// Shared type definitions for the platform

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN" | "SUPPORT" | "FINANCE" | "MODERATOR";
export type UserStatus = "PAYMENT_PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "BANNED";
export type RiskLevel = "NORMAL" | "WATCH" | "FLAGGED" | "SUSPENDED" | "BANNED";

export type PaymentMethodCode = "EASYPAISA" | "JAZZCASH" | "BINANCE";

export type RegistrationPaymentStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TaskStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type TaskType = "LIKE" | "FOLLOW" | "COMMENT" | "WATCH" | "OTHER";

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";

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

export type WithdrawalStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";

export type AnnouncementType = "INFO" | "SUCCESS" | "WARNING" | "IMPORTANT";

// Status color mapping (centralized)
export const STATUS_COLORS: Record<string, string> = {
  // User statuses
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  PAYMENT_PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  SUSPENDED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  BANNED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  // Payment/submission statuses
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  FLAGGED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  // Task statuses
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  PAUSED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  ARCHIVED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  // Withdrawal statuses
  PROCESSING: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  // Risk levels
  NORMAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  WATCH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  // Ticket statuses
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  WAITING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  CLOSED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  REVERSED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
};

// Transaction type display labels
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  TASK_REWARD: "Task Reward",
  WITHDRAWAL: "Withdrawal",
  WITHDRAWAL_REVERSED: "Withdrawal Refund",
  ADMIN_ADJUSTMENT: "Admin Adjustment",
  REGISTRATION_PAYMENT: "Registration Payment",
  BONUS: "Bonus",
  PENALTY: "Penalty",
  REFUND: "Refund",
  REFERRAL: "Referral Bonus",
};
