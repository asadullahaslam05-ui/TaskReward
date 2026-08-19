import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/queues
 *
 * Returns counts of items pending admin attention across the platform.
 * Used by the admin dashboard "Action Queue" / notification badge.
 */
export async function GET() {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const admin = createAdminSupabaseClient();

    const countRows = async (table: string, filters: Record<string, any> = {}) => {
      let query = admin.from(table).select("*", { count: "exact", head: true });
      for (const [k, v] of Object.entries(filters)) {
        if (v === null || v === undefined) continue;
        query = query.eq(k, v);
      }
      const { count, error } = await query;
      if (error) console.error(`[queues] count ${table}:`, error.message);
      return count || 0;
    };

    // Expiring memberships: ACTIVE memberships with end_date within 7 days
    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 7);
    const { count: expiringMemberships } = await admin
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE")
      .gte("end_date", now.toISOString())
      .lte("end_date", soon.toISOString());

    const [
      pendingRegistrationPayments,
      pendingTaskSubmissions,
      pendingWithdrawals,
      pendingMembershipPayments,
      expiredMemberships,
      flaggedUsers,
      openSupportTickets,
    ] = await Promise.all([
      countRows("registration_payments", { status: "PENDING" }),
      countRows("task_submissions", { status: "PENDING" }),
      countRows("withdrawals", { status: "PENDING" }),
      countRows("membership_payments", { status: "PENDING" }),
      countRows("memberships", { status: "EXPIRED" }),
      countRows("profiles", { flagged: true }),
      countRows("support_tickets", { status: "OPEN" }),
    ]);

    return apiSuccess({
      pendingRegistrationPayments,
      pendingTaskSubmissions,
      pendingWithdrawals,
      pendingMembershipPayments,
      expiringMemberships: expiringMemberships || 0,
      expiredMemberships,
      flaggedUsers,
      openSupportTickets,
      totalPending:
        (pendingRegistrationPayments || 0) +
        (pendingTaskSubmissions || 0) +
        (pendingWithdrawals || 0) +
        (pendingMembershipPayments || 0) +
        (expiringMemberships || 0) +
        (expiredMemberships || 0) +
        (flaggedUsers || 0) +
        (openSupportTickets || 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
