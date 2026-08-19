"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  FileCode2,
  Copy,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  HardDrive,
  ListTree,
  Lock,
  Info,
  Eye,
} from "lucide-react";

import { apiGet } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */

interface SqlFileMeta {
  filename: string;
  number: number;
  size: number;
  lineCount: number;
  path?: string;
}

interface SqlFileListResponse {
  files: SqlFileMeta[];
  count: number;
}

interface SqlFileContent {
  filename: string;
  size: number;
  lineCount: number;
  content: string;
  mimeType?: string;
}

interface SqlFileContentResponse {
  file: SqlFileContent;
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

/* ---------- Component ---------- */

export function AdminSqlViewer() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Fetch file list
  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
    error: listErr,
    refetch: refetchList,
    isFetching: listFetching,
  } = useQuery<SqlFileListResponse>({
    queryKey: ["supabase-sql-file-list"],
    queryFn: () => apiGet<SqlFileListResponse>("/api/supabase/sql-file"),
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Fetch file content (only when a file is selected)
  const {
    data: contentData,
    isLoading: contentLoading,
    isError: contentError,
    error: contentErr,
    refetch: refetchContent,
    isFetching: contentFetching,
  } = useQuery<SqlFileContentResponse>({
    queryKey: ["supabase-sql-file-content", selectedFile],
    queryFn: () =>
      apiGet<SqlFileContentResponse>(
        `/api/supabase/sql-file?file=${encodeURIComponent(selectedFile || "")}`
      ),
    enabled: !!selectedFile,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const files = listData?.files ?? [];
  const file = contentData?.file;
  const fileCount = listData?.count ?? 0;

  const handleCopy = async () => {
    if (!file?.content) {
      toast.error("No content to copy");
      return;
    }
    const ok = await copyToClipboard(file.content);
    if (ok) toast.success(`Copied ${file.filename}`);
    else toast.error("Failed to copy");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCode2 className="h-6 w-6 text-emerald-500" />
            SQL Viewer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only viewer for SQL migration files in{" "}
            <code className="font-mono">supabase/migrations/</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchList()} disabled={listFetching}>
          {listFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              This viewer reads SQL files from{" "}
              <code className="font-mono">supabase/migrations/</code> on the server. Files are
              displayed with syntax highlighting and are read-only.
            </p>
            <p>Click a file in the sidebar to load its content. No secrets are displayed.</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            FILES
          </div>
          <div className="text-2xl font-bold mt-1">{fileCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            TOTAL SIZE
          </div>
          <div className="text-2xl font-bold mt-1">
            {formatBytes(files.reduce((sum, f) => sum + (f.size || 0), 0))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ListTree className="h-3.5 w-3.5" />
            TOTAL LINES
          </div>
          <div className="text-2xl font-bold mt-1">
            {files.reduce((sum, f) => sum + (f.lineCount || 0), 0)}
          </div>
        </Card>
      </div>

      {/* Main viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <Card className="overflow-hidden h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListTree className="h-4 w-4" />
              Files ({fileCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {listLoading ? (
              <div className="space-y-2 px-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : listError ? (
              <div className="px-2 py-4 text-sm text-red-600 dark:text-red-400">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Failed to load files
                </div>
                <div className="text-xs">
                  {(listErr as Error)?.message || "Unknown error"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => refetchList()}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : files.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                <FileCode2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                No SQL files found
              </div>
            ) : (
              <ScrollArea className="h-[400px] lg:h-[560px] pr-2">
                <div className="space-y-1 px-1">
                  {files.map((f) => {
                    const isActive = selectedFile === f.filename;
                    return (
                      <button
                        key={f.filename}
                        type="button"
                        onClick={() => setSelectedFile(f.filename)}
                        className={cn(
                          "w-full text-left rounded-md border px-2.5 py-2 transition-colors",
                          isActive
                            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-700"
                            : "border-transparent hover:bg-muted/60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold",
                              isActive
                                ? "bg-emerald-500 text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {String(f.number).padStart(2, "0")}
                          </div>
                          <span
                            className={cn(
                              "font-mono text-xs truncate flex-1",
                              isActive ? "font-semibold" : ""
                            )}
                            title={f.filename}
                          >
                            {f.filename}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 pl-8 text-xs text-muted-foreground">
                          <span>{f.lineCount} lines</span>
                          <span>{formatBytes(f.size)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Content Panel */}
        <Card className="overflow-hidden">
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center h-[400px] lg:h-[600px] text-center p-8">
              <Eye className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-lg">Select a file to view</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Choose a SQL file from the sidebar to see its content with syntax highlighting.
              </p>
            </div>
          ) : contentLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : contentError ? (
            <div className="p-6">
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium text-red-700 dark:text-red-300">
                    Failed to load file content
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {(contentErr as Error)?.message || "Unknown error"}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => refetchContent()}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : !file ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No file content available.
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* File metadata header */}
              <div className="border-b p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    <span className="font-mono text-sm font-medium truncate">
                      {file.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className="text-xs gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-0"
                    >
                      <Lock className="h-3 w-3" />
                      Read-only
                    </Badge>
                    <Button
                      size="sm"
                      onClick={handleCopy}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <ListTree className="h-3 w-3" />
                    {file.lineCount} lines
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {formatBytes(file.size)}
                  </span>
                  {file.mimeType && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {file.mimeType}
                    </span>
                  )}
                  {contentFetching && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </div>
              </div>

              {/* SQL content */}
              <ScrollArea className="max-h-[600px] w-full">
                <div className="text-xs">
                  <SyntaxHighlighter
                    language="sql"
                    style={vscDarkPlus}
                    showLineNumbers
                    wrapLongLines={false}
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      fontSize: "12px",
                      background: "#1e1e1e",
                      minHeight: "100%",
                    }}
                    lineNumberStyle={{
                      color: "#6b7280",
                      minWidth: "2.5em",
                      paddingRight: "1em",
                      userSelect: "none",
                      textAlign: "right",
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      },
                    }}
                  >
                    {file.content ?? ""}
                  </SyntaxHighlighter>
                </div>
              </ScrollArea>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
