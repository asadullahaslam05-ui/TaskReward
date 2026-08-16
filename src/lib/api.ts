import { NextResponse } from "next/server";
import { AuthError } from "@/lib/session";

/**
 * Convert a snake_case key to camelCase.
 * - Keys starting with "_" (e.g. Prisma's _count, _sum) are preserved as-is.
 * - Keys without underscores pass through unchanged.
 * - Keys with digits after underscores (e.g. "line_1") convert correctly → "line1".
 */
function snakeToCamel(key: string): string {
  if (!key) return key;
  if (key.startsWith("_")) return key; // preserve Prisma aggregate fields
  if (!key.includes("_")) return key;
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Recursively convert all snake_case object keys to camelCase.
 * Handles nested objects, arrays, Dates (preserved), and primitives.
 */
function convertKeysDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return (value as unknown[]).map((v) => convertKeysDeep(v)) as unknown as T;
  }
  if (typeof value === "object" && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[snakeToCamel(k)] = convertKeysDeep(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Standard success response.
 * Auto-converts snake_case keys to camelCase so that Supabase row data
 * (which uses Postgres snake_case columns) becomes idiomatic TS data
 * for the frontend. Prisma rows already use camelCase and pass through
 * unchanged (their keys have no underscores, or are aggregate fields
 * like `_count`/`_sum` which are intentionally preserved).
 */
export function apiSuccess(data: any, status: number = 200) {
  const converted = convertKeysDeep(data);
  return NextResponse.json({ success: true, data: converted }, { status });
}

/**
 * Standard error response. Never leaks internal errors.
 */
export function apiError(message: string, status: number = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code },
    { status }
  );
}

/**
 * Handle API errors consistently. Maps known errors to appropriate status codes.
 */
export function handleApiError(error: unknown) {
  console.error("[API Error]", error);

  if (error instanceof AuthError) {
    return apiError(error.message, error.statusCode);
  }

  if (error instanceof Error) {
    // Don't leak database/SQL errors to users
    const msg = error.message;
    if (msg.includes("Unique constraint")) {
      return apiError("A record with this value already exists", 409);
    }
    if (msg.includes("Foreign key constraint")) {
      return apiError("Referenced record not found", 400);
    }
    if (msg.includes("Record not found")) {
      return apiError("Record not found", 404);
    }
    return apiError(msg, 400);
  }

  return apiError("An unexpected error occurred", 500);
}
