-- 003_rpc_functions.sql
CREATE OR REPLACE FUNCTION approve_task_submission(p_submission_id UUID, p_admin_id UUID) RETURNS JSONB AS $$
DECLARE v_submission task_submissions%ROWTYPE; v_task tasks%ROWTYPE; v_profile profiles%ROWTYPE; v_balance_before DECIMAL(12,2); v_balance_after DECIMAL(12,2); v_effective_reward DECIMAL(12,2);
BEGIN
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required'); END IF;
SELECT * INTO v_submission FROM task_submissions WHERE id = p_submission_id FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Submission not found'); END IF;
IF v_submission.status != 'PENDING' THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Submission already processed'); END IF;
IF v_submission.reward_credited = TRUE THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Reward already credited'); END IF;
SELECT * INTO v_task FROM tasks WHERE id = v_submission.task_id FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Task not found'); END IF;
v_effective_reward := v_task.reward;
SELECT * INTO v_profile FROM profiles WHERE id = v_submission.user_id FOR UPDATE;
v_balance_before := v_profile.balance;
v_balance_after := v_balance_before + v_effective_reward;
INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status, created_by) VALUES (v_submission.user_id, 'TASK_REWARD', v_effective_reward, v_balance_before, v_balance_after, 'task_submission', v_submission.id, 'Task reward: ' || v_task.title, 'COMPLETED', p_admin_id);
UPDATE profiles SET balance = v_balance_after, total_earned = total_earned + v_effective_reward WHERE id = v_submission.user_id;
UPDATE wallets SET balance = v_balance_after, total_earned = total_earned + v_effective_reward WHERE user_id = v_submission.user_id;
UPDATE task_submissions SET status = 'APPROVED', reward_credited = TRUE, reward_amount = v_effective_reward, reviewed_by_id = p_admin_id, reviewed_at = now() WHERE id = p_submission_id;
INSERT INTO notifications (user_id, title, message, type) VALUES (v_submission.user_id, 'Task Approved!', 'Your submission for "' || v_task.title || '" was approved.', 'SUCCESS');
INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, after_data) VALUES (p_admin_id, 'TASK_SUBMISSION_APPROVED', 'task_submission', p_submission_id::text, jsonb_build_object('status','APPROVED','reward',v_effective_reward));
RETURN jsonb_build_object('success', TRUE, 'reward', v_effective_reward, 'new_balance', v_balance_after);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_task_submission(p_submission_id UUID, p_admin_id UUID, p_reason TEXT) RETURNS JSONB AS $$
DECLARE v_submission task_submissions%ROWTYPE;
BEGIN
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required'); END IF;
SELECT * INTO v_submission FROM task_submissions WHERE id = p_submission_id FOR UPDATE;
IF NOT FOUND OR v_submission.status != 'PENDING' THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Submission not found or processed'); END IF;
UPDATE task_submissions SET status = 'REJECTED', admin_note = p_reason, reviewed_by_id = p_admin_id, reviewed_at = now() WHERE id = p_submission_id;
INSERT INTO notifications (user_id, title, message, type) VALUES (v_submission.user_id, 'Task Rejected', 'Reason: ' || p_reason, 'WARNING');
RETURN jsonb_build_object('success', TRUE);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_withdrawal(p_user_id UUID, p_amount DECIMAL(12,2), p_fee DECIMAL(12,2), p_payment_method_id UUID, p_account_holder TEXT, p_account_number TEXT, p_wallet_address TEXT, p_network TEXT, p_note TEXT) RETURNS JSONB AS $$
DECLARE v_profile profiles%ROWTYPE; v_balance_before DECIMAL(12,2); v_balance_after DECIMAL(12,2); v_pending_after DECIMAL(12,2); v_total_needed DECIMAL(12,2); v_withdrawal_id UUID;
BEGIN
SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'User not found'); END IF;
v_total_needed := p_amount + p_fee;
IF v_profile.balance < v_total_needed THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient balance'); END IF;
v_balance_before := v_profile.balance;
v_balance_after := v_balance_before - v_total_needed;
v_pending_after := v_profile.pending_balance + v_total_needed;
INSERT INTO withdrawals (user_id, amount, fee, payment_method_id, payout_account_holder, payout_account_number, payout_wallet_address, payout_network, note, status) VALUES (p_user_id, p_amount, p_fee, p_payment_method_id, p_account_holder, p_account_number, p_wallet_address, p_network, p_note, 'PENDING') RETURNING id INTO v_withdrawal_id;
INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status) VALUES (p_user_id, 'WITHDRAWAL', -v_total_needed, v_balance_before, v_balance_after, 'withdrawal', v_withdrawal_id::text, 'Withdrawal request', 'PENDING');
UPDATE profiles SET balance = v_balance_after, pending_balance = v_pending_after WHERE id = p_user_id;
UPDATE wallets SET balance = v_balance_after, pending_balance = v_pending_after WHERE user_id = p_user_id;
RETURN jsonb_build_object('success', TRUE, 'withdrawal_id', v_withdrawal_id, 'new_balance', v_balance_after);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_withdrawal_paid(p_withdrawal_id UUID, p_admin_id UUID, p_payment_txn_id TEXT, p_payment_proof_url TEXT) RETURNS JSONB AS $$
DECLARE v_withdrawal withdrawals%ROWTYPE; v_profile profiles%ROWTYPE; v_total_amount DECIMAL(12,2);
BEGIN
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required'); END IF;
SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Withdrawal not found'); END IF;
IF v_withdrawal.status NOT IN ('PENDING','APPROVED','PROCESSING') THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Already processed'); END IF;
v_total_amount := v_withdrawal.amount + v_withdrawal.fee;
SELECT * INTO v_profile FROM profiles WHERE id = v_withdrawal.user_id FOR UPDATE;
UPDATE withdrawals SET status = 'PAID', payment_transaction_id = p_payment_txn_id, payment_proof_url = p_payment_proof_url, reviewed_by_id = p_admin_id, reviewed_at = now(), paid_at = now() WHERE id = p_withdrawal_id;
INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status, created_by) VALUES (v_withdrawal.user_id, 'WITHDRAWAL', -v_total_amount, v_profile.balance, v_profile.balance, 'withdrawal', p_withdrawal_id::text, 'Withdrawal paid', 'COMPLETED', p_admin_id);
UPDATE profiles SET pending_balance = pending_balance - v_total_amount, total_withdrawn = total_withdrawn + v_withdrawal.amount WHERE id = v_withdrawal.user_id;
UPDATE wallets SET pending_balance = pending_balance - v_total_amount, total_withdrawn = total_withdrawn + v_withdrawal.amount WHERE user_id = v_withdrawal.user_id;
INSERT INTO notifications (user_id, title, message, type) VALUES (v_withdrawal.user_id, 'Withdrawal Paid!', 'Your withdrawal has been sent.', 'SUCCESS');
RETURN jsonb_build_object('success', TRUE);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_withdrawal(p_withdrawal_id UUID, p_admin_id UUID, p_reason TEXT) RETURNS JSONB AS $$
DECLARE v_withdrawal withdrawals%ROWTYPE; v_profile profiles%ROWTYPE; v_total_amount DECIMAL(12,2); v_balance_before DECIMAL(12,2); v_balance_after DECIMAL(12,2); v_refund_exists BOOLEAN;
BEGIN
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required'); END IF;
SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Not found'); END IF;
IF v_withdrawal.status IN ('REJECTED','CANCELLED') THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Already rejected'); END IF;
SELECT EXISTS(SELECT 1 FROM wallet_transactions WHERE reference_id = p_withdrawal_id::text AND type = 'WITHDRAWAL_REVERSED') INTO v_refund_exists;
IF v_refund_exists THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Refund already processed'); END IF;
v_total_amount := v_withdrawal.amount + v_withdrawal.fee;
SELECT * INTO v_profile FROM profiles WHERE id = v_withdrawal.user_id FOR UPDATE;
v_balance_before := v_profile.balance;
v_balance_after := v_balance_before + v_total_amount;
INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status) VALUES (v_withdrawal.user_id, 'WITHDRAWAL_REVERSED', v_total_amount, v_balance_before, v_balance_after, 'withdrawal', p_withdrawal_id::text, 'Withdrawal rejected - funds returned', 'COMPLETED');
UPDATE profiles SET balance = v_balance_after, pending_balance = pending_balance - v_total_amount WHERE id = v_withdrawal.user_id;
UPDATE wallets SET balance = v_balance_after, pending_balance = pending_balance - v_total_amount WHERE user_id = v_withdrawal.user_id;
UPDATE withdrawals SET status = 'REJECTED', admin_note = p_reason, reviewed_by_id = p_admin_id, reviewed_at = now() WHERE id = p_withdrawal_id;
INSERT INTO notifications (user_id, title, message, type) VALUES (v_withdrawal.user_id, 'Withdrawal Rejected', 'Reason: ' || p_reason, 'WARNING');
RETURN jsonb_build_object('success', TRUE, 'new_balance', v_balance_after);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_adjust_balance(p_user_id UUID, p_amount DECIMAL(12,2), p_reason TEXT, p_admin_id UUID) RETURNS JSONB AS $$
DECLARE v_profile profiles%ROWTYPE; v_balance_before DECIMAL(12,2); v_balance_after DECIMAL(12,2); v_tx_type wallet_tx_type;
BEGIN
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required'); END IF;
IF p_amount = 0 THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Amount cannot be zero'); END IF;
SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'User not found'); END IF;
v_balance_before := v_profile.balance;
v_balance_after := v_balance_before + p_amount;
IF v_balance_after < 0 THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Cannot be negative'); END IF;
v_tx_type := CASE WHEN p_amount > 0 THEN 'ADMIN_ADJUSTMENT' ELSE 'PENALTY' END;
INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, status, created_by) VALUES (p_user_id, v_tx_type, p_amount, v_balance_before, v_balance_after, p_reason, 'COMPLETED', p_admin_id);
UPDATE profiles SET balance = v_balance_after, total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END WHERE id = p_user_id;
UPDATE wallets SET balance = v_balance_after, total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END WHERE user_id = p_user_id;
INSERT INTO notifications (user_id, title, message, type) VALUES (p_user_id, CASE WHEN p_amount > 0 THEN 'Balance Added' ELSE 'Balance Deducted' END, 'Reason: ' || p_reason, CASE WHEN p_amount > 0 THEN 'SUCCESS' ELSE 'WARNING' END);
RETURN jsonb_build_object('success', TRUE, 'new_balance', v_balance_after);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_registration_payment(p_payment_id UUID, p_admin_id UUID, p_admin_note TEXT DEFAULT NULL) RETURNS JSONB AS $$
DECLARE v_payment registration_payments%ROWTYPE; v_monthly_limit INTEGER; v_approved_this_month INTEGER; v_month_start TIMESTAMPTZ; v_month_end TIMESTAMPTZ; v_membership_id UUID; v_plan_id UUID; v_billing_days INTEGER; v_end_date TIMESTAMPTZ;
BEGIN
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required'); END IF;
SELECT * INTO v_payment FROM registration_payments WHERE id = p_payment_id FOR UPDATE;
IF NOT FOUND OR v_payment.status != 'PENDING' THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Not found or processed'); END IF;
SELECT value INTO v_monthly_limit FROM site_settings WHERE key = 'registration.monthly_limit';
v_monthly_limit := COALESCE(v_monthly_limit::INTEGER, 0);
IF v_monthly_limit > 0 THEN
  v_month_start := date_trunc('month', now());
  v_month_end := date_trunc('month', now() + interval '1 month');
  SELECT COUNT(*) INTO v_approved_this_month FROM registration_payments WHERE status = 'APPROVED' AND reviewed_at >= v_month_start AND reviewed_at < v_month_end;
  IF v_approved_this_month >= v_monthly_limit THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Monthly registration limit reached'); END IF;
END IF;
UPDATE registration_payments SET status = 'APPROVED', admin_note = p_admin_note, reviewed_by_id = p_admin_id, reviewed_at = now() WHERE id = p_payment_id;
UPDATE profiles SET status = 'ACTIVE' WHERE id = v_payment.user_id;
SELECT id INTO v_plan_id FROM membership_plans WHERE is_default = TRUE AND active = TRUE LIMIT 1;
IF v_plan_id IS NULL THEN SELECT id INTO v_plan_id FROM membership_plans WHERE active = TRUE ORDER BY sort_order LIMIT 1; END IF;
IF v_plan_id IS NOT NULL THEN
  SELECT COALESCE((SELECT value::INTEGER FROM site_settings WHERE key = 'membership.billing_cycle_days'), 30) INTO v_billing_days;
  v_end_date := now() + (v_billing_days || ' days')::INTERVAL;
  INSERT INTO memberships (user_id, plan_id, status, started_at, current_period_start, current_period_end, next_payment_due, fee) VALUES (v_payment.user_id, v_plan_id, 'ACTIVE', now(), now(), v_end_date, v_end_date, (SELECT monthly_fee FROM membership_plans WHERE id = v_plan_id)) RETURNING id INTO v_membership_id;
END IF;
INSERT INTO notifications (user_id, title, message, type) VALUES (v_payment.user_id, 'Account Activated!', 'Your registration payment has been approved.', 'SUCCESS');
RETURN jsonb_build_object('success', TRUE, 'membership_id', v_membership_id);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION extend_membership(p_membership_id UUID, p_admin_id UUID) RETURNS JSONB AS $$
DECLARE v_membership memberships%ROWTYPE; v_billing_days INTEGER; v_base_date TIMESTAMPTZ; v_new_end TIMESTAMPTZ;
BEGIN
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('ADMIN','SUPER_ADMIN')) THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Admin authorization required'); END IF;
SELECT * INTO v_membership FROM memberships WHERE id = p_membership_id FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Membership not found'); END IF;
SELECT COALESCE((SELECT value::INTEGER FROM site_settings WHERE key = 'membership.billing_cycle_days'), 30) INTO v_billing_days;
v_base_date := CASE WHEN v_membership.current_period_end > now() THEN v_membership.current_period_end ELSE now() END;
v_new_end := v_base_date + (v_billing_days || ' days')::INTERVAL;
UPDATE memberships SET status = 'ACTIVE', current_period_start = now(), current_period_end = v_new_end, next_payment_due = v_new_end WHERE id = p_membership_id;
INSERT INTO notifications (user_id, title, message, type) VALUES (v_membership.user_id, 'Membership Renewed', 'New expiry: ' || v_new_end, 'SUCCESS');
RETURN jsonb_build_object('success', TRUE, 'new_expiry', v_new_end);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
