import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { ENV } from "@/lib/env";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/system-health
 *
 * Returns a snapshot of platform health: DB connectivity, auth provider
 * status, storage availability, key metrics, recent error logs, and
 * environment info. NEVER exposes secrets (keys, passwords, connection
 * strings).
 */
export async function GET() {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const startedAt = Date.now();

    // ----------------------------------------------------------------
    // Database status — try a tiny select against the profiles table.
    // ----------------------------------------------------------------
    let dbStatus: "healthy" | "degraded" | "down" = "down";
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    let totalUsers = 0;
    let totalTasks = 0;
    let totalTransactions = 0;

    try {
      const admin = createAdminSupabaseClient();
      const t0 = Date.now();
      const { error: profilesErr } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true });
      dbLatencyMs = Date.now() - t0;

      if (profilesErr) {
        dbStatus = "degraded";
        dbError = profilesErr.message;
      } else {
        dbStatus = "healthy";
      }

      // Metrics — best-effort, ignore errors
      const [{ count: uCount }, { count: tCount }, { count: txCount }] = await Promise.all([
        admin.from("profiles").select("*", { count: "exact", head: true }),
        admin.from("tasks").select("*", { count: "exact", head: true }),
        admin.from("wallet_transactions").select("*", { count: "exact", head: true }),
      ]);
      totalUsers = uCount || 0;
      totalTasks = tCount || 0;
      totalTransactions = txCount || 0;
    } catch (e: any) {
      dbError = e?.message || "Unknown DB error";
      dbStatus = "down";
    }

    // ----------------------------------------------------------------
    // Auth provider status — based on env var presence (no values).
    // ----------------------------------------------------------------
    const authStatus: "healthy" | "degraded" | "down" =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? "healthy"
        : "down";

    // ----------------------------------------------------------------
    // Storage status — Supabase Storage API.
    // ----------------------------------------------------------------
    let storageStatus: "healthy" | "degraded" | "down" = "down";
    let storageError: string | null = null;
    try {
      const admin = createAdminSupabaseClient();
      const { data, error } = await admin.storage.listBuckets();
      if (error) {
        storageStatus = "degraded";
        storageError = error.message;
      } else {
        storageStatus = "healthy";
        // Sanity-touch the bucket list (data length not needed)
        void (data?.length ?? 0);
      }
    } catch (e: any) {
      storageError = e?.message || "Unknown storage error";
      storageStatus = "down";
    }

    // ----------------------------------------------------------------
    // Recent errors — read from a system_errors table if present.
    // ----------------------------------------------------------------
    let recentErrors: any[] = [];
    try {
      const admin = createAdminSupabaseClient();
      const { data, error } = await admin
        .from("system_errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!error && data) recentErrors = data;
    } catch {
      // table may not exist; leave empty
    }

    // ----------------------------------------------------------------
    // Environment info — no secrets, just identifiers + flags.
    // Uses the centralized ENV contract.
    // ----------------------------------------------------------------
    const environment = process.env.NODE_ENV || "development";
    const region = process.env.VERCEL_REGION || process.env.SUPABASE_REGION || "local";
    const hasSupabaseUrl = Boolean(ENV.supabaseUrl);
    const hasServiceKey = Boolean(ENV.supabaseSecretKey);
    const hasPublishableKey = Boolean(ENV.supabasePublishableKey);

    const responseTimeMs = Date.now() - startedAt;

    const overall: "healthy" | "degraded" | "down" =
      dbStatus === "healthy" && authStatus === "healthy" && storageStatus === "healthy"
        ? "healthy"
        : dbStatus === "down" || authStatus === "down"
          ? "down"
          : "degraded";

    return apiSuccess({
      overall,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      auth: {
        status: authStatus,
        provider: "supabase",
      },
      storage: {
        status: storageStatus,
        error: storageError,
      },
      metrics: {
        totalUsers,
        totalTasks,
        totalTransactions,
      },
      recentErrors,
      environment: {
        node: environment,
        region,
        supabaseUrlConfigured: hasSupabaseUrl,
        serviceKeyConfigured: hasServiceKey,
        publishableKeyConfigured: hasPublishableKey,
        runtime: typeof (globalThis as { Bun?: unknown }).Bun !== "undefined" ? "bun" : "node",
        responseTimeMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
