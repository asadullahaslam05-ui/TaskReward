import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";
import { isValidUUID } from "@/lib/uuid";

/**
 * /api/supabase/notifications
 *
 * GET   — list the user's notifications with unreadCount.
 * PATCH — mark a notification (or all) as read.
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
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const { skip, take } = paginate(page, pageSize);

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(skip, skip + take - 1);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data, count, error } = await query;

    if (error) {
      return apiError(error.message, 500);
    }

    // Compute unread count separately (ignores the unreadOnly filter)
    const { count: unreadCount } = await admin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    const total = count ?? 0;
    return apiSuccess({
      notifications: data || [],
      unreadCount: unreadCount ?? 0,
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

export async function PATCH(req: NextRequest) {
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

    const body = await req.json();
    const { id, markAllRead } = body || {};

    const admin = createAdminSupabaseClient();

    if (markAllRead) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) return apiError(error.message, 500);
      return apiSuccess({ markedAllRead: true });
    }

    if (id) {
      if (!isValidUUID(id)) {
        return apiError("Invalid notification id", 400);
      }
      // Verify ownership before updating
      const { data: notif } = await admin
        .from("notifications")
        .select("id, user_id")
        .eq("id", id)
        .maybeSingle();

      if (!notif || notif.user_id !== user.id) {
        return apiError("Notification not found", 404);
      }

      const { error } = await admin
        .from("notifications")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) return apiError(error.message, 500);
      return apiSuccess({ markedRead: true });
    }

    return apiError("Notification ID or markAllRead required", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
