import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/feature-flags
 *   Returns all feature flags.
 *
 * PATCH /api/supabase/admin/feature-flags
 *   Body: { flags: [{ key, enabled?, value?, description? }, ...] }
 *   Updates each flag by key (upsert behavior — creates the flag if missing).
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
      .from("feature_flags")
      .select("*")
      .order("key", { ascending: true });

    if (error) {
      console.error("[admin/feature-flags] list error:", error.message);
      // Graceful fallback if the table does not exist yet
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        return apiSuccess([]);
      }
      return apiError("Failed to fetch feature flags", 500);
    }

    return apiSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const body = await req.json();
    const flags = Array.isArray(body?.flags) ? body.flags : null;
    if (!flags) {
      return apiError("flags must be an array", 400);
    }

    const admin = createAdminSupabaseClient();
    const updated: any[] = [];

    for (const f of flags) {
      if (!f.key) continue;
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (f.enabled !== undefined) update.enabled = Boolean(f.enabled);
      if (f.value !== undefined) update.value = f.value === null ? null : String(f.value);
      if (f.description !== undefined) update.description = String(f.description);

      const { data, error } = await admin
        .from("feature_flags")
        .upsert(
          {
            key: String(f.key),
            ...update,
          },
          { onConflict: "key" }
        )
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(`[admin/feature-flags] upsert ${f.key}:`, error.message);
        continue;
      }
      if (data) updated.push(data);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `FEATURE_FLAGS_UPDATE: ${updated.length} flags`,
        target_type: "FEATURE_FLAGS",
        target_id: updated.map((u) => u.key).join(",").slice(0, 200),
        after_data: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("[admin/feature-flags] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ updated: updated.length, flags: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
