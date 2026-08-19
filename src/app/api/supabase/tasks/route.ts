import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";
import { isValidUUID } from "@/lib/uuid";

/**
 * GET /api/supabase/tasks
 *
 * AUTHENTICATED — ACTIVE users only.
 * Returns active tasks, filtered to exclude tasks the user has already submitted
 * to (when duplicate prevention is enabled). Includes payment_method relation.
 */
export async function GET(req: NextRequest) {
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

    // Fetch profile to check status
    const { data: profile } = await admin
      .from("profiles")
      .select("id, status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return apiError("Profile not found", 404);
    if (profile.status !== "ACTIVE") {
      return apiError("Account not active", 403);
    }

    // Check feature flag
    const { data: tasksSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "feature.tasks_enabled")
      .maybeSingle();
    if (tasksSetting?.value === "false") {
      return apiError("Tasks are currently disabled", 403);
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const platform = searchParams.get("platform");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const { skip, take } = paginate(page, pageSize);

    // Duplicate prevention setting
    const { data: dupSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "tasks.prevent_duplicates")
      .maybeSingle();
    const preventDuplicates = dupSetting?.value !== "false";

    // Collect already-submitted task IDs
    let submittedTaskIds: string[] = [];
    if (preventDuplicates) {
      const { data: submitted } = await admin
        .from("task_submissions")
        .select("task_id")
        .eq("user_id", user.id);
      submittedTaskIds = (submitted || []).map((s: any) => s.task_id).filter(Boolean);
    }

    // Build base query.
    // NOTE: tasks have a `category_id` FK to task_categories, NOT a
    // payment_method_id. Use the correct relation alias.
    let query = admin
      .from("tasks")
      .select("*, category:task_categories(*)", { count: "exact" })
      .eq("status", "ACTIVE")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .range(skip, skip + take - 1);

    if (platform) query = query.eq("platform", platform);
    if (type) query = query.eq("type", type);
    if (search) {
      query = query.or(`title.ilike.%${search}%,instructions.ilike.%${search}%`);
    }

    if (preventDuplicates && submittedTaskIds.length > 0) {
      // Filter out submitted task IDs (single .not.in is sufficient)
      query = query.not("id", "in", `(${submittedTaskIds.join(",")})`);
    }

    const { data, count, error } = await query;
    if (error) return apiError(error.message, 500);

    const total = count ?? 0;
    return apiSuccess({
      tasks: data || [],
      pagination: {
        page,
        pageSize: take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
