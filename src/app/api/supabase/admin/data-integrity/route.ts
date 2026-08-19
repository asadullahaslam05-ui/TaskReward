import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/data-integrity
 *
 * Runs safe, read-only integrity checks across the database.
 * Detects orphaned records, missing relations, and data inconsistencies.
 * Does NOT modify or delete any records.
 */
export async function GET() {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const admin = createAdminSupabaseClient();
    const issues: Array<{
      id: string;
      issue: string;
      table: string;
      recordId: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      suggestion: string;
    }> = [];

    // ============================================================
    // 1. Users without wallets
    // ============================================================
    const { data: usersWithoutWallets } = await admin
      .from("profiles")
      .select("id, email, username")
      .not("id", "in", `(${await admin.from("wallets").select("user_id").then(r => (r.data || []).map(w => w.user_id).join(",") || "''")})`)
      .eq("role", "USER");

    for (const u of usersWithoutWallets || []) {
      issues.push({
        id: `no-wallet-${u.id}`,
        issue: "User has no wallet record",
        table: "profiles",
        recordId: u.id,
        severity: "HIGH",
        suggestion: "Create a wallet for this user via the handle_new_user trigger or manually insert into wallets table.",
      });
    }

    // ============================================================
    // 2. Registration payments with missing payment method
    // ============================================================
    const { data: regPayments } = await admin
      .from("registration_payments")
      .select("id, payment_method_id, user_id, amount, status");

    for (const p of regPayments || []) {
      if (p.payment_method_id) {
        const { data: method } = await admin
          .from("payment_methods")
          .select("id")
          .eq("id", p.payment_method_id)
          .maybeSingle();
        if (!method) {
          issues.push({
            id: `orphan-pm-reg-${p.id}`,
            issue: "Registration payment references a deleted payment method",
            table: "registration_payments",
            recordId: p.id,
            severity: "MEDIUM",
            suggestion: "The payment method was deleted but the payment record still references it. Consider restoring the payment method or updating the record.",
          });
        }
      }
    }

    // ============================================================
    // 3. Membership payments with missing membership
    // ============================================================
    const { data: memPayments } = await admin
      .from("membership_payments")
      .select("id, membership_id, user_id, amount, status");

    for (const p of memPayments || []) {
      if (p.membership_id) {
        const { data: membership } = await admin
          .from("memberships")
          .select("id")
          .eq("id", p.membership_id)
          .maybeSingle();
        if (!membership) {
          issues.push({
            id: `orphan-membership-pay-${p.id}`,
            issue: "Membership payment references a deleted membership",
            table: "membership_payments",
            recordId: p.id,
            severity: "HIGH",
            suggestion: "The membership was deleted but the payment record still references it. This may affect financial history.",
          });
        }
      }
    }

    // ============================================================
    // 4. Tasks with missing category
    // ============================================================
    const { data: tasksWithCategory } = await admin
      .from("tasks")
      .select("id, title, category_id")
      .not("category_id", "is", null);

    for (const t of tasksWithCategory || []) {
      if (t.category_id) {
        const { data: category } = await admin
          .from("task_categories")
          .select("id")
          .eq("id", t.category_id)
          .maybeSingle();
        if (!category) {
          issues.push({
            id: `orphan-cat-task-${t.id}`,
            issue: "Task references a deleted category",
            table: "tasks",
            recordId: t.id,
            severity: "LOW",
            suggestion: "Set category_id to null or assign a valid category.",
          });
        }
      }
    }

    // ============================================================
    // 5. Memberships with missing plan
    // ============================================================
    const { data: memberships } = await admin
      .from("memberships")
      .select("id, user_id, plan_id, status");

    for (const m of memberships || []) {
      if (m.plan_id) {
        const { data: plan } = await admin
          .from("membership_plans")
          .select("id")
          .eq("id", m.plan_id)
          .maybeSingle();
        if (!plan) {
          issues.push({
            id: `orphan-plan-${m.id}`,
            issue: "Membership references a deleted plan",
            table: "memberships",
            recordId: m.id,
            severity: "HIGH",
            suggestion: "The membership plan was deleted but the membership still references it. Assign a valid plan.",
          });
        }
      }
    }

    // ============================================================
    // 6. ACTIVE users without membership
    // ============================================================
    const { data: activeUsers } = await admin
      .from("profiles")
      .select("id, email, username")
      .eq("role", "USER")
      .eq("status", "ACTIVE");

    for (const u of activeUsers || []) {
      const { data: membership } = await admin
        .from("memberships")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();
      if (!membership) {
        issues.push({
          id: `active-no-membership-${u.id}`,
          issue: "ACTIVE user has no membership record",
          table: "profiles",
          recordId: u.id,
          severity: "MEDIUM",
          suggestion: "This user is ACTIVE but has no membership. They may not be able to earn. Create a membership or check if approval was incomplete.",
        });
      }
    }

    // ============================================================
    // 7. Withdrawals with missing payment method
    // ============================================================
    const { data: withdrawals } = await admin
      .from("withdrawals")
      .select("id, payment_method_id, user_id, amount, status");

    for (const w of withdrawals || []) {
      if (w.payment_method_id) {
        const { data: method } = await admin
          .from("payment_methods")
          .select("id")
          .eq("id", w.payment_method_id)
          .maybeSingle();
        if (!method) {
          issues.push({
            id: `orphan-pm-wd-${w.id}`,
            issue: "Withdrawal references a deleted payment method",
            table: "withdrawals",
            recordId: w.id,
            severity: "MEDIUM",
            suggestion: "The payment method was deleted but the withdrawal record still references it.",
          });
        }
      }
    }

    // ============================================================
    // 8. Duplicate referral records
    // ============================================================
    const { data: allReferrals } = await admin
      .from("referrals")
      .select("id, referrer_id, referred_id");

    const referredCounts = new Map<string, number>();
    for (const r of allReferrals || []) {
      referredCounts.set(r.referred_id, (referredCounts.get(r.referred_id) || 0) + 1);
    }
    for (const [referredId, count] of referredCounts) {
      if (count > 1) {
        issues.push({
          id: `dup-referral-${referredId}`,
          issue: `User has ${count} referral records (should be max 1)`,
          table: "referrals",
          recordId: referredId,
          severity: "MEDIUM",
          suggestion: "Remove duplicate referral records, keeping only the earliest one.",
        });
      }
    }

    // ============================================================
    // Summary
    // ============================================================
    const summary = {
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === "CRITICAL").length,
      high: issues.filter(i => i.severity === "HIGH").length,
      medium: issues.filter(i => i.severity === "MEDIUM").length,
      low: issues.filter(i => i.severity === "LOW").length,
    };

    return apiSuccess({ issues, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
