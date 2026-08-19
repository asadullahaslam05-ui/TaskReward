import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidUUID } from "@/lib/uuid";

/**
 * /api/supabase/support/tickets
 *
 * GET  — list the current user's support tickets (with message count).
 * POST — create a new ticket + initial message.
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
    const status = searchParams.get("status");

    const admin = createAdminSupabaseClient();

    let query = admin
      .from("support_tickets")
      .select("*, messages:support_messages(count)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;

    if (error) return apiError(error.message, 500);

    return apiSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
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

    const subject = (body?.subject || "").toString().trim();
    const category = (body?.category || "").toString().trim();
    const priority = (body?.priority || "NORMAL").toString().trim();
    const message = (body?.message || "").toString().trim();

    if (subject.length < 3) {
      return apiError("Subject must be at least 3 characters", 400);
    }
    if (!category) {
      return apiError("Category is required", 400);
    }
    if (message.length < 5) {
      return apiError("Message must be at least 5 characters", 400);
    }

    const admin = createAdminSupabaseClient();

    // Insert the ticket
    const now = new Date().toISOString();
    const { data: ticket, error: ticketErr } = await admin
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject,
        category,
        priority,
        status: "OPEN",
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (ticketErr || !ticket) {
      return apiError(ticketErr?.message || "Failed to create ticket", 400);
    }

    // Insert the initial message
    const { error: msgErr } = await admin.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: "USER",
      message,
      created_at: now,
    });

    if (msgErr) {
      console.error("[support/tickets] initial message error:", msgErr.message);
      // Ticket was still created — return success with a warning
    }

    return apiSuccess(ticket, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
