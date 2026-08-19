import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasPublicSupabaseConfig, ENV } from "@/lib/env";

/**
 * Middleware to refresh Supabase auth sessions.
 *
 * This MUST never crash an incoming request. If Supabase env vars are
 * missing or the session refresh fails for any reason, we fall through
 * with a plain `NextResponse.next()` so the app still renders (e.g. the
 * anonymous homepage) instead of returning a 404/500.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Not configured yet — skip session refresh entirely.
  if (!hasPublicSupabaseConfig()) {
    return response;
  }

  try {
    const supabase = createServerClient(
      ENV.supabaseUrl,
      ENV.supabasePublishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Refreshing the session via getUser() also updates the cookies.
    await supabase.auth.getUser();
  } catch (e) {
    // Never let middleware destroy the request — log and continue.
    console.error("[middleware] Supabase session refresh failed:", e);
  }

  return response;
}
