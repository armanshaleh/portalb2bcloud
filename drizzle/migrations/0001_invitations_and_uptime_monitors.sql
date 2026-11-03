CREATE TABLE public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  customer_type public.customer_type NOT NULL,
  display_name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_invitations TO authenticated;
GRANT ALL ON public.client_invitations TO service_role;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read invitations" ON public.client_invitations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create invitations" ON public.client_invitations FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update invitations" ON public.client_invitations FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TYPE public.monitor_status AS ENUM ('UP','DOWN','DEGRADED','MAINTENANCE','PENDING');

CREATE TABLE public.network_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  category text NOT NULL DEFAULT 'FACILITY',
  kuma_monitor_id integer UNIQUE,
  status public.monitor_status NOT NULL DEFAULT 'PENDING',
  last_latency_ms numeric,
  last_checked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_monitors TO authenticated;
GRANT ALL ON public.network_monitors TO service_role;
ALTER TABLE public.network_monitors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.monitor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES public.network_monitors(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (monitor_id, customer_id)
);
GRANT SELECT, INSERT, DELETE ON public.monitor_assignments TO authenticated;
GRANT ALL ON public.monitor_assignments TO service_role;
ALTER TABLE public.monitor_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.monitor_heartbeats (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monitor_id uuid NOT NULL REFERENCES public.network_monitors(id) ON DELETE CASCADE,
  status public.monitor_status NOT NULL,
  latency_ms numeric,
  message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX monitor_heartbeats_monitor_time_idx ON public.monitor_heartbeats (monitor_id, checked_at DESC);
GRANT SELECT ON public.monitor_heartbeats TO authenticated;
GRANT ALL ON public.monitor_heartbeats TO service_role;
ALTER TABLE public.monitor_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_monitor(_monitor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.monitor_assignments a
    JOIN public.customers c ON c.id = a.customer_id
    WHERE a.monitor_id = _monitor_id AND c.user_id = auth.uid()
  )
$$;

CREATE POLICY "Staff manage monitors" ON public.network_monitors FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Assigned clients read monitors" ON public.network_monitors FOR SELECT TO authenticated USING (public.can_view_monitor(id));
CREATE POLICY "Staff manage assignments" ON public.monitor_assignments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Clients read own assignments" ON public.monitor_assignments FOR SELECT TO authenticated USING (public.owns_customer(customer_id));
CREATE POLICY "Viewers read heartbeats" ON public.monitor_heartbeats FOR SELECT TO authenticated USING (public.can_view_monitor(monitor_id));