"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ArrowLeftRight,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime, isValidEmail } from "@/lib/utils-fin";

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

type Transaction = {
  id: string;
  type: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  referenceId?: string | null;
  description: string;
  status: string;
  createdAt: string;
};

type UserDetail = {
  user: UserSummary & { pendingBalance?: number };
  transactions: Transaction[];
};

const TX_TYPES = [
  "TASK_REWARD",
  "WITHDRAWAL",
  "WITHDRAWAL_REVERSED",
  "ADMIN_ADJUSTMENT",
  "REGISTRATION_PAYMENT",
  "BONUS",
  "PENALTY",
  "REFUND",
  "REFERRAL",
];

export function AdminTransactions() {
  const { setView } = useAppStore();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Search users
  const usersQuery = useQuery<UsersResponse>({
    queryKey: ["admin-users-search", submittedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "20",
      });
      if (submittedSearch) params.set("search", submittedSearch);
      return apiGet<UsersResponse>(`/api/supabase/admin/users?${params.toString()}`);
    },
    enabled: submittedSearch.length > 0,
  });

  // Fetch selected user's transactions
  const userDetailQuery = useQuery<UserDetail>({
    queryKey: ["admin-user-detail-tx", selectedUserId],
    queryFn: () => apiGet<UserDetail>(`/api/supabase/admin/users/${selectedUserId}`),
    enabled: !!selectedUserId,
  });

  const handleSearch = () => {
    setSubmittedSearch(search.trim());
    setSelectedUserId(null);
    setPage(1);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setTypeFilter("");
    setPage(1);
  };

  const filteredTransactions = useMemo(() => {
    if (!userDetailQuery.data?.transactions) return [];
    const txs = userDetailQuery.data.transactions;
    if (!typeFilter) return txs;
    return txs.filter((t) => t.type === typeFilter);
  }, [userDetailQuery.data, typeFilter]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const user = userDetailQuery.data?.user;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-violet-500" />
          All Transactions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for a user to view their wallet transactions and ledger
        </p>
      </div>

      {/* User Search */}
      <Card className="p-6 space-y-4">
        <div>
          <Label htmlFor="search">Search User</Label>
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
          {submittedSearch && !isValidEmail(submittedSearch) && submittedSearch.length < 3 && (
            <p className="text-xs text-amber-600 mt-1">
              Tip: enter at least 3 characters to search.
            </p>
          )}
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
            Failed to search users. Try again.
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
              {usersQuery.data.pagination.total} user(s) found — click to view transactions
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

      {/* Selected user transactions */}
      {selectedUserId && (
        <>
          {/* User summary */}
          {userDetailQuery.isLoading && (
            <Card className="p-6">
              <Skeleton className="h-24 w-full" />
            </Card>
          )}

          {user && (
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">
                    {user.fullName?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{user.fullName || user.username || "Unnamed"}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setView("admin-user-detail", user.id)}>
                    <UserIcon className="h-4 w-4 mr-1" />
                    View Profile
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="text-xs text-muted-foreground">Available Balance</div>
                  <CurrencyDisplay amount={user.balance} className="font-bold text-base text-emerald-700 dark:text-emerald-300" />
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <div className="text-xs text-muted-foreground">Pending</div>
                  <CurrencyDisplay amount={user.pendingBalance || 0} className="font-bold text-base text-amber-700 dark:text-amber-300" />
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Total Earned</div>
                  <CurrencyDisplay amount={user.totalEarned} className="font-bold text-base" />
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Total Withdrawn</div>
                  <CurrencyDisplay amount={user.totalWithdrawn} className="font-bold text-base" />
                </div>
              </div>
            </Card>
          )}

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="w-full sm:w-64">
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v === "ALL" ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All transaction types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All transaction types</SelectItem>
                    {TX_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredTransactions.length} transaction(s)
              </div>
            </div>
          </Card>

          {/* Transactions table */}
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userDetailQuery.isLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                  {userDetailQuery.isError && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-red-500 py-8">
                        <AlertCircle className="h-5 w-5 inline mr-2" />
                        Failed to load transactions.
                      </TableCell>
                    </TableRow>
                  )}

                  {!userDetailQuery.isLoading &&
                    paginatedTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    )}

                  {paginatedTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(tx.createdAt)}
                        <div className="text-[10px]">{formatDate(tx.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {tx.type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div
                          className={`font-medium ${
                            tx.amount >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          <CurrencyDisplay amount={tx.amount} showSign />
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Bal: <CurrencyDisplay amount={tx.newBalance} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        <div className="line-clamp-2">{tx.description}</div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {tx.referenceId ? (
                          <span className="truncate inline-block max-w-[120px] align-bottom">
                            {tx.referenceId}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
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
                Page {page} of {totalPages}
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
        </>
      )}

      {!selectedUserId && !usersQuery.data && (
        <Card className="p-12 text-center">
          <ArrowLeftRight className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Search for a user to begin</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use the search box above to find a user by email, name, or phone.
          </p>
        </Card>
      )}
    </div>
  );
}
