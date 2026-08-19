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
import { SignedImage } from "@/components/shared/signed-image";
import { formatDate, formatDateShort } from "@/lib/utils-fin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard,
  Check,
  X,
  Eye,
  Image as ImageIcon,
  ChevronRight,
  Inbox,
  User as UserIcon,
  Hash,
  Wallet,
  Calendar,
} from "lucide-react";

type PaymentUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
};

type PaymentMethod = {
  id: string;
  name: string;
  code: string;
};

type RegistrationPayment = {
  id: string;
  userId: string;
  paymentMethodId: string;
  user: PaymentUser;
  paymentMethod: PaymentMethod;
  senderName: string;
  senderAccount: string;
  transactionId: string;
  amount: number;
  paymentDate: string;
  screenshotUrl: string;
  note: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type PaymentsResponse = {
  payments: RegistrationPayment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

const PAGE_SIZE = 20;

export function AdminPayments() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [detailPayment, setDetailPayment] = useState<RegistrationPayment | null>(null);
  const [screenshotPayment, setScreenshotPayment] = useState<RegistrationPayment | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    action: "APPROVED" | "REJECTED" | null;
    payment: RegistrationPayment | null;
  }>({ open: false, action: null, payment: null });
  const [adminNote, setAdminNote] = useState("");

  const queryPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    return `/api/supabase/admin/registration-payments?${params.toString()}`;
  }, [page, statusFilter]);

  const { data, isLoading, isFetching, isError } = useQuery<PaymentsResponse>({
    queryKey: ["admin-payments", queryPath],
    queryFn: () => apiGet<PaymentsResponse>(queryPath),
  });

  const payments = data?.payments ?? [];
  const pagination = data?.pagination;

  const reviewMutation = useMutation({
    mutationFn: (vars: { id: string; action: "APPROVED" | "REJECTED"; adminNote: string }) =>
      apiPatch(`/api/supabase/admin/registration-payments/${vars.id}`, {
        action: vars.action,
        adminNote: vars.adminNote,
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.action === "APPROVED"
          ? "Payment approved & user activated"
          : "Payment rejected"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setReviewDialog({ open: false, action: null, payment: null });
      setAdminNote("");
      setDetailPayment(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update payment"),
  });

  const openReview = (payment: RegistrationPayment, action: "APPROVED" | "REJECTED") => {
    setReviewDialog({ open: true, action, payment });
    setAdminNote("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Registration Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve pending registration payments.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-bold mt-1">{pagination?.total ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pending (page)</div>
          <div className="text-xl font-bold mt-1 text-amber-600">
            {payments.filter((p) => p.status === "PENDING").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Approved (page)</div>
          <div className="text-xl font-bold mt-1 text-emerald-600">
            {payments.filter((p) => p.status === "APPROVED").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Rejected (page)</div>
          <div className="text-xl font-bold mt-1 text-red-600">
            {payments.filter((p) => p.status === "REJECTED").length}
          </div>
        </Card>
      </div>

      {/* List */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="border-b p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-violet-500" />
            Payments
          </CardTitle>
        </CardHeader>

        {isError ? (
          <CardContent className="py-10 text-center text-sm text-red-600">
            Failed to load payments.
          </CardContent>
        ) : isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No payments found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {statusFilter !== "ALL"
                ? `No ${statusFilter.toLowerCase()} payments.`
                : "Payments will appear here once users submit them."}
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
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs font-semibold">
                              {p.user?.fullName?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.user?.fullName || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.user?.email || "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-0 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          {p.paymentMethod?.name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <CurrencyDisplay amount={p.amount} />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{p.transactionId}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.senderName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateShort(p.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailPayment(p)}
                            className="h-8 px-2"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {p.status === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => openReview(p, "APPROVED")}
                                className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReview(p, "REJECTED")}
                                className="h-8 px-2 border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {payments.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-sm font-semibold">
                          {p.user?.fullName?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.user?.fullName || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.user?.email || "—"}</div>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Method</div>
                      <div className="font-medium mt-0.5">{p.paymentMethod?.name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Amount</div>
                      <div className="font-medium mt-0.5">
                        <CurrencyDisplay amount={p.amount} />
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Transaction ID</div>
                      <div className="font-mono mt-0.5 truncate">{p.transactionId}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Sender</div>
                      <div className="font-medium mt-0.5">{p.senderName}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailPayment(p)}
                      className="flex-1"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                    {p.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openReview(p, "APPROVED")}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReview(p, "REJECTED")}
                          className="flex-1 border-red-300 text-red-700"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
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
            {isFetching ? "Loading..." : `Showing ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`}
          </div>
          <Pagination className="mx-0 justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={pagination.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className={pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailPayment} onOpenChange={(o) => !o && setDetailPayment(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailPayment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-violet-500" />
                  Payment Details
                </DialogTitle>
                <DialogDescription>
                  Submitted on {formatDate(detailPayment.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* User info */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold">
                      {detailPayment.user?.fullName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{detailPayment.user?.fullName || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{detailPayment.user?.email || "—"}</div>
                    {detailPayment.user?.phone && (
                      <div className="text-xs text-muted-foreground">{detailPayment.user?.phone}</div>
                    )}
                  </div>
                  <StatusBadge status={detailPayment.status} />
                </div>

                {/* Payment details */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow
                    icon={<Wallet className="h-4 w-4" />}
                    label="Method"
                    value={detailPayment.paymentMethod?.name || "—"}
                  />
                  <DetailRow
                    icon={<Wallet className="h-4 w-4" />}
                    label="Amount"
                    value={<CurrencyDisplay amount={detailPayment.amount} />}
                  />
                  <DetailRow
                    icon={<Hash className="h-4 w-4" />}
                    label="Transaction ID"
                    value={
                      <span className="font-mono text-xs break-all">{detailPayment.transactionId}</span>
                    }
                  />
                  <DetailRow
                    icon={<UserIcon className="h-4 w-4" />}
                    label="Sender Name"
                    value={detailPayment.senderName}
                  />
                  <DetailRow
                    icon={<UserIcon className="h-4 w-4" />}
                    label="Sender Account"
                    value={detailPayment.senderAccount || "—"}
                  />
                  <DetailRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Payment Date"
                    value={formatDateShort(detailPayment.paymentDate)}
                  />
                </div>

                {/* Note */}
                {detailPayment.note && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">User Note</div>
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      {detailPayment.note}
                    </div>
                  </div>
                )}

                {/* Admin note */}
                {detailPayment.adminNote && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Admin Note</div>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-sm">
                      {detailPayment.adminNote}
                    </div>
                  </div>
                )}

                {/* Screenshot */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Payment Screenshot</div>
                  <button
                    onClick={() => setScreenshotPayment(detailPayment)}
                    className="block w-full"
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted/50 hover:border-violet-300 transition-colors">
                      {detailPayment.screenshotUrl ? (
                        <SignedImage
                          path={detailPayment.screenshotUrl}
                          bucket="payment-proofs"
                          alt="Payment screenshot"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          No screenshot
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Actions */}
                {detailPayment.status === "PENDING" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => openReview(detailPayment, "APPROVED")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openReview(detailPayment, "REJECTED")}
                      className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog
        open={reviewDialog.open}
        onOpenChange={(o) => {
          if (!o) {
            setReviewDialog({ open: false, action: null, payment: null });
            setAdminNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewDialog.action === "APPROVED" ? (
                <>
                  <Check className="h-5 w-5 text-emerald-600" />
                  Approve Payment
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-red-600" />
                  Reject Payment
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === "APPROVED"
                ? "Approving this payment will activate the user account. The user will be notified."
                : "Rejecting this payment will mark the user as REJECTED. The user will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="adminNote" className="text-xs">
              Admin Note {reviewDialog.action === "REJECTED" && "(required)"}
            </Label>
            <Textarea
              id="adminNote"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder={
                reviewDialog.action === "APPROVED"
                  ? "Optional note for approval..."
                  : "Reason for rejection..."
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialog({ open: false, action: null, payment: null });
                setAdminNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (reviewDialog.payment && reviewDialog.action) {
                  if (reviewDialog.action === "REJECTED" && !adminNote.trim()) {
                    toast.error("Please provide a reason for rejection");
                    return;
                  }
                  reviewMutation.mutate({
                    id: reviewDialog.payment.id,
                    action: reviewDialog.action,
                    adminNote: adminNote.trim(),
                  });
                }
              }}
              disabled={
                reviewMutation.isPending ||
                (reviewDialog.action === "REJECTED" && !adminNote.trim())
              }
              className={
                reviewDialog.action === "APPROVED"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {reviewMutation.isPending
                ? "Processing..."
                : reviewDialog.action === "APPROVED"
                ? "Confirm Approve"
                : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot viewer */}
      <Dialog
        open={!!screenshotPayment}
        onOpenChange={(o) => !o && setScreenshotPayment(null)}
      >
        <DialogContent className="sm:max-w-3xl p-2" showCloseButton>
        <DialogHeader className="p-2">
            <DialogTitle className="text-sm">Payment Screenshot</DialogTitle>
            <DialogDescription className="text-xs">
              {screenshotPayment?.user?.fullName || "—"} • Txn: {screenshotPayment?.transactionId}
            </DialogDescription>
          </DialogHeader>
          {screenshotPayment && (
            <div className="overflow-auto max-h-[80vh]">
              {screenshotPayment.screenshotUrl ? (
                <SignedImage
                  path={screenshotPayment.screenshotUrl}
                  bucket="payment-proofs"
                  alt="Payment screenshot"
                  className="w-full h-auto"
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No screenshot attached
                </div>
              )}
            </div>
          )}
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
