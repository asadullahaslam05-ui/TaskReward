"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, uploadFile } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { truncate } from "@/lib/utils-fin";
import { toast } from "sonner";
import {
  ListChecks,
  Search,
  ExternalLink,
  Clock,
  Users,
  Upload,
  X,
  Link as LinkIcon,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  platform: string;
  type: string;
  targetUrl: string;
  instructions: string;
  reward: number;
  maxCompletions: number;
  currentCompletions: number;
  estimatedTime: string;
  screenshotRequired: boolean;
  textProofRequired: boolean;
  linkProofRequired: boolean;
  priority: number;
  category?: { id: string; name: string } | null;
  _count?: { submissions: number };
}

interface TasksResponse {
  tasks: Task[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

const PLATFORMS = ["TikTok", "YouTube", "Instagram", "Facebook", "Twitter", "Other"];
const TASK_TYPES = [
  { value: "LIKE", label: "Like" },
  { value: "FOLLOW", label: "Follow" },
  { value: "COMMENT", label: "Comment" },
  { value: "WATCH", label: "Watch" },
  { value: "OTHER", label: "Other" },
];

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  YouTube: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  Instagram: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  Facebook: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  Twitter: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  Other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function UserTasks() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (platform !== "ALL") params.set("platform", platform);
    if (type !== "ALL") params.set("type", type);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [page, pageSize, platform, type, search]);

  const { data, isLoading, isFetching } = useQuery<TasksResponse>({
    queryKey: ["user-tasks", queryParams],
    queryFn: () => apiGet(`/api/supabase/tasks?${queryParams}`),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };
  const handlePlatform = (val: string) => {
    setPlatform(val);
    setPage(1);
  };
  const handleType = (val: string) => {
    setType(val);
    setPage(1);
  };

  const tasks = data?.tasks || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Available Tasks</h1>
            <p className="text-sm text-muted-foreground">
              Complete tasks and earn rewards
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={platform} onValueChange={handlePlatform}>
            <SelectTrigger>
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={handleType}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {TASK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tasks grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-16 w-full mb-3" />
              <Skeleton className="h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <div className="h-14 w-14 rounded-full bg-violet-100 dark:bg-violet-950/40 mx-auto flex items-center justify-center mb-3">
              <ListChecks className="h-7 w-7 text-violet-500" />
            </div>
            <h3 className="font-semibold text-lg">No tasks available</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {search || platform !== "ALL" || type !== "ALL"
                ? "Try adjusting your filters to see more tasks."
                : "New tasks are added regularly. Please check back later."}
            </p>
            {(search || platform !== "ALL" || type !== "ALL") && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setPlatform("ALL");
                  setType("ALL");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {isFetching ? "Loading..." : `Showing ${tasks.length} of ${pagination?.total || 0} tasks`}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onStart={() => setActiveTask(task)} />
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

      {/* Task modal */}
      <TaskStartDialog
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
          queryClient.invalidateQueries({ queryKey: ["available-tasks-count"] });
          queryClient.invalidateQueries({ queryKey: ["submission-count"] });
        }}
      />
    </div>
  );
}

function TaskCard({ task, onStart }: { task: Task; onStart: () => void }) {
  const remaining =
    task.maxCompletions > 0
      ? Math.max(0, task.maxCompletions - task.currentCompletions)
      : -1; // -1 = unlimited

  const isFull = task.maxCompletions > 0 && remaining === 0;
  const fillPercent = task.maxCompletions > 0
    ? Math.min(100, (task.currentCompletions / task.maxCompletions) * 100)
    : 0;

  return (
    <Card className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="absolute top-0 right-0 h-20 w-20 bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-950/30 dark:to-fuchsia-950/30 rounded-bl-full opacity-50" />
      <div className="flex items-start justify-between gap-2 relative">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`${PLATFORM_COLORS[task.platform] || PLATFORM_COLORS.Other} border-0`}>
            {task.platform}
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase">
            {task.type}
          </Badge>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Reward</div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            <CurrencyDisplay amount={task.reward} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold leading-tight">{task.title}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {truncate(task.instructions, 120)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {task.estimatedTime || "2-3 min"}
        </span>
        {task.maxCompletions > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {remaining} / {task.maxCompletions} slots left
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            Unlimited
          </span>
        )}
      </div>

      {task.maxCompletions > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      )}

      <Button
        onClick={onStart}
        disabled={isFull}
        className={`mt-1 w-full font-semibold ${
          isFull
            ? ""
            : "bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
        }`}
      >
        {isFull ? "Task Full" : "Start Task"}
      </Button>
    </Card>
  );
}

function TaskStartDialog({
  task,
  onClose,
  onSubmitted,
}: {
  task: Task | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [textProof, setTextProof] = useState("");
  const [linkProof, setLinkProof] = useState("");
  const [uploading, setUploading] = useState(false);
  const [hasOpenedUrl, setHasOpenedUrl] = useState(false);

  // Reset form when task changes
  const resetForm = () => {
    setScreenshotUrl("");
    setTextProof("");
    setLinkProof("");
    setHasOpenedUrl(false);
  };

  const handleOpen = () => {
    if (!task?.targetUrl) {
      toast.error("No target URL for this task");
      return;
    }
    window.open(task.targetUrl, "_blank", "noopener,noreferrer");
    setHasOpenedUrl(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFile(file, "task-proofs", "task");
      setScreenshotUrl(result.path);
      toast.success("Screenshot uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error("No task selected");
      const payload: any = {};
      if (task.screenshotRequired) payload.screenshotUrl = screenshotUrl;
      if (task.textProofRequired) payload.textProof = textProof;
      if (task.linkProofRequired) payload.linkProof = linkProof;
      return apiPost(`/api/supabase/tasks/${task.id}`, payload);
    },
    onSuccess: () => {
      toast.success("Task submitted! Awaiting approval.");
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["submission-count"] });
      onSubmitted();
      resetForm();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Submission failed");
    },
  });

  const handleSubmit = () => {
    if (!task) return;
    if (task.screenshotRequired && !screenshotUrl) {
      toast.error("Please upload a screenshot");
      return;
    }
    if (task.textProofRequired && !textProof.trim()) {
      toast.error("Please enter text proof");
      return;
    }
    if (task.linkProofRequired && !linkProof.trim()) {
      toast.error("Please enter the link proof");
      return;
    }
    mutation.mutate();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{task.title}</span>
            <Badge className={`${PLATFORM_COLORS[task.platform] || PLATFORM_COLORS.Other} border-0`}>
              {task.platform}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">
              {task.type}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Complete the task below and submit your proof for verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reward + meta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">Reward</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400">
                <CurrencyDisplay amount={task.reward} />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xs text-muted-foreground">Est. Time</div>
              <div className="font-semibold text-sm">{task.estimatedTime || "2-3 min"}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xs text-muted-foreground">Slots Left</div>
              <div className="font-semibold text-sm">
                {task.maxCompletions > 0
                  ? `${Math.max(0, task.maxCompletions - task.currentCompletions)} / ${task.maxCompletions}`
                  : "Unlimited"}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-violet-500" />
              Instructions
            </h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.instructions}</p>
          </div>

          {/* Open target URL */}
          <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4 text-violet-500" />
                  Open Task Link
                </h4>
                <p className="text-xs text-muted-foreground mt-1 break-all">
                  {task.targetUrl}
                </p>
              </div>
              <Button
                onClick={handleOpen}
                className="bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white shrink-0"
                size="sm"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </div>
            {hasOpenedUrl && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Link opened. Complete the task, then submit your proof below.
              </p>
            )}
          </div>

          {/* Proof form */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Submit Proof</h4>

            {task.screenshotRequired && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Screenshot Proof <span className="text-rose-500">*</span>
                </Label>
                {screenshotUrl ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    { }
                    <img
                      src={screenshotUrl}
                      alt="Screenshot proof"
                      className="w-full max-h-64 object-contain bg-muted"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setScreenshotUrl("")}
                      className="absolute top-2 right-2 h-7 px-2"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Uploading..." : "Click to upload screenshot"}
                    </span>
                    <span className="text-xs text-muted-foreground/70">PNG, JPG up to 10MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            )}

            {task.textProofRequired && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Text Proof <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  placeholder="Enter required text proof (e.g. comment text, username, etc.)"
                  value={textProof}
                  onChange={(e) => setTextProof(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {task.linkProofRequired && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Link Proof <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="Paste the required link (e.g. comment URL, share link)"
                  value={linkProof}
                  onChange={(e) => setLinkProof(e.target.value)}
                />
              </div>
            )}

            {!task.screenshotRequired &&
              !task.textProofRequired &&
              !task.linkProofRequired && (
                <p className="text-sm text-muted-foreground italic">
                  No proof required for this task. Just submit to complete.
                </p>
              )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || uploading}
            className="bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold"
          >
            {mutation.isPending ? "Submitting..." : "Submit Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
