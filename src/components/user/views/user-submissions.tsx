"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime, formatDate, truncate } from "@/lib/utils-fin";
import {
  FileCheck,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ExternalLink,
  FileText,
  MessageSquare,
  Inbox,
  Link as LinkIcon,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  platform: string;
  type: string;
  reward: number;
  instructions?: string;
  targetUrl?: string;
}

interface Submission {
  id: string;
  taskId: string;
  task: Task;
  screenshotUrl: string | null;
  textProof: string | null;
  linkProof: string | null;
  status: string;
  adminNote: string | null;
  rewardCredited: boolean;
  createdAt: string;
  reviewedAt: string | null;
}

interface SubmissionsResponse {
  submissions: Submission[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "FLAGGED", label: "Flagged" },
];

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  YouTube: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  Instagram: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  Facebook: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  Twitter: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  Other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function UserSubmissions() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [status, setStatus] = useState<string>("ALL");
  const [selected, setSelected] = useState<Submission | null>(null);

  const queryStr = `?page=${page}&pageSize=${pageSize}${
    status !== "ALL" ? `&status=${status}` : ""
  }`;

  const { data, isLoading, isFetching } = useQuery<SubmissionsResponse>({
    queryKey: ["user-submissions", queryStr],
    queryFn: () => apiGet(`/api/supabase/task-submissions${queryStr}`),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const submissions = data?.submissions || [];
  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
          <FileCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Submissions</h1>
          <p className="text-sm text-muted-foreground">
            Track the status of your task submissions
          </p>
        </div>
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="w-full md:w-64">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            {isFetching ? "Loading..." : `${data?.pagination?.total || 0} total submissions`}
          </div>
        </div>
      </Card>

      {/* Submissions list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <div className="h-14 w-14 rounded-full bg-violet-100 dark:bg-violet-950/40 mx-auto flex items-center justify-center mb-3">
              <Inbox className="h-7 w-7 text-violet-500" />
            </div>
            <h3 className="font-semibold text-lg">No submissions found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {status !== "ALL"
                ? "No submissions match this filter."
                : "Complete some tasks to see your submissions here."}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {submissions.map((sub) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                onClick={() => setSelected(sub)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
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
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
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
        </>
      )}

      {/* Detail dialog */}
      <SubmissionDetailDialog
        submission={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function SubmissionCard({
  submission,
  onClick,
}: {
  submission: Submission;
  onClick: () => void;
}) {
  const { task, status, screenshotUrl, createdAt, adminNote } = submission;

  return (
    <Card
      onClick={onClick}
      className="p-4 cursor-pointer hover:shadow-md hover:border-violet-300 dark:hover:border-violet-800 transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Screenshot thumbnail */}
        <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
          {screenshotUrl ? (
             
            <img
              src={screenshotUrl}
              alt="Proof"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2">
              {task?.title || "—"}
            </h3>
            <StatusBadge status={status} className="shrink-0" />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={`text-[10px] border-0 ${PLATFORM_COLORS[task?.platform || "—"] || PLATFORM_COLORS.Other}`}
            >
              {task?.platform || "—"}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">
              {task?.type || "—"}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CurrencyDisplay amount={task?.reward || 0} />
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(createdAt)}
            </span>
          </div>
        </div>
      </div>

      {adminNote && (
        <div className="mt-3 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
          <span className="font-medium">Admin note:</span>{" "}
          {truncate(adminNote, 80)}
        </div>
      )}

      <Button variant="ghost" size="sm" className="mt-2 w-full text-violet-600 dark:text-violet-400">
        View details
      </Button>
    </Card>
  );
}

function SubmissionDetailDialog({
  submission,
  onClose,
}: {
  submission: Submission | null;
  onClose: () => void;
}) {
  if (!submission) return null;
  const { task, status, screenshotUrl, textProof, linkProof, adminNote, createdAt, reviewedAt, rewardCredited } = submission;

  return (
    <Dialog open={!!submission} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
            <span className="truncate">{task?.title || "—"}</span>
          </DialogTitle>
          <DialogDescription>
            Submitted {formatDate(createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="mt-1">
                <StatusBadge status={status} />
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Reward</div>
              <div className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                <CurrencyDisplay amount={task?.reward || 0} />
                {rewardCredited && (
                  <Badge variant="outline" className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-0">
                    Credited
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Task meta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`${PLATFORM_COLORS[task?.platform || "—"] || PLATFORM_COLORS.Other} border-0`}>
              {task?.platform || "—"}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">
              {task?.type || "—"}
            </Badge>
            {task?.targetUrl && (
              <a
                href={task?.targetUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View task URL
              </a>
            )}
          </div>

          {/* Screenshot */}
          {screenshotUrl && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-violet-500" />
                Screenshot Proof
              </h4>
              <div className="rounded-lg overflow-hidden border">
                { }
                <img
                  src={screenshotUrl}
                  alt="Screenshot proof"
                  className="w-full max-h-80 object-contain bg-muted"
                />
              </div>
            </div>
          )}

          {/* Text proof */}
          {textProof && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-violet-500" />
                Text Proof
              </h4>
              <div className="rounded-lg border p-3 bg-muted/30 text-sm whitespace-pre-wrap">
                {textProof}
              </div>
            </div>
          )}

          {/* Link proof */}
          {linkProof && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <LinkIcon className="h-4 w-4 text-violet-500" />
                Link Proof
              </h4>
              <a
                href={linkProof}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border p-3 bg-muted/30 text-sm text-violet-600 dark:text-violet-400 hover:underline break-all"
              >
                {linkProof}
              </a>
            </div>
          )}

          {/* Admin note */}
          {adminNote && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-violet-500" />
                Admin Note
              </h4>
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm">
                {adminNote}
              </div>
            </div>
          )}

          {/* Reviewed date */}
          {reviewedAt && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Reviewed on {formatDate(reviewedAt)}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
