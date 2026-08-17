import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

  const result = {
    runtime: "server",
    supabaseUrlConfigured: Boolean(url),
    supabaseUrlValid: false,
    supabaseHost: null as string | null,

    publishableKeyConfigured: Boolean(publishableKey),
    secretKeyConfigured: Boolean(secretKey),

    secretKeyLooksLikeLegacyServiceRole: false,
    connection: false,

    error: null as string | null,
    code: null as string | null,
  };

  try {
    if (url) {
      const parsed = new URL(url);
      result.supabaseUrlValid = parsed.protocol === "https:";
      result.supabaseHost = parsed.host;
    }

    if (secretKey) {
      // Old Supabase service_role JWTs usually have 3 dot-separated parts.
      result.secretKeyLooksLikeLegacyServiceRole =
        secretKey.split(".").length === 3;
    }

    if (!url || !secretKey) {
      result.error = "Missing required server Supabase environment variables.";
      return Response.json(result, { status: 500 });
    }

    const supabase = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await supabase
      .from("site_settings")
      .select("key")
      .limit(1);

    if (error) {
      result.error = error.message;
      result.code = error.code ?? null;

      console.error("[Supabase Health] Database error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      return Response.json(result, { status: 500 });
    }

    result.connection = true;

    return Response.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    result.error = message;

    console.error("[Supabase Health] Unexpected error:", error);

    return Response.json(result, { status: 500 });
  }
}