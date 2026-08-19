"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatRelativeTime, formatDate } from "@/lib/utils-fin";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";
import {
  Wallet as WalletIcon,
  Clock,
  TrendingUp,
  ArrowDownToLine,
  Banknote,
  ArrowRight,
  ArrowLeftRight,
  PiggyBank,
  Receipt,
} from "lucide-react";

interface WalletStats {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  referenceId: string | null;
  createdAt: string;
}

interface TxResponse {
  transactions: Transaction[];
  pagination: { total: number };
}

export function UserWallet() {
  const setView = useAppStore((s) => s.setView);
  const { data: settings } = useSettings();

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletStats>({
    queryKey: ["wallet-summary"],
    queryFn: () => apiGet("/api/supabase/wallet"),
    staleTime: 30_000,
  });

  const { data: txData, isLoading: txLoading } = useQuery<TxResponse>({
    queryKey: ["wallet-transactions", { pageSize: 10 }],
    queryFn: () => apiGet("/api/supabase/wallet/transactions?pageSize=10"),
    staleTime: 30_000,
  });

  const stats = [
    {
      label: "Available Balance",
      value: wallet?.balance ?? 0,
      icon: WalletIcon,
      gradient: "from-violet-500 to-fuchsia-500",
      iconBg: "bg-violet-100 dark:bg-violet-950/40",
      iconColor: "text-violet-600 dark:text-violet-400",
      description: "Funds available for withdrawal",
    },
    {
      label: "Pending Balance",
      value: wallet?.pendingBalance ?? 0,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-100 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      description: "Awaiting task approval",
    },
    {
      label: "Total Earned",
      value: wallet?.totalEarned ?? 0,
      icon: TrendingUp,
      gradient: "from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      description: "Lifetime earnings",
    },
    {
      label: "Total Withdrawn",
      value: wallet?.totalWithdrawn ?? 0,
      icon: ArrowDownToLine,
      gradient: "from-rose-500 to-pink-500",
      iconBg: "bg-rose-100 dark:bg-rose-950/40",
      iconColor: "text-rose-600 dark:text-rose-400",
      description: "Lifetime withdrawals",
    },
  ];

  const transactions = txData?.transactions || [];
  const withdrawalsEnabled = settings?.withdrawalsEnabled ?? true;
  const minWithdrawal = settings?.withdrawalMin ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <WalletIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Wallet</h1>
            <p className="text-sm text-muted-foreground">
              Manage your balance and view transactions
            </p>
          </div>
        </div>
        <Button
          onClick={() => setView("user-withdraw")}
          disabled={!withdrawalsEnabled}
          className="bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold"
        >
          <Banknote className="h-4 w-4 mr-1" />
          Withdraw Funds
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-5 overflow-hidden relative">
            <div className="absolute top-0 right-0 h-20 w-20 bg-gradient-to-br opacity-10 from-violet-500 to-fuchsia-500 rounded-bl-full" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <div className="mt-2 text-2xl font-bold">
                  {walletLoading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    <CurrencyDisplay amount={stat.value} />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.description}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Withdrawal hint */}
      {withdrawalsEnabled && (
        <Card className="p-4 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20 border-violet-200 dark:border-violet-900">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Ready to withdraw?</h3>
                <p className="text-xs text-muted-foreground">
                  Minimum withdrawal:{" "}
                  <CurrencyDisplay amount={minWithdrawal} className="font-medium" />
                  {wallet && wallet.balance < minWithdrawal && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      · Need{" "}
                      <CurrencyDisplay amount={minWithdrawal - wallet.balance} /> more
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setView("user-withdraw")}
              className="bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
            >
              Withdraw Now <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {!withdrawalsEnabled && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Withdrawals are temporarily disabled. Please check back later.
            </p>
          </div>
        </Card>
      )}

      {/* Recent transactions */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-violet-500" />
              Recent Transactions
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("user-transactions")}>
              View all <ArrowLeftRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {txLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
              No transactions yet
            </div>
          ) : (
            <div className="divide-y max-h-[28rem] overflow-y-auto">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {TRANSACTION_TYPE_LABELS[tx.type] || tx.type}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] border-0 ${
                          tx.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : tx.status === "PENDING"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {tx.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {tx.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatRelativeTime(tx.createdAt)} · {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div
                    className={`font-semibold text-sm whitespace-nowrap ${
                      tx.amount >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    <CurrencyDisplay amount={tx.amount} showSign />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending withdrawals hint */}
      {wallet && wallet.pendingWithdrawals > 0 && (
        <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                Pending withdrawal:{" "}
                <CurrencyDisplay amount={wallet.pendingWithdrawals} className="font-bold" />
              </p>
              <p className="text-xs text-muted-foreground">
                Your withdrawal request is being processed.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
