"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { apiGet } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { formatDateShort, formatRelativeTime } from "@/lib/utils-fin";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Download,
  Users as UsersIcon,
  Flag,
  ChevronRight,
} from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
  riskLevel: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  flagged: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type UsersResponse = {
  users: UserRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const STATUS_OPTIONS = [
  { label: "All Status", value: "ALL" },
  { label: "Payment Pending", value: "PAYMENT_PENDING" },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Banned", value: "BANNED" },
  { label: "Rejected", value: "REJECTED" },
];

const ROLE_OPTIONS = [
  { label: "All Roles", value: "ALL" },
  { label: "User", value: "USER" },
  { label: "Admin", value: "ADMIN" },
  { label: "Super Admin", value: "SUPER_ADMIN" },
  { label: "Support", value: "SUPPORT" },
  { label: "Finance", value: "FINANCE" },
  { label: "Moderator", value: "MODERATOR" },
];

const PAGE_SIZE = 20;

function roleBadgeClass(role: string): string {
  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
    case "SUPPORT":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "FINANCE":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "MODERATOR":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function AdminUsers() {
  const { setView } = useAppStore();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    return `/api/supabase/admin/users?${params.toString()}`;
  }, [page, debouncedSearch, statusFilter, roleFilter]);

  const { data, isLoading, isFetching, isError } = useQuery<UsersResponse>({
    queryKey: ["admin-users", queryPath],
    queryFn: () => apiGet<UsersResponse>(queryPath),
  });

  const users = data?.users ?? [];
  const pagination = data?.pagination;

  const handleRowClick = (user: UserRow) => {
    setView("admin-user-detail", user.id);
  };

  const handleExportCSV = () => {
    if (!users.length) {
      toast.error("No data to export");
      return;
    }
    const headers = [
      "ID",
      "Email",
      "Username",
      "Full Name",
      "Phone",
      "Role",
      "Status",
      "Risk Level",
      "Balance",
      "Total Earned",
      "Total Withdrawn",
      "Flagged",
      "Joined",
      "Last Login",
    ];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = users.map((u) =>
      [
        u.id,
        u.email,
        u.username,
        u.fullName,
        u.phone ?? "",
        u.role,
        u.status,
        u.riskLevel,
        u.balance,
        u.totalEarned,
        u.totalWithdrawn,
        u.flagged ? "YES" : "NO",
        u.createdAt,
        u.lastLoginAt ?? "",
      ]
        .map(escape)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${users.length} users to CSV`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all platform users, statuses, and wallet balances.
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, username, full name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full md:w-44">
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
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-bold mt-1">
            {pagination?.total ?? "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Page</div>
          <div className="text-xl font-bold mt-1">
            {pagination ? `${pagination.page} / ${pagination.totalPages || 1}` : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-xl font-bold mt-1 text-emerald-600">
            {users.filter((u) => u.status === "ACTIVE").length}
            <span className="text-xs text-muted-foreground ml-1">on page</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Flagged</div>
          <div className="text-xl font-bold mt-1 text-amber-600">
            {users.filter((u) => u.flagged).length}
            <span className="text-xs text-muted-foreground ml-1">on page</span>
          </div>
        </Card>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="border-b p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-violet-500" />
            User List
          </CardTitle>
        </CardHeader>

        {isError ? (
          <CardContent className="py-10 text-center text-sm text-red-600">
            Failed to load users.
          </CardContent>
        ) : isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">User</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="pr-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow
                      key={u.id}
                      onClick={() => handleRowClick(u)}
                      className="cursor-pointer"
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs font-semibold">
                              {u.fullName?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-1.5">
                              {u.fullName}
                              {u.flagged && (
                                <Flag className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">@{u.username}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${roleBadgeClass(u.role)} border-0`}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <CurrencyDisplay amount={u.balance} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <CurrencyDisplay amount={u.totalEarned} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateShort(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : "—"}
                      </TableCell>
                      <TableCell className="pr-4">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleRowClick(u)}
                  className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-sm font-semibold">
                        {u.fullName?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {u.fullName}
                        {u.flagged && (
                          <Flag className="h-3 w-3 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Status</div>
                      <StatusBadge status={u.status} className="mt-0.5" />
                    </div>
                    <div>
                      <div className="text-muted-foreground">Role</div>
                      <Badge variant="outline" className={`${roleBadgeClass(u.role)} border-0 mt-0.5`}>
                        {u.role}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Balance</div>
                      <div className="font-medium">
                        <CurrencyDisplay amount={u.balance} />
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Earned</div>
                      <div className="font-medium">
                        <CurrencyDisplay amount={u.totalEarned} />
                      </div>
                    </div>
                  </div>
                </button>
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

function EmptyState() {
  return (
    <CardContent className="py-16 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <UsersIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No users found</p>
      <p className="text-xs text-muted-foreground mt-1">
        Try adjusting your search or filters.
      </p>
    </CardContent>
  );
}
