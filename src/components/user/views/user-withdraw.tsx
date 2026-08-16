"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Banknote,
  ArrowDownToLine,
  Info,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

// ---------- Types ----------
interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  network?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  walletAddress?: string | null;
  instructions?: string | null;
}

interface PayoutAccount {
  id: string;
  paymentMethodId: string;
  paymentMethod: PaymentMethod;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  walletAddress?: string | null;
  network?: string | null;
  label?: string | null;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  paymentMethod: PaymentMethod;
  payoutAccountHolder: string;
  payoutAccountNumber: string;
  payoutWalletAddress?: string | null;
  payoutNetwork?: string | null;
  note?: string | null;
  status: string;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  paidAt?: string | null;
}

interface WithdrawalsResponse {
  withdrawals: Withdrawal[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ---------- Component ----------
export function UserWithdraw() {
  const { user, refresh } = useCurrentUser();
  const { settings } = useSettings();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [payoutAccountId, setPayoutAccountId] = useState("__manual__");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [note, setNote] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Fetch payment methods
  const { data: methods, isLoading: methodsLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: () => apiGet<PaymentMethod[]>("/api/supabase/payment-methods"),
  });

  // Fetch payout accounts
  const { data: payoutAccounts } = useQuery<PayoutAccount[]>({
    queryKey: ["payout-accounts"],
    queryFn: () => apiGet<PayoutAccount[]>("/api/supabase/payout-accounts"),
  });

  // Fetch withdrawals history
  const { data: withdrawalsData, isLoading: withdrawalsLoading } =
    useQuery<WithdrawalsResponse>({
      queryKey: ["withdrawals", page],
      queryFn: () =>
        apiGet<WithdrawalsResponse>(
          `/api/supabase/withdrawals?page=${page}&pageSize=${pageSize}`
        ),
    });

  const selectedMethod = useMemo(
    () => methods?.find((m) => m.id === paymentMethodId),
    [methods, paymentMethodId]
  );

  const selectedPayoutAccount = useMemo(
    () => payoutAccounts?.find((a) => a.id === payoutAccountId),
    [payoutAccounts, payoutAccountId]
  );

  const isBinance = selectedMethod?.code === "BINANCE";

  // When selecting a saved payout account, prefill fields
  const handleSelectPayoutAccount = (id: string) => {
    setPayoutAccountId(id);
    const acc = payoutAccounts?.find((a) => a.id === id);
    if (acc && id !== "__manual__") {
      setAccountHolderName(acc.accountHolderName || "");
      setAccountNumber(acc.accountNumber || "");
      setWalletAddress(acc.walletAddress || "");
      setNetwork(acc.network || "");
    }
  };

  const balance = user?.balance ?? 0;
  const minAmount = settings?.withdrawalMin ?? 100;
  const maxAmount = settings?.withdrawalMax ?? 50000;
  const dailyLimit = settings?.withdrawalDailyLimit ?? 10000;
  const fee = settings?.withdrawalFee ?? 0;
  const processingMessage =
    settings?.withdrawalProcessingMessage ||
    "Withdrawals are processed within 24-48 hours after admin approval.";

  const numericAmount = parseFloat(amount) || 0;
  const totalDeducted = numericAmount + fee;

  const validationError = useMemo(() => {
    if (!numericAmount) return null;
    if (numericAmount < minAmount)
      return `Minimum withdrawal is ${minAmount}`;
    if (numericAmount > maxAmount)
      return `Maximum withdrawal is ${maxAmount}`;
    if (numericAmount > balance)
      return `Amount exceeds your available balance`;
    return null;
  }, [numericAmount, minAmount, maxAmount, balance]);

  // Create withdrawal mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/api/supabase/withdrawals", payload),
    onSuccess: () => {
      toast.success("Withdrawal request submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["payout-accounts"] });
      refresh();
      // Reset form
      setAmount("");
      setAccountHolderName("");
      setAccountNumber("");
      setWalletAddress("");
      setNetwork("");
      setNote("");
      setPayoutAccountId("__manual__");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit withdrawal request");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (user.status !== "ACTIVE") {
      toast.error("Your account is not active");
      return;
    }
    if (!paymentMethodId) {
      toast.error("Please select a payment method");
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // Field validation based on method
    if (isBinance) {
      if (!walletAddress.trim()) {
        toast.error("Wallet address is required for Binance");
        return;
      }
    } else {
      if (!accountHolderName.trim() || !accountNumber.trim()) {
        toast.error("Account holder name and number are required");
        return;
      }
    }

    const payload: any = {
      amount: numericAmount,
      paymentMethodId,
      note: note.trim() || undefined,
    };

    if (payoutAccountId !== "__manual__") {
      payload.payoutAccountId = payoutAccountId;
    }
    if (isBinance) {
      payload.walletAddress = walletAddress.trim();
      payload.network = network.trim() || undefined;
    } else {
      payload.accountHolderName = accountHolderName.trim();
      payload.accountNumber = accountNumber.trim();
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="h-6 w-6 text-violet-600" />
          Withdraw Funds
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Submit a withdrawal request to your preferred payment method.
        </p>
      </div>

      {/* Balance & Limits summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white border-0">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <Wallet className="h-4 w-4" /> Available Balance
            </div>
            <div className="text-2xl font-bold">
              <CurrencyDisplay amount={balance} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowDownToLine className="h-4 w-4" /> Min Withdrawal
            </div>
            <div className="text-xl font-bold">
              <CurrencyDisplay amount={minAmount} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowDownToLine className="h-4 w-4" /> Max / Transaction
            </div>
            <div className="text-xl font-bold">
              <CurrencyDisplay amount={maxAmount} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" /> Daily Limit
            </div>
            <div className="text-xl font-bold">
              <CurrencyDisplay amount={dailyLimit} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal form */}
      <Card>
        <CardHeader>
          <CardTitle>New Withdrawal Request</CardTitle>
          <CardDescription>
            Fill in the details below. Your funds will be reserved until the
            withdrawal is processed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings && !settings.withdrawalsEnabled ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">
                Withdrawals are currently disabled by the administrator.
              </p>
            </div>
          ) : user && user.status !== "ACTIVE" ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">
                Your account must be active to withdraw funds.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Withdrawal Amount <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                    {settings?.currencySymbol || "Rs"}
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-10"
                    required
                  />
                </div>
                {validationError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {validationError}
                  </p>
                )}
                {fee > 0 && numericAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Fee: <CurrencyDisplay amount={fee} /> · Total deducted:{" "}
                    <span className="font-medium text-foreground">
                      <CurrencyDisplay amount={totalDeducted} />
                    </span>
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                {methodsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={paymentMethodId}
                    onValueChange={(v) => {
                      setPaymentMethodId(v);
                      // reset network default when switching
                      const m = methods?.find((x) => x.id === v);
                      if (m?.code === "BINANCE") {
                        setNetwork(m.network || "");
                      } else {
                        setNetwork("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {methods?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedMethod?.instructions && (
                  <p className="text-xs text-muted-foreground">
                    {selectedMethod.instructions}
                  </p>
                )}
              </div>

              {/* Payout Account Selector */}
              {paymentMethodId && (
                <div className="space-y-2">
                  <Label>Saved Payout Account</Label>
                  {payoutAccounts && payoutAccounts.length > 0 ? (
                    <Select
                      value={payoutAccountId}
                      onValueChange={handleSelectPayoutAccount}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose saved account or enter manually" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__manual__">
                          Enter manually
                        </SelectItem>
                        {payoutAccounts
                          .filter(
                            (a) => a.paymentMethodId === paymentMethodId
                          )
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label ||
                                a.accountHolderName ||
                                a.walletAddress ||
                                "Account"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No saved accounts for this method. Fill in the details
                      below.
                    </p>
                  )}
                </div>
              )}

              {/* Conditional fields */}
              {paymentMethodId &&
                (isBinance ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50">
                    <div className="space-y-2 md:col-span-2">
                      <Label>
                        Wallet Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="Enter your Binance wallet address"
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Network</Label>
                      <Input
                        value={network}
                        onChange={(e) => setNetwork(e.target.value)}
                        placeholder="e.g. BEP20, TRC20, ERC20"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50">
                    <div className="space-y-2">
                      <Label>
                        Account Holder Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={accountHolderName}
                        onChange={(e) =>
                          setAccountHolderName(e.target.value)
                        }
                        placeholder="Full name on account"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Account Number{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="Mobile / account number"
                        required
                      />
                    </div>
                  </div>
                ))}

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any note for the admin..."
                  rows={2}
                />
              </div>

              {/* Processing info */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">{processingMessage}</p>
              </div>

              {/* Submit */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div className="text-sm text-muted-foreground">
                  {numericAmount > 0 && (
                    <span>
                      You will receive{" "}
                      <span className="font-semibold text-foreground">
                        <CurrencyDisplay amount={numericAmount} />
                      </span>
                      {fee > 0 && (
                        <>
                          {" "}
                          (after <CurrencyDisplay amount={fee} /> fee)
                        </>
                      )}
                    </span>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white w-full sm:w-auto"
                >
                  {createMutation.isPending
                    ? "Submitting..."
                    : "Submit Withdrawal Request"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
          <CardDescription>
            Your recent withdrawal requests and their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawalsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !withdrawalsData?.withdrawals ||
            withdrawalsData.withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Banknote className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No withdrawals yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Your withdrawal history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {withdrawalsData.withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">
                        <CurrencyDisplay amount={w.amount} />
                      </span>
                      {w.fee > 0 && (
                        <Badge variant="outline" className="text-xs">
                          fee <CurrencyDisplay amount={w.fee} />
                        </Badge>
                      )}
                      <StatusBadge status={w.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>
                        <span className="font-medium">Method:</span>{" "}
                        {w.paymentMethod?.name || "—"}
                      </div>
                      {w.payoutWalletAddress ? (
                        <div className="truncate">
                          <span className="font-medium">Wallet:</span>{" "}
                          {w.payoutWalletAddress}
                          {w.payoutNetwork && ` · ${w.payoutNetwork}`}
                        </div>
                      ) : (
                        <div>
                          <span className="font-medium">To:</span>{" "}
                          {w.payoutAccountHolder} · {w.payoutAccountNumber}
                        </div>
                      )}
                      {w.adminNote && (
                        <div className="text-amber-600 dark:text-amber-400">
                          Admin: {w.adminNote}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    <div>{formatDate(w.createdAt)}</div>
                    <div className="text-muted-foreground/70">
                      {formatRelativeTime(w.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {withdrawalsData &&
            withdrawalsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {withdrawalsData.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) =>
                      Math.min(withdrawalsData.pagination.totalPages, p + 1)
                    )
                  }
                  disabled={
                    page >= withdrawalsData.pagination.totalPages
                  }
                >
                  Next
                </Button>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
