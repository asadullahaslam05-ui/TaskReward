import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettingBool, getSetting } from "@/lib/settings";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { isValidEmail } from "@/lib/utils-fin";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Invalid phone number").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check if registration is enabled
    const registrationEnabled = await getSettingBool("feature.registration_enabled", true);
    if (!registrationEnabled) {
      return apiError("Registration is currently disabled", 403);
    }

    const body = await req.json();
    const data = registerSchema.parse(body);

    // Validate email
    if (!isValidEmail(data.email)) {
      return apiError("Invalid email address", 400);
    }

    const email = data.email.toLowerCase().trim();

    // Check for existing email
    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      return apiError("An account with this email already exists", 409);
    }

    // Check for existing username
    const existingUsername = await db.user.findUnique({ where: { username: data.username } });
    if (existingUsername) {
      return apiError("This username is already taken", 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Handle referral
    let referredById: string | null = null;
    if (data.referralCode) {
      const referrer = await db.user.findUnique({
        where: { referralCode: data.referralCode },
      });
      if (referrer) {
        referredById = referrer.id;
      }
    }

    // Create user with PAYMENT_PENDING status
    const user = await db.user.create({
      data: {
        email,
        username: data.username,
        fullName: data.fullName,
        phone: data.phone,
        passwordHash,
        role: "USER",
        status: "PAYMENT_PENDING",
        referredById,
      },
    });

    // If referred, create a pending referral earning record
    if (referredById) {
      const referralEnabled = await getSettingBool("feature.referral_enabled", true);
      if (referralEnabled) {
        const referralReward = parseFloat(await getSetting("referral.reward", "50"));
        await db.referralEarning.create({
          data: {
            referrerId: referredById,
            referredId: user.id,
            amount: referralReward,
            status: "PENDING",
          },
        });
      }
    }

    return apiSuccess({
      userId: user.id,
      message: "Account created. Please complete your registration payment to activate your account.",
    }, 201);
  } catch (error: any) {
    if (error.issues) {
      // Zod validation error
      return apiError(error.issues[0]?.message || "Validation failed", 400);
    }
    return handleApiError(error);
  }
}
