import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { callRPC } from "@/lib/supabase/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate, getClientIP, getDeviceInfo } from "@/lib/utils-fin";
import { isValidUUID } from "@/lib/uuid";

/**
 * /api/supabase/withdrawals
 *
 * GET  — list the current user's withdrawals (with payment_method relation).
 * POST — create a withdrawal request via the `create_withdrawal` RPC.
 *
 * POST is restricted to ACTIVE users.
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

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("withdrawals")
      .select("*, payment_method:payment_methods(*)", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(skip, skip + take - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) return apiError(error.message, 500);

    const total = count ?? 0;
    return apiSuccess({
      withdrawals: data || [],
      pagination: {
        page,
        pageSize: take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
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

    // Verify ACTIVE user
    const { data: profile } = await admin
      .from("profiles")
      .select("id, status, balance, pending_balance")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return apiError("Profile not found", 404);
    if (profile.status !== "ACTIVE") {
      return apiError("Account not active", 403);
    }

    // Check feature flag
    const { data: wSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "feature.withdrawals_enabled")
      .maybeSingle();
    if (wSetting?.value === "false") {
      return apiError("Withdrawals are currently disabled", 403);
    }

    const body = await req.json();

    const amount = Number(body?.amount);
    const paymentMethodId = (body?.paymentMethodId || "").toString();
    const payoutAccountId = (body?.payoutAccountId || "").toString();
    const accountHolderName = (body?.accountHolderName || "").toString().trim();
    const accountNumber = (body?.accountNumber || "").toString().trim();
    const walletAddress = (body?.walletAddress || "").toString().trim();
    const network = (body?.network || "").toString().trim();
    const note = (body?.note || "").toString().trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError("Valid amount is required", 400);
    }
    if (!paymentMethodId || !isValidUUID(paymentMethodId)) {
      return apiError("Valid payment method ID is required", 400);
    }

    // Validate payment method
    const { data: method } = await admin
      .from("payment_methods")
      .select("*")
      .eq("id", paymentMethodId)
      .maybeSingle();
    if (!method || !method.enabled) {
      return apiError("Invalid payment method", 400);
    }

    // Method-specific validation
    if ((method.code || "").toUpperCase() === "BINANCE") {
      if (!walletAddress) {
        return apiError("Wallet address is required for Binance", 400);
      }
    } else {
      if (!accountHolderName || !accountNumber) {
        return apiError(
          "Account holder name and account number are required",
          400
        );
      }
    }

    // Call RPC function (create_withdrawal) — handles balance reservation
    // and transaction logging atomically on the DB side.
    const { data: result, error: rpcErr } = await callRPC("create_withdrawal", {
      p_user_id: user.id,
      p_amount: amount,
      p_payment_method_id: paymentMethodId,
      p_payout_account_id:
        payoutAccountId && isValidUUID(payoutAccountId) ? payoutAccountId : null,
      p_account_holder: accountHolderName || null,
      p_account_number: accountNumber || null,
      p_wallet_address: walletAddress || null,
      p_network: network || method.network || null,
      p_note: note || null,
      p_ip_address: getClientIP(req),
      p_device_info: getDeviceInfo(req),
    });

    if (rpcErr) {
      return apiError(rpcErr.message || "Failed to create withdrawal", 400);
    }
    if (result && result.success === false) {
      return apiError(result.message || "Withdrawal rejected", 400);
    }

    // Re-fetch the withdrawal with payment_method relation
    const withdrawalId = result?.withdrawal_id || result?.id;
    let withdrawal = result;
    if (withdrawalId) {
      const { data: fullRow } = await admin
        .from("withdrawals")
        .select("*, payment_method:payment_methods(*)")
        .eq("id", withdrawalId)
        .maybeSingle();
      if (fullRow) withdrawal = fullRow;
    }

    return apiSuccess(withdrawal, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
