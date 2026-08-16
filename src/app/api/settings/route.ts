import { getPublicSettings } from "@/lib/settings";
import { apiSuccess, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const settings = await getPublicSettings();
    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
