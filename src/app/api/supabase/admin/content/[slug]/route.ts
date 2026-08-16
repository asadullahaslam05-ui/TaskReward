import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * PUT /api/supabase/admin/content/[slug]
 *   Body: { title?, content?, slug? (rename allowed) }
 *   Upserts the content page by slug. Returns the resulting row.
 *
 * DELETE /api/supabase/admin/content/[slug]
 *   Permanently deletes the content page.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { slug } = await params;
    if (!slug) return apiError("Content slug required", 400);

    const body = await req.json();
    const admin = createAdminSupabaseClient();

    // Fetch existing for audit (if any)
    const { data: before } = await admin
      .from("content_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: adminProfile.id,
    };
    if (body.title !== undefined) update.title = String(body.title);
    if (body.content !== undefined) update.content = String(body.content);
    if (body.slug !== undefined && body.slug !== slug) update.slug = String(body.slug);

    const { data: updated, error } = await admin
      .from("content_pages")
      .upsert(
        {
          slug,
          title: body.title ?? before?.title ?? "Untitled",
          content: body.content ?? before?.content ?? "",
          updated_at: update.updated_at,
          updated_by: update.updated_by,
        },
        { onConflict: "slug" }
      )
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[admin/content] PUT error:", error.message);
      return apiError("Failed to save content page", 500);
    }

    // If a rename was requested, update the slug
    if (body.slug && body.slug !== slug && updated) {
      const { data: renamed, error: renameErr } = await admin
        .from("content_pages")
        .update({ slug: String(body.slug) })
        .eq("id", updated.id)
        .select("*")
        .maybeSingle();
      if (!renameErr && renamed) {
        try {
          await admin.from("admin_audit_logs").insert({
            admin_id: adminProfile.id,
            action: `CONTENT_UPDATE: ${slug} → ${body.slug}`,
            target_type: "CONTENT",
            target_id: updated.id,
            before_data: JSON.stringify(before || {}),
            after_data: JSON.stringify(renamed),
          });
        } catch (e) {
          console.error("[admin/content] audit log failed:", (e as Error)?.message);
        }
        return apiSuccess(renamed);
      }
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `CONTENT_UPDATE: ${slug}`,
        target_type: "CONTENT",
        target_id: updated?.id,
        before_data: JSON.stringify(before || {}),
        after_data: JSON.stringify(updated || {}),
      });
    } catch (e) {
      console.error("[admin/content] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { slug } = await params;
    if (!slug) return apiError("Content slug required", 400);

    const admin = createAdminSupabaseClient();

    const { data: before, error: beforeErr } = await admin
      .from("content_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/content] DELETE fetch error:", beforeErr.message);
      return apiError("Failed to fetch content page", 500);
    }
    if (!before) return apiError("Content page not found", 404);

    const { error: deleteErr } = await admin
      .from("content_pages")
      .delete()
      .eq("slug", slug);
    if (deleteErr) {
      console.error("[admin/content] DELETE error:", deleteErr.message);
      return apiError("Failed to delete content page", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `CONTENT_DELETE: ${slug}`,
        target_type: "CONTENT",
        target_id: before.id,
        before_data: JSON.stringify(before),
      });
    } catch (e) {
      console.error("[admin/content] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ deleted: true, slug });
  } catch (error) {
    return handleApiError(error);
  }
}
