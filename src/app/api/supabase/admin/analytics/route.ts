import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/analytics?range=7|30|90
 *
 * Admin dashboard analytics with summary counts (real DB counts) and
 * time-series chart data (daily counts, zero-filled) for the requested
 * 7/30/90 day range.
 *
 * Auth: requires ADMIN or SUPER_ADMIN profile.
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("range") || "30", 10) || 30, 1), 365);

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);
    const startIso = startDate.toISOString();

    const admin = createAdminSupabaseClient();

    // ----------------------------------------------------------------
    // Helper: count rows matching filters using head+exact count.
    // ----------------------------------------------------------------
    const countRows = async (table: string, filters: Record<string, any> = {}) => {
      let query = admin.from(table).select("*", { count: "exact", head: true });
      for (const [k, v] of Object.entries(filters)) {
        if (v === null || v === undefined) continue;
        query = query.eq(k, v);
      }
      const { count, error } = await query;
      if (error) console.error(`[analytics] count ${table}:`, error.message);
      return count || 0;
    };

    // ----------------------------------------------------------------
    // Helper: sum a numeric column for rows matching filters.
    // ----------------------------------------------------------------
    const sumColumn = async (table: string, column: string, filters: Record<string, any> = {}) => {
      let query = admin.from(table).select(column);
      for (const [k, v] of Object.entries(filters)) {
        if (v === null || v === undefined) continue;
        query = query.eq(k, v);
      }
      const { data, error } = await query;
      if (error) console.error(`[analytics] sum ${table}.${column}:`, error.message);
      return (data || []).reduce((sum: number, r: any) => sum + (Number(r[column]) || 0), 0);
    };

    // ----------------------------------------------------------------
    // Run all summary counts in parallel.
    // ----------------------------------------------------------------
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      bannedUsers,
      totalTasks,
      activeTasks,
      pendingPayments,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      pendingWithdrawals,
      paidWithdrawals,
      activeMemberships,
      expiringMemberships,
      expiredMemberships,
      totalRevenue,
      totalRewards,
      totalWithdrawn,
    ] = await Promise.all([
      countRows("profiles", { role: "USER" }),
      countRows("profiles", { role: "USER", status: "ACTIVE" }),
      countRows("profiles", { role: "USER", status: "PAYMENT_PENDING" }),
      countRows("profiles", { role: "USER", status: "SUSPENDED" }),
      countRows("profiles", { role: "USER", status: "BANNED" }),
      countRows("tasks"),
      countRows("tasks", { status: "ACTIVE" }),
      countRows("registration_payments", { status: "PENDING" }),
      countRows("task_submissions", { status: "PENDING" }),
      countRows("task_submissions", { status: "APPROVED" }),
      countRows("task_submissions", { status: "REJECTED" }),
      countRows("withdrawals", { status: "PENDING" }),
      countRows("withdrawals", { status: "PAID" }),
      countRows("memberships", { status: "ACTIVE" }),
      countExpiringMemberships(admin),
      countRows("memberships", { status: "EXPIRED" }),
      sumColumn("registration_payments", "amount", { status: "APPROVED" }),
      sumColumn("wallet_transactions", "amount", { type: "TASK_REWARD" }),
      sumColumn("withdrawals", "amount", { status: "PAID" }),
    ]);

    // ----------------------------------------------------------------
    // Chart data: daily counts zero-filled across the date range.
    // ----------------------------------------------------------------
    const [registrations, taskSubmissions, withdrawals, paymentsApproved] = await Promise.all([
      fetchDailyCounts(admin, "profiles", "created_at", startIso, { role: "USER" }),
      fetchDailyCounts(admin, "task_submissions", "created_at", startIso),
      fetchDailyCounts(admin, "withdrawals", "created_at", startIso),
      fetchDailyCounts(admin, "registration_payments", "reviewed_at", startIso, { status: "APPROVED" }),
    ]);

    return apiSuccess({
      summary: {
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        bannedUsers,
        totalTasks,
        activeTasks,
        pendingPayments,
        pendingSubmissions,
        approvedSubmissions,
        rejectedSubmissions,
        pendingWithdrawals,
        paidWithdrawals,
        totalRevenue,
        totalRewards,
        totalWithdrawn,
        activeMemberships,
        expiringMemberships,
        expiredMemberships,
      },
      charts: {
        registrations,
        taskSubmissions,
        withdrawals,
        paymentsApproved,
      },
      range: days,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Count memberships that will expire within the next 7 days.
 */
async function countExpiringMemberships(admin: ReturnType<typeof createAdminSupabaseClient>): Promise<number> {
  const now = new Date();
  const soon = new Date();
  soon.setDate(now.getDate() + 7);
  const { count, error } = await admin
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("status", "ACTIVE")
    .gte("end_date", now.toISOString())
    .lte("end_date", soon.toISOString());
  if (error) console.error("[analytics] expiring memberships:", error.message);
  return count || 0;
}

/**
 * Fetch daily counts for a table in the date range, zero-filled.
 * Returns an array of { date: "YYYY-MM-DD", count: number } sorted ascending.
 */
async function fetchDailyCounts(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  table: string,
  dateColumn: string,
  startIso: string,
  filters: Record<string, any> = {}
): Promise<Array<{ date: string; count: number }>> {
  let query = admin
    .from(table)
    .select(dateColumn)
    .gte(dateColumn, startIso);
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined) continue;
    query = query.eq(k, v);
  }
  const { data, error } = await query;
  if (error) {
    console.error(`[analytics] daily ${table}.${dateColumn}:`, error.message);
    return [];
  }

  // Build zero-filled map covering the full range
  const dayMap = new Map<string, number>();
  const cursor = new Date(startIso);
  const end = new Date();
  while (cursor <= end) {
    dayMap.set(cursor.toISOString().split("T")[0], 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of data || []) {
    const raw = (row as any)[dateColumn];
    if (!raw) continue;
    const key = new Date(raw).toISOString().split("T")[0];
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
