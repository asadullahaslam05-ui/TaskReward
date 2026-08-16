import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { getSettingNumber, getSettingBool } from "@/lib/settings";
import { reserveFunds } from "@/lib/wallet";
import { createNotification } from "@/lib/notify";
import { generateReferenceId, paginate } from "@/lib/utils-fin";

const withdrawalSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethodId: z.string().min(1),
  payoutAccountId: z.string().optional(),
  accountHolderName: z.string().optional(),
  accountNumber: z.string().optional(),
  walletAddress: z.string().optional(),
  network: z.string().optional(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const { skip, take } = paginate(page, pageSize);

    const where: any = { userId: user.id };
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      db.withdrawal.findMany({
        where,
        include: { paymentMethod: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.withdrawal.count({ where }),
    ]);

    return apiSuccess({
      withdrawals,
      pagination: { page, pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);
    if (user.status !== "ACTIVE") return apiError("Account not active", 403);

    const withdrawalsEnabled = await getSettingBool("feature.withdrawals_enabled", true);
    if (!withdrawalsEnabled) return apiError("Withdrawals are currently disabled", 403);

    const body = await req.json();
    const data = withdrawalSchema.parse(body);

    const minAmount = await getSettingNumber("withdrawal.min_amount", 100);
    const maxAmount = await getSettingNumber("withdrawal.max_amount", 50000);
    const dailyLimit = await getSettingNumber("withdrawal.daily_limit", 10000);
    const fee = await getSettingNumber("withdrawal.fee", 0);

    if (data.amount < minAmount) {
      return apiError(`Minimum withdrawal is ${minAmount}`, 400);
    }
    if (data.amount > maxAmount) {
      return apiError(`Maximum withdrawal is ${maxAmount}`, 400);
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayWithdrawals = await db.withdrawal.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: today },
        status: { notIn: ["REJECTED", "CANCELLED"] },
      },
      _sum: { amount: true },
    });
    const todayTotal = todayWithdrawals._sum.amount || 0;
    if (todayTotal + data.amount > dailyLimit) {
      return apiError(`Daily withdrawal limit (${dailyLimit}) would be exceeded`, 400);
    }

    // Check balance (amount + fee)
    const totalNeeded = data.amount + fee;
    if (user.balance < totalNeeded) {
      return apiError(`Insufficient balance. You need ${totalNeeded} (including fee ${fee})`, 400);
    }

    // Validate payment method
    const method = await db.paymentMethod.findUnique({
      where: { id: data.paymentMethodId },
    });
    if (!method || !method.enabled) {
      return apiError("Invalid payment method", 400);
    }

    // Validate payout account fields based on method
    if (method.code === "BINANCE") {
      if (!data.walletAddress) return apiError("Wallet address is required for Binance", 400);
    } else {
      if (!data.accountHolderName || !data.accountNumber) {
        return apiError("Account holder name and number are required", 400);
      }
    }

    // Create withdrawal with reserved funds (atomic)
    const referenceId = generateReferenceId("WD");

    const result = await db.$transaction(async (tx) => {
      // Reserve funds from wallet
      const currentUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (currentUser.balance < totalNeeded) {
        throw new Error("Insufficient balance");
      }

      // Create withdrawal record
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: user.id,
          amount: data.amount,
          fee,
          paymentMethodId: data.paymentMethodId,
          payoutAccountId: data.payoutAccountId || null,
          payoutAccountHolder: data.accountHolderName || "",
          payoutAccountNumber: data.accountNumber || "",
          payoutWalletAddress: data.walletAddress || null,
          payoutNetwork: data.network || method.network || null,
          note: data.note || null,
          status: "PENDING",
        },
      });

      // Reserve funds (debit available, credit pending)
      const previousBalance = currentUser.balance;
      const newBalance = previousBalance - totalNeeded;
      const newPending = currentUser.pendingBalance + totalNeeded;

      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: "WITHDRAWAL",
          amount: -totalNeeded,
          previousBalance,
          newBalance,
          referenceId,
          description: `Withdrawal request #${withdrawal.id}`,
          status: "PENDING",
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { balance: newBalance, pendingBalance: newPending },
      });

      return withdrawal;
    });

    // Notify user
    await createNotification({
      userId: user.id,
      title: "Withdrawal Request Submitted",
      message: `Your withdrawal of ${data.amount + fee} is pending admin review.`,
      type: "INFO",
    });

    return apiSuccess(result, 201);
  } catch (error: any) {
    if (error.issues) {
      return apiError(error.issues[0]?.message || "Validation failed", 400);
    }
    return handleApiError(error);
  }
}
