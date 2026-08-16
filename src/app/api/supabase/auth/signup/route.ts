import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidEmail } from "@/lib/utils-fin";

/**
 * POST /api/supabase/auth/signup
 *
 * Create a new user via Supabase Auth (admin API), then UPSERT the
 * matching `profiles` row with status = PAYMENT_PENDING.
 *
 * NOTE: A database trigger (`handle_new_user`) auto-creates a minimal
 * `profiles` row + `wallets` row whenever a Supabase Auth user is created.
 * We therefore UPSERT (not INSERT) to enrich that row with the remaining
 * fields (phone, referral_code, referred_by_id, …) without conflicting.
 *
 * - Auto-confirms the user's email if the admin setting
 *   `auth.email_verification_required` is false.
 * - Resolves optional referral code (case-insensitive), creating a
 *   referral record that points at the new user.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();
    const fullName = (body?.fullName || "").toString().trim();
    const username = (body?.username || "").toString().trim();
    const phone = (body?.phone || "").toString().trim();
    const referralCode = (body?.referralCode || "").toString().trim();

    if (!email || !password) {
      return apiError("Email and password are required", 400);
    }
    if (!isValidEmail(email)) {
      return apiError("Invalid email address", 400);
    }
    if (password.length < 6) {
      return apiError("Password must be at least 6 characters", 400);
    }
    if (!username || username.length < 3) {
      return apiError("Username must be at least 3 characters", 400);
    }
    if (!fullName || fullName.length < 2) {
      return apiError("Full name is required", 400);
    }

    const admin = createAdminSupabaseClient();

    // Check if registration is enabled
    const { data: registrationSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "feature.registration_enabled")
      .maybeSingle();
    const registrationEnabled =
      !registrationSetting || registrationSetting.value !== "false";
    if (!registrationEnabled) {
      return apiError("Registration is currently disabled", 403);
    }

    // Check admin setting for email verification requirement
    const { data: verificationSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "auth.email_verification_required")
      .maybeSingle();
    const emailVerificationRequired =
      !verificationSetting || verificationSetting.value === "true";

    // Pre-flight uniqueness checks
    const { data: existingEmail } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingEmail) {
      return apiError("An account with this email already exists", 409);
    }

    const { data: existingUsername } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existingUsername) {
      return apiError("This username is already taken", 409);
    }

    // Create the user in Supabase Auth via admin API.
    // This fires the `on_auth_user_created` trigger which inserts a minimal
    // profiles row + wallets row.
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: !emailVerificationRequired,
        user_metadata: {
          full_name: fullName,
          username,
          phone,
        },
      });

    if (createErr || !created?.user) {
      // Map common Supabase Auth errors to friendly messages.
      const msg = createErr?.message || "Failed to create user";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already been registered")) {
        return apiError("An account with this email already exists", 409);
      }
      if (msg.toLowerCase().includes("password")) {
        return apiError("Password is too weak. Use at least 6 characters.", 400);
      }
      return apiError(msg, 400);
    }

    const userId = created.user.id;

    // Resolve referral code (if provided)
    let referrerId: string | null = null;
    if (referralCode) {
      const { data: referrer } = await admin
        .from("profiles")
        .select("id, referral_code")
        .eq("referral_code", referralCode)
        .maybeSingle();
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    // Generate a unique referral code for the new user
    const newReferralCode = await generateUniqueReferralCode(admin, username);

    // UPSERT the profile row (the trigger already created a minimal row).
    // Field names MUST match the migration schema exactly:
    //   referred_by_id (not referred_by)
    //   risk_level enum: NORMAL | WATCH | FLAGGED | SUSPENDED | BANNED (no "LOW")
    //   no email_verified column exists
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          username,
          full_name: fullName,
          phone,
          role: "USER",
          status: "PAYMENT_PENDING",
          referral_code: newReferralCode,
          referred_by_id: referrerId,
          balance: 0,
          pending_balance: 0,
          total_earned: 0,
          total_withdrawn: 0,
          risk_level: "NORMAL",
          flagged: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (profileErr) {
      console.error("[signup] profile upsert error:", profileErr.message);
      // Best-effort cleanup: delete the auth user if profile upsert fails
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // ignore
      }
      return apiError(profileErr.message || "Failed to create profile", 400);
    }

    // UPSERT the wallet row (the trigger already created one).
    const { error: walletErr } = await admin
      .from("wallets")
      .upsert(
        {
          user_id: userId,
          balance: 0,
          pending_balance: 0,
          total_earned: 0,
          total_withdrawn: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (walletErr) {
      console.error("[signup] wallet upsert error:", walletErr.message);
    }

    // Create referral record (referrals table: referrer_id, referred_id, status — no reward_amount column)
    if (referrerId) {
      try {
        await admin.from("referrals").insert({
          referrer_id: referrerId,
          referred_id: userId,
          status: "PENDING",
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[signup] referral creation error:", err);
      }
    }

    return apiSuccess(
      {
        userId,
        email,
        username,
        referralCode: newReferralCode,
        requiresPayment: true,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Generate a unique referral code based on the username.
 * Retries with a numeric suffix until a unique code is found.
 */
async function generateUniqueReferralCode(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  username: string
): Promise<string> {
  const base = username
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 6)
    .padEnd(4, "X");

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const candidate = `${base}${suffix}`;
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }

  // Fallback - extremely unlikely
  return `${base}${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
