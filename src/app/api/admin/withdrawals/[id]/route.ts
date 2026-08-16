import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createAuditLog, createNotification } from "@/lib/notify";
import { reverseReservedFunds } from "@/lib/wallet";
import { getClientIP } from "@/lib/utils-fin";
import { generateReferenceId } from "@/lib/utils-fin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { action, adminNote, paymentTransactionId, paymentProofUrl } = body;
    // action: APPROVED | PROCESSING | PAID | REJECTED | CANCELLED

    const withdrawal = await db.withdrawal.findUnique({
      where: { id },
      include: { user: true, paymentMethod: true },
    });
    if (!withdrawal) return apiError("Withdrawal not found", 404);

    const validActions = ["APPROVED", "PROCESSING", "PAID", "REJECTED", "CANCELLED"];
    if (!validActions.includes(action)) {
      return apiError("Invalid action", 400);
    }

    const beforeStatus = withdrawal.status;

    if (action === "PAID") {
      // Mark as paid - move reserved funds out of pending
      const result = await db.$transaction(async (tx) => {
        const updated = await tx.withdrawal.update({
          where: { id },
          data: {
            status: "PAID",
            adminNote: adminNote || null,
            paymentTransactionId: paymentTransactionId || null,
            paymentProofUrl: paymentProofUrl || null,
            reviewedById: admin.id,
            reviewedAt: new Date(),
            paidAt: new Date(),
          },
        });

        // Deduct from pending balance (funds were already reserved)
        const user = await tx.user.findUniqueOrThrow({ where: { id: withdrawal.userId } });
        const totalAmount = withdrawal.amount + withdrawal.fee;

        // Create final withdrawal transaction
        await tx.walletTransaction.create({
          data: {
            userId: withdrawal.userId,
            type: "WITHDRAWAL",
            amount: -totalAmount,
            previousBalance: user.balance, // available balance unchanged (already debited)
            newBalance: user.balance,
            referenceId: withdrawal.id,
            description: `Withdrawal paid via ${withdrawal.paymentMethod.name}`,
            status: "COMPLETED",
            createdBy: admin.id,
          },
        });

        // Update the pending transaction to COMPLETED and reduce pending balance
        await tx.user.update({
          where: { id: withdrawal.userId },
          data: {
            pendingBalance: { decrement: totalAmount },
            totalWithdrawn: { increment: withdrawal.amount },
          },
        });

        return updated;
      });

      await createNotification({
        userId: withdrawal.userId,
        title: "Withdrawal Paid!",
        message: `Your withdrawal of ${withdrawal.amount} has been sent via ${withdrawal.paymentMethod.name}.`,
        type: "SUCCESS",
      });

      await createAuditLog({
        adminId: admin.id,
        action: `WITHDRAWAL_PAID: ${withdrawal.amount} to ${withdrawal.user.email}`,
        targetType: "WITHDRAWAL",
        targetId: id,
        beforeData: { status: beforeStatus },
        afterData: { status: "PAID", paymentTransactionId },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(result);
    } else if (action === "REJECTED" || action === "CANCELLED") {
      // Reverse reserved funds back to available balance
      const referenceId = generateReferenceId("WDR");
      const totalAmount = withdrawal.amount + withdrawal.fee;

      const result = await db.$transaction(async (tx) => {
        // Update withdrawal status
        const updated = await tx.withdrawal.update({
          where: { id },
          data: {
            status: action,
            adminNote: adminNote || `Withdrawal ${action.toLowerCase()}`,
            reviewedById: admin.id,
            reviewedAt: new Date(),
          },
        });

        // Reverse funds (idempotent via referenceId)
        const user = await tx.user.findUniqueOrThrow({ where: { id: withdrawal.userId } });
        const newBalance = user.balance + totalAmount;
        const newPending = user.pendingBalance - totalAmount;

        await tx.walletTransaction.create({
          data: {
            userId: withdrawal.userId,
            type: "WITHDRAWAL_REVERSED",
            amount: totalAmount,
            previousBalance: user.balance,
            newBalance,
            referenceId,
            description: `Withdrawal ${action.toLowerCase()} - funds returned`,
            status: "COMPLETED",
          },
        });

        await tx.user.update({
          where: { id: withdrawal.userId },
          data: { balance: newBalance, pendingBalance: newPending },
        });

        return updated;
      });

      await createNotification({
        userId: withdrawal.userId,
        title: `Withdrawal ${action === "REJECTED" ? "Rejected" : "Cancelled"}`,
        message: `Your withdrawal of ${withdrawal.amount} was ${action.toLowerCase()}. ${adminNote || ""} Funds returned to your wallet.`,
        type: "WARNING",
      });

      await createAuditLog({
        adminId: admin.id,
        action: `WITHDRAWAL_${action}: ${withdrawal.amount} to ${withdrawal.user.email}`,
        targetType: "WITHDRAWAL",
        targetId: id,
        beforeData: { status: beforeStatus },
        afterData: { status: action, adminNote },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(result);
    } else {
      // APPROVED or PROCESSING - just update status
      const updated = await db.withdrawal.update({
        where: { id },
        data: {
          status: action,
          adminNote: adminNote || null,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      await createNotification({
        userId: withdrawal.userId,
        title: `Withdrawal ${action === "APPROVED" ? "Approved" : "Processing"}`,
        message: `Your withdrawal of ${withdrawal.amount} is now ${action.toLowerCase()}.`,
        type: "INFO",
      });

      await createAuditLog({
        adminId: admin.id,
        action: `WITHDRAWAL_${action}: ${withdrawal.user.email}`,
        targetType: "WITHDRAWAL",
        targetId: id,
        beforeData: { status: beforeStatus },
        afterData: { status: action, adminNote },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(updated);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
