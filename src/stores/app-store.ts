"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppView =
  // Public
  | "landing"
  | "login"
  | "register"
  | "payment"
  // User
  | "user-dashboard"
  | "user-tasks"
  | "user-submissions"
  | "user-wallet"
  | "user-transactions"
  | "user-withdraw"
  | "user-payout-accounts"
  | "user-notifications"
  | "user-referrals"
  | "user-support"
  | "user-profile"
  | "user-membership"
  // Admin
  | "admin-dashboard"
  | "admin-queues"
  | "admin-users"
  | "admin-user-detail"
  | "admin-user-tags"
  | "admin-payments"
  | "admin-payment-methods"
  | "admin-membership-payments"
  | "admin-memberships"
  | "admin-tasks"
  | "admin-task-create"
  | "admin-task-submissions"
  | "admin-categories"
  | "admin-withdrawals"
  | "admin-transactions"
  | "admin-balance-adjustment"
  | "admin-announcements"
  | "admin-referrals"
  | "admin-support"
  | "admin-content"
  | "admin-settings"
  | "admin-feature-flags"
  | "admin-supabase-setup"
  | "admin-sql-migrations"
  | "admin-sql-viewer"
  | "admin-system-health"
  | "admin-errors"
  | "admin-audit-logs"
  | "admin-data-integrity"
  | "admin-seo"
  | "admin-maintenance";

interface AppState {
  view: AppView;
  selectedId: string | null;
  setView: (view: AppView, selectedId?: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: "landing",
      selectedId: null,
      setView: (view, selectedId = null) => set({ view, selectedId }),
      reset: () => set({ view: "landing", selectedId: null }),
    }),
    {
      name: "app-view",
      partialize: (state) => ({ view: state.view, selectedId: state.selectedId }),
    }
  )
);
