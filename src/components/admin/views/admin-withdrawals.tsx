"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, uploadFile } from "@/lib/api-client/client";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Banknote,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  Upload,
  Receipt,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";
import { SignedImage } from "@/components/shared/signed-image";

type Withdrawal = {
  id: string;
  amount: number;
  fee: number;
  status: string;
  adminNote?: string | null;
  paymentTransactionId?: string | null;
  paymentProofUrl?: string | null;
  payoutAccountId?: string | null;
  payoutAccountHolder: string;
  payoutAccountNumber: string;
  payoutWalletAddress?: string | null;
  payoutNetwork?: string | null;
  note?: string | null;
  createdAt: string;
  paidAt?: string | null;
  reviewedAt?: string | null;
  user: { id: string; email: string; username?: string | null; fullName?: string | null };
  paymentMethod: { id: string; name: string; type: string };
};

type WithdrawalsResponse = {
  withdrawals: Withdrawal[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_OPTIONS = ["", "PENDING", "APPROVED", "PROCESSING", "PAID", "REJECTED", "CANCELLED"];

export function AdminWithdrawals() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [pageSize] = useState(20);

  const [viewWithdrawal, setViewWithdrawal] = useState<Withdrawal | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    withdrawal: Withdrawal;
    action: "APPROVED" | "REJECTED" | "PROCESSING" | "PAID";
  } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [txnId, setTxnId] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const queryKey = ["admin-withdrawals", page, pageSize, status];

  const { data, isLoading, isError } = useQuery<WithdrawalsResponse>({
    queryKey,
    queryFn: () =>
      apiGet<WithdrawalsResponse>(
        `/api/supabase/admin/withdrawals?page=${page}&pageSize=${pageSize}&status=${status}`
      ),
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!actionDialog) throw new Error("No action");
      const { withdrawal, action } = actionDialog;
      const payload: Record<string, unknown> = { action, adminNote: adminNote.trim() };

      if (action === "PAID") {
        payload.paymentTransactionId = txnId.trim();
        if (proofFile) {
          setUploadingProof(true);
          try {
            const uploaded = await uploadFile(proofFile, "payout-proofs", "payout");
            payload.paymentProofUrl = uploaded.path;
          } finally {
            setUploadingProof(false);
          }
        }
      }

      return apiPatch(`/api/supabase/admin/withdrawals/${withdrawal.id}`, payload);
    },
    onSuccess: (_d, _vars) => {
      const label =
        actionDialog?.action === "APPROVED"
          ? "approved"
          : actionDialog?.action === "REJECTED"
            ? "rejected"
            : actionDialog?.action === "PROCESSING"
              ? "marked as processing"
              : "marked as paid";
      toast.success(`Withdrawal ${label}`);
      queryClient.invalidateQueries({ queryKey });
      closeActionDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAction = (
    withdrawal: Withdrawal,
    action: "APPROVED" | "REJECTED" | "PROCESSING" | "PAID"
  ) => {
    setActionDialog({ withdrawal, action });
    setAdminNote("");
    setTxnId("");
    setProofFile(null);
  };

  const closeActionDialog = () => {
    setActionDialog(null);
    setAdminNote("");
    setTxnId("");
    setProofFile(null);
    setViewWithdrawal(null);
  };

  const submitAction = () => {
    if (!actionDialog) return;

    if (actionDialog.action === "REJECTED" && !adminNote.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (actionDialog.action === "PAID" && !txnId.trim()) {
      toast.error("Transaction ID is required when marking as paid");
      return;
    }
    actionMutation.mutate();
  };

  const exportCSV = () => {
    if (!data?.withdrawals.length) {
      toast.error("No withdrawals to export");
      return;
    }
    const headers = [
      "ID",
      "User",
      "Email",
      "Amount",
      "Fee",
      "Total",
      "Method",
      "Account Holder",
      "Account Number",
      "Wallet Address",
      "Network",
      "Status",
      "Txn ID",
      "Created",
      "Paid At",
    ];
    const rows = data.withdrawals.map((w) => [
      w.id,
      w.user?.fullName || w.user?.username || "",
      w.user?.email || "",
      w.amount,
      w.fee,
      w.amount + w.fee,
      w.paymentMethod?.name || "—",
      w.payoutAccountHolder,
      w.payoutAccountNumber,
      w.payoutWalletAddress || "",
      w.payoutNetwork || "",
      w.status,
      w.paymentTransactionId || "",
      w.createdAt,
      w.paidAt || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `withdrawals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  const actionLabel =
    actionDialog?.action === "APPROVED"
      ? "Approve"
      : actionDialog?.action === "REJECTED"
        ? "Reject"
        : actionDialog?.action === "PROCESSING"
          ? "Mark as Processing"
          : "Mark as Paid";

  const actionColor =
    actionDialog?.action === "APPROVED"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : actionDialog?.action === "REJECTED"
        ? "bg-red-600 hover:bg-red-700 text-white"
        : actionDialog?.action === "PROCESSING"
          ? "bg-blue-600 hover:bg-blue-700 text-white"
          : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-violet-500" />
            Withdrawals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Process user withdrawal requests ({total} total)
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!data?.withdrawals.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-56">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v === "ALL" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUS_OPTIONS.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead className="min-w-[160px]">Payout To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {isError && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-red-500 py-8">
                    <AlertCircle className="h-5 w-5 inline mr-2" />
                    Failed to load withdrawals.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && data?.withdrawals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No withdrawals found.
                  </TableCell>
                </TableRow>
              )}

              {data?.withdrawals.map((w) => (
                <TableRow key={w.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm">{w.user?.fullName || w.user?.username || "—"}</div>
                      <div className="text-xs text-muted-foreground">{w.user?.email || "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CurrencyDisplay amount={w.amount} className="font-medium" />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      <CurrencyDisplay amount={w.fee} />
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Badge variant="outline" className="text-xs">{w.paymentMethod?.name || "—"}</Badge>
                      <div className="text-xs text-muted-foreground font-mono">
                        {w.payoutWalletAddress
                          ? `${w.payoutWalletAddress.slice(0, 8)}...${w.payoutWalletAddress.slice(-4)}`
                          : w.payoutAccountNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(w.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewWithdrawal(w)}
                        title="View details"
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {w.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAction(w, "APPROVED")}
                            title="Approve"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAction(w, "REJECTED")}
                            title="Reject"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {w.status === "APPROVED" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAction(w, "PROCESSING")}
                            title="Mark as Processing"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                          >
                            <Loader2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAction(w, "PAID")}
                            title="Mark as Paid"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {w.status === "PROCESSING" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openAction(w, "PAID")}
                          title="Mark as Paid"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} withdrawals)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* View details modal */}
      <Dialog open={!!viewWithdrawal} onOpenChange={(o) => !o && setViewWithdrawal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Withdrawal Details</DialogTitle>
            <DialogDescription>
              Full details for withdrawal request
            </DialogDescription>
          </DialogHeader>

          {viewWithdrawal && (
            <div className="space-y-4">
              {/* User */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-xs text-muted-foreground">User</div>
                  <div className="font-medium">{viewWithdrawal.user?.fullName || viewWithdrawal.user?.username || "—"}</div>
                  <div className="text-xs text-muted-foreground">{viewWithdrawal.user?.email || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <StatusBadge status={viewWithdrawal.status} />
                  <div className="text-xs text-muted-foreground mt-1">
                    Requested {formatDate(viewWithdrawal.createdAt)}
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <CurrencyDisplay amount={viewWithdrawal.amount} className="font-semibold text-base" />
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground">Fee</div>
                  <CurrencyDisplay amount={viewWithdrawal.fee} className="font-semibold text-base" />
                </div>
                <div className="p-3 rounded-lg border bg-violet-50 dark:bg-violet-950/30">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <CurrencyDisplay amount={viewWithdrawal.amount + viewWithdrawal.fee} className="font-semibold text-base text-violet-700 dark:text-violet-300" />
                </div>
              </div>

              {/* Payout details */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-violet-500" />
                  Payout Account
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border">
                  <div>
                    <div className="text-xs text-muted-foreground">Method</div>
                    <div className="font-medium">{viewWithdrawal.paymentMethod?.name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Account Holder</div>
                    <div className="font-medium">{viewWithdrawal.payoutAccountHolder}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Account Number</div>
                    <div className="font-mono text-sm">{viewWithdrawal.payoutAccountNumber}</div>
                  </div>
                  {viewWithdrawal.payoutWalletAddress && (
                    <div>
                      <div className="text-xs text-muted-foreground">Wallet Address</div>
                      <div className="font-mono text-xs break-all">{viewWithdrawal.payoutWalletAddress}</div>
                    </div>
                  )}
                  {viewWithdrawal.payoutNetwork && (
                    <div>
                      <div className="text-xs text-muted-foreground">Network</div>
                      <div className="font-medium text-sm">{viewWithdrawal.payoutNetwork}</div>
                    </div>
                  )}
                  {viewWithdrawal.note && (
                    <div className="sm:col-span-2">
                      <div className="text-xs text-muted-foreground">User Note</div>
                      <div className="text-sm">{viewWithdrawal.note}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment proof / txn */}
              {viewWithdrawal.paymentTransactionId && (
                <div className="p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="text-xs text-muted-foreground">Payment Transaction ID</div>
                  <div className="font-mono text-sm">{viewWithdrawal.paymentTransactionId}</div>
                  {viewWithdrawal.paidAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Paid on {formatDate(viewWithdrawal.paidAt)}
                    </div>
                  )}
                </div>
              )}

              {viewWithdrawal.paymentProofUrl && (
                <div>
                  <Label className="mb-2 block">Payment Proof</Label>
                  {/* payout-proofs is a PRIVATE bucket — render via a
                      short-lived signed URL (admin-authorized), never a raw
                      storage path or public URL. */}
                  <div className="rounded-lg overflow-hidden border bg-muted">
                    <SignedImage
                      path={viewWithdrawal.paymentProofUrl}
                      bucket="payout-proofs"
                      alt="Payment proof"
                      className="w-full max-h-60 object-contain"
                    />
                  </div>
                </div>
              )}

              {viewWithdrawal.adminNote && (
                <div>
                  <Label className="mb-1 block text-xs">Admin Note</Label>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm">
                    {viewWithdrawal.adminNote}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {viewWithdrawal.status === "PENDING" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => openAction(viewWithdrawal, "APPROVED")}
                    disabled={actionMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => openAction(viewWithdrawal, "REJECTED")}
                    disabled={actionMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
              {viewWithdrawal.status === "APPROVED" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => openAction(viewWithdrawal, "PROCESSING")}
                    disabled={actionMutation.isPending}
                  >
                    <Loader2 className="h-4 w-4 mr-1" /> Mark Processing
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90"
                    onClick={() => openAction(viewWithdrawal, "PAID")}
                    disabled={actionMutation.isPending}
                  >
                    <Receipt className="h-4 w-4 mr-1" /> Mark Paid
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && closeActionDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionLabel} Withdrawal</DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "APPROVED" &&
                "Approve this withdrawal request. Funds remain reserved until paid."}
              {actionDialog?.action === "REJECTED" &&
                "Rejecting will return the reserved funds to the user's wallet. Please provide a reason."}
              {actionDialog?.action === "PROCESSING" &&
                "Mark this withdrawal as currently being processed by the payment provider."}
              {actionDialog?.action === "PAID" &&
                "Mark this withdrawal as paid. Enter the transaction ID for record-keeping."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {actionDialog?.withdrawal && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium">{actionDialog.withdrawal.user?.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    <CurrencyDisplay amount={actionDialog.withdrawal.amount} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium">{actionDialog.withdrawal.paymentMethod?.name || "—"}</span>
                </div>
              </div>
            )}

            {actionDialog?.action === "PAID" && (
              <div>
                <Label htmlFor="txnId">
                  Transaction ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="txnId"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  placeholder="e.g. TXN-XXXX-XXXX"
                />
              </div>
            )}

            {actionDialog?.action === "PAID" && (
              <div>
                <Label htmlFor="proofFile">Payment Proof (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="proofFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                  {proofFile && (
                    <Badge variant="secondary" className="flex-shrink-0">
                      <Upload className="h-3 w-3 mr-1" />
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload a screenshot of the payment confirmation
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="adminNote">
                Admin Note{" "}
                {actionDialog?.action === "REJECTED" && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  actionDialog?.action === "REJECTED"
                    ? "Reason for rejection (required)..."
                    : "Optional note..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>
              Cancel
            </Button>
            <Button
              className={actionColor}
              onClick={submitAction}
              disabled={actionMutation.isPending || uploadingProof}
            >
              {actionMutation.isPending || uploadingProof ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadingProof ? "Uploading..." : "Processing..."}
                </>
              ) : (
                `Confirm ${actionLabel}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
