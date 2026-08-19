import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/settings
 *   ?category=GENERAL — optional category filter
 *   Returns: { items: [...all rows...], grouped: { CATEGORY: [...rows...] } }
 *
 * PUT /api/supabase/admin/settings
 *   Body: { settings: [{ key, value, category?, type? }, ...] }
 *   Updates each setting by key. Returns the count of updated rows.
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("site_settings")
      .select("*")
      .order("category", { ascending: true })
      .order("key", { ascending: true });

    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) {
      console.error("[admin/settings] list error:", error.message);
      return apiError("Failed to fetch settings", 500);
    }

    const items = data || [];

    // Group by category for the tabbed UI
    const grouped: Record<string, any[]> = {};
    for (const s of items) {
      const key = (s as any).category || "GENERAL";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    }

    return apiSuccess({ settings: items, grouped });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const body = await req.json();
    const settings = Array.isArray(body?.settings) ? body.settings : null;
    if (!settings) {
      return apiError("settings must be an array", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch current values for the keys being updated (for audit before-state).
    const keys = settings.map((s: any) => s.key).filter(Boolean);
    const { data: beforeRows } = await admin
      .from("site_settings")
      .select("*")
      .in("key", keys);

    const beforeMap = new Map<string, any>();
    for (const r of beforeRows || []) {
      beforeMap.set((r as any).key, r);
    }

    let updatedCount = 0;
    const updatedRows: any[] = [];

    for (const s of settings) {
      if (!s.key) continue;
      const update: Record<string, any> = {
        value: String(s.value),
        updated_at: new Date().toISOString(),
        updated_by: adminProfile.id,
      };
      if (s.category !== undefined) update.category = String(s.category);
      if (s.type !== undefined) update.type = String(s.type);

      const { data: updated, error } = await admin
        .from("site_settings")
        .update(update)
        .eq("key", s.key)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(`[admin/settings] update ${s.key}:`, error.message);
        continue;
      }
      if (updated) {
        updatedCount++;
        updatedRows.push(updated);
      }
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `SETTINGS_UPDATE: ${updatedCount} settings`,
        target_type: "SETTINGS",
        target_id: keys.join(",").slice(0, 200),
        before_data: JSON.stringify(beforeMap),
        after_data: JSON.stringify(updatedRows),
      });
    } catch (e) {
      console.error("[admin/settings] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess({ updated: updatedCount, items: updatedRows });
  } catch (error) {
    return handleApiError(error);
  }
}
