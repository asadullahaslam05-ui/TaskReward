import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createAuditLog } from "@/lib/notify";
import { getClientIP } from "@/lib/utils-fin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const before = await db.paymentMethod.findUnique({ where: { id } });
    if (!before) return apiError("Payment method not found", 404);

    const updated = await db.paymentMethod.update({
      where: { id },
      data: {
        name: body.name ?? before.name,
        description: body.description ?? before.description,
        enabled: body.enabled ?? before.enabled,
        accountName: body.accountName ?? before.accountName,
        accountNumber: body.accountNumber ?? before.accountNumber,
        walletAddress: body.walletAddress ?? before.walletAddress,
        network: body.network ?? before.network,
        qrCodeUrl: body.qrCodeUrl ?? before.qrCodeUrl,
        instructions: body.instructions ?? before.instructions,
        sortOrder: body.sortOrder ?? before.sortOrder,
      },
    });

    await createAuditLog({
      adminId: admin.id,
      action: `PAYMENT_METHOD_UPDATE: ${updated.name}`,
      targetType: "PAYMENT_METHOD",
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

    const method = await db.paymentMethod.findUnique({ where: { id } });
    if (!method) return apiError("Payment method not found", 404);

    await db.paymentMethod.delete({ where: { id } });

    await createAuditLog({
      adminId: admin.id,
      action: `PAYMENT_METHOD_DELETE: ${method.name}`,
      targetType: "PAYMENT_METHOD",
      targetId: id,
      beforeData: method,
      ipAddress: getClientIP(req),
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
