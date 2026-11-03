CREATE TYPE public.ticket_category AS ENUM ('GENERAL','TECHNICAL','VISIT_DC','GOODS_IN','GOODS_OUT','REACTIVATION','BILLING');
CREATE TYPE public.ticket_status AS ENUM ('OPEN','IN_PROGRESS','APPROVED','REJECTED','CLOSED');

CREATE TABLE public.ticket_counters (yr smallint PRIMARY KEY, last_seq integer NOT NULL DEFAULT 0);
GRANT ALL ON public.ticket_counters TO service_role;
ALTER TABLE public.ticket_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  created_by uuid,
  category public.ticket_category NOT NULL DEFAULT 'GENERAL',
  subject text NOT NULL,
  description text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachment_path text,
  status public.ticket_status NOT NULL DEFAULT 'OPEN',
  epass_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  is_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tickets, public.ticket_messages TO authenticated;
GRANT UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets, public.ticket_messages TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read tickets" ON public.tickets FOR SELECT TO authenticated USING (public.owns_customer(customer_id));
CREATE POLICY "Staff read tickets" ON public.tickets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners open tickets" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (public.owns_customer(customer_id) AND status = 'OPEN' AND epass_code IS NULL AND created_by = auth.uid());
CREATE POLICY "Staff update tickets" ON public.tickets FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Read messages of visible tickets" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (public.owns_customer(t.customer_id) OR public.is_staff(auth.uid()))));
CREATE POLICY "Post messages on visible tickets" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND is_staff = public.is_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (public.owns_customer(t.customer_id) OR public.is_staff(auth.uid()))));

CREATE OR REPLACE FUNCTION public.assign_ticket_no() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y smallint := extract(year FROM now()); seq integer;
BEGIN
  INSERT INTO public.ticket_counters(yr, last_seq) VALUES (y, 1)
  ON CONFLICT (yr) DO UPDATE SET last_seq = ticket_counters.last_seq + 1 RETURNING last_seq INTO seq;
  NEW.ticket_no := 'TCK-' || y || '-' || lpad(seq::text, 5, '0');
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_number BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.assign_ticket_no();
CREATE TRIGGER tickets_touch BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.notify_ticket_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(user_id, title, body, link)
    SELECT c.user_id, 'Ticket ' || NEW.ticket_no || ' · ' || NEW.status::text, NEW.subject, '/user/tickets'
    FROM public.customers c WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_notify AFTER UPDATE OF status ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_update();

CREATE OR REPLACE FUNCTION public.notify_ticket_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_staff THEN
    INSERT INTO public.notifications(user_id, title, body, link)
    SELECT c.user_id, 'Reply on ' || t.ticket_no, left(NEW.body, 160), '/user/tickets'
    FROM public.tickets t JOIN public.customers c ON c.id = t.customer_id WHERE t.id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ticket_messages_notify AFTER INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_message();

CREATE TYPE public.payment_kind AS ENUM ('PROOF_OF_TRANSFER','PPH23_CERTIFICATE','SIGNED_DOCUMENT');
CREATE TABLE public.billing_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.billing_documents(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  kind public.payment_kind NOT NULL,
  storage_path text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  status public.legal_doc_status NOT NULL DEFAULT 'PENDING',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_attachments TO authenticated;
GRANT ALL ON public.billing_attachments TO service_role;
ALTER TABLE public.billing_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read attachments" ON public.billing_attachments FOR SELECT TO authenticated USING (public.owns_customer(customer_id));
CREATE POLICY "Staff read attachments" ON public.billing_attachments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

ALTER TABLE public.billing_documents ADD COLUMN lifecycle_stage text;

CREATE TABLE public.customer_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL,
  setup_fee numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_prices TO authenticated;
GRANT ALL ON public.customer_prices TO service_role;
ALTER TABLE public.customer_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage prices" ON public.customer_prices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Owners read own prices" ON public.customer_prices FOR SELECT TO authenticated USING (public.owns_customer(customer_id));

CREATE OR REPLACE FUNCTION public.audit_customer_price() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'price.' || lower(TG_OP), 'customer_price', COALESCE(NEW.id, OLD.id),
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER customer_prices_audit AFTER INSERT OR UPDATE OR DELETE ON public.customer_prices FOR EACH ROW EXECUTE FUNCTION public.audit_customer_price();
REVOKE EXECUTE ON FUNCTION public.assign_ticket_no(), public.notify_ticket_update(), public.notify_ticket_message(), public.audit_customer_price() FROM PUBLIC, anon, authenticated;