"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client/client";
import { useAppStore } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { isValidUrl } from "@/lib/utils-fin";

type Category = { id: string; name: string; description?: string | null; active: boolean };

type TaskDetail = {
  id: string;
  title: string;
  platform: string;
  type: string;
  targetUrl: string;
  profileUrl?: string | null;
  instructions: string;
  reward: number;
  status: string;
  maxCompletions: number;
  startDate?: string | null;
  endDate?: string | null;
  categoryId?: string | null;
  screenshotRequired: boolean;
  textProofRequired: boolean;
  linkProofRequired: boolean;
  priority: number;
  visibility: string;
  dailyLimit: number;
  estimatedTime: string;
};

const PLATFORMS = ["TikTok", "YouTube", "Instagram", "Facebook", "Other"];
const TASK_TYPES = ["LIKE", "FOLLOW", "COMMENT", "WATCH", "OTHER"];

function toInputDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

const DEFAULT_FORM = {
  title: "",
  platform: "TikTok",
  type: "LIKE",
  targetUrl: "",
  profileUrl: "",
  instructions: "",
  reward: 0,
  status: "DRAFT",
  maxCompletions: 0,
  startDate: "",
  endDate: "",
  categoryId: "",
  screenshotRequired: true,
  textProofRequired: false,
  linkProofRequired: false,
  priority: 0,
  visibility: "PUBLIC",
  dailyLimit: 0,
  estimatedTime: "2-3 min",
};

function formFromTask(t: TaskDetail) {
  return {
    title: t.title || "",
    platform: t.platform || "TikTok",
    type: t.type || "LIKE",
    targetUrl: t.targetUrl || "",
    profileUrl: t.profileUrl || "",
    instructions: t.instructions || "",
    reward: t.reward ?? 0,
    status: t.status || "DRAFT",
    maxCompletions: t.maxCompletions ?? 0,
    startDate: toInputDate(t.startDate),
    endDate: toInputDate(t.endDate),
    categoryId: t.categoryId || "",
    screenshotRequired: t.screenshotRequired ?? true,
    textProofRequired: t.textProofRequired ?? false,
    linkProofRequired: t.linkProofRequired ?? false,
    priority: t.priority ?? 0,
    visibility: t.visibility || "PUBLIC",
    dailyLimit: t.dailyLimit ?? 0,
    estimatedTime: t.estimatedTime || "2-3 min",
  };
}

/**
 * Inner form component that initializes its state from `initialTask`.
 * Uses a `key` prop on the parent to remount when switching tasks.
 */
function TaskForm({
  selectedId,
  initialTask,
  categories,
  onDone,
}: {
  selectedId: string | null;
  initialTask: TaskDetail | null;
  categories: Category[] | undefined;
  onDone: () => void;
}) {
  const isEdit = !!selectedId;
  const [form, setForm] = useState(initialTask ? formFromTask(initialTask) : DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        platform: form.platform,
        type: form.type,
        targetUrl: form.targetUrl.trim(),
        profileUrl: form.profileUrl.trim() || null,
        instructions: form.instructions.trim(),
        reward: Number(form.reward),
        status: form.status,
        maxCompletions: Number(form.maxCompletions),
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        categoryId: form.categoryId || null,
        screenshotRequired: form.screenshotRequired,
        textProofRequired: form.textProofRequired,
        linkProofRequired: form.linkProofRequired,
        priority: Number(form.priority),
        visibility: form.visibility,
        dailyLimit: Number(form.dailyLimit),
        estimatedTime: form.estimatedTime,
      };

      if (isEdit && selectedId) {
        return apiPatch(`/api/supabase/admin/tasks/${selectedId}`, payload);
      }
      return apiPost("/api/supabase/admin/tasks", payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Task updated successfully" : "Task created successfully");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.targetUrl.trim()) errs.targetUrl = "Target URL is required";
    else if (!isValidUrl(form.targetUrl.trim())) errs.targetUrl = "Please enter a valid URL";
    if (Number(form.reward) <= 0) errs.reward = "Reward must be greater than 0";
    if (form.profileUrl && !isValidUrl(form.profileUrl.trim()))
      errs.profileUrl = "Please enter a valid profile URL";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }
    saveMutation.mutate();
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold border-b pb-3">Basic Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Like and follow on TikTok"
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <Label>Platform</Label>
            <Select value={form.platform} onValueChange={(v) => update("platform", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Task Type</Label>
            <Select value={form.type} onValueChange={(v) => update("type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="targetUrl">
              Target URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="targetUrl"
              value={form.targetUrl}
              onChange={(e) => update("targetUrl", e.target.value)}
              placeholder="https://tiktok.com/@user/video/123"
              className={errors.targetUrl ? "border-red-500" : ""}
            />
            {errors.targetUrl && (
              <p className="text-xs text-red-500 mt-1">{errors.targetUrl}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="profileUrl">Profile URL (optional)</Label>
            <Input
              id="profileUrl"
              value={form.profileUrl}
              onChange={(e) => update("profileUrl", e.target.value)}
              placeholder="https://tiktok.com/@user"
              className={errors.profileUrl ? "border-red-500" : ""}
            />
            {errors.profileUrl && (
              <p className="text-xs text-red-500 mt-1">{errors.profileUrl}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={form.instructions}
              onChange={(e) => update("instructions", e.target.value)}
              placeholder="Step-by-step instructions for users to complete the task..."
              rows={4}
            />
          </div>
        </div>
      </Card>

      {/* Reward & Limits */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold border-b pb-3">Reward & Limits</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="reward">
              Reward Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reward"
              type="number"
              step="0.01"
              min="0"
              value={form.reward}
              onChange={(e) => update("reward", parseFloat(e.target.value) || 0)}
              className={errors.reward ? "border-red-500" : ""}
            />
            {errors.reward && (
              <p className="text-xs text-red-500 mt-1">{errors.reward}</p>
            )}
          </div>

          <div>
            <Label htmlFor="maxCompletions">Max Completions (0 = unlimited)</Label>
            <Input
              id="maxCompletions"
              type="number"
              min="0"
              value={form.maxCompletions}
              onChange={(e) => update("maxCompletions", parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label htmlFor="dailyLimit">Daily Limit per User (0 = unlimited)</Label>
            <Input
              id="dailyLimit"
              type="number"
              min="0"
              value={form.dailyLimit}
              onChange={(e) => update("dailyLimit", parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority (higher shows first)</Label>
            <Input
              id="priority"
              type="number"
              value={form.priority}
              onChange={(e) => update("priority", parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label htmlFor="estimatedTime">Estimated Time</Label>
            <Input
              id="estimatedTime"
              value={form.estimatedTime}
              onChange={(e) => update("estimatedTime", e.target.value)}
              placeholder="e.g. 2-3 min"
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={form.categoryId || "NONE"}
              onValueChange={(v) => update("categoryId", v === "NONE" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No category</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id} disabled={!c.active}>
                    {c.name}
                    {!c.active && " (inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Schedule & Status */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold border-b pb-3">Schedule & Status</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => update("endDate", e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft (not visible to users)</SelectItem>
                <SelectItem value="ACTIVE">Active (live)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visibility</Label>
            <Select value={form.visibility} onValueChange={(v) => update("visibility", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public (all users)</SelectItem>
                <SelectItem value="PRIVATE">Private (link only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Proof Requirements */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold border-b pb-3">Proof Requirements</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="screenshotRequired" className="cursor-pointer">
                Screenshot Required
              </Label>
              <p className="text-xs text-muted-foreground">User must upload a screenshot</p>
            </div>
            <Switch
              id="screenshotRequired"
              checked={form.screenshotRequired}
              onCheckedChange={(v) => update("screenshotRequired", v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="textProofRequired" className="cursor-pointer">
                Text Proof Required
              </Label>
              <p className="text-xs text-muted-foreground">User must enter text proof</p>
            </div>
            <Switch
              id="textProofRequired"
              checked={form.textProofRequired}
              onCheckedChange={(v) => update("textProofRequired", v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="linkProofRequired" className="cursor-pointer">
                Link Proof Required
              </Label>
              <p className="text-xs text-muted-foreground">User must submit a proof link</p>
            </div>
            <Switch
              id="linkProofRequired"
              checked={form.linkProofRequired}
              onCheckedChange={(v) => update("linkProofRequired", v)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
          <Checkbox id="ack" defaultChecked disabled className="opacity-50" />
          <label htmlFor="ack" className="cursor-not-allowed">
            At least one proof requirement should be enabled for verification
          </label>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saveMutation.isPending}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending
            ? "Saving..."
            : isEdit
              ? "Update Task"
              : "Create Task"}
        </Button>
      </div>
    </form>
  );
}

export function AdminTaskCreate() {
  const { selectedId, setView } = useAppStore();
  const isEdit = !!selectedId;

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["admin-categories-all"],
    queryFn: () => apiGet<Category[]>("/api/supabase/admin/categories"),
  });

  const { data: existingTask, isLoading } = useQuery<TaskDetail>({
    queryKey: ["admin-task", selectedId],
    queryFn: () => apiGet<TaskDetail>(`/api/supabase/admin/tasks/${selectedId}`),
    enabled: isEdit,
  });

  const handleDone = () => setView("admin-tasks", null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleDone}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileCheck className="h-6 w-6 text-violet-500" />
              {isEdit ? "Edit Task" : "Create New Task"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEdit ? "Update task details and settings" : "Fill in the details to create a new task"}
            </p>
          </div>
        </div>
      </div>

      {isEdit && isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </Card>
        </div>
      ) : (
        <TaskForm
          key={selectedId || "new"}
          selectedId={selectedId}
          initialTask={existingTask ?? null}
          categories={categories}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
