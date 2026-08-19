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
 *
 * REQUIRED BUSINESS VALUES FAIL CLOSED:
 *   registration.fee, withdrawal.min_amount, withdrawal.max_amount,
 *   withdrawal.daily_limit, withdrawal.fee, referral.reward,
 *   referral.max_reward
 * These are returned as `number | null`. If the setting is missing or
 * invalid, the value is `null` and the key is listed in `configErrors`.
 * The frontend MUST handle `null` by showing a configuration error and
 * disabling the relevant action. NO hardcoded monetary fallback is ever
 * returned for a required business value.
 */

function parseBool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

/**
 * Parse a REQUIRED business numeric setting.
 * Returns `number` if valid, `null` if missing/invalid.
 * NEVER returns a hardcoded fallback — fail closed.
 */
function parseRequiredNum(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
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

    // --- Required business values (fail closed → null + configErrors) ---
    const registrationFee = parseRequiredNum(map["registration.fee"]);
    const withdrawalMin = parseRequiredNum(map["withdrawal.min_amount"]);
    const withdrawalMax = parseRequiredNum(map["withdrawal.max_amount"]);
    const withdrawalDailyLimit = parseRequiredNum(map["withdrawal.daily_limit"]);
    const withdrawalFee = parseRequiredNum(map["withdrawal.fee"]);
    const referralReward = parseRequiredNum(map["referral.reward"]);
    const referralMax = parseRequiredNum(map["referral.max_reward"]);

    // Collect configuration errors for missing/invalid required business values.
    const configErrors: string[] = [];
    if (registrationFee === null)
      configErrors.push("registration.fee is not configured or invalid");
    if (withdrawalMin === null)
      configErrors.push("withdrawal.min_amount is not configured or invalid");
    if (withdrawalMax === null)
      configErrors.push("withdrawal.max_amount is not configured or invalid");
    if (withdrawalDailyLimit === null)
      configErrors.push("withdrawal.daily_limit is not configured or invalid");
    if (withdrawalFee === null)
      configErrors.push("withdrawal.fee is not configured or invalid");
    if (referralReward === null)
      configErrors.push("referral.reward is not configured or invalid");
    if (referralMax === null)
      configErrors.push("referral.max_reward is not configured or invalid");

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

      // Registration — REQUIRED business value (null if misconfigured)
      registrationFee,
      registrationInstructions: map["registration.instructions"] || "",
      registrationWelcomeMessage:
        map["registration.welcome_message"] ||
        "Welcome! Complete your registration payment to start earning.",

      // Branding
      brandPrimaryColor: map["brand.primary_color"] || "#6366f1",
      brandSecondaryColor: map["brand.secondary_color"] || "#8b5cf6",
      brandAccentColor: map["brand.accent_color"] || "#ec4899",

      // Withdrawal — REQUIRED business values (null if misconfigured)
      withdrawalMin,
      withdrawalMax,
      withdrawalDailyLimit,
      withdrawalFee,
      withdrawalProcessingMessage:
        map["withdrawal.processing_message"] ||
        "Withdrawals are processed within 24-48 hours.",

      // Referral — REQUIRED business values (null if misconfigured)
      referralReward,
      referralType: map["referral.type"] || "FIXED",
      referralMax,

      // SEO
      seoTitle: map["seo.title"] || "TaskReward - Earn Money Online",
      seoDescription:
        map["seo.description"] ||
        "Complete tasks and earn real money.",

      // Configuration errors — non-empty when required business values are
      // missing/invalid. Frontend consumers check this to show config errors
      // and disable affected actions.
      configErrors,
    };

    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
