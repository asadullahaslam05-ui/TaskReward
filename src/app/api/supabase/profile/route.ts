import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/uuid";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

/**
 * PATCH /api/supabase/profile
 *
 * Update the authenticated user's own profile (full name, username,
 * phone, profile image). Users cannot change their own role, status,
 * balance, or email via this endpoint.
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401);
    }
    if (!isValidUUID(user.id)) {
      return apiError("Invalid user id", 400);
    }

    const body = await req.json();
    const fullName = (body?.fullName || "").toString().trim();
    const username = (body?.username || "").toString().trim();
    const phone = body?.phone ? (body.phone as string).toString().trim() : null;
    const profileImage = body?.profileImage
      ? (body.profileImage as string).toString().trim()
      : null;

    if (!fullName || fullName.length < 2) {
      return apiError("Full name is required", 400);
    }
    if (!username || username.length < 3) {
      return apiError("Username must be at least 3 characters", 400);
    }

    const admin = createAdminSupabaseClient();

    // Check username uniqueness (exclude self).
    const { data: existingUsername } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();
    if (existingUsername) {
      return apiError("This username is already taken", 409);
    }

    const { data, error } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        username,
        phone,
        profile_image: profileImage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id, email, username, full_name, phone, role, status, profile_image")
      .maybeSingle();

    if (error) {
      console.error("[profile] update error:", error.message);
      return apiError("Failed to update profile", 500);
    }

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
