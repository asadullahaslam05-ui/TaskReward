import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * PATCH /api/supabase/admin/categories/[id]
 * Updates editable fields (name, description, active).
 *
 * DELETE /api/supabase/admin/categories/[id]
 * Deletes a category. Fails if tasks reference it (admin must reassign
 * those tasks to another category first, or set their category_id null).
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
    if (!id) return apiError("Category id required", 400);

    const body = await req.json();
    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("task_categories")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/categories] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch category", 500);
    }
    if (!before) return apiError("Category not found", 404);

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) update.name = String(body.name);
    if (body.description !== undefined) update.description = body.description;
    if (body.active !== undefined) update.active = Boolean(body.active);

    const { data: updated, error: updateErr } = await admin
      .from("task_categories")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[admin/categories] PATCH update error:", updateErr.message);
      if (updateErr.code === "23505") {
        return apiError("A category with this name already exists", 409);
      }
      return apiError("Failed to update category", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: "CATEGORY_UPDATE",
        target_type: "CATEGORY",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("[admin/categories] audit log failed:", (e as Error)?.message);
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
    if (!id) return apiError("Category id required", 400);

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("task_categories")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/categories] DELETE fetch error:", beforeErr.message);
      return apiError("Failed to fetch category", 500);
    }
    if (!before) return apiError("Category not found", 404);

    const { error: deleteErr } = await admin
      .from("task_categories")
      .delete()
      .eq("id", id);
    if (deleteErr) {
      console.error("[admin/categories] DELETE error:", deleteErr.message);
      if (deleteErr.code === "23503") {
        return apiError(
          "Cannot delete: tasks still reference this category. Reassign them first.",
          409
        );
      }
      return apiError("Failed to delete category", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `CATEGORY_DELETE: ${before.name}`,
        target_type: "CATEGORY",
        target_id: id,
        before_data: JSON.stringify(before),
      });
    } catch (e) {
      console.error("[admin/categories] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
