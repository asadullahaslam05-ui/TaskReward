/**
 * Centralized environment-variable validation for the TaskReward app.
 *
 * Single source of truth for the Supabase environment contract:
 *   - NEXT_PUBLIC_SUPABASE_URL            (public, browser-safe)
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public, browser-safe)
 *   - SUPABASE_SECRET_KEY                  (server-only, bypasses RLS)
 *
 * Importing this module guarantees that a missing/malformed variable is
 * reported with a clear, actionable error instead of a deep, confusing
 * crash such as "supabaseUrl is required" inside a user-facing component.
 */

/** Whether the current runtime is the browser (not the server). */
const IS_BROWSER = typeof window !== "undefined";

export const ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
} as const;

/** True when the two PUBLIC Supabase variables are present. */
export function hasPublicSupabaseConfig(): boolean {
  return ENV.supabaseUrl.length > 0 && ENV.supabasePublishableKey.length > 0;
}

/** True when the server-only secret key is present. */
export function hasServerSupabaseConfig(): boolean {
  return ENV.supabaseSecretKey.length > 0;
}

/**
 * Assert that the PUBLIC Supabase variables are configured.
 * Safe to call from browser or server code.
 * Throws an Error with a developer-friendly message (no secret values).
 */
export function assertPublicSupabaseConfig(): void {
  if (hasPublicSupabaseConfig()) return;

  const missing: string[] = [];
  if (!ENV.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!ENV.supabasePublishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  throw new Error(
    `Supabase configuration is missing. Please configure the required environment variables: ${missing.join(", ")}.` +
      (IS_BROWSER
        ? " If you are an administrator, add them to the server .env file and rebuild."
        : " Add them to your .env file and restart the dev server.")
  );
}

/**
 * Assert that the SERVER-ONLY Supabase secret is configured.
 * Must NEVER be called from client code.
 */
export function assertServerSupabaseConfig(): void {
  if (IS_BROWSER) {
    throw new Error(
      "Server-only Supabase configuration was requested from the browser. This is a bug."
    );
  }
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey || !ENV.supabaseSecretKey) {
    const missing: string[] = [];
    if (!ENV.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!ENV.supabasePublishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    if (!ENV.supabaseSecretKey) missing.push("SUPABASE_SECRET_KEY");
    throw new Error(
      `Supabase server configuration is missing. Required variables: ${missing.join(", ")}. ` +
        "Add them to your .env file and restart the dev server."
    );
  }
}

/** The Supabase project hostname (for diagnostics / health pages). Never exposes keys. */
export function supabaseProjectHost(): string {
  try {
    return ENV.supabaseUrl ? new URL(ENV.supabaseUrl).host : "(not configured)";
  } catch {
    return "(invalid URL)";
  }
}
