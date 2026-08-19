import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { slug } = await params;
    const body = await req.json();

    const page = await db.contentPage.upsert({
      where: { slug },
      create: {
        slug,
        title: body.title,
        content: body.content,
        updatedBy: admin.id,
      },
      update: {
        title: body.title,
        content: body.content,
        updatedBy: admin.id,
      },
    });

    return apiSuccess(page);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requireAdmin();
    const { slug } = await params;
    await db.contentPage.delete({ where: { slug } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
