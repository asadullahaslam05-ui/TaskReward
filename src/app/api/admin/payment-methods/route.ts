import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createAuditLog } from "@/lib/notify";
import { getClientIP } from "@/lib/utils-fin";

export async function GET() {
  try {
    await requireAdmin();
    const methods = await db.paymentMethod.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return apiSuccess(methods);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();

    const method = await db.paymentMethod.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description || null,
        enabled: body.enabled ?? true,
        accountName: body.accountName || null,
        accountNumber: body.accountNumber || null,
        walletAddress: body.walletAddress || null,
        network: body.network || null,
        qrCodeUrl: body.qrCodeUrl || null,
        instructions: body.instructions || null,
        sortOrder: body.sortOrder || 0,
      },
    });

    await createAuditLog({
      adminId: admin.id,
      action: `PAYMENT_METHOD_CREATE: ${method.name}`,
      targetType: "PAYMENT_METHOD",
      targetId: method.id,
      afterData: method,
      ipAddress: getClientIP(req),
    });

    return apiSuccess(method, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
