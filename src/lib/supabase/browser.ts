"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  ENV,
  assertPublicSupabaseConfig,
  hasPublicSupabaseConfig,
} from "@/lib/env";

/**
 * Whether the Supabase public env vars are present.
 * Used to gracefully degrade (e.g. anonymous homepage) when the project
 * hasn't been wired up to a Supabase backend yet.
 */
export function isSupabaseConfigured(): boolean {
  return hasPublicSupabaseConfig();
}

/**
 * Supabase client for BROWSER-SIDE operations.
 * Uses the publishable (anon) key. Respects RLS policies.
 *
 * Throws a clear, actionable configuration error if the public env vars
 * are missing — never constructs a client from `undefined`.
 */
export function createBrowserSupabaseClient() {
  assertPublicSupabaseConfig();
  return createBrowserClient(ENV.supabaseUrl, ENV.supabasePublishableKey);
}
