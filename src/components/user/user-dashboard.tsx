"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useAppStore, type AppView } from "@/stores/app-store";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  ListChecks,
  FileCheck,
  Wallet,
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Bell,
  Users,
  HeadphonesIcon,
  User,
  LogOut,
  Menu,
} from "lucide-react";
import type { CurrentUser } from "@/hooks/use-current-user";
import type { PublicSettings } from "@/hooks/use-settings";
import { BrandLogo } from "@/components/shared/brand-logo";

const NAV_ITEMS: { view: AppView; label: string; icon: any }[] = [
  { view: "user-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "user-tasks", label: "Tasks", icon: ListChecks },
  { view: "user-submissions", label: "My Submissions", icon: FileCheck },
  { view: "user-wallet", label: "Wallet", icon: Wallet },
  { view: "user-transactions", label: "Transactions", icon: ArrowLeftRight },
  { view: "user-withdraw", label: "Withdraw", icon: Banknote },
  { view: "user-payout-accounts", label: "Payment Accounts", icon: CreditCard },
  { view: "user-notifications", label: "Notifications", icon: Bell },
  { view: "user-referrals", label: "Referrals", icon: Users },
  { view: "user-support", label: "Support", icon: HeadphonesIcon },
  { view: "user-profile", label: "Profile", icon: User },
];

interface SidebarProps {
  user: CurrentUser | null;
  settings: PublicSettings | undefined;
  currentView: AppView;
  onNavigate: (v: AppView) => void;
  onSignOut: () => void;
}

function SidebarContent({ user, settings, currentView, onNavigate, onSignOut }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <BrandLogo size="sm" variant="mark" />
          <span className="font-bold">{settings?.siteName || "TaskReward"}</span>
        </div>
      </div>

      {/* User info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold">
            {user?.fullName?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{user?.fullName}</div>
            <div className="text-xs text-muted-foreground truncate">@{user?.username}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Balance</span>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {settings?.currencySymbol || "Rs"} {user?.balance?.toFixed(2) || "0.00"}
          </Badge>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
              currentView === item.view
                ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Sign out */}
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

export function UserDashboard() {
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-background fixed inset-y-0 left-0 z-40">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>User navigation</SheetTitle>
            <SheetDescription>Navigate through your TaskReward account.</SheetDescription>
          </SheetHeader>
          <SidebarContent {...sidebarProps} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" variant="mark" />
            <span className="font-semibold text-sm">{settings?.siteName || "TaskReward"}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleNavigate("user-notifications")}
          >
            <Bell className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <UserViewRenderer />
        </main>

        {/* Footer */}
        <footer className="border-t bg-background mt-auto py-4 px-4 md:px-6">
          <p className="text-xs text-center text-muted-foreground">
            {settings?.footerText || "© 2025 TaskReward. All rights reserved."}
          </p>
        </footer>
      </div>
    </div>
  );
}

function UserViewRenderer() {
  const { view } = useAppStore();

  switch (view) {
    case "user-dashboard":
      return <UserDashboardHome />;
    case "user-tasks":
      return <UserTasks />;
    case "user-submissions":
      return <UserSubmissions />;
    case "user-wallet":
      return <UserWallet />;
    case "user-transactions":
      return <UserTransactions />;
    case "user-withdraw":
      return <UserWithdraw />;
    case "user-payout-accounts":
      return <UserPayoutAccounts />;
    case "user-notifications":
      return <UserNotifications />;
    case "user-referrals":
      return <UserReferrals />;
    case "user-support":
      return <UserSupport />;
    case "user-profile":
      return <UserProfile />;
    default:
      return <UserDashboardHome />;
  }
}

import { UserDashboardHome } from "@/components/user/views/user-dashboard-home";
import { UserTasks } from "@/components/user/views/user-tasks";
import { UserSubmissions } from "@/components/user/views/user-submissions";
import { UserWallet } from "@/components/user/views/user-wallet";
import { UserTransactions } from "@/components/user/views/user-transactions";
import { UserWithdraw } from "@/components/user/views/user-withdraw";
import { UserPayoutAccounts } from "@/components/user/views/user-payout-accounts";
import { UserNotifications } from "@/components/user/views/user-notifications";
import { UserReferrals } from "@/components/user/views/user-referrals";
import { UserSupport } from "@/components/user/views/user-support";
import { UserProfile } from "@/components/user/views/user-profile";
