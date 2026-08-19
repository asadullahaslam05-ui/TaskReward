import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { callRPC } from "@/lib/supabase/db";

/**
 * PATCH /api/supabase/admin/registration-payments/[id]
 *
 * Body: { action: "APPROVED" | "REJECTED", adminNote?: string }
 *
 * Approve calls the `approve_registration_payment` RPC function (which
 * updates the payment status, activates the user's wallet, and emits a
 * wallet_transaction). Reject simply marks the payment as REJECTED.
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
    if (!id) return apiError("Payment id required", 400);

    const body = await req.json();
    const action = String(body.action || "").toUpperCase();
    const adminNote = body.adminNote ? String(body.adminNote) : null;

    if (action !== "APPROVED" && action !== "REJECTED") {
      return apiError("Invalid action. Use APPROVED or REJECTED.", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch current payment for audit context.
    const { data: before, error: beforeErr } = await admin
      .from("registration_payments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/registration-payments] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch payment", 500);
    }
    if (!before) return apiError("Registration payment not found", 404);

    if (action === "APPROVED") {
      // Call the RPC. The DB function is responsible for status flip,
      // user activation, membership creation, and ledger entry.
      const { data: rpcData, error: rpcErr } = await callRPC("approve_registration_payment", {
        p_payment_id: id,
        p_admin_id: adminProfile.id,
        p_admin_note: adminNote,
      });
      if (rpcErr) {
        console.error("[admin/registration-payments] approve RPC error:", rpcErr.message);
        return apiError(rpcErr.message || "Failed to approve payment", 500);
      }
      // The RPC returns { success: boolean, error?: string } as JSONB.
      // A business-rule failure (e.g. monthly limit reached, not pending)
      // comes back as rpcData.success === false, NOT as a PostgREST error.
      if (rpcData && rpcData.success === false) {
        const msg = rpcData.error || "Failed to approve payment";
        console.error("[admin/registration-payments] approve RPC business error:", msg);
        return apiError(msg, 400);
      }
      // Fetch the resulting record for the response.
      const { data: updated } = await admin
        .from("registration_payments")
        .select("*, user:profiles!registration_payments_user_id_fkey(*), payment_method:payment_methods(*)")
        .eq("id", id)
        .maybeSingle();

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: "REGISTRATION_PAYMENT_APPROVED",
          target_type: "REGISTRATION_PAYMENT",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/registration-payments] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ payment: updated, rpc: rpcData });
    }

    // REJECTED branch
    const { data: updated, error: updateErr } = await admin
      .from("registration_payments")
      .update({
        status: "REJECTED",
        admin_note: adminNote,
        reviewed_by_id: adminProfile.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, user:profiles!registration_payments_user_id_fkey(*), payment_method:payment_methods(*)")
      .maybeSingle();

    if (updateErr) {
      console.error("[admin/registration-payments] reject error:", updateErr.message);
      return apiError("Failed to reject payment", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "REGISTRATION_PAYMENT_REJECTED",
        target_type: "REGISTRATION_PAYMENT",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated || {}),
      });
    } catch (e) {
      console.error("[admin/registration-payments] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ payment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
