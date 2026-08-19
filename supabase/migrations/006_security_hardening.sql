-- 006_security_hardening.sql
-- ============================================================================
-- Phase 2R — Additive corrective migration. SAFE to run on production:
--   * does NOT drop tables or data
--   * does NOT disable RLS
--   * uses DROP POLICY IF EXISTS + CREATE POLICY (idempotent pair)
--   * uses DROP FUNCTION IF EXISTS + CREATE FUNCTION for signature changes
--   * uses CREATE OR REPLACE FUNCTION for body-only changes
--   * does NOT edit 002_rls_policies.sql or 003_rpc_functions.sql history
--
-- Fixes applied:
--   1. WITHDRAWALS: remove the direct-INSERT RLS policy so users can no
--      longer bypass create_withdrawal() and craft fake pending withdrawals.
--   2. PROFILES UPDATE: column-agnostic policy replaced; a BEFORE UPDATE
--      trigger rejects changes to protected columns from non-admin callers.
--      The trigger uses an EXPLICIT authorization check (JWT role claim +
--      is_admin()), not a blind `auth.uid() IS NULL` assumption.
--   3. RPC HARDENING:
--      a) approve_task_submission — check task ACTIVE/date/max_completions;
--         increment tasks.current_completions atomically.
--      b) create_withdrawal — NEW 11-param signature (old 9-param dropped
--         first); reads fee/limits from site_settings; server-side fee.
--      c) mark_withdrawal_paid — UPDATE existing PENDING ledger row (no
--         second INSERT; fixes double-ledger).
--      d) approve_registration_payment — credit referrer (reads referral
--         settings), idempotent via referral_transactions.reference_id.
--   4. RPC ACCESS: REVOKE EXECUTE from PUBLIC/anon/authenticated; GRANT to
--      service_role only. Closes admin-impersonation hole.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. WITHDRAWALS: remove direct INSERT policy (force create_withdrawal RPC)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own withdrawals" ON withdrawals;
-- No CREATE replacement — INSERT now happens only inside create_withdrawal()
-- (SECURITY DEFINER, service_role only). Users keep SELECT on their own rows.

-- ---------------------------------------------------------------------------
-- 2. PROFILES UPDATE: restrict to non-sensitive columns + trigger guard
-- ---------------------------------------------------------------------------
-- Re-runnable pair: DROP IF EXISTS then CREATE. If the policy already exists,
-- DROP is a no-op; CREATE then recreates it. Safe to run multiple times.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- BEFORE UPDATE trigger: reject non-admin changes to protected columns.
--
-- Authorization model (EXPLICIT, not relying on auth.uid() IS NULL alone):
--
--   1. Read the JWT role claim via current_setting('request.jwt.claim.role', true).
--      - 'service_role' → the Next.js server via the admin client. TRUSTED.
--      - NULL → no JWT context at all (direct DB connection / psql). This is
--        already a privileged context (DB owner). TRUSTED.
--      - 'anon' → anonymous browser. Cannot reach UPDATE through RLS anyway
--        (policy requires auth.uid() = id, and anon has no auth.uid()), but
--        if it somehow did, is_admin() would be false → protected columns
--        rejected.
--      - 'authenticated' → a logged-in user via PostgREST. Check is_admin().
--        If admin → allow. If not → reject protected column changes.
--
--   2. This means:
--      - Normal authenticated users CANNOT change role/balance/status/etc.
--      - Admin users CAN (via their JWT).
--      - The Next.js server CAN (via service_role, which bypasses RLS AND
--        fires this trigger with role='service_role' → trusted).
--      - SECURITY DEFINER RPCs called via service_role inherit the
--        service_role context → trusted. RPCs called via an authenticated
--        JWT (which we revoked in section 4) would see the caller's role;
--        since we revoked anon/authenticated execution, this can't happen.
CREATE OR REPLACE FUNCTION guard_protected_profile_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Explicitly read the JWT role claim. NULL when no JWT is present
  -- (service-role admin client, or a direct DB connection).
  v_caller_role := current_setting('request.jwt.claim.role', true);

  -- service_role = the Next.js server holding the SUPABASE_SECRET_KEY.
  -- NULL = no JWT context at all (direct DB / psql) — already privileged.
  IF v_caller_role = 'service_role' OR v_caller_role IS NULL THEN
    RETURN NEW; -- trusted server / privileged context
  END IF;

  -- JWT-based caller (anon or authenticated). Check admin status.
  SELECT is_admin() INTO v_is_admin;
  IF v_is_admin THEN
    RETURN NEW; -- admin user via JWT; allow
  END IF;

  -- Non-admin user: reject changes to ANY protected column.
  IF NEW.role             IS DISTINCT FROM OLD.role
     OR NEW.status            IS DISTINCT FROM OLD.status
     OR NEW.risk_level        IS DISTINCT FROM OLD.risk_level
     OR NEW.balance           IS DISTINCT FROM OLD.balance
     OR NEW.pending_balance   IS DISTINCT FROM OLD.pending_balance
     OR NEW.total_earned      IS DISTINCT FROM OLD.total_earned
     OR NEW.total_withdrawn   IS DISTINCT FROM OLD.total_withdrawn
     OR NEW.flagged           IS DISTINCT FROM OLD.flagged
     OR NEW.flagged_reason    IS DISTINCT FROM OLD.flagged_reason
     OR NEW.referred_by_id    IS DISTINCT FROM OLD.referred_by_id
     OR NEW.referral_code     IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile columns';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_profile_columns ON profiles;
CREATE TRIGGER trg_guard_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_protected_profile_columns();

-- ---------------------------------------------------------------------------
-- 3a. approve_task_submission — hardened (same signature)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_task_submission(p_submission_id UUID, p_admin_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_submission task_submissions%ROWTYPE;
  v_task tasks%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_balance_before DECIMAL(12,2);
  v_balance_after DECIMAL(12,2);
  v_effective_reward DECIMAL(12,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required');
  END IF;
  SELECT * INTO v_submission FROM task_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Submission not found'); END IF;
  IF v_submission.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Submission already processed');
  END IF;
  IF v_submission.reward_credited = TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Reward already credited');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = v_submission.task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Task not found'); END IF;

  -- Harden: task must be ACTIVE and within its date window.
  IF v_task.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Task is not active');
  END IF;
  IF v_task.start_date IS NOT NULL AND now() < v_task.start_date THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Task has not started');
  END IF;
  IF v_task.end_date IS NOT NULL AND now() > v_task.end_date THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Task has ended');
  END IF;
  -- Harden: respect max_completions (0 = unlimited).
  IF v_task.max_completions > 0 AND v_task.current_completions >= v_task.max_completions THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Task completions limit reached');
  END IF;

  -- Server-authoritative reward (read from the tasks row, never the client).
  v_effective_reward := v_task.reward;

  SELECT * INTO v_profile FROM profiles WHERE id = v_submission.user_id FOR UPDATE;
  v_balance_before := v_profile.balance;
  v_balance_after := v_balance_before + v_effective_reward;

  INSERT INTO wallet_transactions
    (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status, created_by)
  VALUES
    (v_submission.user_id, 'TASK_REWARD', v_effective_reward, v_balance_before, v_balance_after,
     'task_submission', v_submission.id, 'Task reward: ' || v_task.title, 'COMPLETED', p_admin_id);

  UPDATE profiles SET balance = v_balance_after, total_earned = total_earned + v_effective_reward
    WHERE id = v_submission.user_id;
  UPDATE wallets SET balance = v_balance_after, total_earned = total_earned + v_effective_reward
    WHERE user_id = v_submission.user_id;

  -- Atomically increment completion count + mark submission approved.
  UPDATE tasks SET current_completions = current_completions + 1 WHERE id = v_task.id;
  UPDATE task_submissions SET status = 'APPROVED', reward_credited = TRUE,
    reward_amount = v_effective_reward, reviewed_by_id = p_admin_id, reviewed_at = now()
    WHERE id = p_submission_id;

  INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_submission.user_id, 'Task Approved!',
            'Your submission for "' || v_task.title || '" was approved.', 'SUCCESS');
  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, after_data)
    VALUES (p_admin_id, 'TASK_SUBMISSION_APPROVED', 'task_submission', p_submission_id::text,
            jsonb_build_object('status','APPROVED','reward',v_effective_reward));

  RETURN jsonb_build_object('success', TRUE, 'reward', v_effective_reward, 'new_balance', v_balance_after);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3b. create_withdrawal — NEW 11-param signature
--     The OLD 9-param signature (with p_fee as 3rd param) is DROPPED FIRST
--     so CREATE OR REPLACE doesn't fail on the parameter-type change.
--     p_fee is DROPPED — server reads withdrawal.fee from site_settings.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_withdrawal(
  UUID,
  DECIMAL,
  DECIMAL,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);

CREATE OR REPLACE FUNCTION create_withdrawal(
  p_user_id UUID,
  p_amount DECIMAL(12,2),
  p_payment_method_id UUID,
  p_payout_account_id UUID DEFAULT NULL,
  p_account_holder TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_wallet_address TEXT DEFAULT NULL,
  p_network TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_balance_before DECIMAL(12,2);
  v_balance_after DECIMAL(12,2);
  v_pending_after DECIMAL(12,2);
  v_total_needed DECIMAL(12,2);
  v_withdrawal_id UUID;
  v_min DECIMAL(12,2);
  v_max DECIMAL(12,2);
  v_daily_limit DECIMAL(12,2);
  v_fee DECIMAL(12,2);
  v_today_total DECIMAL(12,2);
  v_method RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'User not found'); END IF;

  -- Read withdrawal configuration from site_settings (admin-controlled).
  SELECT COALESCE(MAX(CASE WHEN key='withdrawal.min_amount'  THEN value::NUMERIC END), 0) INTO v_min        FROM site_settings WHERE key IN ('withdrawal.min_amount','withdrawal.max_amount','withdrawal.daily_limit','withdrawal.fee');
  SELECT COALESCE(MAX(CASE WHEN key='withdrawal.max_amount'  THEN value::NUMERIC END), 0) INTO v_max        FROM site_settings WHERE key IN ('withdrawal.min_amount','withdrawal.max_amount','withdrawal.daily_limit','withdrawal.fee');
  SELECT COALESCE(MAX(CASE WHEN key='withdrawal.daily_limit' THEN value::NUMERIC END), 0) INTO v_daily_limit FROM site_settings WHERE key IN ('withdrawal.min_amount','withdrawal.max_amount','withdrawal.daily_limit','withdrawal.fee');
  SELECT COALESCE(MAX(CASE WHEN key='withdrawal.fee'         THEN value::NUMERIC END), 0) INTO v_fee        FROM site_settings WHERE key IN ('withdrawal.min_amount','withdrawal.max_amount','withdrawal.daily_limit','withdrawal.fee');

  -- Validate amount against admin-configured min/max.
  IF v_min > 0 AND p_amount < v_min THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Amount below minimum ' || v_min);
  END IF;
  IF v_max > 0 AND p_amount > v_max THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Amount above maximum ' || v_max);
  END IF;

  -- Enforce daily limit (sum of today's withdrawals by this user).
  IF v_daily_limit > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_today_total FROM withdrawals
      WHERE user_id = p_user_id
        AND created_at >= date_trunc('day', now())
        AND status NOT IN ('REJECTED','CANCELLED');
    IF v_today_total + p_amount > v_daily_limit THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Daily withdrawal limit exceeded');
    END IF;
  END IF;

  -- Validate payment method.
  SELECT * INTO v_method FROM payment_methods WHERE id = p_payment_method_id;
  IF NOT FOUND OR NOT enabled THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid or disabled payment method');
  END IF;

  v_total_needed := p_amount + v_fee;
  IF v_profile.balance < v_total_needed THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient balance');
  END IF;

  v_balance_before := v_profile.balance;
  v_balance_after := v_balance_before - v_total_needed;
  v_pending_after := v_profile.pending_balance + v_total_needed;

  INSERT INTO withdrawals
    (user_id, amount, fee, payment_method_id, payout_account_id,
     payout_account_holder, payout_account_number, payout_wallet_address,
     payout_network, note, status)
  VALUES
    (p_user_id, p_amount, v_fee, p_payment_method_id, p_payout_account_id,
     p_account_holder, p_account_number, p_wallet_address,
     p_network, p_note, 'PENDING')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO wallet_transactions
    (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status)
  VALUES
    (p_user_id, 'WITHDRAWAL', -v_total_needed, v_balance_before, v_balance_after,
     'withdrawal', v_withdrawal_id::text, 'Withdrawal request', 'PENDING');

  UPDATE profiles SET balance = v_balance_after, pending_balance = v_pending_after
    WHERE id = p_user_id;
  UPDATE wallets SET balance = v_balance_after, pending_balance = v_pending_after
    WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', TRUE, 'withdrawal_id', v_withdrawal_id,
    'new_balance', v_balance_after, 'fee', v_fee);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3c. mark_withdrawal_paid — UPDATE existing PENDING ledger row to COMPLETED
--     (no second INSERT — fixes double-ledger bug). Same signature.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_withdrawal_paid(
  p_withdrawal_id UUID, p_admin_id UUID, p_payment_txn_id TEXT, p_payment_proof_url TEXT
) RETURNS JSONB AS $$
DECLARE
  v_withdrawal withdrawals%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_total_amount DECIMAL(12,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required');
  END IF;
  SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Withdrawal not found'); END IF;
  IF v_withdrawal.status NOT IN ('PENDING','APPROVED','PROCESSING') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Already processed');
  END IF;

  v_total_amount := v_withdrawal.amount + v_withdrawal.fee;
  SELECT * INTO v_profile FROM profiles WHERE id = v_withdrawal.user_id FOR UPDATE;

  UPDATE withdrawals SET status = 'PAID',
    payment_transaction_id = p_payment_txn_id,
    payment_proof_url = p_payment_proof_url,
    reviewed_by_id = p_admin_id, reviewed_at = now(), paid_at = now()
    WHERE id = p_withdrawal_id;

  -- UPDATE the existing PENDING wallet_transactions row to COMPLETED
  -- (created by create_withdrawal). No second INSERT.
  UPDATE wallet_transactions SET status = 'COMPLETED', created_by = p_admin_id
    WHERE reference_type = 'withdrawal' AND reference_id = p_withdrawal_id::text;

  UPDATE profiles SET pending_balance = pending_balance - v_total_amount,
                       total_withdrawn = total_withdrawn + v_withdrawal.amount
    WHERE id = v_withdrawal.user_id;
  UPDATE wallets SET pending_balance = pending_balance - v_total_amount,
                     total_withdrawn = total_withdrawn + v_withdrawal.amount
    WHERE user_id = v_withdrawal.user_id;

  INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_withdrawal.user_id, 'Withdrawal Paid!', 'Your withdrawal has been sent.', 'SUCCESS');

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3d. approve_registration_payment — also credit the referrer (Phase 2M)
--     Idempotent: referral_transactions.reference_id = 'regpayment:' || payment_id
--     Same signature. Also re-validates the stored amount vs current fee.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_registration_payment(
  p_payment_id UUID, p_admin_id UUID, p_admin_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payment registration_payments%ROWTYPE;
  v_monthly_limit INTEGER;
  v_approved_this_month INTEGER;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_membership_id UUID;
  v_plan_id UUID;
  v_billing_days INTEGER;
  v_end_date TIMESTAMPTZ;
  v_referral RECORD;
  v_ref_reward DECIMAL(12,2);
  v_ref_type TEXT;
  v_ref_max DECIMAL(12,2);
  v_referrer profiles%ROWTYPE;
  v_ref_balance_before DECIMAL(12,2);
  v_ref_balance_after DECIMAL(12,2);
  v_expected_fee DECIMAL(12,2);
  v_fee_str TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required');
  END IF;
  SELECT * INTO v_payment FROM registration_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Not found or processed');
  END IF;

  -- Defense in depth: re-validate the stored amount against the current fee.
  SELECT value INTO v_fee_str FROM site_settings WHERE key = 'registration.fee';
  v_expected_fee := COALESCE(v_fee_str::NUMERIC, 0);
  IF v_expected_fee > 0 AND v_payment.amount != v_expected_fee THEN
    RETURN jsonb_build_object('success', FALSE, 'error',
      'Payment amount (' || v_payment.amount || ') does not match current fee (' || v_expected_fee || ')');
  END IF;

  -- Monthly registration limit.
  SELECT value INTO v_monthly_limit FROM site_settings WHERE key = 'registration.monthly_limit';
  v_monthly_limit := COALESCE(v_monthly_limit::INTEGER, 0);
  IF v_monthly_limit > 0 THEN
    v_month_start := date_trunc('month', now());
    v_month_end := date_trunc('month', now() + interval '1 month');
    SELECT COUNT(*) INTO v_approved_this_month FROM registration_payments
      WHERE status = 'APPROVED' AND reviewed_at >= v_month_start AND reviewed_at < v_month_end;
    IF v_approved_this_month >= v_monthly_limit THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Monthly registration limit reached');
    END IF;
  END IF;

  UPDATE registration_payments SET status = 'APPROVED', admin_note = p_admin_note,
    reviewed_by_id = p_admin_id, reviewed_at = now() WHERE id = p_payment_id;
  UPDATE profiles SET status = 'ACTIVE' WHERE id = v_payment.user_id;

  -- Default membership.
  SELECT id INTO v_plan_id FROM membership_plans WHERE is_default = TRUE AND active = TRUE LIMIT 1;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM membership_plans WHERE active = TRUE ORDER BY sort_order LIMIT 1;
  END IF;
  IF v_plan_id IS NOT NULL THEN
    SELECT COALESCE((SELECT value::INTEGER FROM site_settings WHERE key = 'membership.billing_cycle_days'), 30)
      INTO v_billing_days;
    v_end_date := now() + (v_billing_days || ' days')::INTERVAL;
    INSERT INTO memberships (user_id, plan_id, status, started_at, current_period_start,
      current_period_end, next_payment_due, fee)
    VALUES (v_payment.user_id, v_plan_id, 'ACTIVE', now(), now(), v_end_date, v_end_date,
      (SELECT monthly_fee FROM membership_plans WHERE id = v_plan_id))
    RETURNING id INTO v_membership_id;
  END IF;

  -- Referral reward (Phase 2M): credit the referrer if a PENDING referral exists.
  SELECT * INTO v_referral FROM referrals WHERE referred_id = v_payment.user_id AND status = 'PENDING' LIMIT 1;
  IF v_referral IS NOT NULL THEN
    -- Idempotency: skip if already credited for this payment.
    IF NOT EXISTS (SELECT 1 FROM referral_transactions WHERE reference_id = 'regpayment:' || p_payment_id::text) THEN
      SELECT COALESCE(MAX(CASE WHEN key='referral.reward'     THEN value::NUMERIC END), 0) INTO v_ref_reward
        FROM site_settings WHERE key IN ('referral.reward','referral.type','referral.max_reward');
      SELECT COALESCE(MAX(CASE WHEN key='referral.type'        THEN value END), 'FIXED')   INTO v_ref_type
        FROM site_settings WHERE key IN ('referral.reward','referral.type','referral.max_reward');
      SELECT COALESCE(MAX(CASE WHEN key='referral.max_reward'  THEN value::NUMERIC END), 0) INTO v_ref_max
        FROM site_settings WHERE key IN ('referral.reward','referral.type','referral.max_reward');

      IF v_ref_type = 'PERCENTAGE' THEN
        v_ref_reward := LEAST(v_ref_reward * v_payment.amount / 100.0, v_ref_max);
      ELSE
        v_ref_reward := LEAST(v_ref_reward, v_ref_max);
      END IF;

      IF v_ref_reward > 0 THEN
        SELECT * INTO v_referrer FROM profiles WHERE id = v_referral.referrer_id FOR UPDATE;
        v_ref_balance_before := v_referrer.balance;
        v_ref_balance_after := v_ref_balance_before + v_ref_reward;
        INSERT INTO wallet_transactions
          (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status)
        VALUES
          (v_referrer.id, 'REFERRAL', v_ref_reward, v_ref_balance_before, v_ref_balance_after,
           'referral', p_payment_id::text, 'Referral reward', 'COMPLETED');
        UPDATE profiles SET balance = v_ref_balance_after, total_earned = total_earned + v_ref_reward
          WHERE id = v_referrer.id;
        UPDATE wallets SET balance = v_ref_balance_after, total_earned = total_earned + v_ref_reward
          WHERE user_id = v_referrer.id;
        INSERT INTO notifications (user_id, title, message, type)
          VALUES (v_referrer.id, 'Referral Reward!',
            'You earned ' || v_ref_reward || ' for a referred user activating.', 'SUCCESS');
      END IF;

      INSERT INTO referral_transactions (referrer_id, referred_id, amount, reference_id, status)
        VALUES (v_referral.referrer_id, v_payment.user_id, v_ref_reward,
                'regpayment:' || p_payment_id::text, 'COMPLETED');
      UPDATE referrals SET status = 'CREDITED' WHERE id = v_referral.id;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_payment.user_id, 'Account Activated!',
            'Your registration payment has been approved.', 'SUCCESS');

  RETURN jsonb_build_object('success', TRUE, 'membership_id', v_membership_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 4. RPC ACCESS: revoke public execution; grant only to service_role.
--    Closes the admin-impersonation hole (anon-key callers can no longer
--    invoke these RPCs). The Next.js server uses the service-role admin
--    client, which is the only caller permitted to execute them.
--    (Note: the service-role key bypasses the GRANT system entirely, so the
--     REVOKE here only affects anon/authenticated JWT callers — which is
--     exactly what we want.)
--
--    NOTE: REVOKE/GRANT use the NEW create_withdrawal signature (11 params).
--    The old 9-param signature was DROPPED above, so it has no grants to
--    revoke. If the old function somehow still exists (partial prior run),
--    the DROP FUNCTION above already removed it.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION approve_task_submission(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reject_task_submission(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION create_withdrawal(UUID, DECIMAL, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION mark_withdrawal_paid(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reject_withdrawal(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_adjust_balance(UUID, DECIMAL, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION approve_registration_payment(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION extend_membership(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_task_submission(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reject_task_submission(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_withdrawal(UUID, DECIMAL, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION mark_withdrawal_paid(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reject_withdrawal(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_adjust_balance(UUID, DECIMAL, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION approve_registration_payment(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION extend_membership(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Add reference_id column to referral_transactions if missing (idempotent).
--    (The 001 schema did not declare reference_id; we add it for idempotency
--    of referral crediting in approve_registration_payment.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='referral_transactions' AND column_name='reference_id') THEN
    ALTER TABLE referral_transactions ADD COLUMN reference_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_referral_tx_reference ON referral_transactions(reference_id);
  END IF;
END $$;
