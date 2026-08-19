import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";
import { isValidUUID } from "@/lib/uuid";

/**
 * GET /api/supabase/wallet/transactions
 *
 * AUTHENTICATED — lists the user's wallet transactions with pagination.
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const type = searchParams.get("type");
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    // Build query
    let query = admin
      .from("wallet_transactions")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(skip, skip + take - 1);

    if (type) {
      query = query.eq("type", type);
    }

    const { data, count, error } = await query;

    if (error) {
      return apiError(error.message, 500);
    }

    const total = count ?? 0;
    return apiSuccess({
      transactions: data || [],
      pagination: {
        page,
        pageSize: take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
