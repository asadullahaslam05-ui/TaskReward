"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/client";
import { formatDateShort } from "@/lib/utils-fin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  QrCode,
  Wallet,
  User,
  Hash,
  Network,
  FileText,
  GripVertical,
  Power,
} from "lucide-react";

type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  accountName: string | null;
  accountNumber: string | null;
  walletAddress: string | null;
  network: string | null;
  qrCodeUrl: string | null;
  instructions: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type MethodFormData = {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  accountName: string;
  accountNumber: string;
  walletAddress: string;
  network: string;
  qrCodeUrl: string;
  instructions: string;
  sortOrder: number;
};

const EMPTY_FORM: MethodFormData = {
  code: "",
  name: "",
  description: "",
  enabled: true,
  accountName: "",
  accountNumber: "",
  walletAddress: "",
  network: "",
  qrCodeUrl: "",
  instructions: "",
  sortOrder: 0,
};

export function AdminPaymentMethods() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MethodFormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);

  const { data: methods, isLoading, isError } = useQuery<PaymentMethod[]>({
    queryKey: ["admin-payment-methods"],
    queryFn: () => apiGet<PaymentMethod[]>("/api/supabase/admin/payment-methods"),
    onError: (err: any) => toast.error(err.message || "Failed to load payment methods"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] });

  // Create / update
  const saveMutation = useMutation({
    mutationFn: (vars: { id: string | null; data: MethodFormData }) => {
      const body = {
        code: vars.data.code,
        name: vars.data.name,
        description: vars.data.description || null,
        enabled: vars.data.enabled,
        accountName: vars.data.accountName || null,
        accountNumber: vars.data.accountNumber || null,
        walletAddress: vars.data.walletAddress || null,
        network: vars.data.network || null,
        qrCodeUrl: vars.data.qrCodeUrl || null,
        instructions: vars.data.instructions || null,
        sortOrder: vars.data.sortOrder || 0,
      };
      return vars.id
        ? apiPatch(`/api/supabase/admin/payment-methods/${vars.id}`, body)
        : apiPost("/api/supabase/admin/payment-methods", body);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.id ? "Payment method updated" : "Payment method created");
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to save payment method"),
  });

  // Toggle enabled
  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) =>
      apiPatch(`/api/supabase/admin/payment-methods/${vars.id}`, { enabled: vars.enabled }),
    onSuccess: (_d, vars) => {
      toast.success(`Method ${vars.enabled ? "enabled" : "disabled"}`);
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to toggle"),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/supabase/admin/payment-methods/${id}`),
    onSuccess: () => {
      toast.success("Payment method deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditingId(m.id);
    setForm({
      code: m.code,
      name: m.name,
      description: m.description || "",
      enabled: m.enabled,
      accountName: m.accountName || "",
      accountNumber: m.accountNumber || "",
      walletAddress: m.walletAddress || "",
      network: m.network || "",
      qrCodeUrl: m.qrCodeUrl || "",
      instructions: m.instructions || "",
      sortOrder: m.sortOrder,
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }
    saveMutation.mutate({ id: editingId, data: form });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Payment Methods
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure payment methods for registration and withdrawals.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Method
        </Button>
      </div>

      {/* List */}
      {isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-red-600">
            Failed to load payment methods.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : !methods || methods.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No payment methods yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Add your first payment method to get started.
            </p>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((m) => (
            <Card key={m.id} className="p-6">
              <CardHeader className="px-0 pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm flex-shrink-0">
                      <CreditCard className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{m.name}</CardTitle>
                      <CardDescription className="text-xs font-mono">
                        {m.code}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: m.id, enabled: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => setDeleteTarget(m)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 space-y-3">
                {/* Status & sort */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`border-0 ${
                      m.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    <Power className="h-3 w-3 mr-1" />
                    {m.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge variant="outline" className="border-0">
                    <GripVertical className="h-3 w-3 mr-1" />
                    Order: {m.sortOrder}
                  </Badge>
                </div>

                {/* Description */}
                {m.description && (
                  <div className="text-xs text-muted-foreground italic">
                    {m.description}
                  </div>
                )}

                {/* Fields */}
                <div className="space-y-1.5">
                  {m.accountName && (
                    <FieldRow
                      icon={<User className="h-3.5 w-3.5" />}
                      label="Account Name"
                      value={m.accountName}
                    />
                  )}
                  {m.accountNumber && (
                    <FieldRow
                      icon={<Hash className="h-3.5 w-3.5" />}
                      label="Account Number"
                      value={m.accountNumber}
                      mono
                    />
                  )}
                  {m.walletAddress && (
                    <FieldRow
                      icon={<Wallet className="h-3.5 w-3.5" />}
                      label="Wallet Address"
                      value={m.walletAddress}
                      mono
                    />
                  )}
                  {m.network && (
                    <FieldRow
                      icon={<Network className="h-3.5 w-3.5" />}
                      label="Network"
                      value={m.network}
                    />
                  )}
                </div>

                {/* QR code */}
                {m.qrCodeUrl && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <img
                      src={m.qrCodeUrl}
                      alt="QR code"
                      className="h-16 w-16 rounded border bg-white object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <QrCode className="h-3.5 w-3.5" />
                        QR Code
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {m.qrCodeUrl}
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {m.instructions && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <FileText className="h-3.5 w-3.5" />
                      Instructions
                    </div>
                    <div className="text-xs whitespace-pre-wrap">{m.instructions}</div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-1">
                  Updated {formatDateShort(m.updatedAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-violet-500" />
              {editingId ? "Edit Payment Method" : "Add Payment Method"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the payment method details below."
                : "Configure a new payment method for users."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code" className="text-xs">Code *</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="EASYPAISA"
                  disabled={!!editingId}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier (cannot be changed)
                </p>
              </div>
              <div>
                <Label htmlFor="name" className="text-xs">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Easypaisa"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description shown to users"
              />
            </div>

            {/* Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="accountName" className="text-xs">Account Name</Label>
                <Input
                  id="accountName"
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="accountNumber" className="text-xs">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  placeholder="03001234567"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="walletAddress" className="text-xs">Wallet Address</Label>
                <Input
                  id="walletAddress"
                  value={form.walletAddress}
                  onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
                  placeholder="0x... or USDT TRC20 address"
                />
              </div>
              <div>
                <Label htmlFor="network" className="text-xs">Network</Label>
                <Input
                  id="network"
                  value={form.network}
                  onChange={(e) => setForm({ ...form, network: e.target.value })}
                  placeholder="TRC20 / BEP20 / ERC20"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="qrCodeUrl" className="text-xs">QR Code URL</Label>
              <Input
                id="qrCodeUrl"
                value={form.qrCodeUrl}
                onChange={(e) => setForm({ ...form, qrCodeUrl: e.target.value })}
                placeholder="/uploads/qr-easypaisa.png"
              />
            </div>

            <div>
              <Label htmlFor="instructions" className="text-xs">Instructions</Label>
              <Textarea
                id="instructions"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Step-by-step payment instructions for users..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sortOrder" className="text-xs">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
                  />
                  <Label className="text-sm cursor-pointer">Enabled</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Create Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Payment Method
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})?
              This action cannot be undone. Existing payments and withdrawals referencing this method will be unaffected but the method will no longer be available for new transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FieldRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
        {icon}
        {label}
      </div>
      <div className={`text-right truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </div>
    </div>
  );
}
