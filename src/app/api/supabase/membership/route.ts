import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidUUID } from "@/lib/uuid";

/**
 * GET /api/supabase/membership
 *
 * AUTHENTICATED — returns the current user's membership with plan, status, and
 * payment history.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }
    if (!isValidUUID(user.id)) {
      return apiError("Invalid user id", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch membership with plan relation
    const { data: membership, error: membershipErr } = await admin
      .from("memberships")
      .select(
        "*, plan:membership_plans(*)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipErr) {
      console.error("[membership] fetch error:", membershipErr.message);
    }

    // Fetch payment history
    const { data: payments, error: paymentsErr } = await admin
      .from("membership_payments")
      .select(
        "*, payment_method:payment_methods(*)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (paymentsErr) {
      console.error("[membership] payments fetch error:", paymentsErr.message);
    }

    // Fetch available plans (for renewal UI)
    const { data: plans, error: plansErr } = await admin
      .from("membership_plans")
      .select("*")
      .eq("active", true)
      .order("price", { ascending: true });

    if (plansErr) {
      console.error("[membership] plans fetch error:", plansErr.message);
    }

    return apiSuccess({
      membership: membership || null,
      payments: payments || [],
      plans: plans || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
