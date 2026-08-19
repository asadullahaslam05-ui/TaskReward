import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * PATCH /api/supabase/admin/announcements/[id]
 *   Updates editable fields (title, message, type, active, start/end date, audience).
 *
 * DELETE /api/supabase/admin/announcements/[id]
 *   Permanently deletes the announcement.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { id } = await params;
    if (!id) return apiError("Announcement id required", 400);

    const body = await req.json();
    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("announcements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/announcements] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch announcement", 500);
    }
    if (!before) return apiError("Announcement not found", 404);

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) update.title = String(body.title);
    if (body.message !== undefined) update.message = String(body.message);
    if (body.type !== undefined) update.type = String(body.type);
    if (body.active !== undefined) update.active = Boolean(body.active);
    if (body.targetAudience !== undefined) update.target_audience = String(body.targetAudience);
    if (body.startDate !== undefined) {
      update.start_date = body.startDate ? new Date(body.startDate).toISOString() : null;
    }
    if (body.endDate !== undefined) {
      update.end_date = body.endDate ? new Date(body.endDate).toISOString() : null;
    }

    const { data: updated, error: updateErr } = await admin
      .from("announcements")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[admin/announcements] PATCH update error:", updateErr.message);
      return apiError("Failed to update announcement", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "ANNOUNCEMENT_UPDATE",
        target_type: "ANNOUNCEMENT",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("[admin/announcements] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { id } = await params;
    if (!id) return apiError("Announcement id required", 400);

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("announcements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/announcements] DELETE fetch error:", beforeErr.message);
      return apiError("Failed to fetch announcement", 500);
    }
    if (!before) return apiError("Announcement not found", 404);

    const { error: deleteErr } = await admin
      .from("announcements")
      .delete()
      .eq("id", id);
    if (deleteErr) {
      console.error("[admin/announcements] DELETE error:", deleteErr.message);
      return apiError("Failed to delete announcement", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `ANNOUNCEMENT_DELETE: ${before.title}`,
        target_type: "ANNOUNCEMENT",
        target_id: id,
        before_data: JSON.stringify(before),
      });
    } catch (e) {
      console.error("[admin/announcements] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
