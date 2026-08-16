import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    await requireAdmin();
    const announcements = await db.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(announcements);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();

    const announcement = await db.announcement.create({
      data: {
        title: body.title,
        message: body.message,
        type: body.type || "INFO",
        active: body.active ?? true,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
        targetAudience: body.targetAudience || "ALL",
      },
    });

    return apiSuccess(announcement, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
