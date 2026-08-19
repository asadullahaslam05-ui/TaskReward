import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/announcements
 *   ?active=true|false  — filter by active flag (default: all)
 *   ?audience=ALL|ACTIVE|PENDING — filter by target audience
 *
 * POST /api/supabase/admin/announcements
 *   Body: { title, message, type?, active?, startDate?, endDate?, targetAudience? }
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");
    const audience = searchParams.get("audience");

    const admin = createAdminSupabaseClient();

    let query = admin.from("announcements").select("*");
    if (active === "true") query = query.eq("active", true);
    else if (active === "false") query = query.eq("active", false);
    if (audience) query = query.eq("target_audience", audience);
    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("[admin/announcements] list error:", error.message);
      return apiError("Failed to fetch announcements", 500);
    }

    return apiSuccess(data || []);
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
    if (!body.title || !body.message) {
      return apiError("title and message are required", 400);
    }

    const admin = createAdminSupabaseClient();

    const insert = {
      title: String(body.title),
      message: String(body.message),
      type: body.type || "INFO",
      active: body.active ?? true,
      start_date: body.startDate ? new Date(body.startDate).toISOString() : new Date().toISOString(),
      end_date: body.endDate ? new Date(body.endDate).toISOString() : null,
      target_audience: body.targetAudience || "ALL",
    };

    const { data, error } = await admin
      .from("announcements")
      .insert(insert)
      .select("*")
      .single();

    if (error) {
      console.error("[admin/announcements] create error:", error.message);
      return apiError("Failed to create announcement", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `ANNOUNCEMENT_CREATE: ${insert.title}`,
        target_type: "ANNOUNCEMENT",
        target_id: data.id,
        after_data: JSON.stringify(data),
      });
    } catch (e) {
      console.error("[admin/announcements] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
