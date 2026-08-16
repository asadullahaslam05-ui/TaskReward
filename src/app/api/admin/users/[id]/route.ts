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
    const admin = await requireAdmin();
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
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
        pendingBalance: true,
        totalEarned: true,
        totalWithdrawn: true,
        flagged: true,
        flaggedReason: true,
        adminNotes: true,
        referralCode: true,
        referredById: true,
        profileImage: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) return apiError("User not found", 404);

    // Get related data
    const [payments, submissions, withdrawals, transactions, referrals] = await Promise.all([
      db.registrationPayment.findMany({
        where: { userId: id },
        include: { paymentMethod: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.taskSubmission.findMany({
        where: { userId: id },
        include: { task: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.withdrawal.findMany({
        where: { userId: id },
        include: { paymentMethod: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.walletTransaction.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.referralEarning.findMany({
        where: { OR: [{ referrerId: id }, { referredId: id }] },
        take: 10,
      }),
    ]);

    return apiSuccess({ user, payments, submissions, withdrawals, transactions, referrals });
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

    const user = await db.user.findUnique({ where: { id } });
    if (!user) return apiError("User not found", 404);

    const beforeData = {
      status: user.status,
      riskLevel: user.riskLevel,
      flagged: user.flagged,
      flaggedReason: user.flaggedReason,
      adminNotes: user.adminNotes,
    };

    const updateData: any = {};
    const action: string[] = [];

    if (body.status && body.status !== user.status) {
      updateData.status = body.status;
      action.push(`status: ${user.status} → ${body.status}`);
    }
    if (body.riskLevel && body.riskLevel !== user.riskLevel) {
      updateData.riskLevel = body.riskLevel;
      action.push(`riskLevel: ${user.riskLevel} → ${body.riskLevel}`);
    }
    if (typeof body.flagged === "boolean" && body.flagged !== user.flagged) {
      updateData.flagged = body.flagged;
      updateData.flaggedReason = body.flaggedReason || null;
      action.push(`flagged: ${user.flagged} → ${body.flagged}`);
    }
    if (body.adminNotes !== undefined) {
      updateData.adminNotes = body.adminNotes;
    }

    if (Object.keys(updateData).length === 0) {
      return apiError("No changes to update", 400);
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      adminId: admin.id,
      action: `USER_UPDATE: ${action.join(", ")}`,
      targetType: "USER",
      targetId: id,
      beforeData,
      afterData: updateData,
      ipAddress: getClientIP(req),
    });

    // Notify user of status change
    if (updateData.status) {
      const messages: Record<string, { title: string; message: string; type: string }> = {
        ACTIVE: { title: "Account Activated", message: "Your account is now active. You can start earning!", type: "SUCCESS" },
        SUSPENDED: { title: "Account Suspended", message: "Your account has been suspended. Contact support for details.", type: "WARNING" },
        BANNED: { title: "Account Banned", message: "Your account has been banned.", type: "IMPORTANT" },
        REJECTED: { title: "Registration Rejected", message: "Your registration payment was rejected. Contact support.", type: "WARNING" },
      };
      const msg = messages[updateData.status];
      if (msg) {
        await db.notification.create({
          data: { userId: id, title: msg.title, message: msg.message, type: msg.type as any },
        });
      }
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
