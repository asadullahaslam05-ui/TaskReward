import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * POST /api/supabase/profile/password
 *
 * Change the authenticated user's password. Requires the current password
 * for verification. Uses the browser Supabase client's session to call
 * `auth.updateUser` so the user's own session is used (not the service
 * role key).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const body = await req.json();
    const currentPassword = (body?.currentPassword || "").toString();
    const newPassword = (body?.newPassword || "").toString();

    if (!currentPassword || !newPassword) {
      return apiError("Current password and new password are required", 400);
    }
    if (newPassword.length < 6) {
      return apiError("New password must be at least 6 characters", 400);
    }

    // Verify the current password by re-signing in. This prevents a user
    // with a stolen session cookie from changing the password without
    // knowing the current one.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || "",
      password: currentPassword,
    });

    if (signInError) {
      return apiError("Current password is incorrect", 400);
    }

    // Update the password.
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[profile/password] update error:", updateError.message);
      return apiError(updateError.message || "Failed to change password", 400);
    }

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
