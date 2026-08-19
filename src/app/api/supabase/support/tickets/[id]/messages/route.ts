import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/uuid";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * /api/supabase/support/tickets/[id]/messages
 *
 * GET  — fetch a single ticket + its messages (user owns the ticket, or admin).
 * POST — add a message to a ticket (user owns the ticket, or admin replies).
 *
 * Next.js 16 dynamic route signature: params is a Promise.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return apiError("Invalid ticket id", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch the ticket, verify ownership (or admin).
    const { data: ticket, error: ticketErr } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (ticketErr) {
      console.error("[support/messages] ticket fetch error:", ticketErr.message);
      return apiError("Failed to load ticket", 500);
    }
    if (!ticket) {
      return apiError("Ticket not found", 404);
    }

    // Authorization: owner or admin.
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin =
      profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";

    if (ticket.user_id !== user.id && !isAdmin) {
      return apiError("You are not authorized to view this ticket", 403);
    }

    // Fetch messages.
    const { data: messages, error: msgErr } = await admin
      .from("support_messages")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    if (msgErr) {
      console.error("[support/messages] messages fetch error:", msgErr.message);
      return apiError("Failed to load messages", 500);
    }

    return apiSuccess({
      ticket,
      messages: messages || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return apiError("Invalid ticket id", 400);
    }

    const body = await req.json();
    const message = (body?.message || "").toString().trim();
    const attachmentUrl = body?.attachmentUrl
      ? (body.attachmentUrl as string).toString().trim()
      : null;

    if (!message && !attachmentUrl) {
      return apiError("Message cannot be empty", 400);
    }

    const admin = createAdminSupabaseClient();

    // Fetch the ticket, verify ownership (or admin).
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle();

    if (!ticket) {
      return apiError("Ticket not found", 404);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin =
      profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";

    if (ticket.user_id !== user.id && !isAdmin) {
      return apiError("You are not authorized to reply to this ticket", 403);
    }

    const senderRole = isAdmin ? "ADMIN" : "USER";

    // Insert the message.
    const { data: newMessage, error: insertErr } = await admin
      .from("support_messages")
      .insert({
        ticket_id: id,
        sender_id: user.id,
        sender_role: senderRole,
        message: message || "(attachment)",
        attachment_url: attachmentUrl,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("[support/messages] insert error:", insertErr.message);
      return apiError("Failed to send message", 500);
    }

    // If the user replies and the ticket was WAITING, move it back to IN_PROGRESS.
    if (senderRole === "USER" && ticket.status === "WAITING") {
      await admin
        .from("support_tickets")
        .update({
          status: "IN_PROGRESS",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return apiSuccess(newMessage, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
