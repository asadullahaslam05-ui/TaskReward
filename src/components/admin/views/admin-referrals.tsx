"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Gift,
  Save,
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  Search,
  Link as LinkIcon,
} from "lucide-react";

import { apiGet, apiPut } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils-fin";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone?: string | null;
  role: string;
  status: string;
  riskLevel: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  flagged: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface SiteSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  type: string;
  updatedAt: string;
}

interface SettingsResponse {
  settings: SiteSetting[];
  grouped: Record<string, SiteSetting[]>;
}

const SETTING_KEYS = {
  REWARD: "referral.reward",
  TYPE: "referral.type",
  MAX: "referral.max_reward",
  ENABLED: "feature.referral_enabled",
};

interface ReferralFormValues {
  reward: string;
  type: string;
  maxReward: string;
  enabled: boolean;
}

function deriveFormValues(settings: SiteSetting[] | undefined): ReferralFormValues {
  const findS = (key: string) => settings?.find((s) => s.key === key);
  const r = findS(SETTING_KEYS.REWARD);
  const t = findS(SETTING_KEYS.TYPE);
  const m = findS(SETTING_KEYS.MAX);
  const e = findS(SETTING_KEYS.ENABLED);
  return {
    reward: r?.value ?? "",
    type: t?.value ?? "FIXED",
    maxReward: m?.value ?? "",
    enabled: e ? e.value === "true" || e.value === "1" : true,
  };
}

export function AdminReferrals() {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings
  const { data: settingsData, isLoading: settingsLoading } =
    useQuery<SettingsResponse>({
      queryKey: ["admin-settings"],
      queryFn: () => apiGet<SettingsResponse>("/api/supabase/admin/settings"),
    });

  // Users list for referral activity
  const { data: usersData, isLoading: usersLoading } = useQuery<UsersResponse>({
    queryKey: ["admin-users-referrals"],
    queryFn: () =>
      apiGet<UsersResponse>("/api/supabase/admin/users?page=1&pageSize=100&role=USER"),
  });

  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return usersData.users;
    return usersData.users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.fullName?.toLowerCase().includes(q)
    );
  }, [usersData, search]);

  const totalReferralEarned = useMemo(() => {
    if (!usersData?.users) return 0;
    // Approximation: sum totalEarned (referral earnings included)
    return usersData.users.reduce((s, u) => s + (u.totalEarned || 0), 0);
  }, [usersData]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Derive initial form values from data
  const formValues = deriveFormValues(settingsData?.settings);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-violet-500" />
          Referral Program
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure referral rewards and view referral activity.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Total Users
          </div>
          <div className="text-2xl font-bold mt-1">
            {usersData?.pagination.total ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            Referral Reward
          </div>
          <div className="text-2xl font-bold mt-1">
            <CurrencyDisplay amount={parseFloat(formValues.reward) || 0} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Max Reward
          </div>
          <div className="text-2xl font-bold mt-1">
            <CurrencyDisplay amount={parseFloat(formValues.maxReward) || 0} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gift className="h-3.5 w-3.5" />
            Status
          </div>
          <div className="mt-1">
            {formValues.enabled ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Enabled
              </Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Referral Settings</h2>
        {settingsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ReferralSettingsForm
            key={settingsData ? "loaded" : "empty"}
            initial={formValues}
          />
        )}
      </Card>

      {/* Referral Activity Table */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Referral Activity</h2>
            <p className="text-sm text-muted-foreground">
              Users with referral codes and their earnings.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No users found matching your search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Total Earned</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.slice(0, 50).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          @{u.username} · {u.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleCopy(u.id, u.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-mono bg-muted hover:bg-muted/70 px-2 py-1 rounded-md transition-colors"
                        title="Copy referral identifier"
                      >
                        <LinkIcon className="h-3 w-3" />
                        <span>{u.id.slice(-8).toUpperCase()}</span>
                        {copiedId === u.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amount={u.balance || 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amount={u.totalEarned || 0} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredUsers.length > 50 && (
              <div className="text-center text-xs text-muted-foreground mt-3">
                Showing first 50 of {filteredUsers.length} users
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Recent Referral Earnings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1">Recent Referral Earnings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Aggregated referral earnings across all users.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">
              Total Earned (All Users)
            </div>
            <div className="text-xl font-bold mt-1">
              <CurrencyDisplay amount={totalReferralEarned} />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Average Earned</div>
            <div className="text-xl font-bold mt-1">
              <CurrencyDisplay
                amount={
                  usersData?.users?.length
                    ? totalReferralEarned / usersData.users.length
                    : 0
                }
              />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Program Status</div>
            <div className="text-xl font-bold mt-1">
              {formValues.enabled ? "Active" : "Paused"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReferralSettingsForm({ initial }: { initial: ReferralFormValues }) {
  const queryClient = useQueryClient();
  const [reward, setReward] = useState(initial.reward);
  const [type, setType] = useState(initial.type);
  const [maxReward, setMaxReward] = useState(initial.maxReward);
  const [enabled, setEnabled] = useState(initial.enabled);

  const saveMutation = useMutation({
    mutationFn: (payload: any[]) =>
      apiPut("/api/supabase/admin/settings", { settings: payload }),
    onSuccess: () => {
      toast.success("Referral settings updated");
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save settings"),
  });

  const handleSaveSettings = () => {
    const payload = [
      {
        key: SETTING_KEYS.REWARD,
        value: String(reward),
        category: "REWARDS",
        type: "NUMBER",
      },
      {
        key: SETTING_KEYS.TYPE,
        value: type,
        category: "REWARDS",
        type: "STRING",
      },
      {
        key: SETTING_KEYS.MAX,
        value: String(maxReward),
        category: "REWARDS",
        type: "NUMBER",
      },
      {
        key: SETTING_KEYS.ENABLED,
        value: String(enabled),
        category: "REWARDS",
        type: "BOOLEAN",
      },
    ];
    saveMutation.mutate(payload);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="referral-enabled">Enable Referral Program</Label>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="text-sm">
            {enabled ? "Enabled" : "Disabled"}
          </div>
          <Switch
            id="referral-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="referral-type">Reward Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="referral-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FIXED">Fixed Amount</SelectItem>
            <SelectItem value="PERCENTAGE">Percentage</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {type === "FIXED"
            ? "Referrer receives a fixed amount per referral."
            : "Referrer receives a percentage of referral earnings."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="referral-reward">
          Reward Amount {type === "PERCENTAGE" ? "(%)" : ""}
        </Label>
        <Input
          id="referral-reward"
          type="number"
          step="0.01"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          placeholder="50"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="referral-max">Maximum Reward Cap</Label>
        <Input
          id="referral-max"
          type="number"
          step="0.01"
          value={maxReward}
          onChange={(e) => setMaxReward(e.target.value)}
          placeholder="500"
        />
        <p className="text-xs text-muted-foreground">
          Total cap a referrer can earn (0 = unlimited).
        </p>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={saveMutation.isPending}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
        >
          <Save className="h-4 w-4 mr-1" />
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
