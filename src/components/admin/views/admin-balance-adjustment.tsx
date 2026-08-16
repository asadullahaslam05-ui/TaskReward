"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client/client";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StatusBadge } from "@/components/shared/status-badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Wallet,
  AlertCircle,
  Plus,
  Minus,
  ShieldCheck,
  History,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

type UserSummary = {
  id: string;
  email: string;
  username?: string | null;
  fullName?: string | null;
  role: string;
  status: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
};

type UsersResponse = {
  users: UserSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type UserDetail = {
  user: UserSummary & { pendingBalance?: number };
};

type AuditLog = {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeData?: any;
  afterData?: any;
  createdAt: string;
  admin?: { username?: string | null; fullName?: string | null; email?: string | null } | null;
};

type AuditLogsResponse = {
  logs: AuditLog[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export function AdminBalanceAdjustment() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"add" | "remove">("add");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Search users
  const usersQuery = useQuery<UsersResponse>({
    queryKey: ["admin-users-ba-search", submittedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", pageSize: "20" });
      if (submittedSearch) params.set("search", submittedSearch);
      return apiGet<UsersResponse>(`/api/supabase/admin/users?${params.toString()}`);
    },
    enabled: submittedSearch.length > 0,
  });

  // Selected user detail
  const userDetailQuery = useQuery<UserDetail>({
    queryKey: ["admin-user-ba-detail", selectedUserId],
    queryFn: () => apiGet<UserDetail>(`/api/supabase/admin/users/${selectedUserId}`),
    enabled: !!selectedUserId,
  });

  // Recent adjustments (from audit logs filtered by BALANCE)
  const auditQuery = useQuery<AuditLogsResponse>({
    queryKey: ["admin-audit-logs-balance"],
    queryFn: () =>
      apiGet<AuditLogsResponse>(`/api/supabase/admin/audit-logs?action=BALANCE&page=1&pageSize=10`),
  });

  const adjustMutation = useMutation({
    mutationFn: () => {
      const amt = Number(amount);
      if (!selectedUserId) throw new Error("No user selected");
      if (!reason.trim()) throw new Error("Reason is required");
      if (isNaN(amt) || amt <= 0) throw new Error("Amount must be greater than 0");
      return apiPost("/api/supabase/admin/balance-adjustment", {
        userId: selectedUserId,
        amount: amt,
        reason: reason.trim(),
        type,
      });
    },
    onSuccess: () => {
      toast.success("Balance adjusted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-user-ba-detail", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs-balance"] });
      setAmount("");
      setReason("");
      setType("add");
      setConfirmOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSearch = () => {
    setSubmittedSearch(search.trim());
    setSelectedUserId(null);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setAmount("");
    setReason("");
    setType("add");
  };

  const openConfirm = () => {
    const amt = Number(amount);
    if (!selectedUserId) {
      toast.error("Please select a user first");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }
    if (type === "remove" && userDetailQuery.data && amt > userDetailQuery.data.user.balance) {
      toast.warning("Warning: removal amount exceeds user's available balance");
    }
    setConfirmOpen(true);
  };

  const user = userDetailQuery.data?.user;
  const amt = Number(amount) || 0;
  const projectedBalance = user
    ? type === "add"
      ? user.balance + amt
      : user.balance - amt
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-violet-500" />
          Balance Adjustments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manually adjust user wallet balances with audit trail
        </p>
      </div>

      {/* User search */}
      <Card className="p-6 space-y-4">
        <div>
          <Label htmlFor="search">Find User</Label>
          <div className="flex gap-2">
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by email, username, full name, or phone..."
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        {/* Search results */}
        {usersQuery.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {usersQuery.isError && (
          <div className="text-center py-4 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            Failed to search users.
          </div>
        )}

        {usersQuery.data?.users && usersQuery.data.users.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No users found matching "{submittedSearch}".
          </div>
        )}

        {usersQuery.data?.users && usersQuery.data.users.length > 0 && !selectedUserId && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {usersQuery.data.pagination.total} user(s) found — click to select
            </div>
            {usersQuery.data.users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 hover:border-violet-300 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {u.fullName?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {u.fullName || u.username || "Unnamed"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CurrencyDisplay amount={u.balance} className="text-sm font-medium" />
                  <StatusBadge status={u.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Selected user + adjustment form */}
      {selectedUserId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-violet-500" />
                Selected User
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
                Change
              </Button>
            </div>

            {userDetailQuery.isLoading && <Skeleton className="h-32 w-full" />}
            {userDetailQuery.isError && (
              <div className="text-center py-4 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Failed to load user details.
              </div>
            )}

            {user && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-lg">
                    {user.fullName?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{user.fullName || user.username || "Unnamed"}</div>
                    <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                    <StatusBadge status={user.status} className="mt-1" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <span className="text-sm text-muted-foreground">Available Balance</span>
                    <CurrencyDisplay amount={user.balance} className="font-bold text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <span className="text-sm text-muted-foreground">Pending Balance</span>
                    <CurrencyDisplay amount={user.pendingBalance || 0} className="font-bold text-amber-700 dark:text-amber-300" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Earned</span>
                    <CurrencyDisplay amount={user.totalEarned} className="font-medium" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Withdrawn</span>
                    <CurrencyDisplay amount={user.totalWithdrawn} className="font-medium" />
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Adjustment form */}
          <Card className="p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-violet-500" />
              New Balance Adjustment
            </h2>

            <div className="space-y-4">
              <div>
                <Label>Adjustment Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setType("add")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      type === "add"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="font-medium text-sm">Add Funds</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("remove")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      type === "remove"
                        ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Minus className="h-4 w-4" />
                    <span className="font-medium text-sm">Remove Funds</span>
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="amount">
                  Amount <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="reason">
                  Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a clear reason for this adjustment (will be logged in audit trail)..."
                  rows={3}
                />
              </div>

              {/* Projection */}
              {user && amt > 0 && (
                <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30">
                  <div className="text-xs text-muted-foreground mb-1">Projected Balance</div>
                  <div className="flex items-center justify-between">
                    <CurrencyDisplay amount={user.balance} className="text-sm text-muted-foreground line-through" />
                    <span className="text-muted-foreground">→</span>
                    <CurrencyDisplay
                      amount={projectedBalance}
                      className={`font-bold ${
                        projectedBalance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"
                      }`}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={openConfirm}
                disabled={adjustMutation.isPending}
                className={`w-full ${
                  type === "add"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Review & Confirm Adjustment
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Recent adjustments */}
      <Card className="p-6">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-violet-500" />
          Recent Balance Adjustments
        </h2>

        {auditQuery.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {auditQuery.isError && (
          <div className="text-center py-4 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            Failed to load recent adjustments.
          </div>
        )}

        {auditQuery.data?.logs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No balance adjustments yet.
          </div>
        )}

        {auditQuery.data?.logs && auditQuery.data.logs.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditQuery.data.logs.map((log) => {
                  const after = log.afterData || {};
                  const amount = after.amount;
                  const newBal = after.balance;
                  const reason = after.reason;
                  const isAdd = typeof amount === "number" && amount >= 0;
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(log.createdAt)}
                        <div className="text-[10px]">{formatDate(log.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.admin?.fullName || log.admin?.username || log.admin?.email || "System"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.action}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-0.5">
                          {typeof amount === "number" && (
                            <div className={`font-medium ${isAdd ? "text-emerald-600" : "text-red-600"}`}>
                              {isAdd ? "+" : ""}<CurrencyDisplay amount={amount} showSign />
                            </div>
                          )}
                          {typeof newBal === "number" && (
                            <div className="text-xs text-muted-foreground">
                              New balance: <CurrencyDisplay amount={newBal} />
                            </div>
                          )}
                          {reason && (
                            <div className="text-xs text-muted-foreground italic line-clamp-1">
                              "{reason}"
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Balance Adjustment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  You are about to{" "}
                  <span className={`font-semibold ${type === "add" ? "text-emerald-600" : "text-red-600"}`}>
                    {type === "add" ? "add" : "remove"}
                  </span>{" "}
                  <CurrencyDisplay amount={Number(amount) || 0} className="font-semibold" />{" "}
                  {type === "add" ? "to" : "from"}{" "}
                  <span className="font-semibold text-foreground">
                    {user?.fullName || user?.email}
                  </span>
                  &apos;s wallet.
                </p>
                {user && (
                  <div className="p-2 rounded bg-muted text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Balance:</span>
                      <CurrencyDisplay amount={user.balance} className="font-medium" />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">After Adjustment:</span>
                      <CurrencyDisplay
                        amount={projectedBalance}
                        className={`font-bold ${
                          projectedBalance >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Reason: <span className="italic">&quot;{reason}&quot;</span>
                </p>
                <p className="text-xs text-amber-600">
                  This action is irreversible and will be recorded in the audit log.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                type === "add"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
              disabled={adjustMutation.isPending}
              onClick={() => adjustMutation.mutate()}
            >
              {adjustMutation.isPending ? "Processing..." : "Confirm Adjustment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
