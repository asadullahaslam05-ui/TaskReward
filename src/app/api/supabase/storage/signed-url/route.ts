import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/uuid";
import { isValidBucket, isPrivateBucket } from "@/lib/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * POST /api/supabase/storage/signed-url
 *
 * Body: { path: string, bucket: string }
 *
 * Generates a short-lived signed URL for a PRIVATE storage object.
 *
 * Authorization:
 *   - The caller must be authenticated.
 *   - For user-owned proof buckets (payment-proofs, task-proofs), the
 *     owner may view their own proof; admins may view any proof.
 *   - For payout-proofs, only ADMIN / SUPER_ADMIN may view.
 *   - For public buckets (profile-images, site-assets), a public URL is
 *     returned instead (no signed URL needed).
 *
 * The signed URL expires after 10 minutes. It is never persisted in the
 * database — clients must request a fresh one each time they need to
 * view a private proof.
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
    // 2. Parse + validate input
    // ----------------------------------------------------------------
    const body = await req.json();
    const path = (body?.path || "").toString().trim();
    const bucket = (body?.bucket || "").toString().trim();

    if (!path) {
      return apiError("Storage path is required", 400);
    }
    // Reject path traversal attempts.
    if (path.includes("..") || path.startsWith("/")) {
      return apiError("Invalid storage path", 400);
    }
    if (!bucket || !isValidBucket(bucket)) {
      return apiError("Invalid or missing storage bucket", 400);
    }

    const admin = createAdminSupabaseClient();

    // ----------------------------------------------------------------
    // 3. Resolve the caller's role for authorization
    // ----------------------------------------------------------------
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      !!profile && (profile.role === "ADMIN" || profile.role === "SUPER_ADMIN");

    // ----------------------------------------------------------------
    // 4. Authorize
    // ----------------------------------------------------------------
    // Extract the owning folder (the first path segment = user UUID).
    const ownerFolder = path.split("/")[0] || "";
    const isOwner = ownerFolder === user.id;

    if (bucket === "payout-proofs") {
      // payout-proofs is admin-only.
      if (!isAdmin) {
        return apiError("You are not authorized to view this file", 403);
      }
    } else if (isPrivateBucket(bucket)) {
      // payment-proofs / task-proofs: owner or admin.
      if (!isOwner && !isAdmin) {
        return apiError("You are not authorized to view this file", 403);
      }
    }
    // public buckets: anyone (including anonymous) can read — but this
    // route still requires auth, which is fine.

    // ----------------------------------------------------------------
    // 5. Generate the URL
    // ----------------------------------------------------------------
    if (!isPrivateBucket(bucket)) {
      // Public bucket → return the public URL (no signing needed).
      const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
      if (!pub?.publicUrl) {
        return apiError("Failed to resolve public URL", 500);
      }
      return apiSuccess({ url: pub.publicUrl, signed: false, expiresInSeconds: 0 });
    }

    // Private bucket → create a signed URL (10 min expiry).
    const expiresIn = 600;
    const { data: signed, error: signedErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (signedErr || !signed?.signedUrl) {
      console.error("[signed-url] error:", signedErr?.message);
      return apiError("Failed to generate a viewable link for this file", 500);
    }

    return apiSuccess({
      url: signed.signedUrl,
      signed: true,
      expiresInSeconds: expiresIn,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
