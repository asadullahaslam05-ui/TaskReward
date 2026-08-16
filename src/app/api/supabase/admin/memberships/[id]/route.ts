import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { callRPC } from "@/lib/supabase/db";

/**
 * GET /api/supabase/admin/memberships/[id]
 * Returns the membership with plan, user, and payment history.
 *
 * PATCH /api/supabase/admin/memberships/[id]
 * Body options:
 *   { action: "EXTEND", days: number, reason? }
 *     → calls `extend_membership` RPC.
 *   { action: "EXPIRE", reason? }
 *     → sets status = "EXPIRED", end_date = now.
 *   { action: "STATUS", status: "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED" }
 *     → inline status update.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { id } = await params;
    if (!id) return apiError("Membership id required", 400);

    const admin = createAdminSupabaseClient();

    const { data: membership, error: mErr } = await admin
      .from("memberships")
      .select("*, user:profiles!memberships_user_id_fkey(*), plan:membership_plans(*)")
      .eq("id", id)
      .maybeSingle();

    if (mErr) {
      console.error("[admin/memberships] GET error:", mErr.message);
      return apiError("Failed to fetch membership", 500);
    }
    if (!membership) return apiError("Membership not found", 404);

    const { data: payments } = await admin
      .from("membership_payments")
      .select("*, payment_method:payment_methods(*)")
      .eq("membership_id", id)
      .order("created_at", { ascending: false });

    return apiSuccess({
      membership,
      payments: payments || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

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
    if (!id) return apiError("Membership id required", 400);

    const body = await req.json();
    const action = String(body.action || "").toUpperCase();

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("memberships")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/memberships] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch membership", 500);
    }
    if (!before) return apiError("Membership not found", 404);

    const SELECT = "*, user:profiles!memberships_user_id_fkey(*), plan:membership_plans(*)";

    if (action === "EXTEND") {
      const days = Number(body.days);
      if (!Number.isFinite(days) || days <= 0) {
        return apiError("days must be a positive number", 400);
      }
      const { data: rpcData, error: rpcErr } = await callRPC("extend_membership", {
        p_membership_id: id,
        p_days: days,
        p_admin_id: adminProfile.id,
        p_reason: body.reason ? String(body.reason) : null,
      });
      if (rpcErr) {
        console.error("[admin/memberships] extend RPC error:", rpcErr.message);
        return apiError(rpcErr.message || "Failed to extend membership", 500);
      }
      const { data: updated } = await admin
        .from("memberships")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: `MEMBERSHIP_EXTEND: +${days} days`,
          target_type: "MEMBERSHIP",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/memberships] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ membership: updated, rpc: rpcData });
    }

    if (action === "EXPIRE") {
      const nowIso = new Date().toISOString();
      const { data: updated, error: updateErr } = await admin
        .from("memberships")
        .update({
          status: "EXPIRED",
          end_date: nowIso,
          updated_at: nowIso,
        })
        .eq("id", id)
        .select(SELECT)
        .maybeSingle();

      if (updateErr) {
        console.error("[admin/memberships] expire error:", updateErr.message);
        return apiError("Failed to expire membership", 500);
      }

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: "MEMBERSHIP_EXPIRE",
          target_type: "MEMBERSHIP",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/memberships] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ membership: updated });
    }

    if (action === "STATUS") {
      const status = String(body.status || "").toUpperCase();
      const allowed = ["ACTIVE", "PAUSED", "EXPIRED", "CANCELLED"];
      if (!allowed.includes(status)) {
        return apiError(`Invalid status. Use one of: ${allowed.join(", ")}.`, 400);
      }
      const { data: updated, error: updateErr } = await admin
        .from("memberships")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(SELECT)
        .maybeSingle();

      if (updateErr) {
        console.error("[admin/memberships] status update error:", updateErr.message);
        return apiError("Failed to update membership status", 500);
      }

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: `MEMBERSHIP_STATUS: ${status}`,
          target_type: "MEMBERSHIP",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/memberships] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ membership: updated });
    }

    return apiError("Invalid action. Use EXTEND, EXPIRE or STATUS.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
