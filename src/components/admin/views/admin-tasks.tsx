"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiDelete, apiPost } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Play,
  Pause,
  Archive,
  Send,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

type Task = {
  id: string;
  title: string;
  platform: string;
  type: string;
  reward: number;
  status: string;
  maxCompletions: number;
  currentCompletions: number;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  category?: { id: string; name: string } | null;
  _count?: { submissions: number };
  targetUrl?: string;
  profileUrl?: string | null;
  instructions?: string;
  categoryId?: string | null;
  screenshotRequired?: boolean;
  textProofRequired?: boolean;
  linkProofRequired?: boolean;
  priority?: number;
  visibility?: string;
  dailyLimit?: number;
  estimatedTime?: string;
};

type TasksResponse = {
  tasks: Task[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_OPTIONS = ["", "DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];

export function AdminTasks() {
  const { setView } = useAppStore();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [pageSize] = useState(20);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<Task | null>(null);

  const queryKey = ["admin-tasks", page, pageSize, status];

  const { data, isLoading, isError } = useQuery<TasksResponse>({
    queryKey,
    queryFn: () =>
      apiGet<TasksResponse>(
        `/api/supabase/admin/tasks?page=${page}&pageSize=${pageSize}&status=${status}`
      ),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      apiPatch(`/api/supabase/admin/tasks/${id}`, { status: newStatus }),
    onSuccess: () => {
      toast.success("Task status updated");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/supabase/admin/tasks/${id}`),
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (task: Task) =>
      apiPost("/api/supabase/admin/tasks", {
        title: `${task.title} (Copy)`,
        platform: task.platform,
        type: task.type,
        targetUrl: task.targetUrl,
        profileUrl: task.profileUrl,
        instructions: task.instructions,
        reward: task.reward,
        status: "DRAFT",
        maxCompletions: task.maxCompletions,
        startDate: task.startDate,
        endDate: task.endDate,
        categoryId: task.categoryId,
        screenshotRequired: task.screenshotRequired,
        textProofRequired: task.textProofRequired,
        linkProofRequired: task.linkProofRequired,
        priority: task.priority,
        visibility: task.visibility,
        dailyLimit: task.dailyLimit,
        estimatedTime: task.estimatedTime,
      }),
    onSuccess: () => {
      toast.success("Task duplicated");
      queryClient.invalidateQueries({ queryKey });
      setDuplicateTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleStatusChange = (task: Task, newStatus: string) => {
    statusMutation.mutate({ id: task.id, newStatus });
  };

  const handleEdit = (task: Task) => {
    setView("admin-task-create", task.id);
  };

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-violet-500" />
            Tasks Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, edit, and manage all platform tasks ({total} total)
          </p>
        </div>
        <Button
          onClick={() => setView("admin-task-create", null)}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Filters */}
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
                <TableHead className="min-w-[200px]">Title</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Completions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {isError && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-red-500 py-8">
                    <AlertCircle className="h-5 w-5 inline mr-2" />
                    Failed to load tasks. Try again.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && data?.tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No tasks found. Click "Create Task" to add one.
                  </TableCell>
                </TableRow>
              )}

              {data?.tasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="space-y-0.5">
                      <div className="line-clamp-1">{task.title}</div>
                      {task.category?.name && (
                        <div className="text-xs text-muted-foreground">{task.category.name}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{task.platform}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{task.type}</span>
                  </TableCell>
                  <TableCell>
                    <CurrencyDisplay amount={task.reward} className="font-medium" />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-xs">
                      <div className="font-medium">
                        {task.currentCompletions}
                        {task.maxCompletions > 0 && (
                          <span className="text-muted-foreground"> / {task.maxCompletions}</span>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {task._count?.submissions || 0} submissions
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(task.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {/* Status quick actions */}
                      {task.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(task, "ACTIVE")}
                          title="Publish"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(task, "PAUSED")}
                          title="Pause"
                          className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status === "PAUSED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(task, "ACTIVE")}
                          title="Resume"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status !== "ARCHIVED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(task, "ARCHIVED")}
                          title="Archive"
                          className="h-8 w-8 p-0 text-muted-foreground"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(task)}
                        title="Edit"
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDuplicateTarget(task)}
                        title="Duplicate"
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(task)}
                        title="Delete"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            Page {page} of {totalPages} ({total} tasks)
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The task{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.title}</span> and all
              its submissions will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate confirmation */}
      <AlertDialog open={!!duplicateTarget} onOpenChange={(o) => !o && setDuplicateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate this task?</AlertDialogTitle>
            <AlertDialogDescription>
              A new draft copy of{" "}
              <span className="font-semibold text-foreground">{duplicateTarget?.title}</span> will be
              created. You can edit it afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
              disabled={duplicateMutation.isPending}
              onClick={() => duplicateTarget && duplicateMutation.mutate(duplicateTarget)}
            >
              {duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
