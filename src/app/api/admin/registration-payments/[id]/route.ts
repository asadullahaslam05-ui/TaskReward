import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createAuditLog, createNotification } from "@/lib/notify";
import { creditWallet } from "@/lib/wallet";
import { getClientIP } from "@/lib/utils-fin";
import { getSettingBool, getSettingNumber } from "@/lib/settings";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { action, adminNote } = body; // action: APPROVE | REJECT

    const payment = await db.registrationPayment.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!payment) return apiError("Payment not found", 404);
    if (payment.status !== "PENDING") {
      return apiError(`Payment already ${payment.status.toLowerCase()}`, 400);
    }

    if (action === "APPROVE") {
      // Activate user and record transaction
      const result = await db.$transaction(async (tx) => {
        // Update payment status
        const updated = await tx.registrationPayment.update({
          where: { id },
          data: {
            status: "APPROVED",
            adminNote: adminNote || null,
            reviewedById: admin.id,
            reviewedAt: new Date(),
          },
        });

        // Activate user
        await tx.user.update({
          where: { id: payment.userId },
          data: { status: "ACTIVE" },
        });

        // Create wallet transaction for registration payment (informational, doesn't add to balance)
        const user = await tx.user.findUniqueOrThrow({ where: { id: payment.userId } });
        await tx.walletTransaction.create({
          data: {
            userId: payment.userId,
            type: "REGISTRATION_PAYMENT",
            amount: 0, // registration fee doesn't add to wallet balance
            previousBalance: user.balance,
            newBalance: user.balance,
            referenceId: payment.id,
            description: `Registration payment of ${payment.amount} approved`,
            status: "COMPLETED",
            createdBy: admin.id,
          },
        });

        // Check referral bonus - credit referrer if referral is enabled
        if (payment.user.referredById) {
          const referralEnabled = await getSettingBool("feature.referral_enabled", true);
          if (referralEnabled) {
            const referralReward = await getSettingNumber("referral.reward", 50);
            const referrer = await tx.user.findUniqueOrThrow({ where: { id: payment.user.referredById } });
            const prevBal = referrer.balance;
            const newBal = prevBal + referralReward;

            await tx.walletTransaction.create({
              data: {
                userId: referrer.id,
                type: "REFERRAL",
                amount: referralReward,
                previousBalance: prevBal,
                newBalance: newBal,
                referenceId: payment.user.id,
                description: `Referral bonus for ${payment.user.username} joining`,
                status: "COMPLETED",
                createdBy: admin.id,
              },
            });

            await tx.user.update({
              where: { id: referrer.id },
              data: { balance: newBal, totalEarned: referrer.totalEarned + referralReward },
            });

            // Update referral earning status
            await tx.referralEarning.updateMany({
              where: { referredId: payment.user.id },
              data: { status: "CREDITED" },
            });

            // Notify referrer
            await tx.notification.create({
              data: {
                userId: referrer.id,
                title: "Referral Bonus Credited!",
                message: `You earned ${referralReward} for referring ${payment.user.username}.`,
                type: "SUCCESS",
              },
            });
          }
        }

        return updated;
      });

      // Notify user
      await createNotification({
        userId: payment.userId,
        title: "Account Activated!",
        message: "Your registration payment has been approved. You can now start earning!",
        type: "SUCCESS",
      });

      await createAuditLog({
        adminId: admin.id,
        action: `REGISTRATION_PAYMENT_APPROVED: ${payment.amount} for ${payment.user.email}`,
        targetType: "REGISTRATION_PAYMENT",
        targetId: id,
        beforeData: { status: payment.status },
        afterData: { status: "APPROVED", adminNote },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(result);
    } else if (action === "REJECT") {
      const updated = await db.registrationPayment.update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNote: adminNote || "Payment rejected by admin",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      // Update user status to REJECTED
      await db.user.update({
        where: { id: payment.userId },
        data: { status: "REJECTED" },
      });

      await createNotification({
        userId: payment.userId,
        title: "Registration Payment Rejected",
        message: `Your registration payment was rejected. Reason: ${adminNote || "Please contact support."}`,
        type: "WARNING",
      });

      await createAuditLog({
        adminId: admin.id,
        action: `REGISTRATION_PAYMENT_REJECTED: ${payment.user.email}`,
        targetType: "REGISTRATION_PAYMENT",
        targetId: id,
        beforeData: { status: payment.status },
        afterData: { status: "REJECTED", adminNote },
        ipAddress: getClientIP(req),
      });

      return apiSuccess(updated);
    }

    return apiError("Invalid action. Use APPROVE or REJECT", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
