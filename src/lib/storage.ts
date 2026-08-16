/**
 * Shared file-upload / storage helpers.
 *
 * Used by BOTH the server upload route and (type-only) the client. The
 * actual upload happens server-side via the admin Supabase client so we
 * never expose the service-role key to the browser, and the file path is
 * always derived from the authenticated user's UUID — never from a
 * client-supplied user_id.
 */

/** Private buckets that require signed URLs to view. */
export const PRIVATE_BUCKETS = [
  "payment-proofs",
  "task-proofs",
  "payout-proofs",
] as const;

/** Public buckets (read without auth). */
export const PUBLIC_BUCKETS = [
  "profile-images",
  "site-assets",
] as const;

export type PrivateBucket = (typeof PRIVATE_BUCKETS)[number];
export type PublicBucket = (typeof PUBLIC_BUCKETS)[number];
export type AnyBucket = PrivateBucket | PublicBucket;

export function isPrivateBucket(bucket: string): boolean {
  return (PRIVATE_BUCKETS as readonly string[]).includes(bucket);
}

export function isValidBucket(bucket: string): bucket is AnyBucket {
  return (
    (PRIVATE_BUCKETS as readonly string[]).includes(bucket) ||
    (PUBLIC_BUCKETS as readonly string[]).includes(bucket)
  );
}

/** Allowed image MIME types for proof uploads. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Default max file size: 5 MB. */
export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface ValidatedFile {
  file: File;
  mimeType: string;
  extension: string;
}

export interface FileValidationError {
  message: string;
  code: string;
}

/**
 * Validate an uploaded file: MIME type, extension, and size.
 * Returns a descriptive error on failure.
 */
export function validateUploadFile(
  file: File,
  maxBytes: number = DEFAULT_MAX_FILE_SIZE
): { ok: true; validated: ValidatedFile } | { ok: false; error: FileValidationError } {
  if (!file) {
    return { ok: false, error: { message: "No file provided", code: "NO_FILE" } };
  }

  if (file.size === 0) {
    return {
      ok: false,
      error: { message: "File is empty", code: "EMPTY_FILE" },
    };
  }

  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: {
        message: `File is too large. Maximum allowed size is ${mb} MB.`,
        code: "FILE_TOO_LARGE",
      },
    };
  }

  const mimeType = (file.type || "").toLowerCase();
  const ext = ALLOWED_IMAGE_TYPES[mimeType];
  if (!ext) {
    return {
      ok: false,
      error: {
        message: "Unsupported image type. Please upload a JPG, PNG, or WebP image.",
        code: "UNSUPPORTED_TYPE",
      },
    };
  }

  return { ok: true, validated: { file, mimeType, extension: ext } };
}

/**
 * Build a safe, unique storage path for a user-owned proof file.
 *
 * Path structure: `{userUUID}/{prefix}_{timestamp}_{random}.{ext}`
 *
 * - The folder MUST be the authenticated user's UUID so RLS policies
 *   (`auth.uid()::text = (storage.foldername(name))[1]`) can authorize it.
 * - The filename is sanitized and made unique; the original user-supplied
 *   filename is never used (prevents path traversal / collisions).
 */
export function buildStoragePath(
  userUUID: string,
  prefix: string,
  extension: string
): string {
  const safePrefix = prefix
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase()
    .substring(0, 24) || "proof";
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${userUUID}/${safePrefix}_${ts}_${rand}.${safeExt}`;
}
