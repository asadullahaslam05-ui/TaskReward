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
  registrationFee: number;
  registrationInstructions: string;
  registrationWelcomeMessage: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
  withdrawalMin: number;
  withdrawalMax: number;
  withdrawalDailyLimit: number;
  withdrawalFee: number;
  withdrawalProcessingMessage: string;
  referralReward: number;
  referralType: string;
  referralMax: number;
  seoTitle: string;
  seoDescription: string;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<PublicSettings>("/api/supabase/settings"),
    staleTime: 60_000,
  });
}
