import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

const messageSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const { id } = await params;
    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) return apiError("Ticket not found", 404);

    // User can only view their own tickets; admin can view all
    if (user.role === "USER" && ticket.userId !== user.id) {
      return apiError("Access denied", 403);
    }

    const messages = await db.supportMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({ ticket, messages });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const { id } = await params;
    const body = await req.json();
    const data = messageSchema.parse(body);

    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) return apiError("Ticket not found", 404);

    if (user.role === "USER" && ticket.userId !== user.id) {
      return apiError("Access denied", 403);
    }

    if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
      return apiError("This ticket is closed", 400);
    }

    const message = await db.supportMessage.create({
      data: {
        ticketId: id,
        senderId: user.id,
        senderRole: user.role === "USER" ? "USER" : "ADMIN",
        message: data.message,
      },
    });

    // Update ticket status
    const newStatus = user.role === "USER" ? "WAITING" : "IN_PROGRESS";
    await db.supportTicket.update({
      where: { id },
      data: { status: newStatus },
    });

    return apiSuccess(message, 201);
  } catch (error: any) {
    if (error.issues) {
      return apiError(error.issues[0]?.message || "Validation failed", 400);
    }
    return handleApiError(error);
  }
}
