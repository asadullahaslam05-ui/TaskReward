"use client";

/**
 * Client-side API helpers for making authenticated requests.
 */

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

export async function apiPatch<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE" });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

export interface UploadResult {
  path: string;
  bucket: string;
  filename: string;
  size: number;
  mimeType: string;
  private: boolean;
}

/**
 * Upload a file to Supabase Storage via the authenticated server endpoint.
 *
 * The bucket must be one of the allowed buckets (payment-proofs,
 * task-proofs, payout-proofs, profile-images, site-assets). The server
 * derives the storage path from the authenticated user's UUID — never
 * from a client-supplied id.
 *
 * Returns the storage PATH (not a public URL). Private files are viewed
 * via `getSignedUrl()`.
 */
export async function uploadFile(
  file: File,
  bucket: string = "payment-proofs",
  prefix: string = "proof"
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  formData.append("prefix", prefix);
  const res = await fetch("/api/supabase/upload", {
    method: "POST",
    body: formData,
    // NOTE: do NOT set Content-Type — the browser sets the multipart
    // boundary automatically for FormData.
  });
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(
      res.status === 404
        ? "Upload service is unavailable. Please try again later."
        : "Unable to upload screenshot. Please check your connection and try again."
    );
  }
  if (!json.success) {
    throw new Error(json.error || "Upload failed");
  }
  return json.data as UploadResult;
}

/**
 * Request a short-lived signed URL for a private storage object.
 * Requires authentication; the server enforces ownership / admin checks.
 */
export async function getSignedUrl(
  path: string,
  bucket: string
): Promise<string> {
  const res = await fetch("/api/supabase/storage/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, bucket }),
  });
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error("Unable to load this file. Please try again.");
  }
  if (!json.success) {
    throw new Error(json.error || "Failed to generate a viewable link");
  }
  return json.data.url as string;
}
