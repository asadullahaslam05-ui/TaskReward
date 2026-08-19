import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/categories
 * Returns all task categories, each with the count of tasks in that category.
 *
 * POST /api/supabase/admin/categories
 * Creates a new category. Body: { name, description?, active? }
 */
export async function GET() {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("task_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("[admin/categories] list error:", error.message);
      return apiError("Failed to fetch categories", 500);
    }

    // Fetch task counts per category in a single pass.
    const { data: tasks, error: tasksErr } = await admin
      .from("tasks")
      .select("category_id");

    const countByCategory = new Map<string, number>();
    if (!tasksErr && tasks) {
      for (const t of tasks as any[]) {
        if (t.category_id) {
          countByCategory.set(t.category_id, (countByCategory.get(t.category_id) || 0) + 1);
        }
      }
    }

    const enriched = (data || []).map((c: any) => ({
      ...c,
      taskCount: countByCategory.get(c.id) || 0,
    }));

    return apiSuccess(enriched);
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
    if (!body.name) return apiError("name is required", 400);

    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("task_categories")
      .insert({
        name: String(body.name),
        description: body.description ?? null,
        active: body.active ?? true,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[admin/categories] create error:", error.message);
      if (error.code === "23505") {
        return apiError("A category with this name already exists", 409);
      }
      return apiError("Failed to create category", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `CATEGORY_CREATE: ${body.name}`,
        target_type: "CATEGORY",
        target_id: data.id,
        after_data: JSON.stringify(data),
      });
    } catch (e) {
      console.error("[admin/categories] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ ...data, taskCount: 0 }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
