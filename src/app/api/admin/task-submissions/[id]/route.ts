import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createAuditLog, createNotification } from "@/lib/notify";
import { getClientIP } from "@/lib/utils-fin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { action, adminNote } = body; // action: APPROVE | REJECT | FLAG

    const submission = await db.taskSubmission.findUnique({
      where: { id },
      include: { task: true, user: true },
    });
    if (!submission) return apiError("Submission not found", 404);
    if (submission.status !== "PENDING") {
      return apiError(`Submission already ${submission.status.toLowerCase()}`, 400);
    }

    if (action === "APPROVE") {
      // Atomic: approve + credit reward + notify
      const result = await db.$transaction(async (tx) => {
        // Update submission
        const updated = await tx.taskSubmission.update({
          where: { id },
          data: {
            status: "APPROVED",
            adminNote: adminNote || null,
            reviewedById: admin.id,
            reviewedAt: new Date(),
            rewardCredited: true,
          },
        });

        // Credit reward to wallet
        const user = await tx.user.findUniqueOrThrow({ where: { id: submission.userId } });
        const previousBalance = user.balance;
        const newBalance = previousBalance + submission.task.reward;

        await tx.walletTransaction.create({
          data: {
            userId: submission.userId,
            type: "TASK_REWARD",
            amount: submission.task.reward,
            previousBalance,
            newBalance,
            referenceId: submission.id,
            description: `Task reward: ${submission.task.title}`,
            status: "COMPLETED",
            createdBy: admin.id,
          },
        });

        await tx.user.update({
          where: { id: submission.userId },
          data: {
            balance: newBalance,
            totalEarned: user.totalEarned + submission.task.reward,
          },
        });

        return updated;
      });

      await createNotification({
        userId: submission.userId,
        title: "Task Approved!",
        message: `Your submission for "${submission.task.title}" was approved. Reward of ${submission.task.reward} credited to your wallet.`,
        type: "SUCCESS",
      });

      await createAuditLog({
        adminId: admin.id,
        action: `TASK_SUBMISSION_APPROVED: ${submission.task.title} (+${submission.task.reward})`,
        targetType: "TASK_SUBMISSION",
        targetId: id,
        beforeData: { status: submission.status },
        afterData: { status: "APPROVED", rewardCredited: true },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(result);
    } else if (action === "REJECT") {
      const updated = await db.taskSubmission.update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNote: adminNote || "Submission rejected",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      await createNotification({
        userId: submission.userId,
        title: "Task Submission Rejected",
        message: `Your submission for "${submission.task.title}" was rejected. Reason: ${adminNote || "Does not meet requirements."}`,
        type: "WARNING",
      });

      await createAuditLog({
        adminId: admin.id,
        action: `TASK_SUBMISSION_REJECTED: ${submission.task.title}`,
        targetType: "TASK_SUBMISSION",
        targetId: id,
        beforeData: { status: submission.status },
        afterData: { status: "REJECTED", adminNote },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(updated);
    } else if (action === "FLAG") {
      const updated = await db.taskSubmission.update({
        where: { id },
        data: {
          status: "FLAGGED",
          adminNote: adminNote || "Flagged for review",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      await createAuditLog({
        adminId: admin.id,
        action: `TASK_SUBMISSION_FLAGGED: ${submission.task.title}`,
        targetType: "TASK_SUBMISSION",
        targetId: id,
        beforeData: { status: submission.status },
        afterData: { status: "FLAGGED", adminNote },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(updated);
    }

    return apiError("Invalid action. Use APPROVE, REJECT, or FLAG", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
