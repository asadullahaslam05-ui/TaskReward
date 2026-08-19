import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

/**
 * GET /api/supabase/admin/users?page=&pageSize=&search=&status=&role=
 *
 * List user profiles with optional search (email/username/full_name/phone),
 * filter by status/role, and pagination.
 *
 * Returns a flat array of users under `items` plus pagination metadata.
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
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const role = searchParams.get("role") || "";
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    // Build a count query and a data query sharing the same filters.
    const buildQuery = (withPaging: boolean) => {
      let q = admin.from("profiles").select("*", { count: "exact" });
      if (search) {
        // Note: PostgREST `or` syntax — separate filters with commas.
        q = q.or(
          `email.ilike.%${search}%,username.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }
      if (status) q = q.eq("status", status);
      if (role) q = q.eq("role", role);
      q = q.order("created_at", { ascending: false });
      if (withPaging) {
        q = q.range(skip, skip + take - 1);
      }
      return q;
    };

    const { data, count, error } = await buildQuery(true);
    if (error) {
      console.error("[admin/users] list error:", error.message);
      return apiError("Failed to fetch users", 500);
    }

    const total = count || 0;
    return apiSuccess({
      users: data || [],
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
