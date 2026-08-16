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
    const type = searchParams.get("type");
    const { skip, take } = paginate(page, pageSize);

    const where: any = { userId: user.id };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.walletTransaction.count({ where }),
    ]);

    return apiSuccess({
      transactions,
      pagination: { page, pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
