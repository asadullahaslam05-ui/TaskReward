import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/content
 *
 * Returns all content pages (CMS), ordered by slug ascending.
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
      .from("content_pages")
      .select("*")
      .order("slug", { ascending: true });

    if (error) {
      console.error("[admin/content] list error:", error.message);
      return apiError("Failed to fetch content pages", 500);
    }

    return apiSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}
