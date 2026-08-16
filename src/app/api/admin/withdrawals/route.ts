import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const { skip, take } = paginate(page, pageSize);

    const where: any = {};
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      db.withdrawal.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, username: true, fullName: true },
          },
          paymentMethod: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.withdrawal.count({ where }),
    ]);

    return apiSuccess({
      withdrawals,
      pagination: { page, pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
