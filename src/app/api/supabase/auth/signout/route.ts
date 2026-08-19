import { createServerSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * POST /api/supabase/auth/signout
 *
 * Sign out the current user from Supabase Auth and clear session cookies.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return apiError(error.message || "Failed to sign out", 400);
    }

    return apiSuccess({ signedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
