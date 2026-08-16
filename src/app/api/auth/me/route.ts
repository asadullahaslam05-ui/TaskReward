import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Not authenticated", 401);
    }
    return apiSuccess({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      riskLevel: user.riskLevel,
      balance: user.balance,
      pendingBalance: user.pendingBalance,
      totalEarned: user.totalEarned,
      totalWithdrawn: user.totalWithdrawn,
      referralCode: user.referralCode,
      profileImage: user.profileImage,
      flagged: user.flagged,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
