CREATE TYPE public.announcement_category AS ENUM ('MAINTENANCE','NETWORK_UPGRADE','INCIDENT','GENERAL');

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category public.announcement_category NOT NULL DEFAULT 'GENERAL',
  is_published boolean NOT NULL DEFAULT true,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read published announcements" ON public.announcements FOR SELECT TO authenticated USING (is_published OR public.is_staff(auth.uid()));
CREATE POLICY "Staff insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_customer_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(user_id, title, body, link) VALUES (
      NEW.user_id,
      CASE NEW.status WHEN 'VERIFIED' THEN 'Account verified' WHEN 'REJECTED' THEN 'Verification rejected' WHEN 'SUSPENDED' THEN 'Account suspended' ELSE 'Account status updated' END,
      CASE WHEN NEW.status = 'REJECTED' THEN COALESCE(NEW.rejection_reason, 'Please review your documents.') ELSE 'Your account status is now ' || NEW.status::text || '.' END,
      '/user/dashboard');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customers_notify_status AFTER UPDATE OF status ON public.customers FOR EACH ROW EXECUTE FUNCTION public.notify_customer_status();

CREATE OR REPLACE FUNCTION public.notify_monitor_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, title, body, link)
  SELECT c.user_id, 'New network monitor available', 'You can now view "' || m.name || '".', '/user/network'
  FROM public.customers c, public.network_monitors m WHERE c.id = NEW.customer_id AND m.id = NEW.monitor_id;
  RETURN NEW;
END $$;
CREATE TRIGGER monitor_assignment_notify AFTER INSERT ON public.monitor_assignments FOR EACH ROW EXECUTE FUNCTION public.notify_monitor_assignment();

CREATE OR REPLACE FUNCTION public.notify_announcement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
    INSERT INTO public.notifications(user_id, title, body, link)
    SELECT c.user_id, 'Announcement: ' || NEW.title, left(NEW.body, 160), '/user/announcements'
    FROM public.customers c WHERE c.status = 'VERIFIED';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER announcement_notify AFTER INSERT OR UPDATE OF is_published ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();
REVOKE EXECUTE ON FUNCTION public.notify_customer_status(), public.notify_monitor_assignment(), public.notify_announcement() FROM PUBLIC, anon, authenticated;