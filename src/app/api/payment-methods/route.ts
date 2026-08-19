import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const methods = await db.paymentMethod.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
    });
    return apiSuccess(methods);
  } catch (error) {
    return handleApiError(error);
  }
}
