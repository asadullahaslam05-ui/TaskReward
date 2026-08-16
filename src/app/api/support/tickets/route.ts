import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

const ticketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  category: z.string().min(1),
  priority: z.string().default("NORMAL"),
  message: z.string().min(5, "Message must be at least 5 characters"),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = { userId: user.id };
    if (status) where.status = status;

    const tickets = await db.supportTicket.findMany({
      where,
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(tickets);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const body = await req.json();
    const data = ticketSchema.parse(body);

    const ticket = await db.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          userId: user.id,
          subject: data.subject,
          category: data.category,
          priority: data.priority,
          status: "OPEN",
        },
      });

      await tx.supportMessage.create({
        data: {
          ticketId: t.id,
          senderId: user.id,
          senderRole: "USER",
          message: data.message,
        },
      });

      return t;
    });

    return apiSuccess(ticket, 201);
  } catch (error: any) {
    if (error.issues) {
      return apiError(error.issues[0]?.message || "Validation failed", 400);
    }
    return handleApiError(error);
  }
}
