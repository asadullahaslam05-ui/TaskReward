"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Users,
  Info,
} from "lucide-react";

import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils-fin";

type TagColor = "gray" | "blue" | "green" | "amber" | "red" | "purple";

interface UserTag {
  id: string;
  name: string;
  color: TagColor | string;
  description?: string | null;
  active: boolean;
  createdAt?: string;
  assignmentCount?: number;
  _count?: { users?: number };
}

interface FormState {
  name: string;
  color: TagColor;
  description: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  color: "gray",
  description: "",
  active: true,
};

const COLOR_OPTIONS: {
  value: TagColor;
  label: string;
  swatch: string;
  badge: string;
}[] = [
  {
    value: "gray",
    label: "Gray",
    swatch: "bg-gray-500",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  {
    value: "blue",
    label: "Blue",
    swatch: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    value: "green",
    label: "Green",
    swatch: "bg-emerald-500",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  {
    value: "amber",
    label: "Amber",
    swatch: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    value: "red",
    label: "Red",
    swatch: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  {
    value: "purple",
    label: "Purple",
    swatch: "bg-purple-500",
    badge:
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
];

function colorMeta(color: string) {
  return (
    COLOR_OPTIONS.find((c) => c.value === color) || COLOR_OPTIONS[0]
  );
}

function getAssignmentCount(tag: UserTag | null | undefined): number {
  if (!tag) return 0;
  if (typeof tag.assignmentCount === "number") return tag.assignmentCount;
  if (tag._count?.users) return tag._count.users;
  return 0;
}

function TagFormDialog({
  open,
  editing,
  onOpenChange,
}: {
  open: boolean;
  editing: UserTag | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          name: editing.name,
          color: (editing.color as TagColor) || "gray",
          description: editing.description || "",
          active: editing.active,
        }
      : EMPTY_FORM
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        color: form.color,
        description: form.description.trim() || null,
        active: form.active,
      };
      if (editing) {
        return apiPatch(`/api/supabase/admin/user-tags/${editing.id}`, payload);
      }
      return apiPost("/api/supabase/admin/user-tags", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Tag updated" : "Tag created");
      queryClient.invalidateQueries({ queryKey: ["admin-user-tags"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save tag"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Tag name is required");
      return;
    }
    saveMutation.mutate();
  };

  const selectedColor = colorMeta(form.color);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Tag" : "Create New Tag"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the tag details below."
              : "Tags help you organize and flag users for follow-up."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tag-name"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="e.g. VIP, At-Risk, Verified"
              autoFocus
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tag-color">Color</Label>
            <Select
              value={form.color}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, color: v as TagColor }))
              }
            >
              <SelectTrigger id="tag-color">
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-3 w-3 rounded-full inline-block",
                          opt.swatch
                        )}
                      />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Preview:</span>
              <Badge className={cn("border-0", selectedColor.badge)}>
                {form.name.trim() || "Tag name"}
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tag-desc">Description</Label>
            <Textarea
              id="tag-desc"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Optional — describe when to apply this tag..."
              rows={3}
              maxLength={300}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="tag-active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive tags cannot be assigned to new users
              </p>
            </div>
            <Switch
              id="tag-active"
              checked={form.active}
              onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Create Tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUserTags() {
  const queryClient = useQueryClient();
  const queryKey = ["admin-user-tags"];

  const { data: tags, isLoading, isError, error, refetch } = useQuery<
    UserTag[]
  >({
    queryKey,
    queryFn: () => apiGet<UserTag[]>("/api/supabase/admin/user-tags"),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserTag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserTag | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/supabase/admin/user-tags/${id}`),
    onSuccess: () => {
      toast.success("Tag deleted");
      queryClient.invalidateQueries({ queryKey });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete tag"),
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (tag: UserTag) => {
    setEditing(tag);
    setDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setTimeout(() => setEditing(null), 100);
    }
  };

  const activeCount = tags?.filter((t) => t.active).length ?? 0;
  const totalAssignments =
    tags?.reduce((sum, t) => sum + getAssignmentCount(t), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tags className="h-6 w-6 text-violet-500" />
            User Tags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize and flag users with custom tags for follow-up and review.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create Tag
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Tags</div>
          <div className="text-2xl font-bold mt-1">{tags?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {activeCount}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Assignments</div>
          <div className="text-2xl font-bold mt-1 text-violet-600">
            {totalAssignments}
          </div>
        </Card>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-6 w-32 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="p-8 text-center border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="font-medium text-red-700 dark:text-red-400">
            Failed to load tags
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error as Error)?.message || "Please try again."}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !isError && (tags?.length ?? 0) === 0 && (
        <Card className="p-12 text-center">
          <Tags className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No tags yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first tag to start organizing users.
          </p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Create Tag
          </Button>
        </Card>
      )}

      {/* Grid */}
      {!isLoading && !isError && tags && tags.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => {
            const meta = colorMeta(tag.color);
            const count = getAssignmentCount(tag);
            return (
              <Card
                key={tag.id}
                className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "h-3 w-3 rounded-full flex-shrink-0",
                        meta.swatch
                      )}
                      aria-hidden
                    />
                    <h3 className="font-semibold text-base truncate">
                      {tag.name}
                    </h3>
                  </div>
                  {tag.active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" /> Inactive
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3 min-h-[3rem]">
                  {tag.description || "No description provided."}
                </p>

                <div className="flex items-center justify-between pt-3 border-t">
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {count} {count === 1 ? "user" : "users"}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(tag)}
                      title="Edit"
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(tag)}
                      title="Delete"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {tag.createdAt && (
                  <div className="text-xs text-muted-foreground">
                    Created {formatDate(tag.createdAt)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      {!isLoading && !isError && tags && tags.length > 0 && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Tags are visible to admins only. They help surface groups of users
              needing attention (e.g. flagged accounts, VIPs, watch-list). A tag
              can be assigned to any number of users and toggled active/inactive
              without losing existing assignments.
            </p>
          </div>
        </Card>
      )}

      {/* Create / Edit dialog — key forces remount so form state resets per target */}
      <TagFormDialog
        key={editing?.id || "new"}
        open={dialogOpen}
        editing={editing}
        onOpenChange={handleCloseDialog}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              .
              {getAssignmentCount(deleteTarget) > 0 && (
                <>
                  {" "}
                  It is currently assigned to{" "}
                  <span className="font-semibold text-amber-600">
                    {getAssignmentCount(deleteTarget)} users
                  </span>{" "}
                  — those assignments will be removed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Tag"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
