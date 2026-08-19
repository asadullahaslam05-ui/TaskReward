import { NextRequest } from "next/server";
import { getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { callRPC } from "@/lib/supabase/db";

/**
 * POST /api/supabase/admin/balance-adjustment
 *
 * Body: { userId, amount, reason, type? }
 *   - amount: positive number
 *   - type: "add" (default) or "remove" — controls the sign of the adjustment
 *
 * Calls the `admin_adjust_balance` RPC function which performs the
 * adjustment atomically (wallet update + ledger entry + idempotency
 * check) and returns the new balance.
 */
export async function POST(req: NextRequest) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const body = await req.json();
    const { userId, amount, reason, type } = body;

    if (!userId) return apiError("userId is required", 400);
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return apiError("reason is required", 400);
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      return apiError("amount must be a non-zero number", 400);
    }

    // Apply sign based on type
    const signedAmount = type === "remove" ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    const { data, error } = await callRPC("admin_adjust_balance", {
      p_user_id: userId,
      p_amount: signedAmount,
      p_reason: String(reason),
      p_admin_id: adminProfile.id,
    });

    if (error) {
      console.error("[admin/balance-adjustment] RPC error:", error.message);
      return apiError(error.message || "Failed to adjust balance", 500);
    }

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
