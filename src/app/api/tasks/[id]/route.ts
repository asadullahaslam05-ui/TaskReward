import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { getSettingNumber, getSettingBool } from "@/lib/settings";
import { getClientIP, getDeviceInfo } from "@/lib/utils-fin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const { id } = await params;
    const task = await db.task.findUnique({
      where: { id },
      include: {
        category: true,
        _count: { select: { submissions: true } },
      },
    });

    if (!task) return apiError("Task not found", 404);
    if (task.status !== "ACTIVE" && user.role === "USER") {
      return apiError("Task not available", 404);
    }

    // Check if user already submitted
    const mySubmission = await db.taskSubmission.findUnique({
      where: { taskId_userId: { taskId: id, userId: user.id } },
    });

    return apiSuccess({ ...task, mySubmission });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);
    if (user.status !== "ACTIVE") return apiError("Account not active", 403);

    const { id } = await params;
    const body = await req.json();

    const task = await db.task.findUnique({ where: { id } });
    if (!task) return apiError("Task not found", 404);
    if (task.status !== "ACTIVE") return apiError("Task is not active", 400);

    // Check max completions
    if (task.maxCompletions > 0 && task.currentCompletions >= task.maxCompletions) {
      return apiError("Task has reached maximum completions", 400);
    }

    // Check duplicate submission
    const preventDuplicates = await getSettingBool("tasks.prevent_duplicates", true);
    if (preventDuplicates) {
      const existing = await db.taskSubmission.findUnique({
        where: { taskId_userId: { taskId: id, userId: user.id } },
      });
      if (existing) {
        return apiError("You have already submitted this task", 400);
      }
    }

    // Check daily limit
    const dailyLimit = await getSettingNumber("tasks.daily_limit", 20);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await db.taskSubmission.count({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    });
    if (todayCount >= dailyLimit) {
      return apiError(`Daily task limit (${dailyLimit}) reached. Try again tomorrow.`, 400);
    }

    // Validate proof fields based on task config
    if (task.screenshotRequired && !body.screenshotUrl) {
      return apiError("Screenshot proof is required", 400);
    }
    if (task.textProofRequired && !body.textProof) {
      return apiError("Text proof is required", 400);
    }
    if (task.linkProofRequired && !body.linkProof) {
      return apiError("Link proof is required", 400);
    }

    // Create submission
    const submission = await db.taskSubmission.create({
      data: {
        taskId: id,
        userId: user.id,
        screenshotUrl: body.screenshotUrl || null,
        textProof: body.textProof || null,
        linkProof: body.linkProof || null,
        status: "PENDING",
        ipAddress: getClientIP(req),
        deviceInfo: getDeviceInfo(req),
      },
      include: { task: true },
    });

    // Increment task completion count
    await db.task.update({
      where: { id },
      data: { currentCompletions: { increment: 1 } },
    });

    return apiSuccess(submission, 201);
  } catch (error: any) {
    return handleApiError(error);
  }
}
