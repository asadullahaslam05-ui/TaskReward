"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Check,
  Type,
  Hash,
  ToggleLeft,
  AlignLeft,
  Code2,
  Search,
} from "lucide-react";

import { apiGet, apiPut } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SiteSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  type: string;
  updatedAt: string;
  updatedBy?: string | null;
}

interface SettingsResponse {
  settings: SiteSetting[];
  grouped: Record<string, SiteSetting[]>;
}

type SettingType = "STRING" | "NUMBER" | "BOOLEAN" | "TEXT" | "JSON";

const CATEGORY_ORDER = [
  "GENERAL",
  "BRANDING",
  "REGISTRATION",
  "PAYMENTS",
  "TASKS",
  "REWARDS",
  "WITHDRAWALS",
  "SECURITY",
  "NOTIFICATIONS",
  "CONTENT",
  "SEO",
  "MAINTENANCE",
];

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General",
  BRANDING: "Branding",
  REGISTRATION: "Registration",
  PAYMENTS: "Payments",
  TASKS: "Tasks",
  REWARDS: "Rewards",
  WITHDRAWALS: "Withdrawals",
  SECURITY: "Security",
  NOTIFICATIONS: "Notifications",
  CONTENT: "Content",
  SEO: "SEO",
  MAINTENANCE: "Maintenance",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  GENERAL: "Site-wide configuration values.",
  BRANDING: "Colors, logo and visual identity.",
  REGISTRATION: "Registration payment and approval settings.",
  PAYMENTS: "Payment method configuration.",
  TASKS: "Task submission and reward defaults.",
  REWARDS: "Referral program and bonus settings.",
  WITHDRAWALS: "Withdrawal limits, fees and processing.",
  SECURITY: "Login and security toggles.",
  NOTIFICATIONS: "Notification delivery settings.",
  CONTENT: "Page content and messaging defaults.",
  SEO: "Search engine optimization.",
  MAINTENANCE: "Maintenance mode and system status.",
};

const TYPE_META: Record<SettingType, { icon: any; label: string }> = {
  STRING: { icon: Type, label: "Text" },
  NUMBER: { icon: Hash, label: "Number" },
  BOOLEAN: { icon: ToggleLeft, label: "Toggle" },
  TEXT: { icon: AlignLeft, label: "Long Text" },
  JSON: { icon: Code2, label: "JSON" },
};

const COLOR_KEYS = new Set([
  "brand.primary_color",
  "brand.secondary_color",
  "brand.accent_color",
]);

function SettingRow({
  setting,
  value,
  onChange,
}: {
  setting: SiteSetting;
  value: string;
  onChange: (v: string) => void;
}) {
  const isColor = COLOR_KEYS.has(setting.key);
  const isBoolean = setting.type === "BOOLEAN";
  const isLongText = setting.type === "TEXT";
  const isJson = setting.type === "JSON";
  const isNumber = setting.type === "NUMBER";
  const meta = TYPE_META[setting.type as SettingType] ?? TYPE_META.STRING;
  const Icon = meta.icon;

  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleJsonChange = (v: string) => {
    onChange(v);
    if (!v.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(v);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 sm:gap-4 py-3 border-b last:border-0">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor={setting.key} className="text-sm font-medium">
            {setting.key}
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {meta.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            Updated {new Date(setting.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {isBoolean ? (
          <div className="flex items-center gap-2">
            <Switch
              id={setting.key}
              checked={value === "true" || value === "1"}
              onCheckedChange={(c) => onChange(c ? "true" : "false")}
            />
            <span className="text-sm text-muted-foreground">
              {value === "true" || value === "1" ? "Enabled" : "Disabled"}
            </span>
          </div>
        ) : isColor ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value || "#6366f1"}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-12 rounded-md border cursor-pointer bg-transparent p-0.5"
            />
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#6366f1"
              className="font-mono"
            />
            <div
              className="h-9 w-9 rounded-md border"
              style={{ backgroundColor: value || "#6366f1" }}
            />
          </div>
        ) : isNumber ? (
          <Input
            id={setting.key}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            step="any"
            placeholder="0"
          />
        ) : isLongText ? (
          <Textarea
            id={setting.key}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Enter text..."
          />
        ) : isJson ? (
          <div className="space-y-1">
            <Textarea
              id={setting.key}
              value={value}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={6}
              placeholder="{}"
              className={`font-mono text-xs ${
                jsonError ? "border-red-500" : ""
              }`}
            />
            {jsonError && (
              <p className="text-xs text-red-500">{jsonError}</p>
            )}
          </div>
        ) : (
          <Input
            id={setting.key}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter value"
          />
        )}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("GENERAL");
  const [search, setSearch] = useState("");
  // Map of key -> override value (only stores user edits, not the full state)
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery<SettingsResponse>({
    queryKey: ["admin-settings"],
    queryFn: () => apiGet<SettingsResponse>("/api/supabase/admin/settings"),
    staleTime: 30_000,
  });

  // Sort categories by defined order, push unknown to end
  const categories = useMemo(() => {
    if (!data?.grouped) return [];
    const present = Object.keys(data.grouped);
    const ordered = CATEGORY_ORDER.filter((c) => present.includes(c));
    const extra = present.filter((c) => !CATEGORY_ORDER.includes(c));
    return [...ordered, ...extra];
  }, [data]);

  // Effective tab: fall back to first available category if active tab is missing
  const effectiveTab =
    categories.length > 0 && !categories.includes(activeTab)
      ? categories[0]
      : activeTab;

  const saveMutation = useMutation({
    mutationFn: (payload: any[]) =>
      apiPut("/api/supabase/admin/settings", { settings: payload }),
    onSuccess: (_data, vars) => {
      toast.success(`Saved ${vars.length} setting(s)`);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      // Clear overrides for saved keys
      setOverrides((prev) => {
        const next = { ...prev };
        for (const s of vars) delete next[s.key];
        return next;
      });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save settings"),
  });

  const handleSaveTab = (category: string) => {
    const original = data?.grouped[category] || [];
    const changed = original.filter((s) => overrides[s.key] !== undefined && overrides[s.key] !== s.value);
    if (changed.length === 0) {
      toast.info("No changes to save");
      return;
    }
    const payload = changed.map((s) => ({
      key: s.key,
      value: overrides[s.key],
      category: s.category,
      type: s.type,
    }));
    saveMutation.mutate(payload);
  };

  const handleResetTab = (category: string) => {
    if (!data?.grouped[category]) return;
    setOverrides((prev) => {
      const next = { ...prev };
      for (const s of data.grouped[category]) {
        delete next[s.key];
      }
      return next;
    });
    toast.info("Reverted changes");
  };

  const setSettingValue = (key: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (s: SiteSetting) =>
    overrides[s.key] !== undefined ? overrides[s.key] : s.value;

  const getChangedCount = (category: string): number => {
    const original = data?.grouped[category] || [];
    return original.filter(
      (s) => overrides[s.key] !== undefined && overrides[s.key] !== s.value
    ).length;
  };

  const filteredSettings = useMemo(() => {
    if (!data?.grouped[effectiveTab]) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.grouped[effectiveTab];
    return data.grouped[effectiveTab].filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        s.value?.toLowerCase().includes(q)
    );
  }, [data, effectiveTab, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-violet-500" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all platform configuration values.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {data?.settings?.length ?? 0} settings configured
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 space-y-4">
          <Skeleton className="h-9 w-full max-w-2xl" />
          <Skeleton className="h-64 w-full" />
        </Card>
      ) : isError ? (
        <Card className="p-8 text-center text-red-500">
          {(error as Error)?.message || "Failed to load settings"}
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            Retry
          </Button>
        </Card>
      ) : categories.length === 0 ? (
        <Card className="p-12 text-center">
          <SettingsIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No settings found</h3>
          <p className="text-sm text-muted-foreground">
            Run the seed script to initialize default settings.
          </p>
        </Card>
      ) : (
        <Tabs value={effectiveTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="flex w-max h-auto">
              {categories.map((cat) => {
                const changed = getChangedCount(cat);
                return (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="flex items-center gap-1.5 py-1.5"
                  >
                    {CATEGORY_LABELS[cat] || cat}
                    {changed > 0 && (
                      <Badge className="ml-1 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 text-[10px] px-1.5 py-0">
                        {changed}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {categories.map((cat) => {
            const changed = getChangedCount(cat);
            return (
              <TabsContent key={cat} value={cat}>
                <Card className="p-6">
                  {/* Tab header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {CATEGORY_LABELS[cat] || cat}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {CATEGORY_DESCRIPTIONS[cat] ||
                          "Configuration settings."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-full sm:w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-8 h-9"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetTab(cat)}
                        disabled={changed === 0}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveTab(cat)}
                        disabled={changed === 0 || saveMutation.isPending}
                        className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
                      >
                        {saveMutation.isPending ? (
                          "Saving..."
                        ) : (
                          <>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save {changed > 0 ? `(${changed})` : ""}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Settings list */}
                  {filteredSettings.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      {search
                        ? "No settings match your search."
                        : "No settings in this category."}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredSettings.map((s) => (
                        <SettingRow
                          key={s.id}
                          setting={s}
                          value={getValue(s)}
                          onChange={(v) => setSettingValue(s.key, v)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Save footer (for long lists) */}
                  {filteredSettings.length > 5 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <div className="text-xs text-muted-foreground">
                        {filteredSettings.length} setting(s) ·{" "}
                        {changed > 0 ? (
                          <span className="text-violet-600 font-medium">
                            {changed} changed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3 text-emerald-500" />
                            All in sync
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSaveTab(cat)}
                        disabled={changed === 0 || saveMutation.isPending}
                        className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
                      >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        Save Changes
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
