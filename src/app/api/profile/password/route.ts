import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const body = await req.json();
    const data = passwordSchema.parse(body);

    const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash ?? "");
    if (!isValid) {
      return apiError("Current password is incorrect", 400);
    }

    const newHash = await bcrypt.hash(data.newPassword, 10);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return apiSuccess({ changed: true });
  } catch (error: any) {
    if (error.issues) {
      return apiError(error.issues[0]?.message || "Validation failed", 400);
    }
    return handleApiError(error);
  }
}
