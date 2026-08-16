-- 004_storage.sql
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false), ('task-proofs', 'task-proofs', false), ('payout-proofs', 'payout-proofs', false), ('profile-images', 'profile-images', true), ('site-assets', 'site-assets', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Users can upload own payment proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own payment proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can read all payment proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND is_admin());
CREATE POLICY "Users can upload own task proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own task proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can read all task proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-proofs' AND is_admin());
CREATE POLICY "Admins can upload payout proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payout-proofs' AND is_admin());
CREATE POLICY "Admins can read payout proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payout-proofs' AND is_admin());
CREATE POLICY "Anyone can read profile images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'profile-images');
CREATE POLICY "Users can upload own profile images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own profile images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can read site assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'site-assets');
CREATE POLICY "Admins can upload site assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-assets' AND is_admin());
CREATE POLICY "Admins can update site assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-assets' AND is_admin());
