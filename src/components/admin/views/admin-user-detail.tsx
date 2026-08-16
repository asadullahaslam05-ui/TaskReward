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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { formatDate, formatDateShort, formatRelativeTime } from "@/lib/utils-fin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  Ban,
  ShieldAlert,
  Unlock,
  Flag,
  Save,
  Plus,
  Minus,
  Copy,
  Phone,
  Mail,
  AtSign,
  Calendar,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
  Gift,
  Users as UsersIcon,
  Receipt,
} from "lucide-react";

type UserDetail = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
  riskLevel: string;
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  flagged: boolean;
  flaggedReason: string | null;
  adminNotes: string | null;
  referralCode: string;
  referredById: string | null;
  profileImage: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type RelatedPayment = {
  id: string;
  amount: number;
  status: string;
  senderName: string;
  transactionId: string;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  paymentMethod?: { name: string; code: string } | null;
};

type RelatedSubmission = {
  id: string;
  status: string;
  rewardCredited: boolean;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  task: { id: string; title: string; reward: number };
};

type RelatedWithdrawal = {
  id: string;
  amount: number;
  fee: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  adminNote: string | null;
  paymentMethod?: { name: string; code: string } | null;
};

type RelatedTransaction = {
  id: string;
  type: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  status: string;
  createdAt: string;
};

type RelatedReferral = {
  id: string;
  referrerId: string;
  referredId: string;
  amount: number;
  status: string;
  createdAt: string;
};

type UserDetailResponse = {
  user: UserDetail;
  payments: RelatedPayment[];
  submissions: RelatedSubmission[];
  withdrawals: RelatedWithdrawal[];
  transactions: RelatedTransaction[];
  referrals: RelatedReferral[];
};

export function AdminUserDetail() {
  const { selectedId, setView } = useAppStore();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [dangerDialog, setDangerDialog] = useState<{
    open: boolean;
    action: "SUSPEND" | "BAN" | "REMOVE_FUNDS" | null;
  }>({ open: false, action: null });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const { data, isLoading, isError } = useQuery<UserDetailResponse>({
    queryKey: ["admin-user-detail", selectedId],
    queryFn: () => apiGet<UserDetailResponse>(`/api/supabase/admin/users/${selectedId}`),
    enabled: !!selectedId,
    onSuccess: (d) => {
      setNotes(d.user.adminNotes || "");
      setNotesDirty(false);
      setFlagReason(d.user.flaggedReason || "");
    },
    onError: (err: any) => toast.error(err.message || "Failed to load user"),
  });

  const user = data?.user;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-user-detail", selectedId] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
  };

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "SUSPENDED" | "BANNED") =>
      apiPatch(`/api/supabase/admin/users/${selectedId}`, { status }),
    onSuccess: () => {
      toast.success("User status updated");
      invalidateAll();
      setDangerDialog({ open: false, action: null });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  // Unban user (set to ACTIVE)
  const unbanMutation = useMutation({
    mutationFn: () => apiPatch(`/api/supabase/admin/users/${selectedId}`, { status: "ACTIVE" }),
    onSuccess: () => {
      toast.success("User unbanned");
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Failed to unban"),
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: (flagged: boolean) =>
      apiPatch(`/api/supabase/admin/users/${selectedId}`, { flagged, flaggedReason: flagged ? flagReason : null }),
    onSuccess: (_d, flagged) => {
      toast.success(flagged ? "User flagged" : "User unflagged");
      setFlagDialogOpen(false);
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update flag"),
  });

  // Notes mutation
  const notesMutation = useMutation({
    mutationFn: () => apiPatch(`/api/supabase/admin/users/${selectedId}`, { adminNotes: notes }),
    onSuccess: () => {
      toast.success("Notes saved");
      setNotesDirty(false);
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Failed to save notes"),
  });

  // Balance adjustment mutation
  const adjustMutation = useMutation({
    mutationFn: (vars: { type: "add" | "remove"; amount: number; reason: string }) =>
      apiPost("/api/supabase/admin/balance-adjustment", {
        userId: selectedId,
        amount: vars.amount,
        reason: vars.reason,
        type: vars.type,
      }),
    onSuccess: (_d, vars) => {
      toast.success(`${vars.type === "add" ? "Added" : "Removed"} funds successfully`);
      setAdjustAmount("");
      setAdjustReason("");
      setDangerDialog({ open: false, action: null });
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Failed to adjust balance"),
  });

  const handleAdjust = (type: "add" | "remove") => {
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    if (type === "remove") {
      setDangerDialog({ open: true, action: "REMOVE_FUNDS" });
      return;
    }
    adjustMutation.mutate({ type, amount, reason: adjustReason.trim() });
  };

  const copyReferral = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      toast.success("Referral code copied");
    }
  };

  if (!selectedId) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          No user selected.
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-red-600">
          Failed to load user details.
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setView("admin-users")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Users
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setView("admin-users")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              User Details
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage user account.
            </p>
          </div>
        </div>
      </div>

      {isLoading || !user ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Profile header */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <Avatar className="h-20 w-20 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-2xl font-bold">
                  {user.fullName?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{user.fullName}</h2>
                  <StatusBadge status={user.status} />
                  <Badge variant="outline" className="border-0 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {user.role}
                  </Badge>
                  <Badge variant="outline" className="border-0">
                    Risk: {user.riskLevel}
                  </Badge>
                  {user.flagged && (
                    <Badge variant="outline" className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Flag className="h-3 w-3 mr-1 fill-amber-500" />
                      Flagged
                    </Badge>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AtSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>@{user.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{user.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>Joined {formatDateShort(user.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>Last login {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : "Never"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <button
                      onClick={copyReferral}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/70 flex items-center gap-1"
                    >
                      {user.referralCode}
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 md:flex-col md:w-48">
                {user.status !== "ACTIVE" && (
                  <Button
                    size="sm"
                    onClick={() => statusMutation.mutate("ACTIVE")}
                    disabled={statusMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Activate
                  </Button>
                )}
                {user.status !== "SUSPENDED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDangerDialog({ open: true, action: "SUSPEND" })}
                    className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Suspend
                  </Button>
                )}
                {user.status !== "BANNED" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDangerDialog({ open: true, action: "BAN" })}
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Ban className="h-4 w-4" />
                    Ban
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unbanMutation.mutate()}
                    disabled={unbanMutation.isPending}
                  >
                    <Unlock className="h-4 w-4" />
                    Unban
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<Wallet className="h-4 w-4 text-violet-500" />}
              label="Balance"
              value={<CurrencyDisplay amount={user.balance} />}
            />
            <StatCard
              icon={<Clock className="h-4 w-4 text-amber-500" />}
              label="Pending Balance"
              value={<CurrencyDisplay amount={user.pendingBalance} />}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              label="Total Earned"
              value={<CurrencyDisplay amount={user.totalEarned} />}
            />
            <StatCard
              icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
              label="Total Withdrawn"
              value={<CurrencyDisplay amount={user.totalWithdrawn} />}
            />
          </div>

          {/* Flag & Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Flag toggle */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flag className="h-4 w-4 text-amber-500" />
                  Flag User
                </CardTitle>
                <CardDescription className="text-xs">
                  Flag for fraud review or suspicious activity.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    {user.flagged ? (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        User is currently flagged
                      </span>
                    ) : (
                      <span className="text-muted-foreground">User is not flagged</span>
                    )}
                  </div>
                  <Switch
                    checked={user.flagged}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFlagDialogOpen(true);
                      } else {
                        flagMutation.mutate(false);
                      }
                    }}
                  />
                </div>
                {user.flagged && user.flaggedReason && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Flag reason:
                    </div>
                    <div className="text-sm mt-1">{user.flaggedReason}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin notes */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base">Admin Notes</CardTitle>
                <CardDescription className="text-xs">
                  Internal notes — not visible to user.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesDirty(true);
                  }}
                  placeholder="Add internal notes about this user..."
                  rows={4}
                />
                <Button
                  size="sm"
                  onClick={() => notesMutation.mutate()}
                  disabled={!notesDirty || notesMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {notesMutation.isPending ? "Saving..." : "Save Notes"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Balance adjustment */}
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-violet-500" />
                Balance Adjustment
              </CardTitle>
              <CardDescription className="text-xs">
                Manually add or remove funds from user wallet. All adjustments are logged.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="amount" className="text-xs">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reason" className="text-xs">Reason</Label>
                  <Input
                    id="reason"
                    placeholder="Reason for adjustment"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAdjust("add")}
                    disabled={adjustMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAdjust("remove")}
                    disabled={adjustMutation.isPending}
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 flex-1"
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap">
              <TabsTrigger value="payments">
                Payments ({data.payments.length})
              </TabsTrigger>
              <TabsTrigger value="submissions">
                Submissions ({data.submissions.length})
              </TabsTrigger>
              <TabsTrigger value="withdrawals">
                Withdrawals ({data.withdrawals.length})
              </TabsTrigger>
              <TabsTrigger value="transactions">
                Transactions ({data.transactions.length})
              </TabsTrigger>
              <TabsTrigger value="referrals">
                Referrals ({data.referrals.length})
              </TabsTrigger>
            </TabsList>

            {/* Payments */}
            <TabsContent value="payments">
              <Card className="p-0">
                <SimpleTable
                  headers={["Method", "Amount", "Txn ID", "Sender", "Status", "Date"]}
                  rows={
                    data.payments.length === 0
                      ? null
                      : data.payments.map((p) => [
                          p.paymentMethod?.name || "—",
                          <CurrencyDisplay amount={p.amount} key="amt" />,
                          <span className="font-mono text-xs" key="txn">{p.transactionId}</span>,
                          p.senderName,
                          <StatusBadge status={p.status} key="st" />,
                          <span className="text-xs text-muted-foreground" key="d">
                            {formatDate(p.createdAt)}
                          </span>,
                        ])
                  }
                  empty="No registration payments"
                  icon={<Receipt className="h-5 w-5 text-muted-foreground" />}
                />
              </Card>
            </TabsContent>

            {/* Submissions */}
            <TabsContent value="submissions">
              <Card className="p-0">
                <SimpleTable
                  headers={["Task", "Reward", "Status", "Credited", "Date"]}
                  rows={
                    data.submissions.length === 0
                      ? null
                      : data.submissions.map((s) => [
                          <span className="font-medium truncate max-w-[200px] block" key="t">
                            {s.task?.title || "—"}
                          </span>,
                          <CurrencyDisplay amount={s.task?.reward || 0} key="r" />,
                          <StatusBadge status={s.status} key="st" />,
                          <Badge variant="outline" className="border-0" key="c">
                            {s.rewardCredited ? "Yes" : "No"}
                          </Badge>,
                          <span className="text-xs text-muted-foreground" key="d">
                            {formatDate(s.createdAt)}
                          </span>,
                        ])
                  }
                  empty="No task submissions"
                  icon={<Receipt className="h-5 w-5 text-muted-foreground" />}
                />
              </Card>
            </TabsContent>

            {/* Withdrawals */}
            <TabsContent value="withdrawals">
              <Card className="p-0">
                <SimpleTable
                  headers={["Method", "Amount", "Fee", "Status", "Date", "Paid At"]}
                  rows={
                    data.withdrawals.length === 0
                      ? null
                      : data.withdrawals.map((w) => [
                          w.paymentMethod?.name || "—",
                          <CurrencyDisplay amount={w.amount} key="a" />,
                          <CurrencyDisplay amount={w.fee} key="f" />,
                          <StatusBadge status={w.status} key="st" />,
                          <span className="text-xs text-muted-foreground" key="d">
                            {formatDate(w.createdAt)}
                          </span>,
                          <span className="text-xs text-muted-foreground" key="p">
                            {w.paidAt ? formatDateShort(w.paidAt) : "—"}
                          </span>,
                        ])
                  }
                  empty="No withdrawals"
                  icon={<Receipt className="h-5 w-5 text-muted-foreground" />}
                />
              </Card>
            </TabsContent>

            {/* Transactions */}
            <TabsContent value="transactions">
              <Card className="p-0">
                <SimpleTable
                  headers={["Type", "Amount", "Description", "Balance", "Status", "Date"]}
                  rows={
                    data.transactions.length === 0
                      ? null
                      : data.transactions.map((t) => [
                          <Badge variant="outline" className="border-0" key="ty">
                            {t.type.replace(/_/g, " ")}
                          </Badge>,
                          <span
                            className={t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}
                            key="am"
                          >
                            <CurrencyDisplay amount={t.amount} showSign />
                          </span>,
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] block" key="dsc">
                            {t.description}
                          </span>,
                          <span className="text-xs font-mono" key="b">
                            {t.newBalance.toFixed(2)}
                          </span>,
                          <StatusBadge status={t.status} key="st" />,
                          <span className="text-xs text-muted-foreground" key="d">
                            {formatDate(t.createdAt)}
                          </span>,
                        ])
                  }
                  empty="No transactions"
                  icon={<Receipt className="h-5 w-5 text-muted-foreground" />}
                />
              </Card>
            </TabsContent>

            {/* Referrals */}
            <TabsContent value="referrals">
              <Card className="p-0">
                <SimpleTable
                  headers={["Referrer", "Referred", "Amount", "Status", "Date"]}
                  rows={
                    data.referrals.length === 0
                      ? null
                      : data.referrals.map((r) => [
                          <span className="font-mono text-xs" key="ref">{r.referrerId}</span>,
                          <span className="font-mono text-xs" key="rfd">{r.referredId}</span>,
                          <CurrencyDisplay amount={r.amount} key="a" />,
                          <StatusBadge status={r.status} key="st" />,
                          <span className="text-xs text-muted-foreground" key="d">
                            {formatDate(r.createdAt)}
                          </span>,
                        ])
                  }
                  empty="No referrals"
                  icon={<UsersIcon className="h-5 w-5 text-muted-foreground" />}
                />
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Flag dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-500" />
              Flag User
            </DialogTitle>
            <DialogDescription>
              Provide a reason for flagging this user. This will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="flagReason" className="text-xs">Reason</Label>
            <Textarea
              id="flagReason"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="e.g. Suspicious withdrawal pattern, duplicate accounts..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => flagMutation.mutate(true)}
              disabled={!flagReason.trim() || flagMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {flagMutation.isPending ? "Flagging..." : "Flag User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Danger confirmation */}
      <AlertDialog
        open={dangerDialog.open}
        onOpenChange={(o) => setDangerDialog({ open: o, action: o ? dangerDialog.action : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dangerDialog.action === "BAN" &&
                "Are you sure you want to BAN this user? They will lose all access to the platform."}
              {dangerDialog.action === "SUSPEND" &&
                "Are you sure you want to SUSPEND this user? They will not be able to log in until reactivated."}
              {dangerDialog.action === "REMOVE_FUNDS" && (() => {
                const amount = parseFloat(adjustAmount) || 0;
                return `Are you sure you want to REMOVE ${amount.toFixed(2)} from this user's wallet? This action is irreversible.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (dangerDialog.action === "BAN") statusMutation.mutate("BANNED");
                else if (dangerDialog.action === "SUSPEND") statusMutation.mutate("SUSPENDED");
                else if (dangerDialog.action === "REMOVE_FUNDS") {
                  const amount = parseFloat(adjustAmount);
                  if (amount > 0 && adjustReason.trim()) {
                    adjustMutation.mutate({ type: "remove", amount, reason: adjustReason.trim() });
                  }
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </Card>
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
  icon,
}: {
  headers: string[];
  rows: React.ReactNode[][] | null;
  empty: string;
  icon: React.ReactNode;
}) {
  if (!rows || rows.length === 0) {
    return (
      <CardContent className="py-16 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          {icon}
        </div>
        <p className="text-sm font-medium">{empty}</p>
      </CardContent>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
