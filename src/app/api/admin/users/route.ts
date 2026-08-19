import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { paginate } from "@/lib/utils-fin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const role = searchParams.get("role");
    const { skip, take } = paginate(page, pageSize);

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { username: { contains: search } },
        { fullName: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          phone: true,
          role: true,
          status: true,
          riskLevel: true,
          balance: true,
          totalEarned: true,
          totalWithdrawn: true,
          flagged: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.user.count({ where }),
    ]);

    return apiSuccess({
      users,
      pagination: { page, pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
