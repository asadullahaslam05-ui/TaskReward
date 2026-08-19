"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";

export interface PublicSettings {
  siteName: string;
  siteDescription: string;
  siteLogo: string;
  supportEmail: string;
  supportWhatsapp: string;
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  footerText: string;
  socialLinks: any[];
  registrationEnabled: boolean;
  loginEnabled: boolean;
  withdrawalsEnabled: boolean;
  tasksEnabled: boolean;
  maintenanceMode: boolean;
  referralEnabled: boolean;
  // --- REQUIRED business values (null when misconfigured — fail closed) ---
  registrationFee: number | null;
  withdrawalMin: number | null;
  withdrawalMax: number | null;
  withdrawalDailyLimit: number | null;
  withdrawalFee: number | null;
  referralReward: number | null;
  referralMax: number | null;
  // -------------------------------------------------------------------------
  registrationInstructions: string;
  registrationWelcomeMessage: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
  withdrawalProcessingMessage: string;
  referralType: string;
  seoTitle: string;
  seoDescription: string;
  // Non-empty when required business values are missing/invalid. Frontend
  // consumers should check this to surface a configuration error.
  configErrors?: string[];
}

export function useSettings() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<PublicSettings>("/api/supabase/settings"),
    // Short staleness so admin changes propagate to the public site within
    // half a minute (admin settings save also invalidates this query key).
    staleTime: 30_000,
  });

  // Expose `settings` as a direct alias for `query.data` so that the common
  // `const { settings } = useSettings()` destructure receives the actual
  // settings object. The raw React Query fields (`data`, `isLoading`,
  // `isError`, ...) remain available for call-sites that already use
  // `const { data: settings } = useSettings()`, keeping both patterns working.
  return {
    ...query,
    settings: query.data,
  };
}
