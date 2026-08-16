import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ENV,
  assertPublicSupabaseConfig,
  assertServerSupabaseConfig,
} from "@/lib/env";
import { AuthError } from "@/lib/session";

/**
 * Supabase client for SERVER-SIDE operations.
 * Uses the publishable (anon) key. Respects RLS policies.
 *
 * IMPORTANT: In Next.js 16, cookies() returns a Promise and must be awaited.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  assertPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(
    ENV.supabaseUrl,
    ENV.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where cookies can't be set.
          }
        },
      },
    }
  );
}

/**
 * Supabase ADMIN client for server-side operations.
 * Uses the SERVICE ROLE key — BYPASSES RLS.
 * ONLY use for admin operations and trusted server logic.
 * NEVER expose this to the browser.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  assertServerSupabaseConfig();
  return createClient(ENV.supabaseUrl, ENV.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get the current authenticated user (server-side).
 */
export async function getSupabaseUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Get the current user's profile (server-side).
 */
export async function getSupabaseProfile() {
  const user = await getSupabaseUser();
  if (!user) return null;

  const admin = createAdminSupabaseClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;
  return profile;
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireSupabaseUser() {
  const user = await getSupabaseUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

/**
 * Require admin role.
 */
export async function requireSupabaseAdmin() {
  const profile = await getSupabaseProfile();
  if (!profile) {
    throw new AuthError("Authentication required", 401);
  }
  if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
    throw new AuthError("Admin access required", 403);
  }
  return profile;
}

// AuthError is imported from @/lib/session at the top of this file so that
// both Prisma-based and Supabase-based routes share a single error class.
// This allows handleApiError() (which checks `instanceof AuthError` from
// @/lib/session) to correctly recognize auth failures thrown here.
export { AuthError };
