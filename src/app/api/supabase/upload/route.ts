import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/uuid";
import {
  isValidBucket,
  isPrivateBucket,
  validateUploadFile,
  buildStoragePath,
  DEFAULT_MAX_FILE_SIZE,
} from "@/lib/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * POST /api/supabase/upload
 *
 * Upload a file to Supabase Storage via the authenticated server endpoint.
 *
 * Body: multipart/form-data
 *   - file:    File (required)
 *   - bucket:  string (required) — one of the project's allowed buckets
 *   - prefix:  string (optional) — filename prefix, sanitized server-side
 *
 * Security model:
 *   - Requires an authenticated Supabase user (anon-key session via cookies).
 *   - The storage PATH is derived server-side from the authenticated user's
 *     UUID — NEVER from a client-supplied user id — so the existing storage
 *     RLS policy (`auth.uid()::text = (storage.foldername(name))[1]`) can
 *     authorize it.
 *   - Upload happens through the admin (service-role) client which bypasses
 *     RLS for the write. This is intentional: it lets us place the object in
 *     the user-owned folder even though the browser cannot. The object is
 *     still PRIVATE (signed URLs required to view) because `payment-proofs`
 *     and friends are private buckets.
 *   - The service-role key is never exposed to the browser.
 *   - Bucket names are validated against the project's allowed-bucket list.
 *
 * Returns: { path, bucket, filename, size, mimeType, private }
 */
export async function POST(req: NextRequest) {
  try {
    // ----------------------------------------------------------------
    // 1. Authenticate
    // ----------------------------------------------------------------
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }
    if (!isValidUUID(user.id)) {
      return apiError("Invalid user id", 400);
    }

    // ----------------------------------------------------------------
    // 2. Parse multipart/form-data
    // ----------------------------------------------------------------
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return apiError("Invalid request: expected multipart/form-data", 400);
    }

    const file = formData.get("file");
    const bucket = (formData.get("bucket") || "").toString().trim();
    const prefix = (formData.get("prefix") || "proof").toString().trim();

    if (!(file instanceof File)) {
      return apiError("No file provided", 400);
    }
    if (!bucket || !isValidBucket(bucket)) {
      return apiError("Invalid or missing storage bucket", 400);
    }

    // payout-proofs is admin-only — regular users may not upload to it.
    if (bucket === "payout-proofs") {
      const admin = createAdminSupabaseClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const isAdmin =
        !!profile && (profile.role === "ADMIN" || profile.role === "SUPER_ADMIN");
      if (!isAdmin) {
        return apiError("You are not authorized to upload to this bucket", 403);
      }
    }

    // ----------------------------------------------------------------
    // 3. Validate the file (type, extension, size)
    // ----------------------------------------------------------------
    const validation = validateUploadFile(file, DEFAULT_MAX_FILE_SIZE);
    if (!validation.ok) {
      return apiError(validation.error.message, 400, validation.error.code);
    }
    const { mimeType, extension } = validation.validated;

    // ----------------------------------------------------------------
    // 4. Build a safe, user-owned storage path
    //    {userUUID}/{prefix}_{ts}_{rand}.{ext}
    // ----------------------------------------------------------------
    const storagePath = buildStoragePath(user.id, prefix, extension);

    // ----------------------------------------------------------------
    // 5. Upload through the server-side admin client (service role).
    //    upsert:false so we never silently overwrite an existing object;
    //    if the (extremely unlikely) path collides, we retry once.
    // ----------------------------------------------------------------
    const admin = createAdminSupabaseClient();
    let attempt = 0;
    let pathToUse = storagePath;
    let uploadError: any = null;

    while (attempt < 2) {
      const { error } = await admin.storage
        .from(bucket)
        .upload(pathToUse, file, {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: false,
        });

      if (!error) {
        uploadError = null;
        break;
      }

      // Retry only on a name collision.
      if (error?.name === "StorageError" && /already exists/i.test(error.message || "")) {
        attempt++;
        pathToUse = buildStoragePath(user.id, prefix, extension);
        continue;
      }

      uploadError = error;
      break;
    }

    if (uploadError) {
      console.error("[upload] storage upload failed:", {
        bucket,
        message: uploadError.message,
        path: pathToUse,
      });
      return apiError("Failed to upload file. Please try again.", 500);
    }

    // ----------------------------------------------------------------
    // 6. Return the stored path + safe metadata. Never return a URL for
    //    private buckets — clients must request a signed URL separately.
    // ----------------------------------------------------------------
    return apiSuccess({
      path: pathToUse,
      bucket,
      filename: pathToUse.split("/").pop() || "",
      size: file.size,
      mimeType,
      private: isPrivateBucket(bucket),
    });
  } catch (error) {
    // Log full error server-side; never leak secrets/config to the client.
    console.error("[upload] unexpected error:", error);
    return handleApiError(error);
  }
}
