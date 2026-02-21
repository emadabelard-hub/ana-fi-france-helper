
-- TIGHTEN ALL RLS: public -> authenticated for data isolation

-- === invoice_drafts ===
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.invoice_drafts;
DROP POLICY IF EXISTS "Users can insert their own drafts" ON public.invoice_drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.invoice_drafts;
DROP POLICY IF EXISTS "Users can view their own drafts" ON public.invoice_drafts;
CREATE POLICY "Users can view their own drafts" ON public.invoice_drafts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own drafts" ON public.invoice_drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own drafts" ON public.invoice_drafts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own drafts" ON public.invoice_drafts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- === profiles ===
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- === service_requests ===
DROP POLICY IF EXISTS "Admins can update all requests" ON public.service_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.service_requests;
DROP POLICY IF EXISTS "Users can create their own requests" ON public.service_requests;
DROP POLICY IF EXISTS "Users can update their own pending requests" ON public.service_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.service_requests;
CREATE POLICY "Users can view their own requests" ON public.service_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own requests" ON public.service_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pending requests" ON public.service_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all requests" ON public.service_requests FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can update all requests" ON public.service_requests FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- === transactions ===
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- === transfer_waitlist ===
DROP POLICY IF EXISTS "Admins can view waitlist" ON public.transfer_waitlist;
DROP POLICY IF EXISTS "Anyone can insert into waitlist with valid email" ON public.transfer_waitlist;
CREATE POLICY "Admins can view waitlist" ON public.transfer_waitlist FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Authenticated users can insert into waitlist" ON public.transfer_waitlist FOR INSERT TO authenticated WITH CHECK (true);

-- === visit_logs ===
DROP POLICY IF EXISTS "Admins can view visit logs" ON public.visit_logs;
DROP POLICY IF EXISTS "Authenticated users can log visits" ON public.visit_logs;
CREATE POLICY "Admins can view visit logs" ON public.visit_logs FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Authenticated users can log visits" ON public.visit_logs FOR INSERT TO authenticated WITH CHECK (true);
