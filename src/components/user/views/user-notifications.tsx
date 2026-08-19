"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api-client/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  BellOff,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Mail,
  MailOpen,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, formatDate } from "@/lib/utils-fin";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// ---------- Types ----------
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string; // INFO | SUCCESS | WARNING | IMPORTANT
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ---------- Helpers ----------
const TYPE_ICON: Record<string, any> = {
  INFO: Info,
  SUCCESS: CheckCircle2,
  WARNING: AlertTriangle,
  IMPORTANT: AlertOctagon,
};

const TYPE_COLOR: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  SUCCESS:
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  WARNING:
    "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  IMPORTANT:
    "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
};

const TYPE_BORDER: Record<string, string> = {
  INFO: "border-l-blue-500",
  SUCCESS: "border-l-emerald-500",
  WARNING: "border-l-amber-500",
  IMPORTANT: "border-l-red-500",
};

// ---------- Component ----------
export function UserNotifications() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", page],
    queryFn: () =>
      apiGet<NotificationsResponse>(
        `/api/supabase/notifications?page=${page}&pageSize=${pageSize}`
      ),
  });

  // Mark all read
  const markAllMutation = useMutation({
    mutationFn: () => apiPatch("/api/supabase/notifications", { markAllRead: true }),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to mark all as read"),
  });

  // Mark single read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiPatch("/api/supabase/notifications", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to mark as read"),
  });

  const handleClick = (n: Notification) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
  };

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-violet-600" />
            Notifications
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Stay updated on your account activity and announcements.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            variant="outline"
            className="border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-300 dark:hover:bg-violet-950/30"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Unread summary */}
      {unreadCount > 0 && (
        <Card className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bell className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold">
                {unreadCount} unread{" "}
                {unreadCount === 1 ? "notification" : "notifications"}
              </div>
              <div className="text-white/80 text-sm">
                You have new activity to review.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications list */}
      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>
            Showing {notifications.length} of {pagination?.total || 0}{" "}
            notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-500">
              Failed to load notifications. Please try again.
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                You&apos;ll see notifications here when there&apos;s activity on
                your account, withdrawals, tasks, or system announcements.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] || Info;
                const colorClass =
                  TYPE_COLOR[n.type] ||
                  TYPE_COLOR.INFO;
                const borderClass =
                  TYPE_BORDER[n.type] || TYPE_BORDER.INFO;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left flex items-start gap-3 p-4 rounded-lg border-l-4 ${borderClass} bg-card hover:bg-muted/40 transition-colors ${
                      !n.isRead ? "ring-1 ring-violet-100 dark:ring-violet-900/40" : ""
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm ${
                            !n.isRead ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {n.title}
                        </span>
                        {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-violet-500 flex-shrink-0" />
                        )}
                        {n.type !== "INFO" && (
                          <Badge variant="outline" className="text-xs">
                            {n.type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-1">
                        {n.isRead ? (
                          <MailOpen className="h-3 w-3" />
                        ) : (
                          <Mail className="h-3 w-3" />
                        )}
                        {formatRelativeTime(n.createdAt)}
                        <span className="mx-1">·</span>
                        <span title={formatDate(n.createdAt)}>
                          {formatDate(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 pt-4 border-t">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={
                        page <= 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      const startPage = Math.max(
                        1,
                        Math.min(pagination.totalPages - 4, page - 2)
                      );
                      const p = startPage + i;
                      if (p > pagination.totalPages) return null;
                      return (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === page}
                            onClick={() => setPage(p)}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setPage((p) =>
                          Math.min(pagination.totalPages, p + 1)
                        )
                      }
                      className={
                        page >= pagination.totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
