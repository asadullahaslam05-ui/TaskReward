"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api-client/client";
import { formatDate } from "@/lib/utils-fin";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Database,
  ShieldCheck,
  HardDrive,
  Users,
  ListTodo,
  ArrowLeftRight,
  AlertTriangle,
  RefreshCw,
  Server,
  Globe,
  Code,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

// ------------------------------------------------------------------
// Types — every field is optional so `?.` is enforced. The actual
// Supabase admin route returns a superset of the spec; we accept
// any of the documented/known shapes gracefully.
// ------------------------------------------------------------------
type ServiceStatus = "healthy" | "degraded" | "down";

type SystemError = {
  id?: string;
  level?: string;
  message?: string;
  error?: string | null;
  path?: string | null;
  stack?: string | null;
  resolved?: boolean | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type SystemHealthResponse = {
  overall?: ServiceStatus;
  database?: {
    status?: ServiceStatus;
    latencyMs?: number | null;
    error?: string | null;
    provider?: string | null;
    url?: string | null;
  };
  auth?: {
    status?: ServiceStatus;
    provider?: string | null;
  };
  storage?: {
    status?: ServiceStatus;
    error?: string | null;
    path?: string | null;
  };
  metrics?: {
    totalUsers?: number;
    totalTasks?: number;
    totalTransactions?: number;
  };
  errors?: {
    count24h?: number;
    recent?: SystemError[];
  };
  recentErrors?: SystemError[];
  environment?:
    | string
    | {
        node?: string;
        region?: string;
        runtime?: string;
        responseTimeMs?: number;
        timestamp?: string;
        supabaseUrlConfigured?: boolean;
        serviceKeyConfigured?: boolean;
        publishableKeyConfigured?: boolean;
      };
  version?: string;
  supabase?: {
    configured?: boolean;
    url?: string | null;
  };
};

const STATUS_STYLES: Record<
  ServiceStatus,
  { dot: string; text: string; bg: string; label: string }
> = {
  healthy: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
    label: "Healthy",
  },
  degraded: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
    label: "Degraded",
  },
  down: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
    label: "Down",
  },
};

function statusOf(s?: ServiceStatus | null): ServiceStatus {
  return s === "healthy" || s === "degraded" || s === "down" ? s : "down";
}

export function AdminSystemHealth() {
  const { data, isLoading, isFetching, isError, refetch } = useQuery<SystemHealthResponse>({
    queryKey: ["admin-supabase-system-health"],
    queryFn: () => apiGet<SystemHealthResponse>("/api/supabase/admin/system-health"),
  });

  // Handle recent errors from either shape
  const recentErrors: SystemError[] = useMemo(() => {
    const list = data?.recentErrors ?? data?.errors?.recent ?? [];
    return Array.isArray(list) ? list : [];
  }, [data]);

  // Compute count in last 24h (best-effort from recentErrors list)
  const errors24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return recentErrors.filter((e) => {
      const ts = e?.createdAt || e?.created_at;
      if (!ts) return true; // include if no timestamp
      return new Date(ts).getTime() >= cutoff;
    }).length;
  }, [recentErrors]);

  const dbStatus = statusOf(data?.database?.status);
  const authStatus = statusOf(data?.auth?.status);
  const storageStatus = statusOf(data?.storage?.status);
  const overall = statusOf(data?.overall);

  // Environment can be a string OR an object — handle both
  const envInfo = useMemo(() => {
    const env = data?.environment;
    if (typeof env === "string") {
      return {
        node: env,
        region: "—",
        runtime: "—",
        responseTimeMs: null,
        timestamp: null,
        supabaseUrlConfigured: null,
        serviceKeyConfigured: null,
        publishableKeyConfigured: null,
      };
    }
    return {
      node: env?.node || "—",
      region: env?.region || "—",
      runtime: env?.runtime || "—",
      responseTimeMs: env?.responseTimeMs ?? null,
      timestamp: env?.timestamp ?? null,
      supabaseUrlConfigured: env?.supabaseUrlConfigured ?? null,
      serviceKeyConfigured: env?.serviceKeyConfigured ?? null,
      publishableKeyConfigured: env?.publishableKeyConfigured ?? null,
    };
  }, [data?.environment]);

  const version = data?.version || "—";
  const supabaseConfigured =
    typeof data?.supabase?.configured === "boolean"
      ? data?.supabase?.configured
      : envInfo.supabaseUrlConfigured;
  const supabaseUrl = data?.supabase?.url || null;

  if (isError) {
    return (
      <div className="space-y-6">
        <Header
          onRefresh={() => refetch()}
          refreshing={isFetching}
          overallStatus="down"
        />
        <Card className="p-0">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-sm font-medium">Failed to load system health</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please try refreshing, or check that the admin API is reachable.
            </p>
            <Button
              onClick={() => refetch()}
              className="mt-4"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        onRefresh={() => refetch()}
        refreshing={isFetching}
        overallStatus={overall}
      />

      {/* System status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ServiceCard
          icon={<Database className="h-5 w-5" />}
          title="Database"
          status={dbStatus}
          loading={isLoading}
          extra={
            <>
              {typeof data?.database?.latencyMs === "number" && (
                <div className="text-xs text-muted-foreground mt-1">
                  Latency: <span className="font-medium">{data.database?.latencyMs}ms</span>
                </div>
              )}
              {data?.database?.provider && (
                <div className="text-xs text-muted-foreground">
                  Provider: <span className="font-medium capitalize">{data.database?.provider}</span>
                </div>
              )}
              {data?.database?.url && (
                <div className="text-xs text-muted-foreground truncate">
                  URL: <span className="font-mono">{data.database?.url}</span>
                </div>
              )}
              {data?.database?.error && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400 break-all">
                  {data.database?.error}
                </div>
              )}
            </>
          }
        />
        <ServiceCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Authentication"
          status={authStatus}
          loading={isLoading}
          extra={
            <>
              {data?.auth?.provider && (
                <div className="text-xs text-muted-foreground mt-1">
                  Provider:{" "}
                  <span className="font-medium capitalize">{data.auth?.provider}</span>
                </div>
              )}
            </>
          }
        />
        <ServiceCard
          icon={<HardDrive className="h-5 w-5" />}
          title="Storage"
          status={storageStatus}
          loading={isLoading}
          extra={
            <>
              {data?.storage?.path && (
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  Path: <span className="font-mono">{data.storage?.path}</span>
                </div>
              )}
              {data?.storage?.error && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400 break-all">
                  {data.storage?.error}
                </div>
              )}
            </>
          }
        />
      </div>

      {/* Metrics */}
      <Card className="p-0">
        <CardHeader className="border-b p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-500" />
            Platform Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
            <MetricCell
              icon={<Users className="h-5 w-5 text-violet-500" />}
              label="Total Users"
              value={data?.metrics?.totalUsers ?? 0}
              loading={isLoading}
            />
            <MetricCell
              icon={<ListTodo className="h-5 w-5 text-fuchsia-500" />}
              label="Total Tasks"
              value={data?.metrics?.totalTasks ?? 0}
              loading={isLoading}
            />
            <MetricCell
              icon={<ArrowLeftRight className="h-5 w-5 text-emerald-500" />}
              label="Total Transactions"
              value={data?.metrics?.totalTransactions ?? 0}
              loading={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent errors */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recent Errors
            </CardTitle>
            <Badge
              variant="outline"
              className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
            >
              {errors24h} in last 24h
            </Badge>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : recentErrors.length === 0 ? (
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium">No recent errors</p>
            <p className="text-xs text-muted-foreground mt-1">
              Everything looks clean — no errors logged recently.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Level</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead className="pr-4">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentErrors.map((e, idx) => {
                  const level = (e?.level || "ERROR").toUpperCase();
                  const ts = e?.createdAt || e?.created_at;
                  const message = e?.message || e?.error || "—";
                  return (
                    <TableRow key={e?.id || idx}>
                      <TableCell className="pl-4">
                        <Badge
                          variant="outline"
                          className={
                            "border-0 font-medium " +
                            (level === "FATAL" || level === "ERROR"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                              : level === "WARN" || level === "WARNING"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400")
                          }
                        >
                          {level}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="text-sm break-words">{message}</span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="font-mono text-xs text-muted-foreground truncate block">
                          {e?.path || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {ts ? formatDate(ts) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Environment & Supabase info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-0">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-violet-500" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <InfoRow
              icon={<Code className="h-4 w-4" />}
              label="Node Env"
              value={String(envInfo.node)}
            />
            <InfoRow
              icon={<Globe className="h-4 w-4" />}
              label="Region"
              value={String(envInfo.region)}
            />
            <InfoRow
              icon={<Server className="h-4 w-4" />}
              label="Runtime"
              value={String(envInfo.runtime)}
            />
            {typeof envInfo.responseTimeMs === "number" && (
              <InfoRow
                icon={<Activity className="h-4 w-4" />}
                label="Response Time"
                value={`${envInfo.responseTimeMs}ms`}
              />
            )}
            {envInfo.timestamp && (
              <InfoRow
                icon={<RefreshCw className="h-4 w-4" />}
                label="Snapshot At"
                value={formatDate(envInfo.timestamp)}
              />
            )}
            <InfoRow
              icon={<Code className="h-4 w-4" />}
              label="Version"
              value={String(version)}
            />
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-fuchsia-500" />
              Supabase Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <ConfigRow
              label="Configured"
              ok={Boolean(supabaseConfigured)}
            />
            <ConfigRow
              label="URL configured"
              ok={Boolean(envInfo.supabaseUrlConfigured)}
            />
            <ConfigRow
              label="Service key configured"
              ok={Boolean(envInfo.serviceKeyConfigured)}
            />
            <ConfigRow
              label="Publishable key configured"
              ok={Boolean(envInfo.publishableKeyConfigured)}
            />
            {supabaseUrl && (
              <InfoRow
                icon={<Globe className="h-4 w-4" />}
                label="URL"
                value={
                  <span className="font-mono text-xs break-all">{supabaseUrl}</span>
                }
              />
            )}
            {!supabaseConfigured && (
              <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                Supabase environment variables are not fully configured. Some
                services may be unavailable.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------
function Header({
  onRefresh,
  refreshing,
  overallStatus,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  overallStatus: ServiceStatus;
}) {
  const style = STATUS_STYLES[overallStatus];
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          System Health
        </h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 ${style.text}`}>
            <span className={`h-2 w-2 rounded-full ${style.dot} ${refreshing ? "animate-pulse" : ""}`} />
            {style.label}
          </span>
          <span>• Real-time snapshot of platform services</span>
        </p>
      </div>
      <Button onClick={onRefresh} disabled={refreshing} variant="outline">
        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  status,
  loading,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  status: ServiceStatus;
  loading?: boolean;
  extra?: React.ReactNode;
}) {
  const style = STATUS_STYLES[status];
  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </CardTitle>
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <Badge variant="outline" className={`border ${style.bg} ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot} mr-1.5`} />
            {style.label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : (
          <div className="space-y-0.5">{extra}</div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading?: boolean;
}) {
  return (
    <div className="p-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {loading ? (
          <Skeleton className="h-6 w-16 mt-1" />
        ) : (
          <div className="text-2xl font-bold mt-0.5">
            {new Intl.NumberFormat("en-US").format(value || 0)}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="font-medium text-right truncate max-w-[60%]">{value}</div>
    </div>
  );
}

function ConfigRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {ok ? (
        <Badge
          variant="outline"
          className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Yes
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-0 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
        >
          <XCircle className="h-3 w-3 mr-1" />
          No
        </Badge>
      )}
    </div>
  );
}
