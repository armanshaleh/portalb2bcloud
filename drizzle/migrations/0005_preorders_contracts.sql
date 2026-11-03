CREATE TABLE public.pre_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 1000),
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'MONTHLY',
  notes text,
  status text NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL','APPROVED','REJECTED')),
  review_note text,
  quotation_id uuid REFERENCES public.billing_documents(id),
  created_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pre_orders_customer_idx ON public.pre_orders(customer_id, created_at DESC);
GRANT SELECT, INSERT ON public.pre_orders TO authenticated;
GRANT ALL ON public.pre_orders TO service_role;
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read pre-orders" ON public.pre_orders FOR SELECT TO authenticated USING (public.owns_customer(customer_id));
CREATE POLICY "Staff read pre-orders" ON public.pre_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners submit pre-orders" ON public.pre_orders FOR INSERT TO authenticated
  WITH CHECK (public.owns_customer(customer_id) AND status = 'PENDING_APPROVAL' AND created_by = auth.uid() AND quotation_id IS NULL AND reviewed_by IS NULL);

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  contract_type text NOT NULL DEFAULT 'MSA' CHECK (contract_type IN ('MSA','SLA','NDA','ADDENDUM','OTHER')),
  file_path text NOT NULL,
  mime_type text NOT NULL,
  start_date date,
  end_date date,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contracts_customer_idx ON public.contracts(customer_id);
GRANT SELECT, INSERT, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read contracts" ON public.contracts FOR SELECT TO authenticated USING (public.owns_customer(customer_id));
CREATE POLICY "Staff read contracts" ON public.contracts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "Staff delete contracts" ON public.contracts FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_contract_added() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, title, body, link)
  SELECT c.user_id, 'New contract available', NEW.title, '/user/contracts' FROM public.customers c WHERE c.id = NEW.customer_id;
  RETURN NEW;
END $$;
CREATE TRIGGER contracts_notify AFTER INSERT ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.notify_contract_added();