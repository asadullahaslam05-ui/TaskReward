import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const admin = createAdminSupabaseClient();
    const { error: checkError } = await admin.from("site_settings").select("key").limit(1);
    if (checkError && (checkError.code === "PGRST205" || checkError.message.includes("Could not find the table"))) {
      return apiSuccess({ connected: true, tablesExist: false, message: "Supabase connected but tables not created yet." });
    }
    if (checkError) {
      return apiSuccess({ connected: false, tablesExist: false, error: checkError.message, message: "Failed to connect to Supabase." });
    }
    const tableChecks = await Promise.all([
      admin.from("profiles").select("id").limit(1),
      admin.from("payment_methods").select("id").limit(1),
      admin.from("feature_flags").select("id").limit(1),
      admin.from("tasks").select("id").limit(1),
    ]);
    const existingTables = ["site_settings"];
    if (!tableChecks[0].error) existingTables.push("profiles");
    if (!tableChecks[1].error) existingTables.push("payment_methods");
    if (!tableChecks[2].error) existingTables.push("feature_flags");
    if (!tableChecks[3].error) existingTables.push("tasks");
    return apiSuccess({ connected: true, tablesExist: existingTables.length >= 5, existingTables, message: existingTables.length >= 5 ? "Supabase is fully connected." : `Connected. ${existingTables.length}/5 critical tables found.` });
  } catch (error: any) {
    return apiSuccess({ connected: false, tablesExist: false, error: error.message, message: "Supabase connection failed." });
  }
}
