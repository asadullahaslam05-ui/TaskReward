import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/tasks/[id]
 * Returns task details with category and submission count.
 *
 * PATCH /api/supabase/admin/tasks/[id]
 * Updates editable task fields.
 *
 * DELETE /api/supabase/admin/tasks/[id]
 * Deletes a task (will fail if submissions reference it).
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
    if (!id) return apiError("Task id required", 400);

    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("tasks")
      .select("*, category:task_categories(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[admin/tasks] GET error:", error.message);
      return apiError("Failed to fetch task", 500);
    }
    if (!data) return apiError("Task not found", 404);

    // Submission count via head+exact
    const { count: submissionCount } = await admin
      .from("task_submissions")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id);

    return apiSuccess({ ...data, submissionCount: submissionCount || 0 });
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
    if (!id) return apiError("Task id required", 400);

    const body = await req.json();
    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/tasks] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch task", 500);
    }
    if (!before) return apiError("Task not found", 404);

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    const map: Record<string, string> = {
      title: "title",
      platform: "platform",
      type: "type",
      targetUrl: "target_url",
      profileUrl: "profile_url",
      instructions: "instructions",
      reward: "reward",
      status: "status",
      maxCompletions: "max_completions",
      currentCompletions: "current_completions",
      categoryId: "category_id",
      screenshotRequired: "screenshot_required",
      textProofRequired: "text_proof_required",
      linkProofRequired: "link_proof_required",
      priority: "priority",
      visibility: "visibility",
      dailyLimit: "daily_limit",
      estimatedTime: "estimated_time",
    };
    if (body.startDate !== undefined) update.start_date = body.startDate ? new Date(body.startDate).toISOString() : null;
    if (body.endDate !== undefined) update.end_date = body.endDate ? new Date(body.endDate).toISOString() : null;
    for (const [field, column] of Object.entries(map)) {
      if (body[field] !== undefined) update[column] = body[field];
    }

    const { data: updated, error: updateErr } = await admin
      .from("tasks")
      .update(update)
      .eq("id", id)
      .select("*, category:task_categories(*)")
      .single();

    if (updateErr) {
      console.error("[admin/tasks] PATCH update error:", updateErr.message);
      return apiError("Failed to update task", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "TASK_UPDATE",
        target_type: "TASK",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("[admin/tasks] audit log failed:", (e as Error)?.message);
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
    if (!id) return apiError("Task id required", 400);

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/tasks] DELETE fetch error:", beforeErr.message);
      return apiError("Failed to fetch task", 500);
    }
    if (!before) return apiError("Task not found", 404);

    const { error: deleteErr } = await admin.from("tasks").delete().eq("id", id);
    if (deleteErr) {
      console.error("[admin/tasks] DELETE error:", deleteErr.message);
      if (deleteErr.code === "23503") {
        return apiError(
          "Cannot delete: task has submissions. Archive it instead.",
          409
        );
      }
      return apiError("Failed to delete task", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `TASK_DELETE: ${before.title}`,
        target_type: "TASK",
        target_id: id,
        before_data: JSON.stringify(before),
      });
    } catch (e) {
      console.error("[admin/tasks] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
