import { db } from "@/lib/db";

// In-memory cache for site settings (refreshed on writes)
let settingsCache: Map<string, string> | null = null;
let settingsCacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Load all settings into the cache.
 */
async function loadSettings(): Promise<Map<string, string>> {
  const settings = await db.siteSetting.findMany();
  const map = new Map<string, string>();
  for (const s of settings) {
    map.set(s.key, s.value);
  }
  settingsCache = map;
  settingsCacheTime = Date.now();
  return map;
}

/**
 * Get all settings (cached).
 */
export async function getAllSettings(): Promise<Map<string, string>> {
  if (settingsCache && Date.now() - settingsCacheTime < CACHE_TTL) {
    return settingsCache;
  }
  return loadSettings();
}

/**
 * Get a single setting value as string.
 */
export async function getSetting(key: string, fallback: string = ""): Promise<string> {
  const settings = await getAllSettings();
  return settings.get(key) ?? fallback;
}

/**
 * Get a setting as number.
 */
export async function getSettingNumber(key: string, fallback: number = 0): Promise<number> {
  const val = await getSetting(key);
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

/**
 * Get a setting as boolean.
 */
export async function getSettingBool(key: string, fallback: boolean = false): Promise<boolean> {
  const val = await getSetting(key);
  return val === "true" || val === "1";
}

/**
 * Get a setting as parsed JSON.
 */
export async function getSettingJSON<T>(key: string, fallback: T): Promise<T> {
  const val = await getSetting(key);
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

/**
 * Set a setting value and update the cache.
 */
export async function setSetting(key: string, value: string, category: string = "GENERAL", type: string = "STRING"): Promise<void> {
  await db.siteSetting.upsert({
    where: { key },
    create: { key, value, category, type },
    update: { value, category, type },
  });
  // Update cache
  if (settingsCache) {
    settingsCache.set(key, value);
  }
}

/**
 * Set multiple settings at once (transactional).
 */
export async function setSettings(items: { key: string; value: string; category?: string; type?: string }[]): Promise<void> {
  await db.$transaction(
    items.map((item) =>
      db.siteSetting.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          value: item.value,
          category: item.category ?? "GENERAL",
          type: item.type ?? "STRING",
        },
        update: {
          value: item.value,
          ...(item.category ? { category: item.category } : {}),
          ...(item.type ? { type: item.type } : {}),
        },
      })
    )
  );
  // Refresh cache
  await loadSettings();
}

/**
 * Invalidate the settings cache (force reload on next read).
 */
export function invalidateSettingsCache(): void {
  settingsCache = null;
}

// ============================================================
// Typed setting accessors (business-configurable values)
// ============================================================

export const SettingsKeys = {
  // General
  SITE_NAME: "site.name",
  SITE_DESCRIPTION: "site.description",
  SITE_LOGO: "site.logo",
  SITE_FAVICON: "site.favicon",
  SUPPORT_EMAIL: "site.support_email",
  SUPPORT_WHATSAPP: "site.support_whatsapp",
  CURRENCY_CODE: "site.currency_code",
  CURRENCY_SYMBOL: "site.currency_symbol",
  TIMEZONE: "site.timezone",
  FOOTER_TEXT: "site.footer_text",
  SOCIAL_LINKS: "site.social_links",
  // Feature toggles
  REGISTRATION_ENABLED: "feature.registration_enabled",
  LOGIN_ENABLED: "feature.login_enabled",
  WITHDRAWALS_ENABLED: "feature.withdrawals_enabled",
  TASKS_ENABLED: "feature.tasks_enabled",
  MAINTENANCE_MODE: "feature.maintenance_mode",
  REFERRAL_ENABLED: "feature.referral_enabled",
  // Registration
  REGISTRATION_FEE: "registration.fee",
  REGISTRATION_MANUAL_APPROVAL: "registration.manual_approval",
  REGISTRATION_WELCOME_MESSAGE: "registration.welcome_message",
  REGISTRATION_INSTRUCTIONS: "registration.instructions",
  // Branding
  BRAND_PRIMARY_COLOR: "brand.primary_color",
  BRAND_SECONDARY_COLOR: "brand.secondary_color",
  BRAND_ACCENT_COLOR: "brand.accent_color",
  // Tasks
  TASKS_DEFAULT_REWARD: "tasks.default_reward",
  TASKS_MAX_SUBMISSIONS_PER_USER: "tasks.max_submissions_per_user",
  TASKS_DAILY_LIMIT: "tasks.daily_limit",
  TASKS_PREVENT_DUPLICATES: "tasks.prevent_duplicates",
  // Withdrawals
  WITHDRAWAL_MIN: "withdrawal.min_amount",
  WITHDRAWAL_MAX: "withdrawal.max_amount",
  WITHDRAWAL_DAILY_LIMIT: "withdrawal.daily_limit",
  WITHDRAWAL_FEE: "withdrawal.fee",
  WITHDRAWAL_PROCESSING_MESSAGE: "withdrawal.processing_message",
  // Referral
  REFERRAL_REWARD: "referral.reward",
  REFERRAL_TYPE: "referral.type", // FIXED | PERCENTAGE
  REFERRAL_MAX: "referral.max_reward",
  // SEO
  SEO_TITLE: "seo.title",
  SEO_DESCRIPTION: "seo.description",
  SEO_OG_IMAGE: "seo.og_image",
} as const;

/**
 * Get a structured settings object for the frontend.
 */
export async function getPublicSettings() {
  const settings = await getAllSettings();
  return {
    siteName: settings.get(SettingsKeys.SITE_NAME) || "TaskReward",
    siteDescription: settings.get(SettingsKeys.SITE_DESCRIPTION) || "Earn rewards by completing tasks",
    siteLogo: settings.get(SettingsKeys.SITE_LOGO) || "",
    supportEmail: settings.get(SettingsKeys.SUPPORT_EMAIL) || "support@taskreward.com",
    supportWhatsapp: settings.get(SettingsKeys.SUPPORT_WHATSAPP) || "",
    currencyCode: settings.get(SettingsKeys.CURRENCY_CODE) || "PKR",
    currencySymbol: settings.get(SettingsKeys.CURRENCY_SYMBOL) || "Rs",
    timezone: settings.get(SettingsKeys.TIMEZONE) || "Asia/Karachi",
    footerText: settings.get(SettingsKeys.FOOTER_TEXT) || "© 2025 TaskReward. All rights reserved.",
    socialLinks: (() => {
      try { return JSON.parse(settings.get(SettingsKeys.SOCIAL_LINKS) || "[]"); } catch { return []; }
    })(),
    registrationEnabled: settings.get(SettingsKeys.REGISTRATION_ENABLED) !== "false",
    loginEnabled: settings.get(SettingsKeys.LOGIN_ENABLED) !== "false",
    withdrawalsEnabled: settings.get(SettingsKeys.WITHDRAWALS_ENABLED) !== "false",
    tasksEnabled: settings.get(SettingsKeys.TASKS_ENABLED) !== "false",
    maintenanceMode: settings.get(SettingsKeys.MAINTENANCE_MODE) === "true",
    referralEnabled: settings.get(SettingsKeys.REFERRAL_ENABLED) !== "false",
    registrationFee: parseFloat(settings.get(SettingsKeys.REGISTRATION_FEE) || "500"),
    registrationInstructions: settings.get(SettingsKeys.REGISTRATION_INSTRUCTIONS) || "",
    registrationWelcomeMessage: settings.get(SettingsKeys.REGISTRATION_WELCOME_MESSAGE) || "Welcome! Complete your registration payment to start earning.",
    brandPrimaryColor: settings.get(SettingsKeys.BRAND_PRIMARY_COLOR) || "#6366f1",
    brandSecondaryColor: settings.get(SettingsKeys.BRAND_SECONDARY_COLOR) || "#8b5cf6",
    brandAccentColor: settings.get(SettingsKeys.BRAND_ACCENT_COLOR) || "#ec4899",
    withdrawalMin: parseFloat(settings.get(SettingsKeys.WITHDRAWAL_MIN) || "100"),
    withdrawalMax: parseFloat(settings.get(SettingsKeys.WITHDRAWAL_MAX) || "50000"),
    withdrawalDailyLimit: parseFloat(settings.get(SettingsKeys.WITHDRAWAL_DAILY_LIMIT) || "10000"),
    withdrawalFee: parseFloat(settings.get(SettingsKeys.WITHDRAWAL_FEE) || "0"),
    withdrawalProcessingMessage: settings.get(SettingsKeys.WITHDRAWAL_PROCESSING_MESSAGE) || "Withdrawals are processed within 24-48 hours.",
    referralReward: parseFloat(settings.get(SettingsKeys.REFERRAL_REWARD) || "50"),
    referralType: settings.get(SettingsKeys.REFERRAL_TYPE) || "FIXED",
    referralMax: parseFloat(settings.get(SettingsKeys.REFERRAL_MAX) || "500"),
    seoTitle: settings.get(SettingsKeys.SEO_TITLE) || "TaskReward - Earn Money Online",
    seoDescription: settings.get(SettingsKeys.SEO_DESCRIPTION) || "Complete tasks and earn real money. Join thousands of earners today.",
  };
}
