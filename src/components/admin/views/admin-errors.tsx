"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertOctagon,
  AlertTriangle,
  Info as InfoIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Globe,
  User,
  Clock,
  Code2,
  Server,
  FileWarning,
} from "lucide-react";

import { apiGet } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

type ErrorLevel = "ERROR" | "WARN" | "INFO";

interface ErrorLog {
  id: string;
  level: string;
  message: string;
  path?: string | null;
  method?: string | null;
  stack?: string | null;
  metadata?: any;
  userId?: string | null;
  ipAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
  resolved?: boolean;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ErrorsResponse {
  items?: ErrorLog[];
  errors?: ErrorLog[];
  pagination: Pagination;
}

const PAGE_SIZE = 20;

const LEVEL_META: Record<
  string,
  { label: string; color: string; icon: typeof AlertOctagon }
> = {
  ERROR: {
    label: "Error",
    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: AlertOctagon,
  },
  WARN: {
    label: "Warning",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    icon: AlertTriangle,
  },
  INFO: {
    label: "Info",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    icon: InfoIcon,
  },
};

function levelMeta(level: string) {
  const key = (level || "").toUpperCase();
  return LEVEL_META[key] || {
    label: level || "Unknown",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: InfoIcon,
  };
}

function tryParse(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data !== "string") return data;
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

function truncateMiddle(text: string, max = 60): string {
  if (!text) return "";
  if (text.length <= max) return text;
  const half = Math.floor((max - 3) / 2);
  return `${text.slice(0, half)}...${text.slice(-half)}`;
}

export function AdminErrors() {
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (levelFilter !== "ALL") params.set("level", levelFilter);
    return params.toString();
  }, [page, levelFilter]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<ErrorsResponse>({
      queryKey: ["admin-errors", page, levelFilter],
      queryFn: () =>
        apiGet<ErrorsResponse>(
          `/api/supabase/admin/errors?${queryParams}`
        ),
    });

  // Handle both { items } and { errors } response shapes
  const errors = data?.items || data?.errors || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const handleLevelChange = (value: string) => {
    setLevelFilter(value);
    setPage(1);
  };

  // Summary counts (derived from current page only — for accurate totals rely on pagination.total)
  const counts = {
    ERROR: errors.filter((e) => (e.level || "").toUpperCase() === "ERROR").length,
    WARN: errors.filter((e) => (e.level || "").toUpperCase() === "WARN").length,
    INFO: errors.filter((e) => (e.level || "").toUpperCase() === "INFO").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileWarning className="h-6 w-6 text-red-500" />
            System Errors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and inspect platform errors, warnings, and info events.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Records</div>
          <div className="text-2xl font-bold mt-1">
            {pagination?.total ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertOctagon className="h-3 w-3 text-red-500" />
            Errors (page)
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {counts.ERROR}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Warnings (page)
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {counts.WARN}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <InfoIcon className="h-3 w-3 text-blue-500" />
            Info (page)
          </div>
          <div className="text-2xl font-bold mt-1 text-blue-600">
            {counts.INFO}
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Level:
            </label>
            <Select value={levelFilter} onValueChange={handleLevelChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                <SelectItem value="ERROR">Errors</SelectItem>
                <SelectItem value="WARN">Warnings</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground sm:ml-auto">
            Showing{" "}
            <span className="font-medium text-foreground">
              {pagination && pagination.total > 0
                ? (pagination.page - 1) * pagination.pageSize + 1
                : 0}
              {"–"}
              {pagination
                ? Math.min(pagination.page * pagination.pageSize, pagination.total)
                : 0}
            </span>{" "}
            of <span className="font-medium text-foreground">{pagination?.total ?? 0}</span>{" "}
            records
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <FileWarning className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 font-medium">
              {(error as Error)?.message || "Failed to load system errors"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              The error log may be unavailable or empty.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : errors.length === 0 ? (
          <div className="p-12 text-center">
            <FileWarning className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">No error logs found</h3>
            <p className="text-sm text-muted-foreground">
              {levelFilter !== "ALL"
                ? `No ${levelFilter} records on this page.`
                : "System errors will appear here when they occur."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Level</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-48">Path</TableHead>
                  <TableHead className="w-24">Method</TableHead>
                  <TableHead className="w-44">Timestamp</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((entry) => {
                  const meta = levelMeta(entry.level);
                  const Icon = meta.icon;
                  return (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedError(entry)}
                    >
                      <TableCell>
                        <Badge className={cn("border-0 gap-1", meta.color)}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium line-clamp-2 max-w-md">
                          {entry.message || "No message"}
                        </div>
                        {entry.userId && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            <span className="font-mono truncate max-w-[160px]">
                              {entry.userId}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono text-muted-foreground truncate max-w-[180px]" title={entry.path || ""}>
                          {entry.path ? truncateMiddle(entry.path, 40) : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.method ? (
                          <Badge variant="outline" className="text-xs font-mono">
                            {entry.method}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(entry.createdAt ?? null)}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.createdAt ? formatRelativeTime(entry.createdAt) : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedError(entry)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Page{" "}
            <span className="font-medium text-foreground">{pagination.page}</span>{" "}
            of <span className="font-medium text-foreground">{totalPages}</span>
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
        open={!!selectedError}
        onOpenChange={(o) => !o && setSelectedError(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {(() => {
                const meta = selectedError
                  ? levelMeta(selectedError.level)
                  : LEVEL_META.INFO;
                const Icon = meta.icon;
                return (
                  <>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                        meta.color
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <span className="text-base font-semibold">
                      {selectedError?.message
                        ? truncateMiddle(selectedError.message, 80)
                        : "Error details"}
                    </span>
                  </>
                );
              })()}
            </DialogTitle>
            <DialogDescription>
              Full error record including stack trace and metadata.
            </DialogDescription>
          </DialogHeader>

          {selectedError && (
            <div className="space-y-4">
              {/* Meta grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Clock className="h-3 w-3" />
                    Timestamp
                  </div>
                  <div className="font-medium text-sm">
                    {formatDate(selectedError.createdAt || null)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedError.createdAt
                      ? formatRelativeTime(selectedError.createdAt)
                      : ""}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Server className="h-3 w-3" />
                    Method
                  </div>
                  <div className="font-mono text-sm">
                    {selectedError.method || "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-3 sm:col-span-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Globe className="h-3 w-3" />
                    Path
                  </div>
                  <div className="font-mono text-sm break-all">
                    {selectedError.path || "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-3 sm:col-span-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <User className="h-3 w-3" />
                    User ID
                  </div>
                  <div className="font-mono text-sm break-all">
                    {selectedError.userId || "—"}
                  </div>
                </div>
                {selectedError.ipAddress && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Globe className="h-3 w-3" />
                      IP Address
                    </div>
                    <div className="font-mono text-sm">
                      {selectedError.ipAddress}
                    </div>
                  </div>
                )}
                {typeof selectedError.resolved === "boolean" && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      Status
                    </div>
                    {selectedError.resolved ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0">
                        Resolved
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-0">
                        Unresolved
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Full message */}
              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  Message
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {selectedError.message || "—"}
                </p>
              </div>

              {/* Stack trace */}
              {selectedError.stack && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Code2 className="h-3 w-3" />
                    Stack Trace
                  </div>
                  <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedError.metadata !== null &&
                selectedError.metadata !== undefined && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <Code2 className="h-3 w-3" />
                      Metadata
                    </div>
                    <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto">
                      {prettyJson(tryParse(selectedError.metadata))}
                    </pre>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
