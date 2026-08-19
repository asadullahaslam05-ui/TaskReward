import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { getSettingBool, getSettingNumber } from "@/lib/settings";
import { paginate } from "@/lib/utils-fin";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);
    if (user.status !== "ACTIVE") return apiError("Account not active", 403);

    const tasksEnabled = await getSettingBool("feature.tasks_enabled", true);
    if (!tasksEnabled) return apiError("Tasks are currently disabled", 403);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const platform = searchParams.get("platform");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const { skip, take } = paginate(page, pageSize);

    const where: any = {
      status: "ACTIVE",
    };
    if (platform) where.platform = platform;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { instructions: { contains: search } },
      ];
    }

    // Filter out tasks the user has already submitted to (if duplicate prevention is on)
    const preventDuplicates = await getSettingBool("tasks.prevent_duplicates", true);
    if (preventDuplicates) {
      const submittedTaskIds = await db.taskSubmission.findMany({
        where: { userId: user.id },
        select: { taskId: true },
      });
      if (submittedTaskIds.length > 0) {
        where.id = { notIn: submittedTaskIds.map((s) => s.taskId) };
      }
    }

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        include: {
          category: true,
          _count: { select: { submissions: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      db.task.count({ where }),
    ]);

    return apiSuccess({
      tasks,
      pagination: {
        page,
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
