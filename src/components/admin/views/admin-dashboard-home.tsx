"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { apiGet } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { formatDateShort } from "@/lib/utils-fin";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  UserX,
  ListChecks,
  CheckSquare,
  CreditCard,
  Inbox,
  Banknote,
  DollarSign,
  Gift,
  ArrowDownToLine,
  TrendingUp,
  ArrowRight,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type AnalyticsSummary = {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  totalTasks: number;
  activeTasks: number;
  pendingPayments: number;
  pendingSubmissions: number;
  pendingWithdrawals: number;
  paidWithdrawals: number;
  totalRevenue: number;
  totalRewards: number;
  totalWithdrawn: number;
};

type ChartPoint = { date: string; count: number };

type AnalyticsResponse = {
  summary: AnalyticsSummary;
  charts: {
    registrations: ChartPoint[];
    taskSubmissions: ChartPoint[];
    withdrawals: ChartPoint[];
    paymentsApproved: ChartPoint[];
  };
  range: number;
};

const RANGE_OPTIONS: { label: string; value: number }[] = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
];

export function AdminDashboardHome() {
  const [range, setRange] = useState<number>(30);
  const { setView } = useAppStore();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AnalyticsResponse>({
    queryKey: ["admin-analytics", range],
    queryFn: () => apiGet<AnalyticsResponse>(`/api/supabase/admin/analytics?range=${range}`),
  });

  const summary = data?.summary;
  const charts = data?.charts;

  const statCards: {
    label: string;
    value: string | number;
    icon: any;
    iconColor: string;
    isCurrency?: boolean;
    onClick?: () => void;
  }[] = summary
    ? [
        {
          label: "Total Users",
          value: summary.totalUsers,
          icon: Users,
          iconColor: "from-violet-500 to-fuchsia-500",
          onClick: () => setView("admin-users"),
        },
        {
          label: "Active Users",
          value: summary.activeUsers,
          icon: UserCheck,
          iconColor: "from-emerald-500 to-teal-500",
          onClick: () => setView("admin-users"),
        },
        {
          label: "Pending Users",
          value: summary.pendingUsers,
          icon: UserX,
          iconColor: "from-amber-500 to-orange-500",
          onClick: () => setView("admin-users"),
        },
        {
          label: "Total Tasks",
          value: summary.totalTasks,
          icon: ListChecks,
          iconColor: "from-violet-500 to-purple-500",
          onClick: () => setView("admin-tasks"),
        },
        {
          label: "Active Tasks",
          value: summary.activeTasks,
          icon: CheckSquare,
          iconColor: "from-emerald-500 to-green-500",
          onClick: () => setView("admin-tasks"),
        },
        {
          label: "Pending Payments",
          value: summary.pendingPayments,
          icon: CreditCard,
          iconColor: "from-amber-500 to-yellow-500",
          onClick: () => setView("admin-payments"),
        },
        {
          label: "Pending Submissions",
          value: summary.pendingSubmissions,
          icon: Inbox,
          iconColor: "from-amber-500 to-orange-500",
          onClick: () => setView("admin-task-submissions"),
        },
        {
          label: "Pending Withdrawals",
          value: summary.pendingWithdrawals,
          icon: Banknote,
          iconColor: "from-amber-500 to-orange-500",
          onClick: () => setView("admin-withdrawals"),
        },
        {
          label: "Total Revenue",
          value: summary.totalRevenue,
          icon: DollarSign,
          iconColor: "from-emerald-500 to-teal-500",
          isCurrency: true,
        },
        {
          label: "Total Rewards",
          value: summary.totalRewards,
          icon: Gift,
          iconColor: "from-fuchsia-500 to-pink-500",
          isCurrency: true,
        },
        {
          label: "Total Withdrawn",
          value: summary.totalWithdrawn,
          icon: ArrowDownToLine,
          iconColor: "from-rose-500 to-red-500",
          isCurrency: true,
        },
      ]
    : [];

  const quickLinks = summary
    ? [
        {
          label: "Pending Payments",
          value: summary.pendingPayments,
          view: "admin-payments" as const,
          color: "from-amber-500 to-yellow-500",
          icon: CreditCard,
        },
        {
          label: "Pending Submissions",
          value: summary.pendingSubmissions,
          view: "admin-task-submissions" as const,
          color: "from-violet-500 to-purple-500",
          icon: Inbox,
        },
        {
          label: "Pending Withdrawals",
          value: summary.pendingWithdrawals,
          view: "admin-withdrawals" as const,
          color: "from-rose-500 to-red-500",
          icon: Banknote,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of platform performance and pending actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-background p-1 shadow-sm">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                disabled={isFetching}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  range === opt.value
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Activity className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-6 text-center text-sm text-red-700 dark:text-red-400">
            Failed to load analytics. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {isLoading
          ? Array.from({ length: 11 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : statCards.map((card) => (
              <button
                key={card.label}
                onClick={card.onClick}
                disabled={!card.onClick}
                className="text-left disabled:cursor-default"
              >
                <Card
                  className={`p-4 shadow-sm hover:shadow-md transition-all ${
                    card.onClick ? "hover:border-violet-300 cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`h-9 w-9 rounded-lg bg-gradient-to-br ${card.iconColor} flex items-center justify-center shadow-sm`}
                    >
                      <card.icon className="h-4 w-4 text-white" />
                    </div>
                    {card.onClick && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50" />
                    )}
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight">
                    {card.isCurrency ? (
                      <CurrencyDisplay amount={Number(card.value)} />
                    ) : (
                      card.value
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {card.label}
                  </div>
                </Card>
              </button>
            ))}
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        charts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="User Registrations"
              description={`New users over last ${range} days`}
              icon={<TrendingUp className="h-4 w-4 text-violet-500" />}
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={charts.registrations}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatDateShort(d)}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(d) => formatDateShort(d as string)}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="Registrations"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Task Submissions"
              description={`Submissions over last ${range} days`}
              icon={<Inbox className="h-4 w-4 text-fuchsia-500" />}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.taskSubmissions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatDateShort(d)}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(d) => formatDateShort(d as string)}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#d946ef" radius={[4, 4, 0, 0]} name="Submissions" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Withdrawals"
              description={`Withdrawal requests over last ${range} days`}
              icon={<Banknote className="h-4 w-4 text-rose-500" />}
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={charts.withdrawals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatDateShort(d)}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(d) => formatDateShort(d as string)}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={false}
                    name="Withdrawals"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Payments Approved"
              description={`Approved registration payments over last ${range} days`}
              icon={<CreditCard className="h-4 w-4 text-emerald-500" />}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.paymentsApproved}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatDateShort(d)}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(d) => formatDateShort(d as string)}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Approved" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )
      )}

      {/* Quick links */}
      {!isLoading && quickLinks.length > 0 && (
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base">Pending Actions</CardTitle>
            <CardDescription>Quick access to items awaiting your review</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {quickLinks.map((q) => (
                <button
                  key={q.label}
                  onClick={() => setView(q.view)}
                  className="text-left rounded-xl border p-4 hover:shadow-md hover:border-violet-300 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`h-10 w-10 rounded-lg bg-gradient-to-br ${q.color} flex items-center justify-center shadow-sm`}
                    >
                      <q.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold">{q.value}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-medium">{q.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChartCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}
