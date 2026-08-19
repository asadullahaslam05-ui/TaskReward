"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, FolderTree, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils-fin";

type Category = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  _count?: { tasks: number };
};

type FormState = {
  name: string;
  description: string;
  active: boolean;
};

const EMPTY_FORM: FormState = { name: "", description: "", active: true };

function CategoryFormDialog({
  open,
  editing,
  onOpenChange,
}: {
  open: boolean;
  editing: Category | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          name: editing.name,
          description: editing.description || "",
          active: editing.active,
        }
      : EMPTY_FORM
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        active: form.active,
      };
      if (editing) {
        return apiPatch(`/api/supabase/admin/categories/${editing.id}`, payload);
      }
      return apiPost("/api/supabase/admin/categories", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category created");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (open && !o) {
          // closing - reset form on next open via key remount
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Category" : "Add New Category"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the category details below."
              : "Create a new category to group related tasks."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cat-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. TikTok Tasks"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Brief description of this category..."
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="cat-active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive categories are hidden from task creation
              </p>
            </div>
            <Switch
              id="cat-active"
              checked={form.active}
              onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90"
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCategories() {
  const queryClient = useQueryClient();
  const queryKey = ["admin-categories"];

  const { data: categories, isLoading, isError } = useQuery<Category[]>({
    queryKey,
    queryFn: () => apiGet<Category[]>("/api/supabase/admin/categories"),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/supabase/admin/categories/${id}`),
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpenCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditing(cat);
    setDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Defer reset so the dialog finishes closing
      setTimeout(() => setEditing(null), 100);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-violet-500" />
            Task Categories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize tasks into categories ({categories?.length || 0} total)
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-32 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <Card className="p-12 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">Failed to load categories</p>
          <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page.</p>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !isError && categories?.length === 0 && (
        <Card className="p-12 text-center">
          <FolderTree className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No categories yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first category to organize tasks.
          </p>
        </Card>
      )}

      {/* Grid */}
      {!isLoading && categories && categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created {formatDate(cat.createdAt)}
                  </p>
                </div>
                {cat.active ? (
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
                {cat.description || "No description provided."}
              </p>

              <div className="flex items-center justify-between pt-3 border-t">
                <Badge variant="outline" className="text-xs">
                  {cat._count?.tasks || 0} tasks
                </Badge>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenEdit(cat)}
                    title="Edit"
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(cat)}
                    title="Delete"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit dialog — key forces remount so form state resets when target changes */}
      <CategoryFormDialog
        key={editing?.id || "new"}
        open={dialogOpen}
        editing={editing}
        onOpenChange={handleCloseDialog}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>.
              {(deleteTarget?._count?.tasks || 0) > 0 && (
                <>
                  {" "}
                  It currently has{" "}
                  <span className="font-semibold text-amber-600">
                    {deleteTarget?._count?.tasks} tasks
                  </span>{" "}
                  assigned — those tasks will be uncategorized.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
