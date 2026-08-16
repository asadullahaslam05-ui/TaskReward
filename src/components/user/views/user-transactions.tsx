"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyDisplay } from "@/components/shared/currency-display";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/utils-fin";
import { TRANSACTION_TYPE_LABELS } from "@/lib/types";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
  TrendingUp,
  TrendingDown,
  Hash,
} from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  referenceId: string | null;
  description: string;
  status: string;
  createdAt: string;
}

interface TxResponse {
  transactions: Transaction[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

const TYPE_OPTIONS = [
  { value: "ALL", label: "All types" },
  { value: "TASK_REWARD", label: "Task Reward" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "WITHDRAWAL_REVERSED", label: "Withdrawal Refund" },
  { value: "ADMIN_ADJUSTMENT", label: "Admin Adjustment" },
  { value: "REGISTRATION_PAYMENT", label: "Registration Payment" },
  { value: "BONUS", label: "Bonus" },
  { value: "PENALTY", label: "Penalty" },
  { value: "REFUND", label: "Refund" },
  { value: "REFERRAL", label: "Referral Bonus" },
];

export function UserTransactions() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [type, setType] = useState<string>("ALL");

  const queryStr = `?page=${page}&pageSize=${pageSize}${
    type !== "ALL" ? `&type=${type}` : ""
  }`;

  const { data, isLoading, isFetching } = useQuery<TxResponse>({
    queryKey: ["wallet-transactions-full", queryStr],
    queryFn: () => apiGet(`/api/supabase/wallet/transactions${queryStr}`),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const transactions = data?.transactions || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const total = data?.pagination?.total || 0;

  // Summary stats for current filter
  const totalIn = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOut = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
          <ArrowLeftRight className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-sm text-muted-foreground">
            Full record of all your wallet transactions
          </p>
        </div>
      </div>

      {/* Filter + summary */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="w-full lg:w-72">
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2">
              <div className="text-[10px] uppercase text-muted-foreground">Total In (page)</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                <CurrencyDisplay amount={totalIn} showSign />
              </div>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 px-4 py-2">
              <div className="text-[10px] uppercase text-muted-foreground">Total Out (page)</div>
              <div className="font-semibold text-rose-600 dark:text-rose-400 text-sm">
                -<CurrencyDisplay amount={totalOut} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions table */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center justify-between">
            <span>All Transactions</span>
            <span className="text-xs font-normal text-muted-foreground">
              {isFetching ? "Loading..." : `${total} total`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No transactions found</p>
              <p className="mt-1">
                {type !== "ALL"
                  ? "No transactions match this filter."
                  : "Your transactions will appear here once you start earning."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[140px]">Date</TableHead>
                      <TableHead className="w-[140px]">Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px] text-right">Amount</TableHead>
                      <TableHead className="w-[110px] text-right">Balance</TableHead>
                      <TableHead className="w-[110px]">Status</TableHead>
                      <TableHead className="w-[140px]">Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {TRANSACTION_TYPE_LABELS[tx.type] || tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm truncate">{tx.description}</p>
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold whitespace-nowrap ${
                            tx.amount >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            {tx.amount >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <CurrencyDisplay amount={tx.amount} showSign />
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          <CurrencyDisplay amount={tx.newBalance} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] border-0 ${
                              tx.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                : tx.status === "PENDING"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                : tx.status === "REVERSED"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {tx.referenceId ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                  <Hash className="h-3 w-3" />
                                  <span className="truncate max-w-[100px]">
                                    {tx.referenceId}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <span className="font-mono text-xs">{tx.referenceId}</span>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y max-h-[40rem] overflow-y-auto">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {TRANSACTION_TYPE_LABELS[tx.type] || tx.type}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] border-0 ${
                              tx.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                : tx.status === "PENDING"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                : tx.status === "REVERSED"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-1">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(tx.createdAt)}
                        </p>
                        {tx.referenceId && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono break-all">
                            Ref: {tx.referenceId}
                          </p>
                        )}
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
                    <div className="text-xs text-muted-foreground pt-1 border-t mt-2">
                      Balance after:{" "}
                      <CurrencyDisplay amount={tx.newBalance} className="font-medium" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className={`min-w-9 ${
                    p === page
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                      : ""
                  }`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
