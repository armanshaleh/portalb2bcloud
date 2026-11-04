import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/backend/audit-logs")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Audit logs · Wise Cloud Backend" },
      { name: "description", content: "Searchable history of staff and system activity." },
      { property: "og:title", content: "Audit logs · Wise Cloud Backend" },
      { property: "og:description", content: "Who did what, and when, across the portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/dashboard" });
    return { identity };
  },
  component: AuditLogs,
});

type Log = {
  id: string; actor_id: string | null; actor_email: string | null; action: string;
  entity_type: string; entity_id: string | null; details: unknown; created_at: string;
};

function daysAgo(n: number) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function AuditLogs() {
  const { identity } = Route.useRouteContext();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [open, setOpen] = useState<Log | null>(null);

  const logs = useQuery({
    queryKey: ["audit-logs", from, to],
    queryFn: async () =>
      ((await supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(500)).data ?? []) as Log[],
  });

  const types = useMemo(() => ["ALL", ...Array.from(new Set((logs.data ?? []).map((l) => l.entity_type))).sort()], [logs.data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (logs.data ?? []).filter((l) =>
      (type === "ALL" || l.entity_type === type) &&
      (!s || `${l.action} ${l.actor_email ?? ""} ${l.entity_id ?? ""}`.toLowerCase().includes(s)));
  }, [logs.data, q, type]);

  return (
    <AppShell variant="staff" title="Audit logs" subtitle="Staff & system activity" email={identity.email}>
      <div className="mx-auto max-w-6xl">
        <div className="glass overflow-hidden rounded-3xl border">
          <div className="flex flex-wrap items-center gap-4 border-b border-border/50 px-5 py-4">
            <div className="flex items-center gap-2"><Label className="text-sm text-muted-foreground">From</Label><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Label className="text-sm text-muted-foreground">To</Label><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-xl border bg-card/60 px-3 text-sm">
              {types.map((t) => <option key={t} value={t}>{t === "ALL" ? "All types" : t}</option>)}
            </select>
            <Input placeholder="Search action, email…" className="ml-auto w-56" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">{["Time", "Actor", "Action", "Target", ""].map((t, i) => <th key={i} className="px-5 py-3 font-medium">{t}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums">{new Date(l.created_at).toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 text-xs">{l.actor_email ?? (l.actor_id ? l.actor_id.slice(0, 8) : "System")}</td>
                    <td className="px-5 py-3"><Badge variant="secondary">{l.action}</Badge></td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{l.entity_type}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}</td>
                    <td className="px-5 py-3 text-right">
                      {l.details ? <button className="text-xs text-primary hover:underline" onClick={() => setOpen(l)}>Details</button> : null}
                    </td>
                  </tr>
                ))}
                {!logs.isLoading && rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No activity in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.action}</DialogTitle></DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-xl bg-muted/50 p-4 text-xs">{JSON.stringify(open?.details, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
