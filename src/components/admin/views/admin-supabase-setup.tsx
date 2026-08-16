"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Server,
  Table2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Info,
  Terminal,
} from "lucide-react";

import { apiGet } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types ---------- */

interface EnvVar {
  key: string;
  label: string;
  set: boolean;
  maskedValue: string;
  isSecret: boolean;
}

interface TableStatus {
  name: string;
  exists: boolean;
  rowCount?: number;
}

interface SupabaseCheckResponse {
  connected: boolean;
  url?: string;
  projectRef?: string;
  tables?: TableStatus[];
  env?: EnvVar[];
  error?: string;
  checkedAt?: string;
}

/* ---------- Helpers ---------- */

function formatRelative(timestamp?: string): string {
  if (!timestamp) return "—";
  try {
    const d = new Date(timestamp);
    return d.toLocaleString();
  } catch {
    return timestamp;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to fallback */
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

/* ---------- Bootstrap SQL ---------- */

const ADMIN_BOOTSTRAP_SQL = `-- Admin bootstrap SQL (run in Supabase SQL Editor)
-- This creates the first admin user. Replace email and password hash as needed.

INSERT INTO "User" (id, email, username, fullName, role, status, passwordHash, createdAt, updatedAt)
VALUES (
  gen_random_uuid(),
  'adminasadullah@ceo.com',
  'admin',
  'Platform Admin',
  'ADMIN',
  'ACTIVE',
  crypt(:password, gen_salt('bf')),
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE
SET role = 'ADMIN', status = 'ACTIVE', updatedAt = now();

-- Verify insertion
SELECT id, email, username, role, status FROM "User" WHERE role = 'ADMIN';`;

/* ---------- Setup steps ---------- */

const SETUP_STEPS = [
  {
    title: "Create a Supabase project",
    description:
      "Sign up at supabase.com and create a new project. Choose a region close to your users for low latency.",
    icon: Server,
  },
  {
    title: "Get your project credentials",
    description:
      "Open Project Settings → API. Copy the Project URL, anon public key, and service_role secret key.",
    icon: KeyRound,
  },
  {
    title: "Configure environment variables",
    description:
      "Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY to your .env file. Restart the dev server afterwards.",
    icon: Terminal,
  },
  {
    title: "Run database migrations",
    description:
      "Open the Supabase SQL Editor and execute each .sql file from supabase/migrations/ in order. Use the SQL Migrations view to copy each file.",
    icon: Database,
  },
  {
    title: "Bootstrap an admin user",
    description:
      "Run the admin bootstrap SQL snippet below to create your first admin account. Then sign in with the admin credentials.",
    icon: ShieldCheck,
  },
];

/* ---------- Component ---------- */

export function AdminSupabaseSetup() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<SupabaseCheckResponse>({
    queryKey: ["supabase-check"],
    queryFn: () => apiGet<SupabaseCheckResponse>("/api/supabase/check"),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const handleCheckConnection = async () => {
    try {
      await refetch();
      toast.success("Connection check complete");
    } catch (err: any) {
      toast.error(err?.message || "Connection check failed");
    }
  };

  const handleCopyBootstrap = async () => {
    const ok = await copyToClipboard(ADMIN_BOOTSTRAP_SQL);
    if (ok) toast.success("Bootstrap SQL copied to clipboard");
    else toast.error("Failed to copy");
  };

  const handleCopyEnvValue = async (envVar: EnvVar) => {
    if (!envVar.maskedValue) {
      toast.error("No value to copy");
      return;
    }
    const ok = await copyToClipboard(envVar.maskedValue);
    if (ok) toast.success(`${envVar.label} value copied`);
    else toast.error("Failed to copy");
  };

  const toggleReveal = (key: string) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const connected = data?.connected ?? false;
  const tables = data?.tables ?? [];
  const env = data?.env ?? [];
  const existingTables = tables.filter((t) => t.exists).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-emerald-500" />
            Supabase Setup
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify your Supabase connection, review environment variables and bootstrap the admin account.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckConnection}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Check Connection
        </Button>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Live status of the Supabase backend. Last checked:{" "}
            {formatRelative(data?.checkedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          ) : isError ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium text-red-700 dark:text-red-300">
                  Unable to check Supabase connection
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  {(error as Error)?.message || data?.error || "Unknown error"}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                {connected ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-0 gap-1">
                    <XCircle className="h-3.5 w-3.5" />
                    Disconnected
                  </Badge>
                )}

                {data?.url && (
                  <span className="text-sm font-mono text-muted-foreground truncate max-w-[280px] sm:max-w-md">
                    {data.url}
                  </span>
                )}

                {data?.projectRef && (
                  <Badge variant="outline" className="font-mono text-xs">
                    ref: {data.projectRef}
                  </Badge>
                )}
              </div>

              {data?.error && !connected && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-md p-3">
                  {data.error}
                </div>
              )}

              {/* Tables existence */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                    Tables ({existingTables}/{tables.length})
                  </div>
                  {tables.length > 0 && (
                    <Badge variant="outline">
                      {existingTables === tables.length ? "All present" : "Missing tables"}
                    </Badge>
                  )}
                </div>

                {tables.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No table status available.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                    {tables.map((t) => (
                      <div
                        key={t.name}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {t.exists ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className="font-mono text-xs truncate">{t.name}</span>
                        </div>
                        {t.exists && typeof t.rowCount === "number" && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {t.rowCount} rows
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Environment Variables
          </CardTitle>
          <CardDescription>
            Values are masked. Secret keys are never displayed in plain text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : env.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No environment variables reported by the backend.
            </div>
          ) : (
            env.map((v) => {
              const isRevealed = revealed[v.key] && !v.isSecret;
              return (
                <div
                  key={v.key}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 flex-wrap"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium font-mono">{v.key}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {v.set
                        ? isRevealed
                          ? v.maskedValue
                          : v.maskedValue || "••••••••"
                        : "Not configured"}
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={
                      v.set
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-0"
                    }
                  >
                    {v.set ? "Set" : "Missing"}
                  </Badge>

                  {v.isSecret && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Secret
                    </Badge>
                  )}

                  <div className="flex items-center gap-1">
                    {!v.isSecret && v.set && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => toggleReveal(v.key)}
                        title={isRevealed ? "Hide" : "Reveal"}
                      >
                        {isRevealed ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleCopyEnvValue(v)}
                      title="Copy value"
                      disabled={!v.set}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Setup Instructions
          </CardTitle>
          <CardDescription>Five steps to wire up Supabase for this platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {SETUP_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <li key={idx} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {step.title}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {step.description}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Supabase Dashboard
              </Button>
            </a>
            <a
              href="https://supabase.com/dashboard/project/_/sql/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <Terminal className="h-4 w-4 mr-2" />
                Open SQL Editor
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Admin bootstrap SQL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Admin Bootstrap SQL
          </CardTitle>
          <CardDescription>
            Run this snippet in the Supabase SQL Editor to create the first admin user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="text-xs font-mono bg-muted rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
              {ADMIN_BOOTSTRAP_SQL}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={handleCopyBootstrap}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Replace <code className="font-mono">:password</code> with the value of the{" "}
              <code className="font-mono">ADMIN_BOOTSTRAP_PASSWORD</code> environment variable.
              Never commit real admin passwords to source control.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
