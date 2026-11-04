import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { getMyIdentity } from "@/lib/identity.functions";
import {
  deleteMonitor,
  getKumaWebhookConfig,
  listAllMonitors,
  saveMonitor,
  setMonitorAssignments,
  type StaffMonitor,
} from "@/lib/monitor.functions";
import { AppShell } from "@/components/app-shell";
import { MonitorCard } from "@/components/monitor-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROJECT_ID = "03ed1e1c-68f4-48e3-b049-b71bf7d4b0de";
const WEBHOOK_URL = `https://project--${PROJECT_ID}.lovable.app/api/public/uptime/webhook`;

export const Route = createFileRoute("/_authenticated/backend/monitors")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Network monitor · Wise Cloud Backend" },
      { name: "description", content: "Manage Uptime Kuma monitors and choose which customers can see each one." },
      { property: "og:title", content: "Network monitor · Wise Cloud Backend" },
      { property: "og:description", content: "Uptime monitors with per-customer visibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/network" });
    return { identity };
  },
  component: BackendMonitors,
});

type Draft = { id?: string; name: string; location: string; category: "FACILITY" | "DEDICATED" | "TRANSIT"; kumaId: string };
const EMPTY: Draft = { name: "", location: "", category: "FACILITY", kumaId: "" };

function BackendMonitors() {
  const { identity } = Route.useRouteContext();
  const listFn = useServerFn(listAllMonitors);
  const saveFn = useServerFn(saveMonitor);
  const deleteFn = useServerFn(deleteMonitor);
  const assignFn = useServerFn(setMonitorAssignments);
  const configFn = useServerFn(getKumaWebhookConfig);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["all-monitors"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });
  const config = useQuery({ queryKey: ["kuma-config"], queryFn: () => configFn() });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [assigning, setAssigning] = useState<StaffMonitor | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const monitors = data?.monitors ?? [];
  const customers = data?.customers ?? [];

  async function handleSave() {
    if (!draft) return;
    const kuma = draft.kumaId.trim() ? Number(draft.kumaId) : null;
    if (kuma !== null && (!Number.isInteger(kuma) || kuma <= 0)) {
      toast.error("Uptime Kuma monitor ID must be a positive number.");
      return;
    }
    setBusy(true);
    const res = await saveFn({
      data: { id: draft.id, name: draft.name, location: draft.location, category: draft.category, kumaMonitorId: kuma },
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Monitor saved.");
    setDraft(null);
    void refetch();
  }

  async function handleDelete(m: StaffMonitor) {
    if (!window.confirm(`Delete monitor "${m.name}"? Its history and customer access are removed.`)) return;
    const res = await deleteFn({ data: { id: m.id } });
    if (!res.ok) return void toast.error("Could not delete the monitor.");
    toast.success("Monitor deleted.");
    void refetch();
  }

  async function handleAssign() {
    if (!assigning) return;
    setBusy(true);
    const res = await assignFn({ data: { monitorId: assigning.id, customerIds: [...selected] } });
    setBusy(false);
    if (!res.ok) return void toast.error("Could not update access.");
    toast.success("Customer access updated.");
    setAssigning(null);
    void refetch();
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("Copied.");
  }

  const filteredCustomers = customers.filter((c) =>
    `${c.code} ${c.label}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <AppShell
      variant="staff"
      title="Network monitor"
      subtitle="Uptime Kuma engine · customers only see monitors you assign"
      email={identity.email}
      actions={
        <Button size="sm" onClick={() => setDraft(EMPTY)}>
          <Plus /> Add monitor
        </Button>
      }
    >
      <div className="space-y-6">
        {config.data?.allowed && (
          <div className="glass space-y-5 rounded-3xl border p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="font-display font-semibold">Uptime Kuma connection</p>
            </div>
            <p className="text-sm text-muted-foreground">
              In Uptime Kuma, add a <b>Webhook</b> notification (body: <i>application/json</i>), set the URL below,
              and in <i>Additional Headers</i> paste{" "}
              <code className="rounded bg-muted px-1">{`{"Authorization": "Bearer <token>"}`}</code>. Then attach
              it to each monitor and enter that monitor's Kuma ID here.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <Input readOnly value={WEBHOOK_URL} className="tabular-nums tracking-tight text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(WEBHOOK_URL)} aria-label="Copy URL">
                  <Copy />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  type={showToken ? "text" : "password"}
                  value={config.data.token ?? "not configured"}
                  className="tabular-nums tracking-tight text-xs"
                  onFocus={() => setShowToken(true)}
                  onBlur={() => setShowToken(false)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => config.data?.token && copy(config.data.token)}
                  aria-label="Copy token"
                >
                  <Copy />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The webhook URL works once the portal is published.</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="glass rounded-3xl border py-16 text-center text-sm text-muted-foreground">
            No monitors yet. Add one (e.g. "Core Switch DC-1") and link its Uptime Kuma ID.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {monitors.map((m) => (
              <MonitorCard
                key={m.id}
                m={m}
                footer={
                  <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      Kuma #{m.kuma_monitor_id ?? "—"} · {m.customerIds.length} customer
                      {m.customerIds.length === 1 ? "" : "s"}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAssigning(m);
                          setSelected(new Set(m.customerIds));
                          setFilter("");
                        }}
                      >
                        <Users /> Access
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit monitor"
                        onClick={() =>
                          setDraft({
                            id: m.id,
                            name: m.name,
                            location: m.location ?? "",
                            category: m.category as Draft["category"],
                            kumaId: m.kuma_monitor_id ? String(m.kuma_monitor_id) : "",
                          })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete monitor" onClick={() => void handleDelete(m)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit monitor" : "Add monitor"}</DialogTitle>
            <DialogDescription>Link a monitor from your Uptime Kuma engine.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" value={draft.name} placeholder="Core Switch DC-1" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="m-loc">Location</Label>
                  <Input id="m-loc" value={draft.location} placeholder="DC-1 Jakarta" onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as Draft["category"] })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FACILITY">Facility / global</SelectItem>
                      <SelectItem value="DEDICATED">Dedicated (client)</SelectItem>
                      <SelectItem value="TRANSIT">Transit / peering</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-kuma">Uptime Kuma monitor ID</Label>
                <Input id="m-kuma" inputMode="numeric" value={draft.kumaId} placeholder="e.g. 12" onChange={(e) => setDraft({ ...draft, kumaId: e.target.value })} />
              </div>
              <Button className="w-full" disabled={busy || !draft.name.trim()} onClick={() => void handleSave()}>
                {busy && <Loader2 className="animate-spin" />} Save monitor
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assigning)} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Who can see “{assigning?.name}”?</DialogTitle>
            <DialogDescription>Only checked customers see this monitor. Everyone else never sees it.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Search customers" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {filteredCustomers.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No customers found.</p>}
            {filteredCustomers.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-accent">
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(c.id);
                    else next.delete(c.id);
                    setSelected(next);
                  }}
                />
                <span className="text-sm">{c.label}</span>
                <span className="ml-auto tabular-nums tracking-tight text-xs text-muted-foreground">{c.code}</span>
              </label>
            ))}
          </div>
          <Button disabled={busy} onClick={() => void handleAssign()}>
            {busy && <Loader2 className="animate-spin" />} Save access ({selected.size})
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
