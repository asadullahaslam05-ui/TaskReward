"use client";

import { useState } from "react";
import { useAppStore, type AppView } from "@/stores/app-store";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSettings } from "@/hooks/use-settings";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ListChecks,
  FileCheck,
  Banknote,
  ArrowLeftRight,
  Megaphone,
  Settings,
  FileText,
  ScrollText,
  HeadphonesIcon,
  LogOut,
  Menu,
  Shield,
  Gift,
  Wallet as WalletIcon,
  BadgeCheck,
  Activity,
  AlertTriangle,
  Database,
  FileCode,
  ShieldCheck,
} from "lucide-react";
import type { CurrentUser } from "@/hooks/use-current-user";
import type { PublicSettings } from "@/hooks/use-settings";

const NAV_SECTIONS: { title: string; items: { view: AppView; label: string; icon: any }[] }[] = [
  {
    title: "Overview",
    items: [
      { view: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
      { view: "admin-queues", label: "Review Queues", icon: ListChecks },
    ],
  },
  {
    title: "Users",
    items: [
      { view: "admin-users", label: "All Users", icon: Users },
      { view: "admin-user-tags", label: "User Tags", icon: Users },
    ],
  },
  {
    title: "Payments",
    items: [
      { view: "admin-payments", label: "Registration Payments", icon: CreditCard },
      { view: "admin-membership-payments", label: "Membership Payments", icon: CreditCard },
      { view: "admin-payment-methods", label: "Payment Methods", icon: CreditCard },
    ],
  },
  {
    title: "Memberships",
    items: [
      { view: "admin-memberships", label: "All Memberships", icon: BadgeCheck },
    ],
  },
  {
    title: "Tasks",
    items: [
      { view: "admin-tasks", label: "All Tasks", icon: ListChecks },
      { view: "admin-task-create", label: "Create Task", icon: FileCheck },
      { view: "admin-task-submissions", label: "Task Submissions", icon: FileCheck },
      { view: "admin-categories", label: "Categories", icon: ListChecks },
    ],
  },
  {
    title: "Finance",
    items: [
      { view: "admin-withdrawals", label: "Withdrawals", icon: Banknote },
      { view: "admin-transactions", label: "Transactions", icon: ArrowLeftRight },
      { view: "admin-balance-adjustment", label: "Balance Adjustments", icon: WalletIcon },
    ],
  },
  {
    title: "Engagement",
    items: [
      { view: "admin-announcements", label: "Announcements", icon: Megaphone },
      { view: "admin-referrals", label: "Referrals", icon: Gift },
      { view: "admin-support", label: "Support Tickets", icon: HeadphonesIcon },
    ],
  },
  {
    title: "Content",
    items: [{ view: "admin-content", label: "Pages & Content", icon: FileText }],
  },
  {
    title: "System",
    items: [
      { view: "admin-settings", label: "Settings", icon: Settings },
      { view: "admin-feature-flags", label: "Feature Flags", icon: Settings },
      { view: "admin-supabase-setup", label: "Supabase Setup", icon: Database },
      { view: "admin-sql-migrations", label: "SQL Migrations", icon: Database },
      { view: "admin-sql-viewer", label: "SQL File Viewer", icon: FileCode },
      { view: "admin-system-health", label: "System Health", icon: Activity },
      { view: "admin-errors", label: "Error Log", icon: AlertTriangle },
      { view: "admin-data-integrity", label: "Data Integrity", icon: ShieldCheck },
      { view: "admin-audit-logs", label: "Audit Logs", icon: ScrollText },
    ],
  },
];

interface SidebarProps {
  user: CurrentUser | null | undefined;
  settings: PublicSettings | undefined;
  currentView: AppView;
  onNavigate: (v: AppView) => void;
  onSignOut: () => void;
}

function SidebarContent({ user, settings, currentView, onNavigate, onSignOut }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <BrandLogo size="sm" variant="mark" />
          <div>
            <div className="font-bold text-sm text-sidebar-foreground">{settings?.siteName || "TaskReward"}</div>
            <div className="text-xs text-brand-gold">Admin Panel</div>
          </div>
        </div>
      </div>

      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold">
            {user?.fullName?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{user?.fullName}</div>
            <Badge variant="outline" className="text-xs mt-0.5 bg-violet-50 dark:bg-violet-950">
              {user?.role}
            </Badge>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 max-h-[calc(100vh-280px)]">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </div>
            {section.items.map((item) => (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                  currentView === item.view
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-2 border-t">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useCurrentUser();
  const { settings } = useSettings();
  const { view, setView } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (v: AppView) => {
    setView(v);
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const sidebarProps = {
    user,
    settings,
    currentView: view,
    onNavigate: handleNavigate,
    onSignOut: handleSignOut,
  };

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="hidden md:flex w-64 flex-col border-r bg-background fixed inset-y-0 left-0 z-40">
        <SidebarContent {...sidebarProps} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
            <SheetDescription>Navigate through TaskReward administration.</SheetDescription>
          </SheetHeader>
          <SidebarContent {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BrandLogo size="xs" variant="mark" />
            <span className="font-semibold text-sm">Admin Panel</span>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-4 md:p-6">
          <AdminViewRenderer />
        </main>

        <footer className="border-t bg-background mt-auto py-4 px-4 md:px-6">
          <p className="text-xs text-center text-muted-foreground">
            {settings?.footerText || "© 2025 TaskReward. All rights reserved."}
          </p>
        </footer>
      </div>
    </div>
  );
}

function AdminViewRenderer() {
  const { view } = useAppStore();

  switch (view) {
    case "admin-dashboard":
      return <AdminDashboardHome />;
    case "admin-queues":
      return <AdminQueues />;
    case "admin-users":
      return <AdminUsers />;
    case "admin-user-detail":
      return <AdminUserDetail />;
    case "admin-user-tags":
      return <AdminUserTags />;
    case "admin-payments":
      return <AdminPayments />;
    case "admin-payment-methods":
      return <AdminPaymentMethods />;
    case "admin-membership-payments":
      return <AdminMembershipPayments />;
    case "admin-memberships":
      return <AdminMemberships />;
    case "admin-tasks":
      return <AdminTasks />;
    case "admin-task-create":
      return <AdminTaskCreate />;
    case "admin-task-submissions":
      return <AdminTaskSubmissions />;
    case "admin-categories":
      return <AdminCategories />;
    case "admin-withdrawals":
      return <AdminWithdrawals />;
    case "admin-transactions":
      return <AdminTransactions />;
    case "admin-balance-adjustment":
      return <AdminBalanceAdjustment />;
    case "admin-announcements":
      return <AdminAnnouncements />;
    case "admin-referrals":
      return <AdminReferrals />;
    case "admin-support":
      return <AdminSupport />;
    case "admin-content":
      return <AdminContent />;
    case "admin-settings":
      return <AdminSettings />;
    case "admin-feature-flags":
      return <AdminFeatureFlags />;
    case "admin-supabase-setup":
      return <AdminSupabaseSetup />;
    case "admin-sql-migrations":
      return <AdminSqlMigrations />;
    case "admin-sql-viewer":
      return <AdminSqlViewer />;
    case "admin-system-health":
      return <AdminSystemHealth />;
    case "admin-errors":
      return <AdminErrors />;
    case "admin-data-integrity":
      return <AdminDataIntegrity />;
    case "admin-audit-logs":
      return <AdminAuditLogs />;
    default:
      return <AdminDashboardHome />;
  }
}

import { AdminDashboardHome } from "@/components/admin/views/admin-dashboard-home";
import { AdminQueues } from "@/components/admin/views/admin-queues";
import { AdminUsers } from "@/components/admin/views/admin-users";
import { AdminUserDetail } from "@/components/admin/views/admin-user-detail";
import { AdminUserTags } from "@/components/admin/views/admin-user-tags";
import { AdminPayments } from "@/components/admin/views/admin-payments";
import { AdminPaymentMethods } from "@/components/admin/views/admin-payment-methods";
import { AdminMembershipPayments } from "@/components/admin/views/admin-membership-payments";
import { AdminMemberships } from "@/components/admin/views/admin-memberships";
import { AdminTasks } from "@/components/admin/views/admin-tasks";
import { AdminTaskCreate } from "@/components/admin/views/admin-task-create";
import { AdminTaskSubmissions } from "@/components/admin/views/admin-task-submissions";
import { AdminCategories } from "@/components/admin/views/admin-categories";
import { AdminWithdrawals } from "@/components/admin/views/admin-withdrawals";
import { AdminTransactions } from "@/components/admin/views/admin-transactions";
import { AdminBalanceAdjustment } from "@/components/admin/views/admin-balance-adjustment";
import { AdminAnnouncements } from "@/components/admin/views/admin-announcements";
import { AdminReferrals } from "@/components/admin/views/admin-referrals";
import { AdminSupport } from "@/components/admin/views/admin-support";
import { AdminContent } from "@/components/admin/views/admin-content";
import { AdminSettings } from "@/components/admin/views/admin-settings";
import { AdminFeatureFlags } from "@/components/admin/views/admin-feature-flags";
import { AdminSupabaseSetup } from "@/components/admin/views/admin-supabase-setup";
import { AdminSqlMigrations } from "@/components/admin/views/admin-sql-migrations";
import { AdminSqlViewer } from "@/components/admin/views/admin-sql-viewer";
import { AdminSystemHealth } from "@/components/admin/views/admin-system-health";
import { AdminErrors } from "@/components/admin/views/admin-errors";
import { AdminDataIntegrity } from "@/components/admin/views/admin-data-integrity";
import { AdminAuditLogs } from "@/components/admin/views/admin-audit-logs";
