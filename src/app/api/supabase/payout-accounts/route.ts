import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidUUID } from "@/lib/uuid";

/**
 * /api/supabase/payout-accounts
 *
 * GET    — list the user's payout accounts (with payment_method relation).
 * POST   — create a new payout account.
 * DELETE — delete an existing payout account (?id=UUID).
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

    const { data, error } = await admin
      .from("payout_accounts")
      .select("*, payment_method:payment_methods(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess(data || []);
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

    const body = await req.json();

    const paymentMethodId = (body?.paymentMethodId || "").toString();
    const accountHolderName = (body?.accountHolderName || "").toString().trim();
    const accountNumber = (body?.accountNumber || "").toString().trim();
    const walletAddress = (body?.walletAddress || "").toString().trim();
    const network = (body?.network || "").toString().trim();
    const label = (body?.label || "").toString().trim();

    if (!paymentMethodId || !isValidUUID(paymentMethodId)) {
      return apiError("Valid payment method ID is required", 400);
    }

    const admin = createAdminSupabaseClient();

    // Validate payment method
    const { data: method, error: methodErr } = await admin
      .from("payment_methods")
      .select("*")
      .eq("id", paymentMethodId)
      .maybeSingle();
    if (methodErr) return apiError(methodErr.message, 500);
    if (!method || !method.enabled) {
      return apiError("Invalid or disabled payment method", 400);
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

    const insertRow = {
      user_id: user.id,
      payment_method_id: paymentMethodId,
      account_holder_name: accountHolderName || null,
      account_number: accountNumber || null,
      wallet_address: walletAddress || null,
      network: network || method.network || null,
      label: label || null,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: account, error: insertErr } = await admin
      .from("payout_accounts")
      .insert(insertRow)
      .select("*, payment_method:payment_methods(*)")
      .single();

    if (insertErr || !account) {
      return apiError(insertErr?.message || "Failed to create payout account", 400);
    }

    return apiSuccess(account, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
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
    const id = (searchParams.get("id") || "").toString();
    if (!id || !isValidUUID(id)) {
      return apiError("Valid account ID is required", 400);
    }

    const admin = createAdminSupabaseClient();

    // Verify ownership before deleting
    const { data: account } = await admin
      .from("payout_accounts")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!account || account.user_id !== user.id) {
      return apiError("Account not found", 404);
    }

    const { error } = await admin.from("payout_accounts").delete().eq("id", id);
    if (error) return apiError(error.message, 500);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
