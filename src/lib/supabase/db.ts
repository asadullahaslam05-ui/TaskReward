import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * RPC function caller.
 */
export async function callRPC(fn: string, params: Record<string, any>): Promise<{ data: any; error: any }> {
  const client = createAdminSupabaseClient();
  return client.rpc(fn, params);
}

/**
 * Get the admin Supabase client.
 */
export function getAdminClient() {
  return createAdminSupabaseClient();
}

/**
 * Get the server Supabase client (respects RLS).
 * NOTE: This is async because createServerSupabaseClient() awaits cookies() in Next.js 16.
 */
export async function getServerClient() {
  return createServerSupabaseClient();
}

/**
 * Check if Supabase tables exist.
 */
export async function checkSupabaseTables(): Promise<boolean> {
  try {
    const client = createAdminSupabaseClient();
    const { error } = await client.from("site_settings").select("key").limit(1);
    return !error;
  } catch {
    return false;
  }
}
