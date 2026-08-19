import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidUUID } from "@/lib/uuid";

/**
 * /api/supabase/registration-payments
 *
 * GET  — list the current user's registration payments.
 * POST — submit a new registration payment proof.
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
      .from("registration_payments")
      .select("*, payment_method:payment_methods(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return apiError(error.message, 500);

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
    const senderName = (body?.senderName || "").toString().trim();
    const senderAccount = (body?.senderAccount || "").toString().trim();
    const transactionId = (body?.transactionId || "").toString().trim();
    const amount = Number(body?.amount);
    const paymentDate = (body?.paymentDate || "").toString().trim();
    const screenshotPath = (body?.screenshotPath || "").toString().trim();
    const screenshotBucket = (body?.screenshotBucket || "payment-proofs").toString().trim();
    const note = (body?.note || "").toString().trim();

    if (!paymentMethodId || !isValidUUID(paymentMethodId)) {
      return apiError("Valid payment method ID is required", 400);
    }
    if (!senderName || !senderAccount || !transactionId || !paymentDate) {
      return apiError(
        "Sender name, account, transaction ID and payment date are required",
        400
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError("Valid amount is required", 400);
    }
    if (!screenshotPath) {
      return apiError("Screenshot proof is required", 400);
    }
    // screenshotPath must be a safe storage path (no URL, no traversal).
    if (
      screenshotPath.startsWith("http") ||
      screenshotPath.includes("..") ||
      screenshotPath.startsWith("/")
    ) {
      return apiError("Invalid screenshot path", 400);
    }
    // The path folder MUST be the authenticated user's own UUID.
    const ownerFolder = screenshotPath.split("/")[0] || "";
    if (ownerFolder !== user.id) {
      return apiError("Screenshot ownership mismatch", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch profile to verify status (block already-active users)
    const { data: profile } = await admin
      .from("profiles")
      .select("id, status")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return apiError("Profile not found", 404);
    if (profile.status === "ACTIVE") {
      return apiError("Your account is already active", 400);
    }

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

    // Validate amount against configured registration fee.
    // FAIL CLOSED: if the `registration.fee` setting is missing or invalid,
    // return a clear configuration error rather than silently using a
    // hardcoded fallback amount. The admin must configure the fee before
    // any payment can be submitted.
    const { data: feeSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "registration.fee")
      .maybeSingle();
    const feeStr = (feeSetting?.value || "").toString().trim();
    const expectedFee = parseFloat(feeStr);
    if (!Number.isFinite(expectedFee) || expectedFee <= 0) {
      return apiError(
        "Registration fee is not configured. Please contact the administrator.",
        500
      );
    }
    if (Math.abs(amount - expectedFee) > 1) {
      return apiError(`Amount must be exactly ${expectedFee}`, 400);
    }

    // Block duplicate pending payments
    const { data: existingPending } = await admin
      .from("registration_payments")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .maybeSingle();
    if (existingPending) {
      return apiError(
        "You already have a pending payment. Please wait for admin review.",
        400
      );
    }

    const insertRow = {
      user_id: user.id,
      payment_method_id: paymentMethodId,
      sender_name: senderName,
      sender_account: senderAccount,
      transaction_id: transactionId,
      amount,
      payment_date: paymentDate,
      screenshot_url: screenshotPath,
      note: note || null,
      status: "PENDING",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: payment, error: insertErr } = await admin
      .from("registration_payments")
      .insert(insertRow)
      .select("*, payment_method:payment_methods(*)")
      .single();

    if (insertErr || !payment) {
      return apiError(insertErr?.message || "Failed to submit payment", 400);
    }

    return apiSuccess(payment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
