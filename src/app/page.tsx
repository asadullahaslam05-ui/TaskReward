"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useAppStore } from "@/stores/app-store";
import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Public views
import { LandingView } from "@/components/public/landing-view";
import { LoginView } from "@/components/public/login-view";
import { RegisterView } from "@/components/public/register-view";
import { PaymentView } from "@/components/public/payment-view";

// User dashboard
import { UserDashboard } from "@/components/user/user-dashboard";

// Admin dashboard
import { AdminDashboard } from "@/components/admin/admin-dashboard";

// Shared
import { MaintenanceScreen } from "@/components/shared/maintenance-screen";
import { PageLoader } from "@/components/shared/branded-loading";
import { useSettings } from "@/hooks/use-settings";

function HomeContent() {
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const { view, setView } = useAppStore();
  const { settings } = useSettings();
  const searchParams = useSearchParams();

  // Handle referral code in URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      sessionStorage.setItem("referralCode", ref);
    }
  }, [searchParams]);

  // Reset view to dashboard when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
      const isPaymentPending = user.status === "PAYMENT_PENDING";

      if (!isAdmin && isPaymentPending && (view === "landing" || view === "login" || view === "register" || view === "user-dashboard")) {
        setView("payment");
      } else if (isAdmin && ["landing", "login", "register", "payment"].includes(view)) {
        setView("admin-dashboard");
      } else if (!isAdmin && !isPaymentPending && ["landing", "login", "register"].includes(view)) {
        setView("user-dashboard");
      }
    }
    if (!isAuthenticated && !isLoading) {
      if (!["landing", "login", "register"].includes(view)) {
        setView("landing");
      }
    }
  }, [isAuthenticated, user, isLoading, view, setView]);

  // Show maintenance mode to non-admins
  if (settings?.maintenanceMode && !isLoading && (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN"))) {
    return <MaintenanceScreen />;
  }

  if (isLoading) {
    return <PageLoader label="Loading TaskReward…" />;
  }

  // Not authenticated → public views
  if (!isAuthenticated || !user) {
    if (view === "login") return <LoginView />;
    if (view === "register") return <RegisterView />;
    return <LandingView />;
  }

  // Authenticated user
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  // Payment-pending users can only see the payment view
  if (!isAdmin && user.status === "PAYMENT_PENDING") {
    return <PaymentView />;
  }

  // Payment rejected users can resubmit
  if (!isAdmin && user.status === "REJECTED") {
    return <PaymentView />;
  }

  // Suspended/banned users see a message
  if (!isAdmin && (user.status === "SUSPENDED" || user.status === "BANNED")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Account {user.status}</h1>
          <p className="text-muted-foreground">
            Your account has been {user.status.toLowerCase()}. Please contact support for assistance.
          </p>
          <button
            onClick={() => {
              // Supabase Auth signOut (NextAuth removed)
              fetch("/api/supabase/auth/signout", { method: "POST" })
                .then(() => {
                  window.location.href = "/";
                })
                .catch(() => {
                  window.location.href = "/";
                });
            }}
            className="text-primary underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard />;
  }

  return <UserDashboard />;
}

export default function Home() {
  return (
    <Suspense fallback={<PageLoader label="Loading TaskReward…" />}>
      <HomeContent />
    </Suspense>
  );
}
