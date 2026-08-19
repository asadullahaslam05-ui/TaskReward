import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { adminAdjustBalance } from "@/lib/wallet";
import { createAuditLog } from "@/lib/notify";
import { getClientIP } from "@/lib/utils-fin";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { userId, amount, reason, type } = body;

    if (!userId || !reason || amount === undefined) {
      return apiError("userId, amount, and reason are required", 400);
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return apiError("User not found", 404);

    const adjAmount = type === "remove" ? -Math.abs(amount) : Math.abs(amount);

    const result = await adminAdjustBalance({
      userId,
      amount: adjAmount,
      reason,
      adminId: admin.id,
    });

    await createAuditLog({
      adminId: admin.id,
      action: `BALANCE_ADJUSTMENT: ${type} ${Math.abs(amount)} (new balance: ${result.newBalance})`,
      targetType: "USER",
      targetId: userId,
      beforeData: { balance: user.balance },
      afterData: { balance: result.newBalance, amount: adjAmount, reason },
      ipAddress: getClientIP(req),
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
