import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidUUID } from "@/lib/uuid";

/**
 * GET /api/supabase/referrals
 *
 * AUTHENTICATED — returns the user's referral code, shareable link, summary
 * stats, and a list of recent referrals.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }
    if (!isValidUUID(user.id)) {
      return apiError("Invalid user id", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch profile to get referral_code
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, referral_code, username")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) return apiError(profileErr.message, 500);
    if (!profile) return apiError("Profile not found", 404);

    const referralCode = profile.referral_code || "";

    // Fetch referral configuration from site_settings so the UI can show
    // whether referrals are enabled, the reward amount, type, and max.
    const { data: refSettings } = await admin
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "feature.referral_enabled",
        "referral.reward",
        "referral.type",
        "referral.max_reward",
      ]);
    const cfgMap: Record<string, string> = {};
    for (const r of refSettings || []) cfgMap[r.key] = r.value ?? "";
    const enabled = cfgMap["feature.referral_enabled"] !== "false";

    // REQUIRED business values — fail closed. Return null if missing/invalid.
    const rewardStr = cfgMap["referral.reward"];
    const rewardNum = rewardStr ? parseFloat(rewardStr) : NaN;
    const reward = Number.isFinite(rewardNum) ? rewardNum : null;

    const maxRewardStr = cfgMap["referral.max_reward"];
    const maxRewardNum = maxRewardStr ? parseFloat(maxRewardStr) : NaN;
    const maxReward = Number.isFinite(maxRewardNum) ? maxRewardNum : null;

    const type = cfgMap["referral.type"] || "FIXED";

    // Collect config errors for missing required business values.
    const configErrors: string[] = [];
    if (reward === null)
      configErrors.push("referral.reward is not configured or invalid");
    if (maxReward === null)
      configErrors.push("referral.max_reward is not configured or invalid");

    // Build referral link (origin from request headers if available)
    const origin = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const referralLink = origin
      ? `${protocol}://${origin}/?ref=${referralCode}`
      : `/?ref=${referralCode}`;

    // Stats: total referrals, active (CREDITED), total earned
    const { data: allReferrals, error: refErr } = await admin
      .from("referrals")
      .select("id, status, created_at, referred_id")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (refErr) return apiError(refErr.message, 500);

    const referralsList = allReferrals || [];

    const totalReferrals = referralsList.length;
    const activeReferrals = referralsList.filter((r: any) => r.status === "CREDITED").length;

    // Get total earned from referral_transactions
    const { data: txnData } = await admin
      .from("referral_transactions")
      .select("amount")
      .eq("referrer_id", user.id)
      .eq("status", "CREDITED");

    const totalEarned = (txnData || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

    // Resolve the referred user info for the most recent 20
    const referredIds = referralsList.slice(0, 20).map((r: any) => r.referred_id).filter(Boolean);
    const referredMap: Record<string, any> = {};
    if (referredIds.length > 0) {
      const { data: referredProfiles } = await admin
        .from("profiles")
        .select("id, username, full_name, status, created_at")
        .in("id", referredIds);
      for (const p of referredProfiles || []) {
        referredMap[p.id] = p;
      }
    }

    const recentReferrals = referralsList.slice(0, 20).map((r: any) => ({
      ...r,
      referred: referredMap[r.referred_id] || null,
    }));

    return apiSuccess({
      enabled,
      reward,
      type,
      maxReward,
      referralCode,
      referralLink,
      stats: {
        totalReferrals,
        activeReferrals,
        totalEarned,
      },
      recentReferrals,
      configErrors,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
