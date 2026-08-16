import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { getClientIP, getDeviceInfo } from "@/lib/utils-fin";
import { isValidUUID } from "@/lib/uuid";

/**
 * /api/supabase/tasks/[id]
 *
 * GET  — fetch a single task (with category) + eligibility info.
 * POST — submit proof for the task.
 *
 * Next.js 16 dynamic route signature: params is a Promise.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return apiError("Invalid task ID", 400);
    }

    const admin = createAdminSupabaseClient();

    const { data: task, error } = await admin
      .from("tasks")
      .select("*, category:task_categories(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) return apiError(error.message, 500);
    if (!task) return apiError("Task not found", 404);

    // Fetch profile to determine role + status
    const { data: profile } = await admin
      .from("profiles")
      .select("id, status, role")
      .eq("id", user.id)
      .maybeSingle();

    // If the task is not ACTIVE and the user is a regular user, hide it.
    if (
      task.status !== "ACTIVE" &&
      (!profile || (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN"))
    ) {
      return apiError("Task not available", 404);
    }

    // Eligibility: did this user already submit?
    const { data: mySubmission } = await admin
      .from("task_submissions")
      .select("*")
      .eq("task_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    // Determine eligibility flags
    const isActiveUser = profile?.status === "ACTIVE";
    const alreadySubmitted = !!mySubmission;
    const reachedMaxCompletions =
      task.max_completions > 0 &&
      (task.current_completions || 0) >= task.max_completions;

    const eligible = isActiveUser && !alreadySubmitted && !reachedMaxCompletions;

    return apiSuccess({
      ...task,
      mySubmission: mySubmission || null,
      eligibility: {
        eligible,
        isActiveUser,
        alreadySubmitted,
        reachedMaxCompletions,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    if (!isValidUUID(id)) {
      return apiError("Invalid task ID", 400);
    }

    const admin = createAdminSupabaseClient();

    // Verify active user
    const { data: profile } = await admin
      .from("profiles")
      .select("id, status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return apiError("Profile not found", 404);
    if (profile.status !== "ACTIVE") {
      return apiError("Account not active", 403);
    }

    // Verify task
    const { data: task, error: taskErr } = await admin
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (taskErr) return apiError(taskErr.message, 500);
    if (!task) return apiError("Task not found", 404);
    if (task.status !== "ACTIVE") return apiError("Task is not active", 400);

    // Check max completions
    if (
      task.max_completions > 0 &&
      (task.current_completions || 0) >= task.max_completions
    ) {
      return apiError("Task has reached maximum completions", 400);
    }

    const body = await req.json();

    // Validate proof fields
    if (task.screenshot_required && !body?.screenshotUrl) {
      return apiError("Screenshot proof is required", 400);
    }
    if (task.text_proof_required && !body?.textProof) {
      return apiError("Text proof is required", 400);
    }
    if (task.link_proof_required && !body?.linkProof) {
      return apiError("Link proof is required", 400);
    }

    // Validate screenshot path if provided (must be a private storage path,
    // not a URL). The owner folder must be the authenticated user.
    const screenshotUrl = (body?.screenshotUrl || "").toString().trim();
    if (screenshotUrl) {
      if (
        screenshotUrl.startsWith("http") ||
        screenshotUrl.includes("..") ||
        screenshotUrl.startsWith("/")
      ) {
        return apiError("Invalid screenshot path", 400);
      }
      const ownerFolder = screenshotUrl.split("/")[0] || "";
      if (ownerFolder !== user.id) {
        return apiError("Screenshot ownership mismatch", 400);
      }
    }

    // Duplicate prevention
    const { data: dupSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "tasks.prevent_duplicates")
      .maybeSingle();
    const preventDuplicates = dupSetting?.value !== "false";
    if (preventDuplicates) {
      const { data: existing } = await admin
        .from("task_submissions")
        .select("id")
        .eq("task_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        return apiError("You have already submitted this task", 400);
      }
    }

    // Daily limit
    const { data: dailyLimitSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "tasks.daily_limit")
      .maybeSingle();
    const dailyLimit = parseInt(dailyLimitSetting?.value || "20", 10);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { count: todayCount } = await admin
      .from("task_submissions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfToday.toISOString());

    if ((todayCount || 0) >= dailyLimit) {
      return apiError(
        `Daily task limit (${dailyLimit}) reached. Try again tomorrow.`,
        400
      );
    }

    // Insert submission
    const insertRow = {
      task_id: id,
      user_id: user.id,
      screenshot_url: screenshotUrl || null,
      text_proof: body?.textProof ? String(body.textProof) : null,
      link_proof: body?.linkProof ? String(body.linkProof) : null,
      status: "PENDING",
      ip_address: getClientIP(req),
      device_info: getDeviceInfo(req),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: submission, error: insertErr } = await admin
      .from("task_submissions")
      .insert(insertRow)
      .select("*, task:tasks(*, category:task_categories(*))")
      .single();

    if (insertErr || !submission) {
      return apiError(insertErr?.message || "Failed to submit task", 400);
    }

    // Increment task completion count
    await admin
      .from("tasks")
      .update({
        current_completions: (task.current_completions || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return apiSuccess(submission, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
