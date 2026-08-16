import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { getSettingNumber } from "@/lib/settings";
import { isValidUrl } from "@/lib/utils-fin";

const paymentSchema = z.object({
  paymentMethodId: z.string().min(1),
  senderName: z.string().min(2, "Sender name is required"),
  senderAccount: z.string().min(3, "Sender account is required"),
  transactionId: z.string().min(3, "Transaction ID is required"),
  amount: z.number().positive("Amount must be positive"),
  paymentDate: z.string().min(1, "Payment date is required"),
  screenshotUrl: z.string().min(1, "Screenshot is required"),
  note: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const payments = await db.registrationPayment.findMany({
      where: { userId: user.id },
      include: { paymentMethod: true },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(payments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const body = await req.json();
    const data = paymentSchema.parse(body);

    // Validate screenshot URL
    if (!isValidUrl(data.screenshotUrl) && !data.screenshotUrl.startsWith("/uploads/")) {
      return apiError("Invalid screenshot URL", 400);
    }

    // Validate payment method
    const method = await db.paymentMethod.findUnique({
      where: { id: data.paymentMethodId },
    });
    if (!method || !method.enabled) {
      return apiError("Invalid or disabled payment method", 400);
    }

    // Check registration fee
    const fee = await getSettingNumber("registration.fee", 500);
    if (Math.abs(data.amount - fee) > 1) {
      return apiError(`Amount must be exactly ${fee}`, 400);
    }

    // Check if user already has a pending payment
    const existingPending = await db.registrationPayment.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });
    if (existingPending) {
      return apiError("You already have a pending payment. Please wait for admin review.", 400);
    }

    // If user is already active, don't allow new payment
    if (user.status === "ACTIVE") {
      return apiError("Your account is already active", 400);
    }

    // Create payment record
    const payment = await db.registrationPayment.create({
      data: {
        userId: user.id,
        paymentMethodId: data.paymentMethodId,
        senderName: data.senderName,
        senderAccount: data.senderAccount,
        transactionId: data.transactionId,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        screenshotUrl: data.screenshotUrl,
        note: data.note || null,
        status: "PENDING",
      },
      include: { paymentMethod: true },
    });

    return apiSuccess(payment, 201);
  } catch (error: any) {
    if (error.issues) {
      return apiError(error.issues[0]?.message || "Validation failed", 400);
    }
    return handleApiError(error);
  }
}
