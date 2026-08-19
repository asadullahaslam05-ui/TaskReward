import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { getSettingBool, getSettingNumber, getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const referralEnabled = await getSettingBool("feature.referral_enabled", true);
    const referralReward = await getSettingNumber("referral.reward", 50);
    const referralType = await getSetting("referral.type", "FIXED");
    const referralMax = await getSettingNumber("referral.max_reward", 500);

    // Get referral stats
    const [totalReferrals, activeReferrals, totalEarned] = await Promise.all([
      db.referralEarning.count({ where: { referrerId: user.id } }),
      db.referralEarning.count({
        where: { referrerId: user.id, status: "CREDITED" },
      }),
      db.referralEarning.aggregate({
        where: { referrerId: user.id, status: "CREDITED" },
        _sum: { amount: true },
      }),
    ]);

    const recentReferrals = await db.referralEarning.findMany({
      where: { referrerId: user.id },
      include: {
        referred: {
          select: { username: true, fullName: true, createdAt: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return apiSuccess({
      enabled: referralEnabled,
      reward: referralReward,
      type: referralType,
      maxReward: referralMax,
      referralCode: user.referralCode,
      referralLink: `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${user.referralCode}`,
      stats: {
        totalReferrals,
        activeReferrals,
        totalEarned: totalEarned._sum.amount || 0,
      },
      recentReferrals,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
