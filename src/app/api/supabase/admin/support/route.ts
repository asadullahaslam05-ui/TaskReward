import { NextRequest } from "next/server";
import { createAdminSupabaseClient, getSupabaseProfile } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

/**
 * GET /api/supabase/admin/support?page=&pageSize=&status=&priority=&category=
 *
 * List support tickets with the related user. Optional filters for
 * status, priority, and category.
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getSupabaseProfile();
    if (!profile) return apiError("Authentication required", 401);
    if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
      return apiError("Admin access required", 403);
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20;
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const category = searchParams.get("category") || "";
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("support_tickets")
      .select("*, user:profiles!support_tickets_user_id_fkey(*)", { count: "exact" })
      .order("updated_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (category) query = query.eq("category", category);

    query = query.range(skip, skip + take - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error("[admin/support] list error:", error.message);
      return apiError("Failed to fetch support tickets", 500);
    }

    // Enrich with message counts in a single pass
    const ticketIds = (data || []).map((t: any) => t.id);
    const messageCounts = new Map<string, number>();
    if (ticketIds.length > 0) {
      const { data: msgs, error: msgsErr } = await admin
        .from("support_messages")
        .select("ticket_id")
        .in("ticket_id", ticketIds);
      if (!msgsErr && msgs) {
        for (const m of msgs as any[]) {
          if (m.ticket_id) {
            messageCounts.set(m.ticket_id, (messageCounts.get(m.ticket_id) || 0) + 1);
          }
        }
      }
    }

    const items = (data || []).map((t: any) => ({
      ...t,
      messageCount: messageCounts.get(t.id) || 0,
    }));

    const total = count || 0;
    return apiSuccess({
      tickets: items,
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
