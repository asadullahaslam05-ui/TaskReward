import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (slug) {
      const page = await db.contentPage.findUnique({ where: { slug } });
      if (!page) return apiError("Page not found", 404);
      return apiSuccess(page);
    }

    const pages = await db.contentPage.findMany({
      orderBy: { title: "asc" },
      select: { slug: true, title: true, updatedAt: true },
    });
    return apiSuccess(pages);
  } catch (error) {
    return handleApiError(error);
  }
}
