import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/announcements
 *
 * PUBLIC endpoint — returns active announcements whose schedule is currently
 * valid: start_date <= now AND (end_date IS NULL OR end_date >= now).
 */
export async function GET() {
  try {
    const admin = createAdminSupabaseClient();
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("announcements")
      .select("*")
      .eq("active", true)
      .lte("start_date", now)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order("created_at", { ascending: false });

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}
