import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * PATCH /api/supabase/admin/support/[id]
 *
 * Body: { status?, priority?, category?, assignedToId? }
 * Updates a support ticket's status / priority / category / assignment.
 *
 * Pass `status` as one of: OPEN | IN_PROGRESS | WAITING | RESOLVED | CLOSED
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
    if (!id) return apiError("Ticket id required", 400);

    const body = await req.json();
    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/support] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch ticket", 500);
    }
    if (!before) return apiError("Support ticket not found", 404);

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) {
      const valid = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];
      if (!valid.includes(body.status)) {
        return apiError(`Invalid status. Use one of: ${valid.join(", ")}.`, 400);
      }
      update.status = String(body.status);
    }
    if (body.priority !== undefined) {
      const valid = ["LOW", "NORMAL", "HIGH", "URGENT"];
      if (!valid.includes(body.priority)) {
        return apiError(`Invalid priority. Use one of: ${valid.join(", ")}.`, 400);
      }
      update.priority = String(body.priority);
    }
    if (body.category !== undefined) update.category = String(body.category);
    if (body.assignedToId !== undefined) update.assigned_to_id = body.assignedToId || null;

    const { data: updated, error: updateErr } = await admin
      .from("support_tickets")
      .update(update)
      .eq("id", id)
      .select("*, user:profiles!support_tickets_user_id_fkey(*)")
      .maybeSingle();

    if (updateErr) {
      console.error("[admin/support] PATCH update error:", updateErr.message);
      return apiError("Failed to update ticket", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `SUPPORT_TICKET_UPDATE: ${Object.keys(update).filter((k) => k !== "updated_at").join(", ") || "no-changes"}`,
        target_type: "SUPPORT_TICKET",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated || {}),
      });
    } catch (e) {
      console.error("[admin/support] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
