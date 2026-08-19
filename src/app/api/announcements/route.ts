import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const now = new Date();
    const announcements = await db.announcement.findMany({
      where: {
        active: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(announcements);
  } catch (error) {
    return handleApiError(error);
  }
}
