import { getSupabaseProfile } from "@/lib/supabase/server";

/**
 * Auth Error class — used by both Supabase and legacy auth helpers.
 * Kept here for backward compatibility with api.ts error handling.
 */
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Legacy user shape consumed by the pre-Supabase (Prisma) API routes.
 *
 * These routes (`/api/auth/me`, `/api/profile/*`, `/api/referrals`,
 * `/api/registration-payments`, `/api/wallet`, `/api/withdrawals`,
 * `/api/tasks`, `/api/tasks/[id]`, `/api/admin/*`) were originally written
 * against the Prisma `User` model (camelCase fields, `passwordHash` as a
 * non-null string, `balance`/`pendingBalance`/etc as `Float`, `createdAt`
 * as a `Date`).
 *
 * The current authentication path runs through Supabase, whose `profiles`
 * row uses snake_case column names and stores decimal columns as strings.
 * `LegacyUser` is the bridge: it exposes the camelCase fields the legacy
 * routes read, with the JS types they expect (`number` for balances,
 * `string | null` for `passwordHash` since the Supabase column is
 * nullable, ISO `string` for timestamps).
 */
export interface LegacyUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  passwordHash: string | null;
  role: string;
  status: string;
  riskLevel: string;
  profileImage: string | null;
  referralCode: string;
  referredById: string | null;
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  flagged: boolean;
  flaggedReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map a Supabase `profiles` row (snake_case) to the camelCase `LegacyUser`
 * shape expected by the legacy Prisma-based API routes.
 *
 * `profile` is typed as `Record<string, unknown>` because the Supabase
 * client returns the row without an inferred type. We coerce numeric
 * columns (which Postgres returns as strings via JSON) to JS `number`.
 */
function mapProfileToLegacyUser(profile: Record<string, unknown>): LegacyUser {
  const num = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const nullableStr = (v: unknown): string | null =>
    typeof v === "string" ? v : null;
  const bool = (v: unknown): boolean => v === true;

  return {
    id: str(profile.id),
    email: str(profile.email),
    username: str(profile.username),
    fullName: str(profile.full_name),
    phone: nullableStr(profile.phone),
    passwordHash: nullableStr(profile.password_hash),
    role: str(profile.role),
    status: str(profile.status),
    riskLevel: str(profile.risk_level),
    profileImage: nullableStr(profile.profile_image),
    referralCode: str(profile.referral_code),
    referredById: nullableStr(profile.referred_by_id),
    balance: num(profile.balance),
    pendingBalance: num(profile.pending_balance),
    totalEarned: num(profile.total_earned),
    totalWithdrawn: num(profile.total_withdrawn),
    flagged: bool(profile.flagged),
    flaggedReason: nullableStr(profile.flagged_reason),
    lastLoginAt: nullableStr(profile.last_login_at),
    createdAt: str(profile.created_at),
    updatedAt: str(profile.updated_at),
  };
}

/**
 * Get the current authenticated legacy user (server-side).
 *
 * Returns the camelCase `LegacyUser` mapped from the Supabase `profiles`
 * row, or `null` if not authenticated. Replaces the previous thin
 * re-export of `getSupabaseUser` (which returned the Supabase AUTH user
 * and lacked the profile fields the legacy routes read).
 */
export async function getCurrentUser(): Promise<LegacyUser | null> {
  const profile = await getSupabaseProfile();
  if (!profile) return null;
  return mapProfileToLegacyUser(profile as Record<string, unknown>);
}

/**
 * Alias of {@link getCurrentUser} kept for legacy route imports.
 */
export async function getSession(): Promise<LegacyUser | null> {
  return getCurrentUser();
}

/**
 * Require authentication. Throws {@link AuthError} if not authenticated.
 */
export async function requireAuth(): Promise<LegacyUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

/**
 * Require admin role. Throws {@link AuthError} (401 or 403) otherwise.
 */
export async function requireAdmin(): Promise<LegacyUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

/**
 * Require a specific role. Throws {@link AuthError} otherwise.
 *
 * Accepts a role name (e.g. `"ADMIN"`, `"SUPER_ADMIN"`, `"FINANCE"`).
 * `SUPER_ADMIN` always passes regardless of the required role.
 */
export async function requireRole(role: string): Promise<LegacyUser> {
  const user = await requireAuth();
  if (user.role === "SUPER_ADMIN") return user;
  if (user.role !== role) {
    throw new AuthError(`${role} access required`, 403);
  }
  return user;
}
