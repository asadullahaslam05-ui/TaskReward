import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createAuditLog } from "@/lib/notify";
import { getClientIP } from "@/lib/utils-fin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        category: true,
        createdBy: { select: { username: true, fullName: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!task) return apiError("Task not found", 404);
    return apiSuccess(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const before = await db.task.findUnique({ where: { id } });
    if (!before) return apiError("Task not found", 404);

    const updated = await db.task.update({
      where: { id },
      data: {
        title: body.title ?? before.title,
        platform: body.platform ?? before.platform,
        type: body.type ?? before.type,
        targetUrl: body.targetUrl ?? before.targetUrl,
        profileUrl: body.profileUrl ?? before.profileUrl,
        instructions: body.instructions ?? before.instructions,
        reward: body.reward ?? before.reward,
        status: body.status ?? before.status,
        maxCompletions: body.maxCompletions ?? before.maxCompletions,
        startDate: body.startDate ? new Date(body.startDate) : before.startDate,
        endDate: body.endDate ? new Date(body.endDate) : before.endDate,
        categoryId: body.categoryId ?? before.categoryId,
        screenshotRequired: body.screenshotRequired ?? before.screenshotRequired,
        textProofRequired: body.textProofRequired ?? before.textProofRequired,
        linkProofRequired: body.linkProofRequired ?? before.linkProofRequired,
        priority: body.priority ?? before.priority,
        visibility: body.visibility ?? before.visibility,
        dailyLimit: body.dailyLimit ?? before.dailyLimit,
        estimatedTime: body.estimatedTime ?? before.estimatedTime,
      },
      include: { category: true },
    });

    await createAuditLog({
      adminId: admin.id,
      action: `TASK_UPDATE: ${updated.title}`,
      targetType: "TASK",
      targetId: id,
      beforeData: before,
      afterData: updated,
      ipAddress: getClientIP(req),
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const task = await db.task.findUnique({ where: { id } });
    if (!task) return apiError("Task not found", 404);

    await db.task.delete({ where: { id } });

    await createAuditLog({
      adminId: admin.id,
      action: `TASK_DELETE: ${task.title}`,
      targetType: "TASK",
      targetId: id,
      beforeData: task,
      ipAddress: getClientIP(req),
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
