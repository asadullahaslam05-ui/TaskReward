/**
 * UUID validation utility.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0) return false;
  return UUID_REGEX.test(value);
}

export function assertUUID(value: unknown, fieldName: string = "id"): string {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid ${fieldName}: expected UUID, got "${value}"`);
  }
  return value;
}

export function optionalUUID(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (isValidUUID(value)) return value as string;
  return null;
}
