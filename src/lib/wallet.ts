import { db } from "@/lib/db";

/**
 * Wallet service — all financial operations are atomic and create
 * immutable ledger transactions. Never trust client-submitted balances.
 *
 * Every operation:
 * 1. Reads current balance inside a transaction
 * 2. Validates the operation
 * 3. Creates a wallet transaction record
 * 4. Updates the user's balance
 * 5. Returns the transaction record
 */

export type TransactionType =
  | "TASK_REWARD"
  | "WITHDRAWAL"
  | "WITHDRAWAL_REVERSED"
  | "ADMIN_ADJUSTMENT"
  | "REGISTRATION_PAYMENT"
  | "BONUS"
  | "PENALTY"
  | "REFUND"
  | "REFERRAL";

/**
 * Credit funds to a user's wallet (increase balance).
 */
export async function creditWallet(params: {
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  referenceId?: string;
  createdBy?: string;
  updateTotalEarned?: boolean;
}): Promise<{ transactionId: string; newBalance: number }> {
  const { userId, type, amount, description, referenceId, createdBy, updateTotalEarned } = params;

  if (amount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    const previousBalance = user.balance;
    const newBalance = previousBalance + amount;

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type,
        amount,
        previousBalance,
        newBalance,
        referenceId: referenceId || null,
        description,
        status: "COMPLETED",
        createdBy: createdBy || null,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: newBalance,
        totalEarned: updateTotalEarned ? user.totalEarned + amount : user.totalEarned,
      },
    });

    return { transactionId: transaction.id, newBalance };
  });
}

/**
 * Debit funds from a user's wallet (decrease balance).
 * Throws if insufficient balance.
 */
export async function debitWallet(params: {
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  referenceId?: string;
  createdBy?: string;
  updateTotalWithdrawn?: boolean;
}): Promise<{ transactionId: string; newBalance: number }> {
  const { userId, type, amount, description, referenceId, createdBy, updateTotalWithdrawn } = params;

  if (amount <= 0) {
    throw new Error("Debit amount must be positive");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.balance < amount) {
      throw new Error("Insufficient balance");
    }

    const previousBalance = user.balance;
    const newBalance = previousBalance - amount;

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type,
        amount: -amount, // negative for debit
        previousBalance,
        newBalance,
        referenceId: referenceId || null,
        description,
        status: "COMPLETED",
        createdBy: createdBy || null,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: newBalance,
        totalWithdrawn: updateTotalWithdrawn ? user.totalWithdrawn + amount : user.totalWithdrawn,
      },
    });

    return { transactionId: transaction.id, newBalance };
  });
}

/**
 * Reserve funds for a withdrawal (move from available to pending).
 * This prevents double-spending while admin reviews.
 */
export async function reserveFunds(params: {
  userId: string;
  amount: number;
  description: string;
  referenceId?: string;
}): Promise<{ transactionId: string; newBalance: number; newPending: number }> {
  const { userId, amount, description, referenceId } = params;

  if (amount <= 0) {
    throw new Error("Reserve amount must be positive");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.balance < amount) {
      throw new Error("Insufficient balance");
    }

    const previousBalance = user.balance;
    const newBalance = previousBalance - amount;
    const newPending = user.pendingBalance + amount;

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type: "WITHDRAWAL",
        amount: -amount,
        previousBalance,
        newBalance,
        referenceId: referenceId || null,
        description,
        status: "PENDING",
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: newBalance,
        pendingBalance: newPending,
      },
    });

    return { transactionId: transaction.id, newBalance, newPending };
  });
}

/**
 * Reverse reserved funds back to available balance (e.g. withdrawal rejected).
 * Uses idempotency via referenceId to prevent double-refunds.
 */
export async function reverseReservedFunds(params: {
  userId: string;
  amount: number;
  description: string;
  referenceId: string;
}): Promise<{ transactionId: string; newBalance: number }> {
  const { userId, amount, description, referenceId } = params;

  // Idempotency check: prevent double-refund
  const existing = await db.walletTransaction.findFirst({
    where: {
      referenceId,
      type: "WITHDRAWAL_REVERSED",
    },
  });
  if (existing) {
    throw new Error("This withdrawal has already been reversed");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.pendingBalance < amount) {
      throw new Error("Insufficient pending balance to reverse");
    }

    const previousBalance = user.balance;
    const newBalance = previousBalance + amount;
    const newPending = user.pendingBalance - amount;

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type: "WITHDRAWAL_REVERSED",
        amount,
        previousBalance,
        newBalance,
        referenceId,
        description,
        status: "COMPLETED",
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: newBalance,
        pendingBalance: newPending,
      },
    });

    return { transactionId: transaction.id, newBalance };
  });
}

/**
 * Admin manual balance adjustment (add or remove funds).
 * Always creates an audit trail.
 */
export async function adminAdjustBalance(params: {
  userId: string;
  amount: number; // positive = add, negative = remove
  reason: string;
  adminId: string;
}): Promise<{ transactionId: string; newBalance: number }> {
  const { userId, amount, reason, adminId } = params;

  if (amount === 0) {
    throw new Error("Adjustment amount cannot be zero");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    const previousBalance = user.balance;
    const newBalance = previousBalance + amount;

    if (newBalance < 0) {
      throw new Error("Resulting balance cannot be negative");
    }

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type: amount > 0 ? "ADMIN_ADJUSTMENT" : "PENALTY",
        amount,
        previousBalance,
        newBalance,
        description: reason,
        status: "COMPLETED",
        createdBy: adminId,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: newBalance,
        totalEarned: amount > 0 ? user.totalEarned + amount : user.totalEarned,
      },
    });

    // Create notification
    await tx.notification.create({
      data: {
        userId,
        title: amount > 0 ? "Balance Added" : "Balance Deducted",
        message: `${amount > 0 ? "Added" : "Deducted"} ${Math.abs(amount).toFixed(2)} to your wallet. Reason: ${reason}`,
        type: amount > 0 ? "SUCCESS" : "WARNING",
      },
    });

    return { transactionId: transaction.id, newBalance };
  });
}
