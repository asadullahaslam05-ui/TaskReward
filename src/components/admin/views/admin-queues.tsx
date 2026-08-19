"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ListChecks,
  Inbox,
  Banknote,
  CreditCard,
  Clock,
  CalendarX,
  Flag,
  LifeBuoy,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { apiGet } from "@/lib/api-client/client";
import { useAppStore, type AppView } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface QueuesData {
  pendingRegistrationPayments: number;
  pendingTaskSubmissions: number;
  pendingWithdrawals: number;
  pendingMembershipPayments: number;
  expiringMemberships: number;
  expiredMemberships: number;
  flaggedUsers: number;
  openSupportTickets: number;
  totalPending: number;
}

/**
 * The /api/supabase/admin/queues endpoint returns counts at the top level
 * (matching the actual route handler). Some documented shapes wrap the
 * counts under a `queues` key — we accept both forms for robustness.
 */
interface QueuesResponse extends Partial<QueuesData> {
  queues?: Partial<QueuesData>;
}

interface QueueCardConfig {
  key: keyof Omit<QueuesData, "totalPending">;
  label: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  view: AppView;
}

const QUEUE_CARDS: QueueCardConfig[] = [
  {
    key: "pendingRegistrationPayments",
    label: "Registration Payments",
    description: "Pending manual verification",
    icon: CreditCard,
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-950/50",
    view: "admin-payments",
  },
  {
    key: "pendingTaskSubmissions",
    label: "Task Submissions",
    description: "Awaiting approval",
    icon: Inbox,
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-950/50",
    view: "admin-task-submissions",
  },
  {
    key: "pendingWithdrawals",
    label: "Withdrawals",
    description: "Pending payout requests",
    icon: Banknote,
    iconColor: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-100 dark:bg-rose-950/50",
    view: "admin-withdrawals",
  },
  {
    key: "pendingMembershipPayments",
    label: "Membership Payments",
    description: "Pending activation",
    icon: CreditCard,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
    view: "admin-membership-payments",
  },
  {
    key: "expiringMemberships",
    label: "Expiring Memberships",
    description: "Expires within 7 days",
    icon: Clock,
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-950/50",
    view: "admin-memberships",
  },
  {
    key: "expiredMemberships",
    label: "Expired Memberships",
    description: "Requires renewal",
    icon: CalendarX,
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-950/50",
    view: "admin-memberships",
  },
  {
    key: "flaggedUsers",
    label: "Flagged Users",
    description: "Marked for review",
    icon: Flag,
    iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
    iconBg: "bg-fuchsia-100 dark:bg-fuchsia-950/50",
    view: "admin-users",
  },
  {
    key: "openSupportTickets",
    label: "Support Tickets",
    description: "Open tickets",
    icon: LifeBuoy,
    iconColor: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-100 dark:bg-teal-950/50",
    view: "admin-support",
  },
];

export function AdminQueues() {
  const setView = useAppStore((s) => s.setView);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<QueuesResponse>({
      queryKey: ["admin-queues"],
      queryFn: () => apiGet<QueuesResponse>("/api/supabase/admin/queues"),
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    });

  // Resolve counts from either the top-level or a nested `queues` wrapper
  const resolved: Partial<QueuesData> = { ...(data?.queues || {}), ...data };
  const totalPending =
    resolved.totalPending ??
    QUEUE_CARDS.reduce(
      (sum, c) => sum + (Number(resolved[c.key]) || 0),
      0
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-violet-500" />
            Action Queues
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Items across the platform awaiting admin review. Auto-refreshes every 60 seconds.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Total Pending Banner */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : isError ? (
        <Card className="p-6 border-red-200 bg-red-50 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-700 dark:text-red-400">
                Failed to load queues
              </p>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                {(error as Error)?.message || "An unexpected error occurred."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          className={cn(
            "p-6 overflow-hidden relative",
            totalPending > 0
              ? "border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20"
              : "border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20"
          )}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "h-14 w-14 rounded-xl flex items-center justify-center shadow-sm",
                  totalPending > 0
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-500 text-white"
                )}
              >
                {totalPending > 0 ? (
                  <AlertTriangle className="h-7 w-7" />
                ) : (
                  <ListChecks className="h-7 w-7" />
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Total Pending Items
                </div>
                <div className="text-4xl font-bold tracking-tight mt-0.5">
                  {totalPending}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {totalPending > 0
                    ? "Action required across queues"
                    : "All clear — nothing pending"}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  isFetching ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                )}
              />
              {isFetching ? "Updating..." : "Auto-refresh every 60s"}
            </div>
          </div>
        </Card>
      )}

      {/* Queue Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-11 w-11 rounded-lg" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <Skeleton className="h-4 w-32 mt-4" />
                <Skeleton className="h-3 w-40 mt-2" />
                <Skeleton className="h-8 w-full mt-4" />
              </Card>
            ))
          : !isError &&
            QUEUE_CARDS.map((card) => {
              const count = Number(resolved[card.key]) || 0;
              const Icon = card.icon;
              const hasItems = count > 0;
              return (
                <Card
                  key={card.key}
                  className={cn(
                    "p-5 flex flex-col gap-3 transition-all hover:shadow-md",
                    hasItems && "ring-1 ring-amber-200 dark:ring-amber-900/40"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-lg flex items-center justify-center",
                        card.iconBg
                      )}
                    >
                      <Icon className={cn("h-5 w-5", card.iconColor)} />
                    </div>
                    <div
                      className={cn(
                        "text-3xl font-bold tracking-tight tabular-nums",
                        hasItems ? card.iconColor : "text-muted-foreground"
                      )}
                    >
                      {count}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm">{card.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {card.description}
                    </p>
                  </div>

                  <Button
                    variant={hasItems ? "default" : "outline"}
                    size="sm"
                    className="mt-auto w-full"
                    onClick={() => setView(card.view)}
                    disabled={!hasItems}
                  >
                    {hasItems ? "View" : "None Pending"}
                    {hasItems && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
                  </Button>
                </Card>
              );
            })}
      </div>

      {/* Info footer */}
      {!isLoading && !isError && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Queue counts are aggregated in real time across the database. Each
              card links directly to the relevant admin section for review and
              action. Counts refresh automatically every 60 seconds while this
              page is open.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
