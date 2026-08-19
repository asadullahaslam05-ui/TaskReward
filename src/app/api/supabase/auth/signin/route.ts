import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  createAdminSupabaseClient,
} from "@/lib/supabase/server";
import { ENV } from "@/lib/env";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * POST /api/supabase/auth/signin
 *
 * Login with email/password. Sets session cookies via @supabase/ssr.
 * - PAYMENT_PENDING users are allowed to sign in (redirect handled client-side).
 * - BANNED / SUSPENDED users are blocked.
 * - If admin setting `auth.email_verification_required` is false, we auto-confirm
 *   the user's email before signing in (so unverified signups can still log in).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();

    if (!email || !password) {
      return apiError("Email and password are required", 400);
    }

    const cookieStore = await cookies();

    // Build an SSR client that can both read AND set cookies on the response.
    // Uses the centralized ENV contract.
    const supabase = createServerClient(
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
              // Called from a context where cookies cannot be set.
            }
          },
        },
      }
    );

    // Look up the profile first so we can enforce status rules BEFORE attempting
    // to issue a session. We use the admin (service-role) client to bypass RLS.
    const admin = createAdminSupabaseClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, status, role")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("[signin] profile lookup error:", profileError.message);
    }

    if (!profile) {
      return apiError("Invalid email or password", 401);
    }

    // Block banned / suspended users
    if (profile.status === "BANNED") {
      return apiError("Your account has been banned. Contact support.", 403);
    }
    if (profile.status === "SUSPENDED") {
      return apiError("Your account is suspended. Contact support.", 403);
    }

    // Check admin setting for email verification requirement
    const { data: verificationSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "auth.email_verification_required")
      .maybeSingle();

    const emailVerificationRequired =
      !verificationSetting || verificationSetting.value === "true";

    // If verification is NOT required, auto-confirm the user's email in Supabase Auth
    // so that signInWithPassword succeeds for users who never verified their email.
    if (!emailVerificationRequired) {
      try {
        // Check if the user's email is confirmed in Supabase Auth
        const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
        if (authUser?.user && !authUser.user.email_confirmed_at) {
          await admin.auth.admin.updateUserById(profile.id, {
            email_confirm: true,
          });
        }
      } catch (err) {
        console.error("[signin] auto-confirm error:", err);
      }
    }

    // Attempt sign-in
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData?.user) {
      return apiError("Invalid email or password", 401);
    }

    // Update last login timestamp
    await admin
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", profile.id);

    // Re-fetch full profile for response payload
    const { data: fullProfile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();

    // Build response with session cookies
    const response = apiSuccess({
      user: authData.user,
      profile: fullProfile,
      requiresPayment: profile.status === "PAYMENT_PENDING",
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
