import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * PATCH /api/supabase/admin/payment-methods/[id]
 * Updates editable fields on a payment method.
 *
 * DELETE /api/supabase/admin/payment-methods/[id]
 * Permanently deletes a payment method. Will fail if foreign-key
 * references exist (registration_payments, withdrawals, etc.) — in
 * that case the admin should disable it via PATCH instead.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { id } = await params;
    if (!id) return apiError("Payment method id required", 400);

    const body = await req.json();

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("payment_methods")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/payment-methods] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch payment method", 500);
    }
    if (!before) return apiError("Payment method not found", 404);

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    const map: Record<string, string> = {
      name: "name",
      description: "description",
      enabled: "enabled",
      accountName: "account_name",
      accountNumber: "account_number",
      walletAddress: "wallet_address",
      network: "network",
      qrCodeUrl: "qr_code_url",
      instructions: "instructions",
      sortOrder: "sort_order",
    };
    for (const [field, column] of Object.entries(map)) {
      if (body[field] !== undefined) update[column] = body[field];
    }

    const { data: updated, error: updateErr } = await admin
      .from("payment_methods")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[admin/payment-methods] PATCH update error:", updateErr.message);
      return apiError("Failed to update payment method", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "PAYMENT_METHOD_UPDATE",
        target_type: "PAYMENT_METHOD",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("[admin/payment-methods] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { id } = await params;
    if (!id) return apiError("Payment method id required", 400);

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("payment_methods")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/payment-methods] DELETE fetch error:", beforeErr.message);
      return apiError("Failed to fetch payment method", 500);
    }
    if (!before) return apiError("Payment method not found", 404);

    const { error: deleteErr } = await admin.from("payment_methods").delete().eq("id", id);
    if (deleteErr) {
      console.error("[admin/payment-methods] DELETE error:", deleteErr.message);
      if (deleteErr.code === "23503") {
        return apiError(
          "Cannot delete: payment method is referenced by existing payments or withdrawals. Disable it instead.",
          409
        );
      }
      return apiError("Failed to delete payment method", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "PAYMENT_METHOD_DELETE",
        target_type: "PAYMENT_METHOD",
        target_id: id,
        before_data: JSON.stringify(before),
      });
    } catch (e) {
      console.error("[admin/payment-methods] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
