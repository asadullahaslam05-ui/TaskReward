import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/supabase/admin/payment-methods
 *
 * Returns ALL payment methods (including disabled ones).
 *
 * POST /api/supabase/admin/payment-methods
 * Creates a new payment method. Body must include at minimum `code` and `name`.
 */
export async function GET() {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("payment_methods")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[admin/payment-methods] list error:", error.message);
      return apiError("Failed to fetch payment methods", 500);
    }

    return apiSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminProfile = await getSupabaseProfile();
    if (!adminProfile) return apiError("Authentication required", 401);
    if (adminProfile.role !== "ADMIN" && adminProfile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const body = await req.json();
    if (!body.code || !body.name) {
      return apiError("code and name are required", 400);
    }

    const admin = createAdminSupabaseClient();

    const insert = {
      code: String(body.code).toUpperCase(),
      name: String(body.name),
      description: body.description ?? null,
      enabled: body.enabled ?? true,
      account_name: body.accountName ?? null,
      account_number: body.accountNumber ?? null,
      wallet_address: body.walletAddress ?? null,
      network: body.network ?? null,
      qr_code_url: body.qrCodeUrl ?? null,
      instructions: body.instructions ?? null,
      sort_order: body.sortOrder ?? 0,
    };

    const { data, error } = await admin
      .from("payment_methods")
      .insert(insert)
      .select("*")
      .single();

    if (error) {
      console.error("[admin/payment-methods] create error:", error.message);
      if (error.code === "23505") {
        return apiError("A payment method with this code already exists", 409);
      }
      return apiError("Failed to create payment method", 500);
    }

    try {
      await admin.from("admin_audit_logs").insert({
        admin_id: adminProfile.id,
        action: `PAYMENT_METHOD_CREATE: ${insert.code}`,
        target_type: "PAYMENT_METHOD",
        target_id: data.id,
        after_data: JSON.stringify(data),
      });
    } catch (e) {
      console.error("[admin/payment-methods] audit log failed:", (e as Error)?.message);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
