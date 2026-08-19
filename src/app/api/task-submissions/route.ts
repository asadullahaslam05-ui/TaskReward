import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const { skip, take } = paginate(page, pageSize);

    const where: any = { userId: user.id };
    if (status) where.status = status;

    const [submissions, total] = await Promise.all([
      db.taskSubmission.findMany({
        where,
        include: { task: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.taskSubmission.count({ where }),
    ]);

    return apiSuccess({
      submissions,
      pagination: { page, pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
