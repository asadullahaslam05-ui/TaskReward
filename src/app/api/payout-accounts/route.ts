import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

const payoutAccountSchema = z.object({
  paymentMethodId: z.string().min(1),
  accountHolderName: z.string().optional(),
  accountNumber: z.string().optional(),
  walletAddress: z.string().optional(),
  network: z.string().optional(),
  label: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const accounts = await db.payoutAccount.findMany({
      where: { userId: user.id },
      include: { paymentMethod: true },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(accounts);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const body = await req.json();
    const data = payoutAccountSchema.parse(body);

    const method = await db.paymentMethod.findUnique({
      where: { id: data.paymentMethodId },
    });
    if (!method || !method.enabled) {
      return apiError("Invalid payment method", 400);
    }

    if (method.code === "BINANCE") {
      if (!data.walletAddress) return apiError("Wallet address is required", 400);
    } else {
      if (!data.accountHolderName || !data.accountNumber) {
        return apiError("Account holder name and number are required", 400);
      }
    }

    const account = await db.payoutAccount.create({
      data: {
        userId: user.id,
        paymentMethodId: data.paymentMethodId,
        accountHolderName: data.accountHolderName || null,
        accountNumber: data.accountNumber || null,
        walletAddress: data.walletAddress || null,
        network: data.network || null,
        label: data.label || null,
      },
      include: { paymentMethod: true },
    });

    return apiSuccess(account, 201);
  } catch (error: any) {
    if (error.issues) {
      return apiError(error.issues[0]?.message || "Validation failed", 400);
    }
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("Account ID required", 400);

    const account = await db.payoutAccount.findUnique({ where: { id } });
    if (!account || account.userId !== user.id) {
      return apiError("Account not found", 404);
    }

    await db.payoutAccount.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
