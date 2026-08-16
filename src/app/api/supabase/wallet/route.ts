import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidUUID } from "@/lib/uuid";

/**
 * GET /api/supabase/wallet
 *
 * AUTHENTICATED — returns the current user's wallet stats.
 */
export async function GET() {
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

    // Fetch the wallet row
    const { data: wallet, error: walletErr } = await admin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletErr) {
      console.error("[wallet] fetch error:", walletErr.message);
    }

    // Aggregate pending withdrawals (status = PENDING)
    const { data: pendingAgg, error: pendingErr } = await admin
      .from("withdrawals")
      .select("amount")
      .eq("user_id", user.id)
      .eq("status", "PENDING");

    const pendingWithdrawals =
      pendingErr || !pendingAgg
        ? 0
        : pendingAgg.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

    const balance = wallet?.balance ?? 0;
    const pendingBalance = wallet?.pending_balance ?? 0;
    const totalEarned = wallet?.total_earned ?? 0;
    const totalWithdrawn = wallet?.total_withdrawn ?? 0;

    return apiSuccess({
      balance,
      pendingBalance,
      totalEarned,
      totalWithdrawn,
      pendingWithdrawals,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
