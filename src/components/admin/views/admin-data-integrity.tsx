"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface IntegrityIssue {
  id: string;
  issue: string;
  table: string;
  recordId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  suggestion: string;
}

interface DataIntegrityResponse {
  issues: IntegrityIssue[];
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const severityConfig = {
  CRITICAL: {
    label: "Critical",
    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    icon: AlertCircle,
  },
  HIGH: {
    label: "High",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    icon: AlertTriangle,
  },
  MEDIUM: {
    label: "Medium",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    icon: AlertTriangle,
  },
  LOW: {
    label: "Low",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    icon: Info,
  },
};

export function AdminDataIntegrity() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DataIntegrityResponse>({
    queryKey: ["data-integrity"],
    queryFn: () => apiGet<DataIntegrityResponse>("/api/supabase/admin/data-integrity"),
  });

  const issues = data?.issues || [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Data Integrity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detect orphaned records, missing relations, and data inconsistencies
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Re-scan
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Total Issues</div>
            <div className="text-2xl font-bold mt-1">{summary.totalIssues}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Critical</div>
            <div className="text-2xl font-bold mt-1 text-red-600">{summary.critical}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">High</div>
            <div className="text-2xl font-bold mt-1 text-orange-600">{summary.high}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Medium</div>
            <div className="text-2xl font-bold mt-1 text-amber-600">{summary.medium}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Low</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{summary.low}</div>
          </Card>
        </div>
      )}

      {/* Status Messages */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {isError && (
        <Card className="p-6 border-red-200 bg-red-50 dark:bg-red-950/20">
          <p className="text-sm text-red-600">
            Failed to load data integrity report. Click "Re-scan" to try again.
          </p>
        </Card>
      )}

      {!isLoading && !isError && issues.length === 0 && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-semibold text-lg">All Clear!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No data integrity issues detected. All relations are healthy.
          </p>
        </Card>
      )}

      {/* Issues Table */}
      {!isLoading && !isError && issues.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-32">Table</TableHead>
                  <TableHead className="w-48">Record ID</TableHead>
                  <TableHead>Suggested Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => {
                  const config = severityConfig[issue.severity];
                  const Icon = config.icon;
                  return (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <Badge className={config.color + " border-0 gap-1"}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{issue.issue}</TableCell>
                      <TableCell className="text-sm font-mono">{issue.table}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-48">
                        {issue.recordId}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {issue.suggestion}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p>
              This diagnostic tool performs read-only checks on the database. It does NOT
              modify or delete any records. Issues are detected by checking foreign key
              references, orphaned records, and data consistency.
            </p>
            <p className="mt-2">
              No automated fixes are applied. Review each issue and take manual action if needed.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
