import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidUUID } from "@/lib/uuid";
import { isValidUrl } from "@/lib/utils-fin";

/**
 * /api/supabase/membership/payments
 *
 * GET  — list the current user's membership payments.
 * POST — submit a renewal payment proof.
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
      .from("membership_payments")
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

    const planId = (body?.planId || "").toString();
    const paymentMethodId = (body?.paymentMethodId || "").toString();
    const amount = Number(body?.amount);
    const senderName = (body?.senderName || "").toString().trim();
    const senderAccount = (body?.senderAccount || "").toString().trim();
    const transactionId = (body?.transactionId || "").toString().trim();
    const paymentDate = (body?.paymentDate || "").toString().trim();
    const screenshotUrl = (body?.screenshotUrl || "").toString().trim();
    const note = (body?.note || "").toString().trim();

    if (!planId || !isValidUUID(planId)) {
      return apiError("Valid plan ID is required", 400);
    }
    if (!paymentMethodId || !isValidUUID(paymentMethodId)) {
      return apiError("Valid payment method ID is required", 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError("Valid amount is required", 400);
    }
    if (!senderName || !senderAccount || !transactionId || !paymentDate) {
      return apiError(
        "Sender name, account, transaction ID and payment date are required",
        400
      );
    }
    if (!screenshotUrl) {
      return apiError("Screenshot proof is required", 400);
    }
    if (!isValidUrl(screenshotUrl) && !screenshotUrl.startsWith("/uploads/")) {
      return apiError("Invalid screenshot URL", 400);
    }

    const admin = createAdminSupabaseClient();

    // Validate plan
    const { data: plan, error: planErr } = await admin
      .from("membership_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (planErr) return apiError(planErr.message, 500);
    if (!plan || !plan.active) {
      return apiError("Selected plan is not available", 400);
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

    // Look up the user's membership (if any)
    const { data: membership } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Prevent duplicate pending payments
    const { data: existingPending } = await admin
      .from("membership_payments")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .maybeSingle();
    if (existingPending) {
      return apiError(
        "You already have a pending membership payment. Please wait for admin review.",
        400
      );
    }

    const insertRow = {
      user_id: user.id,
      membership_id: membership?.id ?? null,
      plan_id: planId,
      payment_method_id: paymentMethodId,
      amount,
      sender_name: senderName,
      sender_account: senderAccount,
      transaction_id: transactionId,
      payment_date: paymentDate,
      screenshot_url: screenshotUrl,
      note: note || null,
      status: "PENDING",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: payment, error: insertErr } = await admin
      .from("membership_payments")
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
