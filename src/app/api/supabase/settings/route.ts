import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/settings
 *
 * PUBLIC endpoint — returns all public site settings as a FLAT camelCase
 * object matching the `PublicSettings` interface in src/hooks/use-settings.ts.
 *
 * The database stores settings as dotted-key rows (e.g. "site.name",
 * "registration.fee"). This route converts them into the camelCase shape
 * the frontend expects (e.g. siteName, registrationFee) so that
 * `settings?.siteName` works correctly across the app.
 */

function parseBool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

function parseNum(v: string | undefined, fallback: number): number {
  const n = parseFloat(v || "");
  return Number.isFinite(n) ? n : fallback;
}

function parseJson<T>(v: string | undefined, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("site_settings")
      .select("key, value, category, type");

    if (error) {
      return apiError(error.message, 500);
    }

    // Build a dotted-key lookup map.
    const map: Record<string, string> = {};
    for (const row of data || []) {
      if (row.key) map[row.key] = row.value ?? "";
    }

    // Convert dotted keys → flat camelCase PublicSettings object.
    const settings = {
      // Site
      siteName: map["site.name"] || "TaskReward",
      siteDescription: map["site.description"] || "",
      siteLogo: map["site.logo"] || "",
      supportEmail: map["site.support_email"] || "",
      supportWhatsapp: map["site.support_whatsapp"] || "",
      currencyCode: map["site.currency_code"] || "PKR",
      currencySymbol: map["site.currency_symbol"] || "Rs",
      timezone: map["site.timezone"] || "Asia/Karachi",
      footerText: map["site.footer_text"] || "© 2025 TaskReward. All rights reserved.",
      socialLinks: parseJson<any[]>(map["site.social_links"], []),

      // Feature flags
      registrationEnabled: parseBool(map["feature.registration_enabled"], true),
      loginEnabled: parseBool(map["feature.login_enabled"], true),
      withdrawalsEnabled: parseBool(map["feature.withdrawals_enabled"], true),
      tasksEnabled: parseBool(map["feature.tasks_enabled"], true),
      maintenanceMode: parseBool(map["feature.maintenance_mode"], false),
      referralEnabled: parseBool(map["feature.referral_enabled"], true),

      // Registration
      registrationFee: parseNum(map["registration.fee"], 500),
      registrationInstructions: map["registration.instructions"] || "",
      registrationWelcomeMessage:
        map["registration.welcome_message"] ||
        "Welcome! Complete your registration payment to start earning.",

      // Branding
      brandPrimaryColor: map["brand.primary_color"] || "#6366f1",
      brandSecondaryColor: map["brand.secondary_color"] || "#8b5cf6",
      brandAccentColor: map["brand.accent_color"] || "#ec4899",

      // Withdrawal
      withdrawalMin: parseNum(map["withdrawal.min_amount"], 100),
      withdrawalMax: parseNum(map["withdrawal.max_amount"], 50000),
      withdrawalDailyLimit: parseNum(map["withdrawal.daily_limit"], 10000),
      withdrawalFee: parseNum(map["withdrawal.fee"], 0),
      withdrawalProcessingMessage:
        map["withdrawal.processing_message"] ||
        "Withdrawals are processed within 24-48 hours.",

      // Referral
      referralReward: parseNum(map["referral.reward"], 50),
      referralType: map["referral.type"] || "FIXED",
      referralMax: parseNum(map["referral.max_reward"], 500),

      // SEO
      seoTitle: map["seo.title"] || "TaskReward - Earn Money Online",
      seoDescription:
        map["seo.description"] ||
        "Complete tasks and earn real money.",
    };

    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
