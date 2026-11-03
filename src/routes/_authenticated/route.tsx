import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Integration-owned protected-route gate: client-only (the session lives in
// browser storage), redirects unauthenticated users to /auth before children render.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
