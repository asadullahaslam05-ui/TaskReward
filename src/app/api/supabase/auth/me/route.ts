import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return apiError("Not authenticated", 401);
    }

    const admin = createAdminSupabaseClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[auth/me] profile fetch error:", profileError.message);
    }
    if (!profile) {
      return apiError("Profile not found", 404);
    }

    // Return FLAT object matching CurrentUser interface in use-current-user.ts
    return apiSuccess({
      id: profile.id,
      email: profile.email,
      username: profile.username,
      fullName: profile.full_name,
      phone: profile.phone,
      role: profile.role,
      status: profile.status,
      riskLevel: profile.risk_level,
      balance: Number(profile.balance) || 0,
      pendingBalance: Number(profile.pending_balance) || 0,
      totalEarned: Number(profile.total_earned) || 0,
      totalWithdrawn: Number(profile.total_withdrawn) || 0,
      referralCode: profile.referral_code,
      profileImage: profile.profile_image,
      flagged: profile.flagged,
      createdAt: profile.created_at,
      lastLoginAt: profile.last_login_at,
      membership: null,
      membershipActive: false,
      membershipExpired: false,
      membershipExpiringSoon: false,
      membershipDaysUntilExpiry: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
