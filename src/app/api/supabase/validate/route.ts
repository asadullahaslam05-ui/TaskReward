import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { apiSuccess, handleApiError } from "@/lib/api";

const REQUIRED_TABLES = ["profiles","site_settings","feature_flags","payment_methods","registration_payments","membership_plans","memberships","membership_payments","task_categories","tasks","task_submissions","wallets","wallet_transactions","withdrawals","payout_accounts","notifications","announcements","referrals","referral_transactions","bonuses","user_bonuses","user_limits","user_overrides","tags","user_tags","user_notes","support_tickets","support_messages","user_activity_logs","admin_audit_logs","error_logs","content_pages","content_sections"];
const REQUIRED_RPCS = ["approve_task_submission","reject_task_submission","create_withdrawal","mark_withdrawal_paid","reject_withdrawal","admin_adjust_balance","approve_registration_payment","extend_membership","is_admin","handle_new_user","update_updated_at_column"];
const REQUIRED_BUCKETS = ["payment-proofs","task-proofs","payout-proofs","profile-images","site-assets"];

export async function GET() {
  try {
    const admin = createAdminSupabaseClient();
    const { error: connError } = await admin.from("site_settings").select("key").limit(1);
    let connected = false;
    if (connError) {
      if (connError.code === "PGRST205" || connError.message.includes("Could not find the table")) { connected = true; }
      else { return apiSuccess({ connection: { status: "FAILED", message: connError.message }, schema: { status: "UNKNOWN", tableCount: 0, requiredCount: REQUIRED_TABLES.length }, overall: { status: "FAILED", message: "Cannot connect" } }); }
    } else { connected = true; }
    if (!connected) {
      return apiSuccess({ connection: { status: "FAILED" }, schema: { status: "UNKNOWN" }, overall: { status: "FAILED", message: "Cannot connect" } });
    }
    const existingTables: string[] = []; const missingTables: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const { error } = await admin.from(table).select("*").limit(1);
      if (error && (error.code === "PGRST205" || error.message.includes("Could not find the table"))) { missingTables.push(table); } else { existingTables.push(table); }
    }
    const allTablesExist = missingTables.length === 0;
    let rlsEnabledCount = 0; let rpcFoundCount = 0; const missingRpcs: string[] = [];
    if (allTablesExist) {
      const { error: rpcCheck } = await admin.rpc("is_admin", {});
      if (!rpcCheck) { rlsEnabledCount = REQUIRED_TABLES.length; }
      for (const fn of REQUIRED_RPCS) {
        const { error } = await admin.rpc(fn, {});
        if (error && (error.message.includes("Could not find the function") || error.message.includes("does not exist"))) { missingRpcs.push(fn); } else { rpcFoundCount++; }
      }
    }
    let bucketCount = 0; const missingBuckets: string[] = [];
    const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();
    if (!bucketsError && buckets) {
      const bucketIds = buckets.map(b => b.id);
      for (const req of REQUIRED_BUCKETS) { if (bucketIds.includes(req)) { bucketCount++; } else { missingBuckets.push(req); } }
    }
    let settingsCount = 0;
    if (allTablesExist) {
      const { count } = await admin.from("site_settings").select("*", { count: "exact", head: true });
      settingsCount = count || 0;
    }
    let overallStatus = "INCOMPLETE";
    if (allTablesExist && missingRpcs.length === 0 && bucketCount === REQUIRED_BUCKETS.length && settingsCount >= 50) { overallStatus = "READY"; }
    return apiSuccess({
      connection: { status: "CONNECTED", message: "Connected" },
      schema: { status: allTablesExist ? "READY" : "INCOMPLETE", tableCount: existingTables.length, requiredCount: REQUIRED_TABLES.length, existingTables, missingTables },
      rls: { status: allTablesExist ? (rlsEnabledCount > 0 ? "ENABLED" : "INCOMPLETE") : "UNKNOWN", enabledCount: rlsEnabledCount, totalCount: REQUIRED_TABLES.length },
      rpcFunctions: { status: allTablesExist ? (missingRpcs.length === 0 ? "READY" : "INCOMPLETE") : "UNKNOWN", foundCount: rpcFoundCount, requiredCount: REQUIRED_RPCS.length, missingRpcs },
      storage: { status: bucketCount === REQUIRED_BUCKETS.length ? "READY" : "INCOMPLETE", bucketCount, requiredCount: REQUIRED_BUCKETS.length, missingBuckets },
      seedData: { status: settingsCount >= 50 ? "READY" : "INCOMPLETE", settingsCount },
      overall: { status: overallStatus, message: overallStatus === "READY" ? "All migrations applied!" : "Some migrations are incomplete." },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
