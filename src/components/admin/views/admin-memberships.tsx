"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { apiGet, apiPatch } from "@/lib/api-client/client";
import { formatDate, formatDateShort } from "@/lib/utils-fin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Crown,
  Eye,
  CalendarPlus,
  CalendarX,
  RefreshCw,
  Inbox,
  User as UserIcon,
  Hash,
  Calendar,
  Wallet,
  ShieldCheck,
} from "lucide-react";

// ------------------------------------------------------------------
// Types — every relation field is optional so `?.` is enforced.
// ------------------------------------------------------------------
type MembershipUser = {
  id?: string;
  email?: string;
  username?: string;
  fullName?: string;
  phone?: string | null;
};

type MembershipPlan = {
  id?: string;
  name?: string;
  monthlyFee?: number;
  description?: string | null;
};

type Membership = {
  id: string;
  userId?: string;
  planId?: string;
  user?: MembershipUser | null;
  plan?: MembershipPlan | null;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  currentPeriodEnd?: string | null;
  nextPaymentDate?: string | null;
  autoRenew?: boolean | null;
  cancelledAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type MembershipsResponse = {
  items?: Membership[];
  memberships?: Membership[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Expiring", value: "EXPIRING" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const PAGE_SIZE = 20;

export function AdminMemberships() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [detailM, setDetailM] = useState<Membership | null>(null);

  // Action dialog state — supports EXTEND / EXPIRE / STATUS
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "EXTEND" | "EXPIRE" | "STATUS" | null;
    membership: Membership | null;
  }>({ open: false, type: null, membership: null });
  const [extendDays, setExtendDays] = useState<string>("7");
  const [extendReason, setExtendReason] = useState<string>("");
  const [newStatus, setNewStatus] = useState<string>("ACTIVE");
  const [statusReason, setStatusReason] = useState<string>("");

  // Build the query path
  const queryPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    return `/api/supabase/admin/memberships?${params.toString()}`;
  }, [page, statusFilter]);

  const { data, isLoading, isFetching, isError } = useQuery<MembershipsResponse>({
    queryKey: ["admin-supabase-memberships", queryPath],
    queryFn: () => apiGet<MembershipsResponse>(queryPath),
  });

  // Handle both `items` and `memberships` response keys
  const memberships: Membership[] = data?.items ?? data?.memberships ?? [];
  const pagination = data?.pagination;

  const actionMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      action: "EXTEND" | "EXPIRE" | "STATUS";
      days?: number;
      reason?: string;
      status?: string;
    }) =>
      apiPatch(`/api/supabase/admin/memberships/${vars.id}`, {
        action: vars.action,
        ...(vars.action === "EXTEND"
          ? { days: vars.days, reason: vars.reason }
          : vars.action === "STATUS"
            ? { status: vars.status, reason: vars.reason }
            : {}),
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.action === "EXTEND"
          ? `Membership extended by ${vars.days} day(s)`
          : vars.action === "EXPIRE"
            ? "Membership expired"
            : `Membership status changed to ${vars.status}`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-supabase-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["admin-supabase-membership-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-supabase-analytics"] });
      setActionDialog({ open: false, type: null, membership: null });
      setExtendDays("7");
      setExtendReason("");
      setStatusReason("");
      setNewStatus("ACTIVE");
      setDetailM(null);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update membership"),
  });

  const openAction = (
    membership: Membership,
    type: "EXTEND" | "EXPIRE" | "STATUS"
  ) => {
    setActionDialog({ open: true, type, membership });
    setExtendDays("7");
    setExtendReason("");
    setStatusReason("");
    setNewStatus(membership?.status || "ACTIVE");
  };

  const submitAction = () => {
    if (!actionDialog.membership || !actionDialog.type) return;
    if (actionDialog.type === "EXTEND") {
      const days = Number(extendDays);
      if (!Number.isFinite(days) || days <= 0) {
        toast.error("Days must be a positive number");
        return;
      }
      actionMutation.mutate({
        id: actionDialog.membership.id,
        action: "EXTEND",
        days,
        reason: extendReason.trim(),
      });
    } else if (actionDialog.type === "EXPIRE") {
      actionMutation.mutate({
        id: actionDialog.membership.id,
        action: "EXPIRE",
        reason: extendReason.trim(),
      });
    } else if (actionDialog.type === "STATUS") {
      actionMutation.mutate({
        id: actionDialog.membership.id,
        action: "STATUS",
        status: newStatus,
        reason: statusReason.trim(),
      });
    }
  };

  const totalActive = memberships.filter((m) => m?.status === "ACTIVE").length;
  const totalExpiring = memberships.filter((m) => m?.status === "EXPIRING").length;
  const totalExpired = memberships.filter((m) => m?.status === "EXPIRED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Memberships
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user memberships, extend expiry, or change status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-bold mt-1">{pagination?.total ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active (page)</div>
          <div className="text-xl font-bold mt-1 text-emerald-600">{totalActive}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Expiring (page)</div>
          <div className="text-xl font-bold mt-1 text-amber-600">{totalExpiring}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Expired (page)</div>
          <div className="text-xl font-bold mt-1 text-red-600">{totalExpired}</div>
        </Card>
      </div>

      {/* List */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="border-b p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-violet-500" />
            Memberships
          </CardTitle>
        </CardHeader>

        {isError ? (
          <CardContent className="py-10 text-center text-sm text-red-600">
            Failed to load memberships.
          </CardContent>
        ) : isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : memberships.length === 0 ? (
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No memberships found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {statusFilter !== "ALL"
                ? `No ${statusFilter.toLowerCase()} memberships.`
                : "Memberships will appear here once users subscribe."}
            </p>
          </CardContent>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Next Payment</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs font-semibold">
                              {m.user?.fullName?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {m.user?.fullName || m.user?.username || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {m.user?.email || "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-0 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                        >
                          {m.plan?.name || "—"}
                        </Badge>
                        {typeof m.plan?.monthlyFee === "number" && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            <CurrencyDisplay amount={m.plan.monthlyFee} />/mo
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={m?.status || "UNKNOWN"} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateShort(m?.startDate || null)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateShort(m?.endDate || m?.currentPeriodEnd || null)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateShort(m?.nextPaymentDate || m?.currentPeriodEnd || null)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailM(m)}
                            className="h-8 px-2"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAction(m, "EXTEND")}
                            className="h-8 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            title="Extend"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAction(m, "STATUS")}
                            className="h-8 px-2"
                            title="Change Status"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAction(m, "EXPIRE")}
                            className="h-8 px-2 border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            title="Expire"
                          >
                            <CalendarX className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {memberships.map((m) => (
                <div key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-sm font-semibold">
                          {m.user?.fullName?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {m.user?.fullName || m.user?.username || "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {m.user?.email || "—"}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={m?.status || "UNKNOWN"} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Plan</div>
                      <div className="font-medium mt-0.5">{m.plan?.name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Monthly Fee</div>
                      <div className="font-medium mt-0.5">
                        {typeof m.plan?.monthlyFee === "number" ? (
                          <CurrencyDisplay amount={m.plan.monthlyFee} />
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Start</div>
                      <div className="font-medium mt-0.5">
                        {formatDateShort(m?.startDate || null)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Expiry</div>
                      <div className="font-medium mt-0.5">
                        {formatDateShort(m?.endDate || m?.currentPeriodEnd || null)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailM(m)}
                      className="flex-1"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAction(m, "EXTEND")}
                      className="flex-1 border-emerald-300 text-emerald-700"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                      Extend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAction(m, "EXPIRE")}
                      className="border-red-300 text-red-700"
                    >
                      <CalendarX className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {isFetching
              ? "Loading..."
              : `Showing ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.total
                )} of ${pagination.total}`}
          </div>
          <Pagination className="mx-0 justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={
                    pagination.page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {buildPageList(pagination.page, pagination.totalPages).map((p, idx) =>
                p === "..." ? (
                  <PaginationItem key={`e-${idx}`}>
                    <span className="px-2 text-muted-foreground">…</span>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === pagination.page}
                      onClick={() => setPage(p as number)}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  className={
                    pagination.page >= pagination.totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailM} onOpenChange={(o) => !o && setDetailM(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailM && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-violet-500" />
                  Membership Details
                </DialogTitle>
                <DialogDescription>
                  Created {formatDate(detailM?.createdAt || null)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* User info */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold">
                      {detailM.user?.fullName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {detailM.user?.fullName || detailM.user?.username || "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {detailM.user?.email || "—"}
                    </div>
                    {detailM.user?.phone && (
                      <div className="text-xs text-muted-foreground">
                        {detailM.user?.phone}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={detailM?.status || "UNKNOWN"} />
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow
                    icon={<Wallet className="h-4 w-4" />}
                    label="Plan"
                    value={detailM.plan?.name || "—"}
                  />
                  <DetailRow
                    icon={<Wallet className="h-4 w-4" />}
                    label="Monthly Fee"
                    value={
                      typeof detailM.plan?.monthlyFee === "number" ? (
                        <CurrencyDisplay amount={detailM.plan.monthlyFee} />
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Start Date"
                    value={formatDate(detailM?.startDate || null)}
                  />
                  <DetailRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Expiry Date"
                    value={formatDate(detailM?.endDate || detailM?.currentPeriodEnd || null)}
                  />
                  <DetailRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Next Payment"
                    value={formatDate(
                      detailM?.nextPaymentDate || detailM?.currentPeriodEnd || null
                    )}
                  />
                  <DetailRow
                    icon={<RefreshCw className="h-4 w-4" />}
                    label="Auto Renew"
                    value={detailM?.autoRenew ? "Enabled" : "Disabled"}
                  />
                  {detailM?.cancelledAt && (
                    <DetailRow
                      icon={<CalendarX className="h-4 w-4" />}
                      label="Cancelled At"
                      value={formatDate(detailM?.cancelledAt)}
                    />
                  )}
                  <DetailRow
                    icon={<Hash className="h-4 w-4" />}
                    label="Membership ID"
                    value={<span className="font-mono text-xs break-all">{detailM.id}</span>}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => openAction(detailM, "EXTEND")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CalendarPlus className="h-4 w-4 mr-1" />
                    Extend
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openAction(detailM, "STATUS")}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Change Status
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openAction(detailM, "EXPIRE")}
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <CalendarX className="h-4 w-4 mr-1" />
                    Expire Now
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action dialog (Extend / Expire / Change Status) */}
      <Dialog
        open={actionDialog.open}
        onOpenChange={(o) => {
          if (!o) {
            setActionDialog({ open: false, type: null, membership: null });
            setExtendDays("7");
            setExtendReason("");
            setStatusReason("");
            setNewStatus("ACTIVE");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog.type === "EXTEND" && (
                <>
                  <CalendarPlus className="h-5 w-5 text-emerald-600" />
                  Extend Membership
                </>
              )}
              {actionDialog.type === "EXPIRE" && (
                <>
                  <CalendarX className="h-5 w-5 text-red-600" />
                  Expire Membership
                </>
              )}
              {actionDialog.type === "STATUS" && (
                <>
                  <RefreshCw className="h-5 w-5 text-violet-600" />
                  Change Membership Status
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.membership && (
                <span>
                  For{" "}
                  <span className="font-medium">
                    {actionDialog.membership.user?.fullName ||
                      actionDialog.membership.user?.email ||
                      "this user"}
                  </span>{" "}
                  ({actionDialog.membership.plan?.name || "—"})
                </span>
              )}
              {actionDialog.type === "EXPIRE" &&
                " — this will mark the membership as EXPIRED and set its end date to now."}
              {actionDialog.type === "EXTEND" &&
                " - extends the expiry date by the given number of days."}
              {actionDialog.type === "STATUS" &&
                " - immediately changes the membership status."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {actionDialog.type === "EXTEND" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="extendDays" className="text-xs">
                    Days to extend <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="extendDays"
                    type="number"
                    min={1}
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extendReason" className="text-xs">
                    Reason (optional)
                  </Label>
                  <Textarea
                    id="extendReason"
                    value={extendReason}
                    onChange={(e) => setExtendReason(e.target.value)}
                    placeholder="Reason for extension..."
                    rows={3}
                  />
                </div>
              </>
            )}

            {actionDialog.type === "EXPIRE" && (
              <div className="space-y-2">
                <Label htmlFor="expireReason" className="text-xs">
                  Reason (optional)
                </Label>
                <Textarea
                  id="expireReason"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Reason for expiring this membership..."
                  rows={3}
                />
              </div>
            )}

            {actionDialog.type === "STATUS" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">New Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="PAUSED">Paused</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statusReason" className="text-xs">
                    Reason (optional)
                  </Label>
                  <Textarea
                    id="statusReason"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Reason for status change..."
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog({ open: false, type: null, membership: null });
                setExtendDays("7");
                setExtendReason("");
                setStatusReason("");
                setNewStatus("ACTIVE");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitAction}
              disabled={
                actionMutation.isPending ||
                (actionDialog.type === "EXTEND" &&
                  (!extendDays || Number(extendDays) <= 0))
              }
              className={
                actionDialog.type === "EXPIRE"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : actionDialog.type === "EXTEND"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : ""
              }
            >
              {actionMutation.isPending
                ? "Processing..."
                : actionDialog.type === "EXTEND"
                  ? "Confirm Extend"
                  : actionDialog.type === "EXPIRE"
                    ? "Confirm Expire"
                    : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function buildPageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}
