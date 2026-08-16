import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createAuditLog } from "@/lib/notify";
import { getClientIP, paginate } from "@/lib/utils-fin";
import { getSettingNumber } from "@/lib/settings";

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

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        include: {
          category: true,
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.task.count({ where }),
    ]);

    return apiSuccess({
      tasks,
      pagination: { page, pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();

    const defaultReward = await getSettingNumber("tasks.default_reward", 10);

    const task = await db.task.create({
      data: {
        title: body.title,
        platform: body.platform || "TikTok",
        type: body.type,
        targetUrl: body.targetUrl,
        profileUrl: body.profileUrl || null,
        instructions: body.instructions,
        reward: body.reward ?? defaultReward,
        status: body.status || "DRAFT",
        maxCompletions: body.maxCompletions ?? 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        categoryId: body.categoryId || null,
        screenshotRequired: body.screenshotRequired ?? true,
        textProofRequired: body.textProofRequired ?? false,
        linkProofRequired: body.linkProofRequired ?? false,
        priority: body.priority ?? 0,
        visibility: body.visibility || "PUBLIC",
        dailyLimit: body.dailyLimit ?? 0,
        estimatedTime: body.estimatedTime || "2-3 min",
        createdById: admin.id,
      },
      include: { category: true },
    });

    await createAuditLog({
      adminId: admin.id,
      action: `TASK_CREATE: ${task.title}`,
      targetType: "TASK",
      targetId: task.id,
      afterData: task,
      ipAddress: getClientIP(req),
    });

    return apiSuccess(task, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
