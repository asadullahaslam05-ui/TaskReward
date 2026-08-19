"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Database,
  FileCode2,
  Copy,
  ClipboardCheck,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  ListTree,
  Layers,
  AlertCircle,
  Info,
  ShieldCheck,
  HardDrive,
  FunctionSquare,
  Table2,
  FileText,
} from "lucide-react";

import { apiGet } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types ---------- */

interface MigrationFile {
  filename: string;
  number: number;
  title: string;
  content: string;
  size: number;
  lineCount: number;
}

interface MigrationsResponse {
  migrations: MigrationFile[];
  count: number;
  totalSize: number;
}

interface ValidateSection {
  ok: boolean;
  message?: string;
  total?: number;
  ok_count?: number;
  missing?: string[];
}

interface ValidateResponse {
  connection?: ValidateSection;
  schema?: ValidateSection;
  rls?: ValidateSection;
  rpc?: ValidateSection;
  storage?: ValidateSection;
  seed?: ValidateSection;
  overallOk?: boolean;
  checkedAt?: string;
}

/* ---------- Helpers ---------- */

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/* ---------- Migration steps ---------- */

const MIGRATION_STEPS = [
  "Open the Supabase Dashboard and navigate to the SQL Editor.",
  "Click \"New query\" to start a fresh SQL session.",
  "From the list below, copy each migration in order (oldest first).",
  "Paste the SQL into the editor and click \"Run\" (Ctrl/Cmd + Enter).",
  "Wait for the \"Success\" message before moving to the next file.",
  "Use the \"Check Database\" button above to verify the schema is complete.",
];

/* ---------- Validate Section component ---------- */

function ValidateItem({
  label,
  section,
  icon: Icon,
}: {
  label: string;
  section?: ValidateSection;
  icon: any;
}) {
  const ok = section?.ok ?? false;
  const hasData =
    typeof section?.total === "number" || typeof section?.ok_count === "number";

  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </div>
        {!section ? (
          <Badge variant="outline" className="text-xs">Not checked</Badge>
        ) : ok ? (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            OK
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-0 gap-1">
            <XCircle className="h-3 w-3" />
            Issue
          </Badge>
        )}
      </div>
      {section?.message && (
        <div className="text-xs text-muted-foreground">{section.message}</div>
      )}
      {hasData && (
        <div className="text-xs text-muted-foreground">
          {section?.ok_count ?? 0} / {section?.total ?? 0} OK
        </div>
      )}
      {section?.missing && section.missing.length > 0 && (
        <div className="text-xs space-y-0.5">
          <div className="text-red-600 dark:text-red-400 font-medium">Missing:</div>
          <div className="font-mono text-muted-foreground break-all">
            {section.missing.join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Main component ---------- */

export function AdminSqlMigrations() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);

  const {
    data: migrationsData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<MigrationsResponse>({
    queryKey: ["supabase-migrations"],
    queryFn: () => apiGet<MigrationsResponse>("/api/supabase/migrations"),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const {
    data: validateData,
    isLoading: validateLoading,
    isFetching: validateFetching,
    refetch: refetchValidate,
    isError: validateError,
    error: validateErr,
  } = useQuery<ValidateResponse>({
    queryKey: ["supabase-validate"],
    queryFn: () => apiGet<ValidateResponse>("/api/supabase/validate"),
    enabled: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const migrations = migrationsData?.migrations ?? [];
  const count = migrationsData?.count ?? 0;
  const totalSize = migrationsData?.totalSize ?? 0;

  // Determine effective expanded state. If allExpanded is set, override.
  const isExpanded = (filename: string): boolean => {
    if (allExpanded === true) return true;
    if (allExpanded === false) return false;
    return !!expanded[filename];
  };

  const toggleExpanded = (filename: string) => {
    setAllExpanded(null);
    setExpanded((prev) => ({ ...prev, [filename]: !prev[filename] }));
  };

  const expandAll = () => {
    setAllExpanded(true);
    setExpanded({});
  };

  const collapseAll = () => {
    setAllExpanded(false);
    setExpanded({});
  };

  const handleCopyMigration = async (m: MigrationFile) => {
    const ok = await copyToClipboard(m.content);
    if (ok) toast.success(`Copied ${m.filename}`);
    else toast.error("Failed to copy");
  };

  const handleCopyAll = async () => {
    if (migrations.length === 0) {
      toast.error("No migrations to copy");
      return;
    }
    const separator = "\n\n-- " + "=".repeat(70) + "\n";
    const combined = migrations
      .map(
        (m) =>
          `-- ${m.filename} (${m.title})\n-- ${m.lineCount} lines · ${formatBytes(m.size)}\n` +
          "-- " + "=".repeat(70) + "\n" +
          m.content
      )
      .join(separator);
    const ok = await copyToClipboard(combined);
    if (ok) toast.success(`Copied ${migrations.length} migrations`);
    else toast.error("Failed to copy");
  };

  const handleCheckDatabase = async () => {
    try {
      await refetchValidate();
      toast.success("Database check complete");
    } catch (err: any) {
      toast.error(err?.message || "Database check failed");
    }
  };

  const overallOk = validateData?.overallOk ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-emerald-500" />
            SQL Migrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse migration files in <code className="font-mono">supabase/migrations/</code> and apply them to your database.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckDatabase}
            disabled={validateFetching}
          >
            {validateFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Check Database
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode2 className="h-3.5 w-3.5" />
            MIGRATIONS
          </div>
          <div className="text-2xl font-bold mt-1">{count}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            TOTAL SIZE
          </div>
          <div className="text-2xl font-bold mt-1">{formatBytes(totalSize)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            LINES
          </div>
          <div className="text-2xl font-bold mt-1">
            {migrations.reduce((sum, m) => sum + (m.lineCount || 0), 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            DB STATUS
          </div>
          <div className="text-base font-bold mt-1">
            {validateData ? (
              <Badge
                className={
                  overallOk
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-0"
                }
              >
                {overallOk ? "Healthy" : "Issues"}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Not checked</span>
            )}
          </div>
        </Card>
      </div>

      {/* Database validation card */}
      {validateData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Database Validation
            </CardTitle>
            <CardDescription>
              Live checks against your Supabase database.{" "}
              {validateData.checkedAt ? `Last checked: ${validateData.checkedAt}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ValidateItem label="Connection" section={validateData.connection} icon={Database} />
            <ValidateItem label="Schema (Tables)" section={validateData.schema} icon={Table2} />
            <ValidateItem label="Row Level Security" section={validateData.rls} icon={ShieldCheck} />
            <ValidateItem label="RPC Functions" section={validateData.rpc} icon={FunctionSquare} />
            <ValidateItem label="Storage Buckets" section={validateData.storage} icon={HardDrive} />
            <ValidateItem label="Seed Data" section={validateData.seed} icon={FileText} />
          </CardContent>
        </Card>
      )}

      {validateError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <div className="font-medium">Database validation failed</div>
              <div className="text-xs mt-1">
                {(validateErr as Error)?.message || "Unknown error"}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Migration steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTree className="h-4 w-4" />
            How to Run Migrations
          </CardTitle>
          <CardDescription>Step-by-step instructions for applying migrations.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {MIGRATION_STEPS.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold">
                  {idx + 1}
                </span>
                <span className="text-muted-foreground pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Toolbar */}
      {!isLoading && !isError && migrations.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{count}</span> migration files
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <ChevronDown className="h-4 w-4 mr-1" />
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <ChevronRight className="h-4 w-4 mr-1" />
              Collapse All
            </Button>
            <Button
              size="sm"
              onClick={handleCopyAll}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <ClipboardCheck className="h-4 w-4 mr-1" />
              Copy All Migrations
            </Button>
          </div>
        </div>
      )}

      {/* Migration files */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium text-red-700 dark:text-red-300">
                Failed to load migration files
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                {(error as Error)?.message || "Unknown error"}
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </Card>
      ) : migrations.length === 0 ? (
        <Card className="p-8 text-center">
          <FileCode2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg">No migration files found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add <code className="font-mono">.sql</code> files to{" "}
            <code className="font-mono">supabase/migrations/</code> to see them here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {migrations.map((m) => {
            const expandedFlag = isExpanded(m.filename);
            return (
              <Card key={m.filename} className="overflow-hidden">
                <div className="flex items-start gap-3 p-4 flex-wrap">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-sm font-bold">
                    {String(m.number).padStart(2, "0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium truncate">
                        {m.filename}
                      </span>
                      {m.title && (
                        <Badge variant="outline" className="text-xs">
                          {m.title}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <FileCode2 className="h-3 w-3" />
                        {m.lineCount} lines
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(m.size)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyMigration(m)}
                      title="Copy SQL"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy SQL
                    </Button>
                    <Button
                      size="sm"
                      variant={expandedFlag ? "secondary" : "outline"}
                      onClick={() => toggleExpanded(m.filename)}
                    >
                      {expandedFlag ? (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          Hide SQL
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-3.5 w-3.5 mr-1" />
                          Show SQL
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {expandedFlag && (
                  <div className="border-t">
                    <pre className="text-xs font-mono bg-muted/40 p-4 overflow-x-auto max-h-96 overflow-y-auto">
                      {m.content}
                    </pre>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Migrations are read-only snapshots from{" "}
              <code className="font-mono">supabase/migrations/</code>. Editing them here will not
              change the source files.
            </p>
            <p>
              No environment secrets are displayed on this page. The backend exposes only file
              metadata and SQL content.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
