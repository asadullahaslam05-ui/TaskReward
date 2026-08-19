import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { apiSuccess, handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30"; // days

    const days = parseInt(range);
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);

    // Summary stats
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      bannedUsers,
      totalTasks,
      activeTasks,
      pendingPayments,
      pendingSubmissions,
      pendingWithdrawals,
      paidWithdrawals,
      totalRewards,
      totalWithdrawnAmount,
    ] = await Promise.all([
      db.user.count({ where: { role: "USER" } }),
      db.user.count({ where: { role: "USER", status: "ACTIVE" } }),
      db.user.count({ where: { role: "USER", status: "PAYMENT_PENDING" } }),
      db.user.count({ where: { role: "USER", status: "SUSPENDED" } }),
      db.user.count({ where: { role: "USER", status: "BANNED" } }),
      db.task.count(),
      db.task.count({ where: { status: "ACTIVE" } }),
      db.registrationPayment.count({ where: { status: "PENDING" } }),
      db.taskSubmission.count({ where: { status: "PENDING" } }),
      db.withdrawal.count({ where: { status: "PENDING" } }),
      db.withdrawal.count({ where: { status: "PAID" } }),
      db.walletTransaction.aggregate({
        where: { type: "TASK_REWARD" },
        _sum: { amount: true },
      }),
      db.withdrawal.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    // Revenue (registration payments)
    const totalRevenue = await db.registrationPayment.aggregate({
      where: { status: "APPROVED" },
      _sum: { amount: true },
    });

    // Time-series data for charts
    const registrations = await getDailyCounts(db.user, "createdAt", startDate, now, { role: "USER" });
    const taskSubmissions = await getDailyCounts(db.taskSubmission, "createdAt", startDate, now);
    const withdrawals = await getDailyCounts(db.withdrawal, "createdAt", startDate, now);
    const paymentsApproved = await getDailyCounts(db.registrationPayment, "reviewedAt", startDate, now, { status: "APPROVED" });

    return apiSuccess({
      summary: {
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        bannedUsers,
        totalTasks,
        activeTasks,
        pendingPayments,
        pendingSubmissions,
        pendingWithdrawals,
        paidWithdrawals,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalRewards: totalRewards._sum.amount || 0,
        totalWithdrawn: totalWithdrawnAmount._sum.amount || 0,
      },
      charts: {
        registrations,
        taskSubmissions,
        withdrawals,
        paymentsApproved,
      },
      range: days,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getDailyCounts(model: any, dateField: string, startDate: Date, endDate: Date, where: any = {}) {
  const records = await model.findMany({
    where: {
      ...where,
      [dateField]: { gte: startDate, lte: endDate },
    },
    select: { [dateField]: true },
  });

  const days: { date: string; count: number }[] = [];
  const dayMap = new Map<string, number>();

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dayMap.set(key, 0);
  }

  for (const r of records) {
    const date = r[dateField];
    if (date) {
      const key = new Date(date).toISOString().split("T")[0];
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) || 0) + 1);
      }
    }
  }

  for (const [date, count] of dayMap) {
    days.push({ date, count });
  }

  return days;
}
