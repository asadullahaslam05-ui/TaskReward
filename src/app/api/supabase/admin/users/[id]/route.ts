import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/users/[id]
 *
 * Returns a single user profile plus all related data: registration
 * payments, task submissions, withdrawals, wallet transactions,
 * membership, tags, notes, activities, and any admin override record.
 *
 * PATCH /api/supabase/admin/users/[id]
 * Body fields (all optional): status, riskLevel, flagged, flaggedReason,
 * fullName, username, phone, email, role, adminNotes.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { id } = await params;
    if (!id) return apiError("User id required", 400);

    const admin = createAdminSupabaseClient();

    const { data: user, error: userErr } = await admin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (userErr) {
      console.error("[admin/users] GET error:", userErr.message);
      return apiError("Failed to fetch user", 500);
    }
    if (!user) return apiError("User not found", 404);

    // Parallel fetch of all related data. Each is best-effort.
    const [
      payments,
      submissions,
      withdrawals,
      transactions,
      membership,
      tags,
      notes,
      activities,
      override,
      referrals,
    ] = await Promise.all([
      admin
        .from("registration_payments")
        .select("*, payment_method:payment_methods(*)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then((r) => r.data || []),
      admin
        .from("task_submissions")
        .select("*, task:tasks(*)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then((r) => r.data || []),
      admin
        .from("withdrawals")
        .select("*, payment_method:payment_methods(*)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then((r) => r.data || []),
      admin
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50)
        .then((r) => r.data || []),
      admin
        .from("memberships")
        .select("*, plan:membership_plans(*)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r.data || null),
      admin
        .from("user_tags")
        .select("*")
        .eq("user_id", id)
        .then((r) => r.data || []),
      admin
        .from("user_notes")
        .select("*, admin:profiles!admin_id(*)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .then((r) => r.data || []),
      admin
        .from("user_activities")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50)
        .then((r) => r.data || []),
      admin
        .from("user_overrides")
        .select("*")
        .eq("user_id", id)
        .maybeSingle()
        .then((r) => r.data || null),
      admin
        .from("referrals")
        .select("*, referrer:profiles!referrer_id(*), referred:profiles!referred_id(*)")
        .or(`referrer_id.eq.${id},referred_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(20)
        .then((r) => r.data || []),
    ]);

    return apiSuccess({
      user,
      payments,
      submissions,
      withdrawals,
      transactions,
      membership,
      tags,
      notes,
      activities,
      override,
      referrals,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { id } = await params;
    if (!id) return apiError("User id required", 400);

    const body = await req.json();

    const admin = createAdminSupabaseClient();

    // Fetch the existing record for audit before-state.
    const { data: before, error: beforeErr } = await admin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) {
      console.error("[admin/users] PATCH fetch error:", beforeErr.message);
      return apiError("Failed to fetch user", 500);
    }
    if (!before) return apiError("User not found", 404);

    // Build the update payload from whitelisted fields.
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    const allowed: Array<{ field: string; column: string }> = [
      { field: "status", column: "status" },
      { field: "riskLevel", column: "risk_level" },
      { field: "flagged", column: "flagged" },
      { field: "flaggedReason", column: "flagged_reason" },
      { field: "fullName", column: "full_name" },
      { field: "username", column: "username" },
      { field: "phone", column: "phone" },
      { field: "email", column: "email" },
      { field: "role", column: "role" },
      { field: "adminNotes", column: "admin_notes" },
    ];

    for (const { field, column } of allowed) {
      if (body[field] !== undefined) {
        update[column] = body[field];
      }
    }

    // Sanitize flagged_reason when flagged is toggled off
    if (body.flagged === false) update.flagged_reason = null;

    const { data: updated, error: updateErr } = await admin
      .from("profiles")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[admin/users] PATCH update error:", updateErr.message);
      return apiError("Failed to update user", 500);
    }

    // Best-effort audit log
    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `USER_UPDATE: ${Object.keys(update).filter((k) => k !== "updated_at").join(", ") || "no-changes"}`,
        target_type: "USER",
        target_id: id,
        before_data: JSON.stringify(before),
        after_data: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("[admin/users] audit log insert failed:", (e as Error)?.message);
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
