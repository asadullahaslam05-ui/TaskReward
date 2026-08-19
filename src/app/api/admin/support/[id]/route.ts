import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createNotification } from "@/lib/notify";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { status, priority } = body;

    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) return apiError("Ticket not found", 404);

    const updated = await db.supportTicket.update({
      where: { id },
      data: {
        status: status ?? undefined,
        priority: priority ?? undefined,
      },
    });

    if (status === "RESOLVED" || status === "CLOSED") {
      await createNotification({
        userId: ticket.userId,
        title: `Ticket ${status === "RESOLVED" ? "Resolved" : "Closed"}`,
        message: `Your support ticket "${ticket.subject}" has been ${status.toLowerCase()}.`,
        type: status === "RESOLVED" ? "SUCCESS" : "INFO",
      });
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
