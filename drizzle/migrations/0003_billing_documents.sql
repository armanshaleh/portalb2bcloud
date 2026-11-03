CREATE TYPE public.billing_doc_type AS ENUM ('QUO','INV','PO','FMO','REC');
CREATE TYPE public.billing_doc_status AS ENUM ('PENDING_APPROVAL','APPROVED','REJECTED','SENT','PAID','CANCELLED');

CREATE TABLE public.billing_doc_counters (
  doc_type public.billing_doc_type NOT NULL,
  customer_type public.customer_type NOT NULL,
  doc_year smallint NOT NULL,
  doc_month smallint NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, customer_type, doc_year, doc_month)
);
GRANT ALL ON public.billing_doc_counters TO service_role;
ALTER TABLE public.billing_doc_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.billing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type public.billing_doc_type NOT NULL,
  doc_number text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  status public.billing_doc_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  dpp numeric NOT NULL DEFAULT 0,
  vat numeric NOT NULL DEFAULT 0,
  stamp_duty numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  revision_note text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.billing_documents(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.billing_documents, public.billing_items TO authenticated;
GRANT ALL ON public.billing_documents, public.billing_items TO service_role;
ALTER TABLE public.billing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read billing docs" ON public.billing_documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners read released docs" ON public.billing_documents FOR SELECT TO authenticated
  USING (public.owns_customer(customer_id) AND status IN ('APPROVED','SENT','PAID'));
CREATE POLICY "Read items of visible docs" ON public.billing_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.billing_documents d WHERE d.id = document_id
    AND (public.is_staff(auth.uid()) OR (public.owns_customer(d.customer_id) AND d.status IN ('APPROVED','SENT','PAID')))));

CREATE OR REPLACE FUNCTION public.assign_billing_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ctype public.customer_type; y smallint; m smallint; seq integer;
  romans text[] := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
BEGIN
  SELECT customer_type INTO ctype FROM public.customers WHERE id = NEW.customer_id;
  y := extract(year FROM NEW.issue_date); m := extract(month FROM NEW.issue_date);
  INSERT INTO public.billing_doc_counters(doc_type, customer_type, doc_year, doc_month, last_seq)
  VALUES (NEW.doc_type, ctype, y, m, 1)
  ON CONFLICT (doc_type, customer_type, doc_year, doc_month) DO UPDATE SET last_seq = billing_doc_counters.last_seq + 1
  RETURNING last_seq INTO seq;
  NEW.doc_number := NEW.doc_type::text || '-' || ctype::text || '/ATT/' || y || '/' || romans[m] || '/' || lpad(seq::text, 4, '0');
  RETURN NEW;
END $$;
CREATE TRIGGER billing_documents_number BEFORE INSERT ON public.billing_documents FOR EACH ROW EXECUTE FUNCTION public.assign_billing_number();

CREATE OR REPLACE FUNCTION public.notify_billing_release() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('APPROVED','SENT') AND OLD.status = 'PENDING_APPROVAL' THEN
    INSERT INTO public.notifications(user_id, title, body, link)
    SELECT c.user_id, 'New document: ' || NEW.doc_number, 'Total ' || to_char(NEW.total, 'FM999G999G999G990') || ' IDR', '/user/billing'
    FROM public.customers c WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER billing_documents_notify AFTER UPDATE OF status ON public.billing_documents FOR EACH ROW EXECUTE FUNCTION public.notify_billing_release();
REVOKE EXECUTE ON FUNCTION public.assign_billing_number(), public.notify_billing_release() FROM PUBLIC, anon, authenticated;