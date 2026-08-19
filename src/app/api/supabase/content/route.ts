import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/content
 * GET /api/supabase/content?slug=xxx
 *
 * PUBLIC endpoint — fetches content pages.
 * - With ?slug=xxx, returns a single page (404 if not found).
 * - Without ?slug, returns a list of all pages with slug, title, updatedAt.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    const admin = createAdminSupabaseClient();

    if (slug) {
      const { data, error } = await admin
        .from("content_pages")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        return apiError(error.message, 500);
      }
      if (!data) {
        return apiError("Page not found", 404);
      }
      return apiSuccess(data);
    }

    const { data, error } = await admin
      .from("content_pages")
      .select("slug, title, updated_at")
      .order("title", { ascending: true });

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}
