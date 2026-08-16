import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/payment-methods
 *
 * PUBLIC endpoint — returns enabled payment methods ordered by sort_order.
 */
export async function GET() {
  try {
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("payment_methods")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}
