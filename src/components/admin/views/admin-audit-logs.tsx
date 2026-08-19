"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ScrollText,
  Search,
  Eye,
  User,
  Activity,
  Target,
  Globe,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { apiGet } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

interface AuditAdmin {
  username: string;
  fullName: string;
  email?: string;
}

interface AuditLog {
  id: string;
  adminId: string;
  admin?: AuditAdmin | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  beforeData?: string | null;
  afterData?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 20;

function tryParse(data: string | null | undefined): any {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function prettyJson(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getActionColor(action: string): string {
  const a = action.toUpperCase();
  if (a.includes("DELETE")) {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }
  if (a.includes("CREATE")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (a.includes("UPDATE") || a.includes("PATCH")) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }
  if (a.includes("APPROVE")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (a.includes("REJECT")) {
    return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
  }
  if (a.includes("BAN") || a.includes("SUSPEND")) {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }
  return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
}

export function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (actionFilter) params.set("action", actionFilter);
    return params.toString();
  }, [page, actionFilter]);

  const { data, isLoading, isError, error, refetch } = useQuery<AuditLogsResponse>({
    queryKey: ["admin-audit-logs", page, actionFilter],
    queryFn: () =>
      apiGet<AuditLogsResponse>(`/api/supabase/admin/audit-logs?${queryParams}`),
  });

  const handleSearch = () => {
    setActionFilter(searchInput.trim());
    setPage(1);
  };

  const handleClear = () => {
    setSearchInput("");
    setActionFilter("");
    setPage(1);
  };

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-violet-500" />
          Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track all administrative actions performed on the platform.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Logs</div>
          <div className="text-2xl font-bold mt-1">
            {pagination?.total ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Current Page</div>
          <div className="text-2xl font-bold mt-1">
            {pagination?.page ?? 1}
            <span className="text-sm text-muted-foreground font-normal">
              {" "}
              / {totalPages}
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Page Size</div>
          <div className="text-2xl font-bold mt-1">
            {pagination?.pageSize ?? PAGE_SIZE}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Filter</div>
          <div className="text-sm font-bold mt-1 truncate">
            {actionFilter || "All actions"}
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by action (e.g. USER_UPDATE, SETTINGS_UPDATE)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleSearch}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
          >
            <Search className="h-4 w-4 mr-1" />
            Filter
          </Button>
          {actionFilter && (
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Logs table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500">
            {(error as Error)?.message || "Failed to load audit logs"}
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">No audit logs found</h3>
            <p className="text-sm text-muted-foreground">
              {actionFilter
                ? `No logs match "${actionFilter}".`
                : "Administrative actions will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {log.admin?.fullName?.charAt(0).toUpperCase() ||
                            log.admin?.username?.charAt(0).toUpperCase() ||
                            "A"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {log.admin?.fullName || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            @{log.admin?.username || "unknown"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getActionColor(log.action)}>
                        <Activity className="h-3 w-3 mr-1" />
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-sm">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          {log.targetType || "—"}
                        </div>
                        {log.targetId && (
                          <div className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                            {log.targetId}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(log.createdAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(log.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        {log.ipAddress || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>
            –
            <span className="font-medium">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{" "}
            of <span className="font-medium">{pagination.total}</span> logs
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm font-medium px-2">
              Page {page} of {totalPages}
            </div>
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

      {/* Details dialog */}
      <Dialog
        open={!!selectedLog}
        onOpenChange={(o) => !o && setSelectedLog(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Activity className="h-5 w-5 text-violet-500" />
              <span className="font-mono text-base">
                {selectedLog?.action}
              </span>
            </DialogTitle>
            <DialogDescription>
              Audit log entry details and changes.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <User className="h-3 w-3" />
                    Admin
                  </div>
                  <div className="font-medium text-sm">
                    {selectedLog.admin?.fullName || "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{selectedLog.admin?.username || "unknown"}
                    {selectedLog.admin?.email
                      ? ` · ${selectedLog.admin.email}`
                      : ""}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Clock className="h-3 w-3" />
                    Timestamp
                  </div>
                  <div className="font-medium text-sm">
                    {formatDate(selectedLog.createdAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(selectedLog.createdAt)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Target className="h-3 w-3" />
                    Target
                  </div>
                  <div className="font-medium text-sm">
                    {selectedLog.targetType || "—"}
                  </div>
                  {selectedLog.targetId && (
                    <div className="text-xs text-muted-foreground font-mono break-all">
                      {selectedLog.targetId}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Globe className="h-3 w-3" />
                    IP Address
                  </div>
                  <div className="font-mono text-sm">
                    {selectedLog.ipAddress || "—"}
                  </div>
                </div>
              </div>

              {/* Before / After Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <ChevronLeft className="h-3 w-3" />
                    BEFORE (Previous State)
                  </div>
                  <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto">
                    {prettyJson(tryParse(selectedLog.beforeData))}
                  </pre>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    AFTER (New State)
                    <ChevronRight className="h-3 w-3" />
                  </div>
                  <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto">
                    {prettyJson(tryParse(selectedLog.afterData))}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
