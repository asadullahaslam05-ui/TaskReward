"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Flag,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  AlertCircle,
  Search,
  Info,
} from "lucide-react";

import { apiGet, apiPatch } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils-fin";

interface FeatureFlag {
  id?: string;
  key: string;
  name?: string | null;
  enabled: boolean;
  value?: string | null;
  description?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

function flagTitle(flag: FeatureFlag): string {
  // Prefer a human-readable name; fall back to a prettified key
  if (flag.name && flag.name.trim()) return flag.name;
  return flag.key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function AdminFeatureFlags() {
  const queryClient = useQueryClient();
  const queryKey = ["admin-feature-flags"];
  const [search, setSearch] = useState("");

  const { data: flags, isLoading, isError, error, refetch, isFetching } =
    useQuery<FeatureFlag[]>({
      queryKey,
      queryFn: () =>
        apiGet<FeatureFlag[]>("/api/supabase/admin/feature-flags"),
    });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      apiPatch("/api/supabase/admin/feature-flags", {
        flags: [{ key, enabled }],
      }),
    onMutate: async ({ key, enabled }) => {
      // Optimistic update for snappy UI
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<FeatureFlag[]>(queryKey);
      queryClient.setQueryData<FeatureFlag[]>(queryKey, (old) =>
        (old || []).map((f) => (f.key === key ? { ...f, enabled } : f))
      );
      return { previous };
    },
    onSuccess: (_data, { key, enabled }) => {
      toast.success(`"${flagTitle({ key } as FeatureFlag)}" ${enabled ? "enabled" : "disabled"}`);
    },
    onError: (e: Error, _vars, ctx) => {
      // Rollback on failure
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error(e.message || "Failed to update flag");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const filtered = (flags || []).filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.key.toLowerCase().includes(q) ||
      flagTitle(f).toLowerCase().includes(q) ||
      (f.description || "").toLowerCase().includes(q)
    );
  });

  const enabledCount = flags?.filter((f) => f.enabled).length ?? 0;
  const disabledCount = (flags?.length ?? 0) - enabledCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6 text-violet-500" />
            Feature Flags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle platform features on or off without redeploying.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Flags</div>
          <div className="text-2xl font-bold mt-1">{flags?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Enabled</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {enabledCount}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Disabled</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {disabledCount}
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search flags by name, key, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-72" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="p-8 text-center border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="font-medium text-red-700 dark:text-red-400">
            Failed to load feature flags
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
      {!isLoading && !isError && (filtered.length === 0) && (
        <Card className="p-12 text-center">
          <Flag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">
            {search ? "No matching flags" : "No feature flags configured"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search
              ? `No flags match "${search}". Try a different search term.`
              : "Feature flags will appear here once they are added to the database."}
          </p>
          {search && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setSearch("")}
            >
              Clear Search
            </Button>
          )}
        </Card>
      )}

      {/* Flag list */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((flag) => {
            const title = flagTitle(flag);
            const toggling = toggleMutation.isPending;
            return (
              <Card
                key={flag.key}
                className={cn(
                  "p-4 transition-all hover:shadow-sm",
                  flag.enabled
                    ? "border-emerald-200 dark:border-emerald-900/40"
                    : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        flag.enabled
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {flag.enabled ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{title}</h3>
                        <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {flag.key}
                        </code>
                        {flag.value && (
                          <Badge variant="outline" className="text-xs">
                            value: {flag.value}
                          </Badge>
                        )}
                      </div>
                      {flag.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {flag.description}
                        </p>
                      )}
                      {flag.updatedAt && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Updated {formatRelativeTime(flag.updatedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        flag.enabled
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {flag.enabled ? "ON" : "OFF"}
                    </span>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({
                          key: flag.key,
                          enabled: checked,
                        })
                      }
                      disabled={toggling}
                      aria-label={`Toggle ${title}`}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      {!isLoading && !isError && (flags?.length ?? 0) > 0 && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Feature flags control runtime behavior without redeploying. Changes
              take effect immediately for new requests. The flag value field can
              store additional configuration (e.g. thresholds, IDs) — leave it
              empty to use the flag as a simple on/off toggle.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
