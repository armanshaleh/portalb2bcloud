import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Loader2 } from "lucide-react";

import { getMyIdentity } from "@/lib/identity.functions";
import { listMyMonitors } from "@/lib/monitor.functions";
import { AppShell } from "@/components/app-shell";
import { MonitorCard } from "@/components/monitor-card";

export const Route = createFileRoute("/_authenticated/user/network")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Network status · Wise Cloud Portal" },
      { name: "description", content: "Live availability and latency of the Wise Cloud network assigned to your account." },
      { property: "og:title", content: "Network status · Wise Cloud Portal" },
      { property: "og:description", content: "Live availability and latency of your assigned Wise Cloud network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (identity.isStaff) throw redirect({ to: "/backend/monitors" });
    return { identity };
  },
  component: UserNetwork,
});

function UserNetwork() {
  const { identity } = Route.useRouteContext();
  const listFn = useServerFn(listMyMonitors);
  const { data, isLoading } = useQuery({
    queryKey: ["my-monitors"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });
  const monitors = data?.monitors ?? [];
  const down = monitors.filter((m) => m.status === "DOWN").length;

  return (
    <AppShell variant="client" title="Network status" subtitle="Availability & latency · refreshes every 30s" email={identity.email}>
      <div className="mx-auto max-w-6xl space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl border py-16 text-center">
            <Activity className="h-8 w-8 text-primary" />
            <p className="font-medium">No network monitors are assigned to your account yet.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Our NOC team enables the facilities and endpoints relevant to your services.
            </p>
          </div>
        ) : (
          <>
            <div
              className={`glass rounded-3xl border p-5 ${down ? "text-destructive" : "text-success"}`}
            >
              <p className="font-display text-lg font-bold">
                {down ? `${down} monitor${down > 1 ? "s" : ""} reporting an outage` : "All assigned systems operational"}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {monitors.map((m) => (
                <MonitorCard key={m.id} m={m} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
