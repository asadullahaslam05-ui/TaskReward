import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Authentication required", 401);

    const body = await req.json();
    const { fullName, phone, username, profileImage } = body;

    // Check username uniqueness if changing
    if (username && username !== user.username) {
      const existing = await db.user.findUnique({ where: { username } });
      if (existing) return apiError("Username already taken", 409);
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        fullName: fullName ?? undefined,
        phone: phone ?? undefined,
        username: username ?? undefined,
        profileImage: profileImage ?? undefined,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        profileImage: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
