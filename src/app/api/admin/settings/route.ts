import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { setSettings, invalidateSettingsCache } from "@/lib/settings";
import { createAuditLog } from "@/lib/notify";
import { getClientIP } from "@/lib/utils-fin";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where: any = {};
    if (category) where.category = category;

    const settings = await db.siteSetting.findMany({
      where,
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }

    return apiSuccess({ settings, grouped });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { settings } = body;

    if (!Array.isArray(settings)) {
      return apiError("Settings must be an array", 400);
    }

    // Get before data for audit
    const keys = settings.map((s: any) => s.key);
    const beforeSettings = await db.siteSetting.findMany({
      where: { key: { in: keys } },
    });

    // Update settings
    await setSettings(
      settings.map((s: any) => ({
        key: s.key,
        value: String(s.value),
        category: s.category,
        type: s.type,
      }))
    );

    await createAuditLog({
      adminId: admin.id,
      action: `SETTINGS_UPDATE: ${settings.length} settings updated`,
      targetType: "SETTINGS",
      targetId: keys.join(","),
      beforeData: beforeSettings,
      afterData: settings,
      ipAddress: getClientIP(req),
    });

    return apiSuccess({ updated: settings.length });
  } catch (error) {
    return handleApiError(error);
  }
}
