import { useQuery } from "@tanstack/react-query";
import { Activity, LifeBuoy, Receipt, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { ChartContainer } from "@/components/ui/chart";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()], invoiced: 0, paid: 0 };
  });
}

function compact(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}M`;
  if (v >= 1e6) return `${Number((v / 1e6).toFixed(1))}jt`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}rb`;
  return String(v);
}

function Kpi({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-3xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GlassTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border px-3 py-2 text-xs">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span> {typeof p.value === "number" && p.value > 1000 ? formatIDR(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

const PIE_COLORS = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-destructive)", "var(--color-muted-foreground)", "var(--color-accent-foreground)", "var(--color-ring)"];

function useOverviewData() {
  return useQuery({
    queryKey: ["overview-charts"],
    queryFn: async () => {
      const [docs, tickets, monitors, customers] = await Promise.all([
        supabase.from("billing_documents").select("doc_type,status,total,issue_date"),
        supabase.from("tickets").select("category,status"),
        supabase.from("network_monitors").select("status,is_active"),
        supabase.from("customers").select("status,customer_type"),
      ]);
      return {
        docs: docs.data ?? [],
        tickets: tickets.data ?? [],
        monitors: monitors.data ?? [],
        customers: customers.data ?? [],
      };
    },
  });
}

export function OverviewCharts({ variant }: { variant: "staff" | "client" }) {
  const { data } = useOverviewData();
  const docs = data?.docs ?? [];
  const invoices = docs.filter((d) => d.doc_type === "INV" && d.status !== "CANCELLED" && d.status !== "PENDING_APPROVAL");
  const months = lastSixMonths();
  for (const d of invoices) {
    const dt = new Date(d.issue_date);
    const m = months.find((x) => x.key === `${dt.getFullYear()}-${dt.getMonth()}`);
    if (!m) continue;
    m.invoiced += Number(d.total);
    if (d.status === "PAID") m.paid += Number(d.total);
  }
  const outstanding = invoices.filter((d) => d.status !== "PAID").reduce((s, d) => s + Number(d.total), 0);
  const paidTotal = invoices.filter((d) => d.status === "PAID").reduce((s, d) => s + Number(d.total), 0);
  const tickets = data?.tickets ?? [];
  const openTickets = tickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length;
  const byCat = Object.entries(
    tickets.reduce<Record<string, number>>((acc, t) => ((acc[t.category] = (acc[t.category] ?? 0) + 1), acc), {}),
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  const mons = (data?.monitors ?? []).filter((m) => m.is_active);
  const up = mons.filter((m) => m.status === "UP").length;
  const customers = data?.customers ?? [];
  const verified = customers.filter((c) => c.status === "VERIFIED").length;
  const pending = customers.filter((c) => c.status === "PENDING_VERIFICATION").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {variant === "staff" ? (
          <Kpi icon={Users} label="Active customers" value={String(verified)} hint={`${pending} waiting for verification`} />
        ) : (
          <Kpi icon={Wallet} label="Outstanding" value={formatIDR(outstanding)} hint="Unpaid invoices" />
        )}
        <Kpi icon={Receipt} label={variant === "staff" ? "Paid revenue" : "Total paid"} value={formatIDR(paidTotal)} hint={variant === "staff" ? `Outstanding ${formatIDR(outstanding)}` : `${invoices.length} invoices`} />
        <Kpi icon={LifeBuoy} label="Open tickets" value={String(openTickets)} hint={`${tickets.length} tickets total`} />
        <Kpi icon={Activity} label="Network" value={mons.length ? `${up}/${mons.length} up` : "—"} hint={mons.length ? `${Math.round((up / mons.length) * 100)}% healthy` : "No monitors assigned"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-3xl border p-5 lg:col-span-2">
          <p className="font-display font-semibold">{variant === "staff" ? "Invoiced vs paid" : "Your spending"}</p>
          <p className="text-xs text-muted-foreground">Last 6 months · IDR</p>
          <ChartContainer config={{ invoiced: { label: "Invoiced" }, paid: { label: "Paid" } }} className="mt-4 aspect-auto h-64 w-full">
            <AreaChart data={months} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={44} fontSize={12} />
              <Tooltip content={<GlassTooltip />} />
              <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="var(--color-primary)" strokeWidth={2} fill="url(#gInv)" />
              <Area type="monotone" dataKey="paid" name="Paid" stroke="var(--color-success)" strokeWidth={2} fill="url(#gPaid)" />
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="glass rounded-3xl border p-5">
          <p className="font-display font-semibold">Tickets by category</p>
          <p className="text-xs text-muted-foreground">All time</p>
          {byCat.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No tickets yet.</p>
          ) : variant === "staff" ? (
            <ChartContainer config={{}} className="mt-4 aspect-auto h-64 w-full">
              <PieChart>
                <Tooltip content={<GlassTooltip />} />
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                  {byCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <ChartContainer config={{}} className="mt-4 aspect-auto h-64 w-full">
              <BarChart data={byCat} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip content={<GlassTooltip />} cursor={{ fillOpacity: 0.05 }} />
                <Bar dataKey="value" name="Tickets" fill="var(--color-primary)" radius={8} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          )}
          {variant === "staff" && byCat.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {byCat.map((c, i) => (
                <span key={c.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {c.name} ({c.value})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
