import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { callRPC } from "@/lib/supabase/db";

/**
 * PATCH /api/supabase/admin/membership-payments/[id]
 *
 * Body: { action: "APPROVED" | "REJECTED", adminNote? }
 *
 * APPROVED → calls `extend_membership` RPC (which also marks the payment
 *   as APPROVED, activates/extends the membership, and emits ledger entries).
 * REJECTED → marks the payment as REJECTED in place.
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
    if (!id) return apiError("Membership payment id required", 400);

    const body = await req.json();
    const action = String(body.action || "").toUpperCase();
    const adminNote = body.adminNote ? String(body.adminNote) : null;

    if (action !== "APPROVED" && action !== "REJECTED") {
      return apiError("Invalid action. Use APPROVED or REJECTED.", 400);
    }

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("membership_payments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/membership-payments] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch membership payment", 500);
    }
    if (!before) return apiError("Membership payment not found", 404);

    const SELECT = "*, user:profiles!membership_payments_user_id_fkey(*), payment_method:payment_methods(*), membership:memberships(*)";

    if (action === "APPROVED") {
      // The extend_membership RPC takes the membership_payment_id and
      // performs the full approve flow (status flip, membership extension,
      // wallet ledger entries).
      const { data: rpcData, error: rpcErr } = await callRPC("extend_membership", {
        p_membership_payment_id: id,
        p_admin_id: adminProfile.id,
      });
      if (rpcErr) {
        console.error("[admin/membership-payments] approve RPC error:", rpcErr.message);
        return apiError(rpcErr.message || "Failed to approve membership payment", 500);
      }
      const { data: updated } = await admin
        .from("membership_payments")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: "MEMBERSHIP_PAYMENT_APPROVED",
          target_type: "MEMBERSHIP_PAYMENT",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/membership-payments] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ payment: updated, rpc: rpcData });
    }

    // REJECTED branch
    const { data: updated, error: updateErr } = await admin
      .from("membership_payments")
      .update({
        status: "REJECTED",
        admin_note: adminNote,
        reviewed_by_id: adminProfile.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (updateErr) {
      console.error("[admin/membership-payments] reject error:", updateErr.message);
      return apiError("Failed to reject membership payment", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "MEMBERSHIP_PAYMENT_REJECTED",
        target_type: "MEMBERSHIP_PAYMENT",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated || {}),
      });
    } catch (e) {
      console.error("[admin/membership-payments] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ payment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
