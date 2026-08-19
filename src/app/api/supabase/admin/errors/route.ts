import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

/**
 * GET /api/supabase/admin/errors?page=&pageSize=&level=&resolved=
 *
 * Lists recent system errors from the `error_logs` table. Supports
 * filtering by severity level and resolved flag.
 *
 * If the `error_logs` table does not exist, returns an empty list
 * (graceful degradation — the table may not be set up on all installs).
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
    const level = searchParams.get("level") || "";
    const resolved = searchParams.get("resolved");
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("error_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (level) query = query.eq("level", level.toUpperCase());
    if (resolved === "true") query = query.eq("resolved", true);
    else if (resolved === "false") query = query.eq("resolved", false);

    query = query.range(skip, skip + take - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[admin/errors] list error:", error.message);
      // Graceful fallback if the table does not exist
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        return apiSuccess({
          errors: [],
          pagination: { page, pageSize: take, total: 0, totalPages: 1 },
        });
      }
      return apiError("Failed to fetch system errors", 500);
    }

    const total = count || 0;
    return apiSuccess({
      errors: data || [],
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
