"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api-client/client";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Flag,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  AlertCircle,
  ImageIcon,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

type Submission = {
  id: string;
  status: string;
  screenshotUrl?: string | null;
  textProof?: string | null;
  linkProof?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  task: {
    id: string;
    title: string;
    reward: number;
    platform?: string;
    type?: string;
    targetUrl?: string;
  };
  user: {
    id: string;
    email: string;
    username?: string | null;
    fullName?: string | null;
  };
};

type SubmissionsResponse = {
  submissions: Submission[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_OPTIONS = ["", "PENDING", "APPROVED", "REJECTED", "FLAGGED"];

export function AdminTaskSubmissions() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [pageSize] = useState(20);
  const [viewSubmission, setViewSubmission] = useState<Submission | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    submission: Submission;
    action: "APPROVE" | "REJECT" | "FLAG";
  } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const queryKey = ["admin-task-submissions", page, pageSize, status];

  const { data, isLoading, isError } = useQuery<SubmissionsResponse>({
    queryKey,
    queryFn: () =>
      apiGet<SubmissionsResponse>(
        `/api/supabase/admin/task-submissions?page=${page}&pageSize=${pageSize}&status=${status}`
      ),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: "APPROVE" | "REJECT" | "FLAG";
      note: string;
    }) => apiPatch(`/api/supabase/admin/task-submissions/${id}`, { action, adminNote: note }),
    onSuccess: (_data, vars) => {
      toast.success(`Submission ${vars.action.toLowerCase()}d`);
      queryClient.invalidateQueries({ queryKey });
      setActionDialog(null);
      setAdminNote("");
      setViewSubmission(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAction = (submission: Submission, action: "APPROVE" | "REJECT" | "FLAG") => {
    setActionDialog({ submission, action });
    setAdminNote("");
  };

  const submitAction = () => {
    if (!actionDialog) return;
    if (actionDialog.action !== "APPROVE" && !adminNote.trim()) {
      toast.error("Please provide a reason/note");
      return;
    }
    actionMutation.mutate({
      id: actionDialog.submission.id,
      action: actionDialog.action,
      note: adminNote.trim(),
    });
  };

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  const actionColor = actionDialog?.action === "APPROVE"
    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
    : actionDialog?.action === "REJECT"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-orange-600 hover:bg-orange-700 text-white";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileCheck className="h-6 w-6 text-violet-500" />
          Task Submissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve user task submissions ({total} total)
        </p>
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-56">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v === "ALL" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUS_OPTIONS.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">User</TableHead>
                <TableHead className="min-w-[200px]">Task</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {isError && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-500 py-8">
                    <AlertCircle className="h-5 w-5 inline mr-2" />
                    Failed to load submissions.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && data?.submissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No submissions found.
                  </TableCell>
                </TableRow>
              )}

              {data?.submissions.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm">{sub.user?.fullName || sub.user?.username || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{sub.user?.email || "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm line-clamp-1">{sub.task?.title || "—"}</div>
                      <div className="flex gap-1">
                        {sub.task?.platform && (
                          <Badge variant="secondary" className="text-xs">{sub.task?.platform || "—"}</Badge>
                        )}
                        {sub.task?.type && (
                          <Badge variant="outline" className="text-xs">{sub.task?.type || "—"}</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CurrencyDisplay amount={sub.task?.reward || 0} className="font-medium text-emerald-600" />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={sub.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(sub.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewSubmission(sub)}
                        title="View details"
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {sub.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAction(sub, "APPROVE")}
                            title="Approve"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAction(sub, "REJECT")}
                            title="Reject"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAction(sub, "FLAG")}
                            title="Flag for review"
                            className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                          >
                            <Flag className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
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
            Page {page} of {totalPages} ({total} submissions)
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

      {/* View details modal */}
      <Dialog open={!!viewSubmission} onOpenChange={(o) => !o && setViewSubmission(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Review the proof submitted by the user
            </DialogDescription>
          </DialogHeader>

          {viewSubmission && (
            <div className="space-y-4">
              {/* User info */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-xs text-muted-foreground">User</div>
                  <div className="font-medium">{viewSubmission.user?.fullName || viewSubmission.user?.username || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{viewSubmission.user?.email || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Task</div>
                  <div className="font-medium line-clamp-1">{viewSubmission.task?.title || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    Reward: <CurrencyDisplay amount={viewSubmission.task?.reward || 0} className="text-emerald-600" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <StatusBadge status={viewSubmission.status} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Submitted</div>
                  <div className="text-sm">{formatDate(viewSubmission.createdAt)}</div>
                </div>
              </div>

              {/* Screenshot */}
              {viewSubmission.screenshotUrl && (
                <div>
                  <Label className="mb-2 block">Screenshot</Label>
                  <a
                    href={viewSubmission.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                  >
                    { }
                    <img
                      src={viewSubmission.screenshotUrl}
                      alt="Submission screenshot"
                      className="w-full max-h-80 object-contain bg-muted"
                    />
                  </a>
                  <a
                    href={viewSubmission.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-violet-600 mt-2 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Open in new tab
                  </a>
                </div>
              )}

              {!viewSubmission.screenshotUrl && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  No screenshot provided
                </div>
              )}

              {/* Text proof */}
              {viewSubmission.textProof && (
                <div>
                  <Label className="mb-2 block">Text Proof</Label>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                    {viewSubmission.textProof}
                  </div>
                </div>
              )}

              {/* Link proof */}
              {viewSubmission.linkProof && (
                <div>
                  <Label className="mb-2 block">Link Proof</Label>
                  <a
                    href={viewSubmission.linkProof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline break-all"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    {viewSubmission.linkProof}
                  </a>
                </div>
              )}

              {/* Device info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">IP Address</Label>
                  <div className="text-sm font-mono">{viewSubmission.ipAddress || "—"}</div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Device Info</Label>
                  <div className="text-xs text-muted-foreground break-all line-clamp-3">
                    {viewSubmission.deviceInfo || "—"}
                  </div>
                </div>
              </div>

              {viewSubmission.adminNote && (
                <div>
                  <Label className="mb-1 block text-xs">Admin Note</Label>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm">
                    {viewSubmission.adminNote}
                  </div>
                </div>
              )}

              {/* Actions inside modal */}
              {viewSubmission.status === "PENDING" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => openAction(viewSubmission, "APPROVE")}
                    disabled={actionMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => openAction(viewSubmission, "REJECT")}
                    disabled={actionMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => openAction(viewSubmission, "FLAG")}
                    disabled={actionMutation.isPending}
                  >
                    <Flag className="h-4 w-4 mr-1" />
                    Flag
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action confirmation dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "APPROVE" && "Approve Submission"}
              {actionDialog?.action === "REJECT" && "Reject Submission"}
              {actionDialog?.action === "FLAG" && "Flag Submission"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "APPROVE" &&
                "Approving will credit the reward to the user's wallet. This action cannot be undone."}
              {actionDialog?.action === "REJECT" &&
                "Please provide a reason for rejecting this submission."}
              {actionDialog?.action === "FLAG" &&
                "Flag this submission for further review. Add a note explaining why."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="adminNote">
                Admin Note {actionDialog?.action !== "APPROVE" && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  actionDialog?.action === "APPROVE"
                    ? "Optional note..."
                    : "Reason / explanation..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              className={actionColor}
              onClick={submitAction}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending
                ? "Processing..."
                : actionDialog?.action === "APPROVE"
                  ? "Confirm Approve"
                  : actionDialog?.action === "REJECT"
                    ? "Confirm Reject"
                    : "Confirm Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
