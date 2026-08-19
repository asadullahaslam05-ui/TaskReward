import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

/**
 * GET /api/supabase/admin/tasks?page=&pageSize=&status=
 * List tasks with the related category and pagination.
 *
 * POST /api/supabase/admin/tasks
 * Creates a new task. Body fields: title, platform, type, targetUrl,
 * profileUrl?, instructions, reward, status, maxCompletions, startDate?,
 * endDate?, categoryId?, screenshotRequired, textProofRequired,
 * linkProofRequired, priority, visibility, dailyLimit, estimatedTime.
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20;
    const status = searchParams.get("status") || "";
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("tasks")
      .select("*, category:task_categories(*)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    query = query.range(skip, skip + take - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error("[admin/tasks] list error:", error.message);
      return apiError("Failed to fetch tasks", 500);
    }

    const total = count || 0;
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

export async function POST(req: NextRequest) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const body = await req.json();
    if (!body.title || !body.type || !body.targetUrl || !body.instructions) {
      return apiError("title, type, targetUrl and instructions are required", 400);
    }

    const admin = createAdminSupabaseClient();

    // Read the admin-configured default reward + daily limit from site_settings
    // so that if the admin omits reward/dailyLimit, the configured default is
    // used instead of 0.
    const { data: settingsRows } = await admin
      .from("site_settings")
      .select("key, value")
      .in("key", ["tasks.default_reward", "tasks.daily_limit"]);
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows || []) settingsMap[r.key] = r.value;
    const defaultReward = parseFloat(settingsMap["tasks.default_reward"] || "0") || 0;
    const defaultDailyLimit = parseInt(settingsMap["tasks.daily_limit"] || "0", 10) || 0;

    const insert = {
      title: String(body.title),
      platform: body.platform || "TikTok",
      type: String(body.type),
      target_url: String(body.targetUrl),
      profile_url: body.profileUrl ?? null,
      instructions: String(body.instructions),
      reward: Number(body.reward ?? defaultReward),
      status: body.status || "DRAFT",
      max_completions: Number(body.maxCompletions ?? 0),
      current_completions: 0,
      start_date: body.startDate ? new Date(body.startDate).toISOString() : null,
      end_date: body.endDate ? new Date(body.endDate).toISOString() : null,
      category_id: body.categoryId ?? null,
      screenshot_required: body.screenshotRequired ?? true,
      text_proof_required: body.textProofRequired ?? false,
      link_proof_required: body.linkProofRequired ?? false,
      priority: Number(body.priority ?? 0),
      visibility: body.visibility || "PUBLIC",
      daily_limit: Number(body.dailyLimit ?? defaultDailyLimit),
      estimated_time: body.estimatedTime || "2-3 min",
      created_by_id: adminProfile.id,
    };

    const { data, error } = await admin
      .from("tasks")
      .insert(insert)
      .select("*, category:task_categories(*)")
      .single();

    if (error) {
      console.error("[admin/tasks] create error:", error.message);
      return apiError("Failed to create task", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `TASK_CREATE: ${insert.title}`,
        target_type: "TASK",
        target_id: data.id,
        after_data: JSON.stringify(data),
      });
    } catch (e) {
      console.error("[admin/tasks] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
