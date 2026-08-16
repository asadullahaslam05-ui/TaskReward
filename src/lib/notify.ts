import { db } from "@/lib/db";

/**
 * Create a notification for a user.
 */
export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "IMPORTANT";
  link?: string;
}): Promise<void> {
  await db.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type || "INFO",
      link: params.link || null,
    },
  });
}

/**
 * Create an audit log entry for admin actions.
 */
export async function createAuditLog(params: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeData?: any;
  afterData?: any;
  ipAddress?: string;
}): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType || null,
      targetId: params.targetId || null,
      beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
      afterData: params.afterData ? JSON.stringify(params.afterData) : null,
      ipAddress: params.ipAddress || null,
    },
  });
}
