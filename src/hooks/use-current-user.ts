"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/components/providers/auth-provider";
import { apiGet } from "@/lib/api-client/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
  riskLevel: string;
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  referralCode: string;
  profileImage: string | null;
  flagged: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  membership: any | null;
  membershipActive: boolean;
  membershipExpired: boolean;
  membershipExpiringSoon: boolean;
  membershipDaysUntilExpiry: number | null;
}

export function useCurrentUser() {
  const { session, isLoading: authLoading } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["currentUser", session?.user?.id],
    queryFn: async () => {
      if (!session?.user) return null;
      try {
        return await apiGet<CurrentUser>("/api/supabase/auth/me");
      } catch (e: any) {
        if (e.message.includes("Not authenticated") || e.message.includes("401") || e.message.includes("Profile not found")) {
          return null;
        }
        throw e;
      }
    },
    enabled: !!session?.user,
    staleTime: 30_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
  };

  const signOut = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const user = query.data;
  const isAuthenticated = !!session?.user && !!user;
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return {
    user,
    isLoading: authLoading || (!!session?.user && query.isLoading),
    isAuthenticated,
    isAdmin,
    session,
    refresh,
    signOut,
  };
}
