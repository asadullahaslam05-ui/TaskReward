import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { callRPC } from "@/lib/supabase/db";

/**
 * PATCH /api/supabase/admin/withdrawals/[id]
 *
 * Body options:
 *   { action: "PAID", paymentTransactionId?, paymentProofUrl?, adminNote? }
 *     → calls `mark_withdrawal_paid` RPC.
 *   { action: "REJECTED", adminNote? }
 *     → calls `reject_withdrawal` RPC.
 *   { action: "APPROVED" | "PROCESSING" | "CANCELLED", adminNote? }
 *     → inline status update (no wallet impact).
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
    if (!id) return apiError("Withdrawal id required", 400);

    const body = await req.json();
    const action = String(body.action || "").toUpperCase();
    const adminNote = body.adminNote ? String(body.adminNote) : null;
    const paymentTransactionId = body.paymentTransactionId
      ? String(body.paymentTransactionId)
      : null;
    const paymentProofUrl = body.paymentProofUrl ? String(body.paymentProofUrl) : null;

    const validActions = ["PAID", "REJECTED", "APPROVED", "PROCESSING", "CANCELLED"];
    if (!validActions.includes(action)) {
      return apiError(
        `Invalid action. Use one of: ${validActions.join(", ")}.`,
        400
      );
    }

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("withdrawals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/withdrawals] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch withdrawal", 500);
    }
    if (!before) return apiError("Withdrawal not found", 404);

    const SELECT = "*, user:profiles!withdrawals_user_id_fkey(*), payment_method:payment_methods!withdrawals_payment_method_id_fkey(*)";

    if (action === "PAID") {
      const { data: rpcData, error: rpcErr } = await callRPC("mark_withdrawal_paid", {
        p_withdrawal_id: id,
        p_admin_id: adminProfile.id,
        p_payment_transaction_id: paymentTransactionId,
        p_payment_proof_url: paymentProofUrl,
        p_admin_note: adminNote,
      });
      if (rpcErr) {
        console.error("[admin/withdrawals] mark_paid RPC error:", rpcErr.message);
        return apiError(rpcErr.message || "Failed to mark withdrawal paid", 500);
      }
      // The RPC returns { success: boolean, error?: string } as JSONB.
      if (rpcData && rpcData.success === false) {
        const msg = rpcData.error || "Failed to mark withdrawal paid";
        console.error("[admin/withdrawals] mark_paid RPC business error:", msg);
        return apiError(msg, 400);
      }
      const { data: updated } = await admin
        .from("withdrawals")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: "WITHDRAWAL_PAID",
          target_type: "WITHDRAWAL",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/withdrawals] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ withdrawal: updated, rpc: rpcData });
    }

    if (action === "REJECTED") {
      const { data: rpcData, error: rpcErr } = await callRPC("reject_withdrawal", {
        p_withdrawal_id: id,
        p_admin_id: adminProfile.id,
        p_reason: adminNote,
      });
      if (rpcErr) {
        console.error("[admin/withdrawals] reject RPC error:", rpcErr.message);
        return apiError(rpcErr.message || "Failed to reject withdrawal", 500);
      }
      // The RPC returns { success: boolean, error?: string } as JSONB.
      if (rpcData && rpcData.success === false) {
        const msg = rpcData.error || "Failed to reject withdrawal";
        console.error("[admin/withdrawals] reject RPC business error:", msg);
        return apiError(msg, 400);
      }
      const { data: updated } = await admin
        .from("withdrawals")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: "WITHDRAWAL_REJECTED",
          target_type: "WITHDRAWAL",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/withdrawals] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ withdrawal: updated, rpc: rpcData });
    }

    // Generic status update (APPROVED, PROCESSING, CANCELLED)
    const update: Record<string, any> = {
      status: action,
      admin_note: adminNote,
      reviewed_by_id: adminProfile.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await admin
      .from("withdrawals")
      .update(update)
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (updateErr) {
      console.error("[admin/withdrawals] PATCH update error:", updateErr.message);
      return apiError("Failed to update withdrawal", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `WITHDRAWAL_${action}`,
        target_type: "WITHDRAWAL",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated || {}),
      });
    } catch (e) {
      console.error("[admin/withdrawals] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ withdrawal: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
