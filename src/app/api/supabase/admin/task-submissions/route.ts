import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

/**
 * GET /api/supabase/admin/task-submissions?page=&pageSize=&status=
 *
 * List task submissions with the related task and user. Returns a flat
 * array of submissions under `items` plus pagination metadata.
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
      .from("task_submissions")
      .select(
        "*, task:tasks(*), user:profiles!task_submissions_user_id_fkey(*)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    query = query.range(skip, skip + take - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error("[admin/task-submissions] list error:", error.message);
      return apiError("Failed to fetch task submissions", 500);
    }

    const total = count || 0;
    return apiSuccess({
      submissions: data || [],
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
