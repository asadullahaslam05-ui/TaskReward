/**
 * Auth Error class — used by both Supabase and legacy auth helpers.
 * Kept here for backward compatibility with api.ts error handling.
 */
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Re-export from Supabase server for convenience
export { getSupabaseUser as getSession } from "@/lib/supabase/server";
export { getSupabaseUser as getCurrentUser } from "@/lib/supabase/server";
export { requireSupabaseUser as requireAuth } from "@/lib/supabase/server";
export { requireSupabaseAdmin as requireAdmin } from "@/lib/supabase/server";
export { requireSupabaseAdmin as requireRole } from "@/lib/supabase/server";
