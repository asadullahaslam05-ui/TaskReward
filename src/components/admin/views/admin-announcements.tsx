"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Globe,
  Users,
  Clock,
  Calendar,
} from "lucide-react";

import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

type AnnouncementType = "INFO" | "SUCCESS" | "WARNING" | "IMPORTANT";
type TargetAudience = "ALL" | "ACTIVE" | "PENDING";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  active: boolean;
  startDate: string | Date;
  endDate: string | Date | null;
  targetAudience: TargetAudience;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const TYPE_META: Record<
  AnnouncementType,
  { label: string; color: string; icon: any }
> = {
  INFO: {
    label: "Info",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    icon: Info,
  },
  SUCCESS: {
    label: "Success",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle,
  },
  WARNING: {
    label: "Warning",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    icon: AlertTriangle,
  },
  IMPORTANT: {
    label: "Important",
    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: AlertOctagon,
  },
};

const AUDIENCE_LABEL: Record<TargetAudience, string> = {
  ALL: "All Users",
  ACTIVE: "Active Users",
  PENDING: "Pending Users",
};

interface FormState {
  title: string;
  message: string;
  type: AnnouncementType;
  active: boolean;
  startDate: string | undefined;
  endDate: string | undefined;
  targetAudience: TargetAudience;
}

const EMPTY_FORM: FormState = {
  title: "",
  message: "",
  type: "INFO",
  active: true,
  startDate: "",
  endDate: "",
  targetAudience: "ALL",
};

function toDateInput(d: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function AdminAnnouncements() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading, isError, error } = useQuery<Announcement[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => apiGet<Announcement[]>("/api/supabase/admin/announcements"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: FormState) =>
      apiPost<Announcement>("/api/supabase/admin/announcements", payload),
    onSuccess: () => {
      toast.success("Announcement created");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FormState }) =>
      apiPatch<Announcement>(`/api/supabase/admin/announcements/${id}`, payload),
    onSuccess: () => {
      toast.success("Announcement updated");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/supabase/admin/announcements/${id}`),
    onSuccess: () => {
      toast.success("Announcement deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      message: a.message,
      type: a.type,
      active: a.active,
      startDate: toDateInput(a.startDate),
      endDate: toDateInput(a.endDate),
      targetAudience: a.targetAudience,
    });
    setEditingId(a.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    const payload = {
      ...form,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-violet-500" />
            Announcements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage platform-wide announcements.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Announcement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{data?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {data?.filter((a) => a.active).length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Inactive</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {data?.filter((a) => !a.active).length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Important</div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {data?.filter((a) => a.type === "IMPORTANT").length ?? 0}
          </div>
        </Card>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center text-red-500">
          {(error as Error)?.message || "Failed to load announcements"}
        </Card>
      ) : !data || data.length === 0 ? (
        <Card className="p-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No announcements yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first announcement to engage with users.
          </p>
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Announcement
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((a) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.INFO;
            const Icon = meta.icon;
            return (
              <Card key={a.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`rounded-lg p-2 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{a.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={meta.color}>{meta.label}</Badge>
                        <Badge variant="outline">
                          {a.active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          <Users className="h-3 w-3 mr-1" />
                          {AUDIENCE_LABEL[a.targetAudience]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(a)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => setDeleteId(a.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {a.message}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3 mt-auto flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(a.startDate)}
                    </span>
                    {a.endDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        until {formatDate(a.endDate)}
                      </span>
                    )}
                  </div>
                  <span>{formatRelativeTime(a.createdAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Announcement" : "Create Announcement"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update announcement details."
                : "Fill in the form to publish a new announcement."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Announcement title"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) =>
                  setForm({ ...form, message: e.target.value })
                }
                placeholder="Announcement message"
                rows={5}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm({ ...form, type: v as AnnouncementType })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="SUCCESS">Success</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="IMPORTANT">Important</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Select
                  value={form.targetAudience}
                  onValueChange={(v) =>
                    setForm({ ...form, targetAudience: v as TargetAudience })
                  }
                >
                  <SelectTrigger id="targetAudience">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Users</SelectItem>
                    <SelectItem value="ACTIVE">Active Users</SelectItem>
                    <SelectItem value="PENDING">Pending Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="active" className="cursor-pointer">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Active announcements are visible to users.
                  </p>
                </div>
              </div>
              <Switch
                id="active"
                checked={form.active}
                onCheckedChange={(c) => setForm({ ...form, active: c })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
              >
                {isSaving ? "Saving..." : editingId ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The announcement will be permanently
              removed from the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
