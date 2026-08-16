"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client/client";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  Plus,
  Trash2,
  Wallet,
  User,
  Hash,
  Network,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils-fin";

// ---------- Types ----------
interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  network?: string | null;
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

// ---------- Component ----------
export function UserPayoutAccounts() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [label, setLabel] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("");

  // Fetch payment methods
  const { data: methods, isLoading: methodsLoading } = useQuery<
    PaymentMethod[]
  >({
    queryKey: ["payment-methods"],
    queryFn: () => apiGet<PaymentMethod[]>("/api/supabase/payment-methods"),
  });

  // Fetch payout accounts
  const {
    data: accounts,
    isLoading: accountsLoading,
    error,
  } = useQuery<PayoutAccount[]>({
    queryKey: ["payout-accounts"],
    queryFn: () => apiGet<PayoutAccount[]>("/api/supabase/payout-accounts"),
  });

  const selectedMethod = useMemo(
    () => methods?.find((m) => m.id === paymentMethodId),
    [methods, paymentMethodId]
  );
  const isBinance = selectedMethod?.code === "BINANCE";

  // Reset form fields helper
  const resetForm = () => {
    setPaymentMethodId("");
    setLabel("");
    setAccountHolderName("");
    setAccountNumber("");
    setWalletAddress("");
    setNetwork("");
  };

  // Handle dialog open state changes - reset form when closing
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setDialogOpen(open);
  };

  // Handle payment method selection - auto-fill network default for Binance
  const handleSelectPaymentMethod = (id: string) => {
    setPaymentMethodId(id);
    const m = methods?.find((x) => x.id === id);
    if (m?.code === "BINANCE" && m.network) {
      setNetwork(m.network);
    } else {
      setNetwork("");
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/api/supabase/payout-accounts", payload),
    onSuccess: () => {
      toast.success("Payout account saved successfully");
      queryClient.invalidateQueries({ queryKey: ["payout-accounts"] });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save account");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/supabase/payout-accounts?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Account deleted");
      queryClient.invalidateQueries({ queryKey: ["payout-accounts"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete account");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethodId) {
      toast.error("Please select a payment method");
      return;
    }
    if (isBinance) {
      if (!walletAddress.trim()) {
        toast.error("Wallet address is required");
        return;
      }
    } else {
      if (!accountHolderName.trim() || !accountNumber.trim()) {
        toast.error("Account holder name and number are required");
        return;
      }
    }
    const payload: any = {
      paymentMethodId,
      label: label.trim() || undefined,
    };
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-violet-600" />
            Payout Accounts
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your saved withdrawal accounts for faster payouts.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Payout Account</DialogTitle>
              <DialogDescription>
                Save a withdrawal account for quick access when withdrawing
                funds.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment method */}
              <div className="space-y-2">
                <Label>
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                {methodsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={paymentMethodId}
                    onValueChange={handleSelectPaymentMethod}
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
              </div>

              {/* Label */}
              <div className="space-y-2">
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. My JazzCash, Main Binance"
                />
              </div>

              {/* Conditional fields */}
              {paymentMethodId &&
                (isBinance ? (
                  <div className="space-y-4 p-4 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50">
                    <div className="space-y-2">
                      <Label>
                        Wallet Address{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={walletAddress}
                          onChange={(e) =>
                            setWalletAddress(e.target.value)
                          }
                          placeholder="Enter Binance wallet address"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Network</Label>
                      <div className="relative">
                        <Network className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={network}
                          onChange={(e) => setNetwork(e.target.value)}
                          placeholder="BEP20, TRC20, ERC20..."
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50">
                    <div className="space-y-2">
                      <Label>
                        Account Holder Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={accountHolderName}
                          onChange={(e) =>
                            setAccountHolderName(e.target.value)
                          }
                          placeholder="Full name on account"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Account Number <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={accountNumber}
                          onChange={(e) =>
                            setAccountNumber(e.target.value)
                          }
                          placeholder="Mobile / account number"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
                >
                  {createMutation.isPending ? "Saving..." : "Save Account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Accounts list */}
      {accountsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-red-500">
            Failed to load accounts. Please try again.
          </CardContent>
        </Card>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-violet-500" />
            </div>
            <p className="text-lg font-medium">No payout accounts yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Save your Easypaisa, JazzCash, or Binance wallet details here to
              make future withdrawals faster and more convenient.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="mt-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acc) => {
            const isBinanceAcc = (acc.paymentMethod?.code || "—") === "BINANCE";
            return (
              <Card
                key={acc.id}
                className="relative overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 -mr-8 -mt-8" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold ${
                          isBinanceAcc
                            ? "bg-gradient-to-br from-amber-400 to-yellow-500"
                            : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                        }`}
                      >
                        {(acc.paymentMethod?.name || "U").charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {acc.paymentMethod?.name || "Unknown"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {acc.label || (isBinanceAcc ? "Crypto Wallet" : "Mobile Account")}
                        </CardDescription>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete payout account?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. The saved account
                            will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(acc.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isBinanceAcc ? (
                    <>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Wallet className="h-3 w-3" /> Wallet Address
                        </div>
                        <div className="text-sm font-mono break-all bg-muted/50 rounded px-2 py-1">
                          {acc.walletAddress}
                        </div>
                      </div>
                      {acc.network && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground text-xs flex items-center gap-1">
                            <Network className="h-3 w-3" /> Network
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {acc.network}
                          </Badge>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <User className="h-3 w-3" /> Holder
                        </span>
                        <span className="font-medium">
                          {acc.accountHolderName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <Hash className="h-3 w-3" /> Number
                        </span>
                        <span className="font-mono">
                          {acc.accountNumber}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>Added {formatDate(acc.createdAt)}</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
