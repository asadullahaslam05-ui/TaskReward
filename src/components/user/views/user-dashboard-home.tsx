"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSettings } from "@/hooks/use-settings";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatRelativeTime, formatDate } from "@/lib/utils-fin";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";
import {
  Wallet,
  Clock,
  TrendingUp,
  ArrowDownToLine,
  ListChecks,
  FileCheck,
  CheckCircle2,
  XCircle,
  Megaphone,
  ArrowRight,
  Banknote,
  Bell,
  Users,
} from "lucide-react";

interface WalletStats {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  referenceId: string | null;
  createdAt: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

interface TasksResponse {
  tasks: any[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

interface SubmissionsResponse {
  submissions: any[];
  pagination: { total: number };
}

function useSubmissionCount(status: string) {
  return useQuery<SubmissionsResponse>({
    queryKey: ["submission-count", status],
    queryFn: () => apiGet(`/api/supabase/task-submissions?page=1&pageSize=1&status=${status}`),
    staleTime: 30_000,
  });
}

const ANNOUNCEMENT_STYLE: Record<string, string> = {
  INFO: "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20",
  SUCCESS: "border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20",
  WARNING: "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
  IMPORTANT: "border-l-rose-400 bg-rose-50/50 dark:bg-rose-950/20",
};

export function UserDashboardHome() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { data: settings } = useSettings();
  const setView = useAppStore((s) => s.setView);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletStats>({
    queryKey: ["wallet-summary"],
    queryFn: () => apiGet("/api/supabase/wallet"),
    staleTime: 30_000,
  });

  const { data: announcements, isLoading: annLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: () => apiGet("/api/supabase/announcements"),
    staleTime: 60_000,
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ["wallet-transactions", { pageSize: 5 }],
    queryFn: () => apiGet("/api/supabase/wallet/transactions?pageSize=5"),
    staleTime: 30_000,
  });

  const { data: tasksData } = useQuery<TasksResponse>({
    queryKey: ["available-tasks-count"],
    queryFn: () => apiGet("/api/supabase/tasks?page=1&pageSize=1"),
    staleTime: 30_000,
  });

  // Submission counts: fetch total of each status separately
  const pendingQ = useSubmissionCount("PENDING");
  const approvedQ = useSubmissionCount("APPROVED");
  const rejectedQ = useSubmissionCount("REJECTED");

  const balance = wallet?.balance ?? user?.balance ?? 0;
  const pendingBalance = wallet?.pendingBalance ?? user?.pendingBalance ?? 0;
  const totalEarned = wallet?.totalEarned ?? user?.totalEarned ?? 0;
  const totalWithdrawn = wallet?.totalWithdrawn ?? user?.totalWithdrawn ?? 0;

  const stats = [
    {
      label: "Available Balance",
      value: <CurrencyDisplay amount={balance} className="text-2xl font-bold" />,
      icon: Wallet,
      gradient: "from-violet-500 to-fuchsia-500",
      iconBg: "bg-violet-100 dark:bg-violet-950/40",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      label: "Pending Balance",
      value: <CurrencyDisplay amount={pendingBalance} className="text-2xl font-bold" />,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-100 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Total Earned",
      value: <CurrencyDisplay amount={totalEarned} className="text-2xl font-bold" />,
      icon: TrendingUp,
      gradient: "from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total Withdrawn",
      value: <CurrencyDisplay amount={totalWithdrawn} className="text-2xl font-bold" />,
      icon: ArrowDownToLine,
      gradient: "from-rose-500 to-pink-500",
      iconBg: "bg-rose-100 dark:bg-rose-950/40",
      iconColor: "text-rose-600 dark:text-rose-400",
    },
  ];

  const submissionStats = [
    {
      label: "Pending",
      count: pendingQ.data?.pagination.total ?? 0,
      loading: pendingQ.isLoading,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-950/40",
    },
    {
      label: "Approved",
      count: approvedQ.data?.pagination.total ?? 0,
      loading: approvedQ.isLoading,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-950/40",
    },
    {
      label: "Rejected",
      count: rejectedQ.data?.pagination.total ?? 0,
      loading: rejectedQ.isLoading,
      icon: XCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-950/40",
    },
  ];

  const quickActions = [
    { label: "Browse Tasks", icon: ListChecks, view: "user-tasks" as const, color: "from-violet-500 to-fuchsia-500" },
    { label: "Withdraw Funds", icon: Banknote, view: "user-withdraw" as const, color: "from-emerald-500 to-teal-500" },
    { label: "My Submissions", icon: FileCheck, view: "user-submissions" as const, color: "from-amber-500 to-orange-500" },
    { label: "Transaction History", icon: ArrowRight, view: "user-transactions" as const, color: "from-rose-500 to-pink-500" },
    { label: "Referrals", icon: Users, view: "user-referrals" as const, color: "from-blue-500 to-cyan-500" },
    { label: "Notifications", icon: Bell, view: "user-notifications" as const, color: "from-purple-500 to-violet-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-6 md:p-8 text-white shadow-lg">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-4 -bottom-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back, {userLoading ? "…" : user?.fullName?.split(" ")[0] || "User"}! 👋
          </h1>
          <p className="mt-1 text-sm md:text-base text-white/90">
            Here&apos;s what&apos;s happening with your {settings?.siteName || "TaskReward"} account today.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-white/15 backdrop-blur px-4 py-2">
              <div className="text-xs text-white/80">Available Balance</div>
              <div className="text-lg font-bold">
                {walletLoading ? "…" : <CurrencyDisplay amount={balance} />}
              </div>
            </div>
            <Button
              onClick={() => setView("user-tasks")}
              className="bg-white text-violet-700 hover:bg-white/90 font-semibold"
              size="sm"
            >
              <ListChecks className="h-4 w-4 mr-1" />
              Start Earning
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-4 overflow-hidden relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <div className="mt-2">
                  {walletLoading && userLoading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    stat.value
                  )}
                </div>
              </div>
              <div className={`h-10 w-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tasks + submission summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 lg:col-span-1 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20 border-violet-200 dark:border-violet-900">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
              <ListChecks className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Available Tasks</p>
              <div className="text-2xl font-bold">{tasksData?.pagination.total ?? "—"}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/40"
            onClick={() => setView("user-tasks")}
          >
            View all tasks <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Card>

        {submissionStats.map((s, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-6 w-6 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">{s.label}</p>
                <div className="text-2xl font-bold">
                  {s.loading ? <Skeleton className="h-7 w-8" /> : s.count}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-muted-foreground hover:bg-muted"
              onClick={() => setView("user-submissions")}
            >
              View submissions <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Announcements */}
        <Card className="lg:col-span-1 p-0 overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-violet-500" />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {annLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !announcements || announcements.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No active announcements
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`p-3 rounded-lg border-l-4 ${ANNOUNCEMENT_STYLE[ann.type] || ANNOUNCEMENT_STYLE.INFO}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm">{ann.title}</h4>
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                        {ann.type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{ann.message}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground/70">
                      {formatRelativeTime(ann.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRight className="h-4 w-4 text-violet-500" />
                Recent Transactions
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setView("user-transactions")}>
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {txLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !txData?.transactions || txData.transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No transactions yet
              </div>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {txData.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {TRANSACTION_TYPE_LABELS[tx.type] || tx.type}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            tx.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              : tx.status === "PENDING"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          } border-0`}
                        >
                          {tx.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {tx.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <div
                      className={`font-semibold text-sm whitespace-nowrap ${
                        tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      <CurrencyDisplay amount={tx.amount} showSign />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="p-4">
        <CardTitle className="text-base mb-4 px-2">Quick Actions</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.view}
              onClick={() => setView(action.view)}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div
                className={`h-10 w-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
