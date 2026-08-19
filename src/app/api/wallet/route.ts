import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    // Stats
    const [totalEarned, totalWithdrawn, pendingWithdrawals] = await Promise.all([
      db.walletTransaction.aggregate({
        where: { userId: user.id, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      db.withdrawal.aggregate({
        where: { userId: user.id, status: { in: ["PAID", "PROCESSING", "APPROVED"] } },
        _sum: { amount: true },
      }),
      db.withdrawal.aggregate({
        where: { userId: user.id, status: "PENDING" },
        _sum: { amount: true },
      }),
    ]);

    return apiSuccess({
      balance: user.balance,
      pendingBalance: user.pendingBalance,
      totalEarned: user.totalEarned,
      totalWithdrawn: totalWithdrawn._sum.amount || 0,
      pendingWithdrawals: pendingWithdrawals._sum.amount || 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
