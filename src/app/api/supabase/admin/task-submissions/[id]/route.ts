import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { callRPC } from "@/lib/supabase/db";

/**
 * PATCH /api/supabase/admin/task-submissions/[id]
 *
 * Body: { action: "APPROVED" | "REJECTED" | "FLAGGED", adminNote?: string }
 *
 * APPROVED → calls `approve_task_submission` RPC (credits the user's wallet,
 * increments task counters, marks submission approved).
 * REJECTED → calls `reject_task_submission` RPC.
 * FLAGGED → updates the row in place (no wallet impact).
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
    if (!id) return apiError("Submission id required", 400);

    const body = await req.json();
    const action = String(body.action || "").toUpperCase();
    const adminNote = body.adminNote ? String(body.adminNote) : null;

    if (!["APPROVED", "REJECTED", "FLAGGED"].includes(action)) {
      return apiError("Invalid action. Use APPROVED, REJECTED or FLAGGED.", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch current submission for audit context.
    const { data: before, error: beforeErr } = await admin
      .from("task_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/task-submissions] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch submission", 500);
    }
    if (!before) return apiError("Task submission not found", 404);

    if (action === "APPROVED") {
      const { data: rpcData, error: rpcErr } = await callRPC("approve_task_submission", {
        p_submission_id: id,
        p_admin_id: adminProfile.id,
      });
      if (rpcErr) {
        console.error("[admin/task-submissions] approve RPC error:", rpcErr.message);
        return apiError(rpcErr.message || "Failed to approve submission", 500);
      }
      // The RPC returns { success: boolean, error?: string } as JSONB.
      // A business-rule failure (already processed, reward already credited)
      // comes back as rpcData.success === false, NOT as a PostgREST error.
      if (rpcData && rpcData.success === false) {
        const msg = rpcData.error || "Failed to approve submission";
        console.error("[admin/task-submissions] approve RPC business error:", msg);
        return apiError(msg, 400);
      }
      const { data: updated } = await admin
        .from("task_submissions")
        .select("*, task:tasks(*), user:profiles!task_submissions_user_id_fkey(*)")
        .eq("id", id)
        .maybeSingle();

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: "TASK_SUBMISSION_APPROVED",
          target_type: "TASK_SUBMISSION",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/task-submissions] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ submission: updated, rpc: rpcData });
    }

    if (action === "REJECTED") {
      const { data: rpcData, error: rpcErr } = await callRPC("reject_task_submission", {
        p_submission_id: id,
        p_admin_id: adminProfile.id,
        p_reason: adminNote,
      });
      if (rpcErr) {
        console.error("[admin/task-submissions] reject RPC error:", rpcErr.message);
        return apiError(rpcErr.message || "Failed to reject submission", 500);
      }
      // The RPC returns { success: boolean, error?: string } as JSONB.
      if (rpcData && rpcData.success === false) {
        const msg = rpcData.error || "Failed to reject submission";
        console.error("[admin/task-submissions] reject RPC business error:", msg);
        return apiError(msg, 400);
      }
      const { data: updated } = await admin
        .from("task_submissions")
        .select("*, task:tasks(*), user:profiles!task_submissions_user_id_fkey(*)")
        .eq("id", id)
        .maybeSingle();

      try {
        await admin.from("admin_audit_logs").insert({
          admin_id: adminProfile.id,
          action: "TASK_SUBMISSION_REJECTED",
          target_type: "TASK_SUBMISSION",
          target_id: id,
          before_data: JSON.stringify(before),
          after_data: JSON.stringify(updated || {}),
        });
      } catch (e) {
        console.error("[admin/task-submissions] audit log failed:", (e as Error)?.message);
      }

      return apiSuccess({ submission: updated, rpc: rpcData });
    }

    // FLAGGED branch — inline update, no wallet impact
    const { data: updated, error: updateErr } = await admin
      .from("task_submissions")
      .update({
        status: "FLAGGED",
        admin_note: adminNote,
        reviewed_by_id: adminProfile.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, task:tasks(*), user:profiles!task_submissions_user_id_fkey(*)")
      .maybeSingle();

    if (updateErr) {
      console.error("[admin/task-submissions] flag error:", updateErr.message);
      return apiError("Failed to flag submission", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "TASK_SUBMISSION_FLAGGED",
        target_type: "TASK_SUBMISSION",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated || {}),
      });
    } catch (e) {
      console.error("[admin/task-submissions] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ submission: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
