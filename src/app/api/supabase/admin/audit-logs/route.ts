import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

/**
 * GET /api/supabase/admin/audit-logs?page=&pageSize=&action=
 *
 * List admin audit logs with the related admin profile. Optional action
 * filter does a case-insensitive contains match.
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
    const action = searchParams.get("action")?.trim() || "";
    const targetType = searchParams.get("targetType")?.trim() || "";
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("admin_audit_logs")
      .select("*, admin:profiles!admin_audit_logs_admin_id_fkey(*)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (action) query = query.ilike("action", `%${action}%`);
    if (targetType) query = query.eq("target_type", targetType);

    query = query.range(skip, skip + take - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error("[admin/audit-logs] list error:", error.message);
      return apiError("Failed to fetch audit logs", 500);
    }

    const total = count || 0;
    return apiSuccess({
      logs: data || [],
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
