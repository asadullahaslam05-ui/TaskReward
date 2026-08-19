import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    await requireAdmin();
    const categories = await db.taskCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { tasks: true } } },
    });
    return apiSuccess(categories);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const category = await db.taskCategory.create({
      data: {
        name: body.name,
        description: body.description || null,
        active: body.active ?? true,
      },
    });
    return apiSuccess(category, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
