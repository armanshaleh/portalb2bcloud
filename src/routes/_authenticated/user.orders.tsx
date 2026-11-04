import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { formatDate, formatIDR } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/user/orders")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Order service · Wise Cloud Portal" },
      { name: "description", content: "Request new Wise Cloud colocation, internet or cloud services." },
      { property: "og:title", content: "Order service · Wise Cloud Portal" },
      { property: "og:description", content: "Submit a pre-order for new services." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (identity.isStaff) throw redirect({ to: "/backend/orders" });
    return { identity };
  },
  component: UserOrders,
});

const CYCLES = ["MONTHLY", "QUARTERLY", "ANNUALLY"] as const;
export const ORDER_BADGE = { PENDING_APPROVAL: "warning", APPROVED: "success", REJECTED: "danger" } as const;

function UserOrders() {
  const { identity } = Route.useRouteContext();
  const qc = useQueryClient();
  const [form, setForm] = useState({ product_id: "", quantity: "1", billing_cycle: "MONTHLY" as (typeof CYCLES)[number], notes: "" });
  const [busy, setBusy] = useState(false);

  const me = useQuery({
    queryKey: ["me-customer"],
    queryFn: async () => (await supabase.from("customers").select("id,status").eq("user_id", identity.userId).maybeSingle()).data,
  });
  const products = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => (await supabase.from("products").select("id,code,name,unit_price,setup_fee").eq("is_active", true).order("name")).data ?? [],
  });
  const orders = useQuery({
    queryKey: ["pre-orders", "mine"],
    queryFn: async () => (await supabase.from("pre_orders").select("*, products(name)").order("created_at", { ascending: false })).data ?? [],
  });

  async function submit() {
    const qty = Number(form.quantity);
    if (!me.data || !form.product_id || !Number.isInteger(qty) || qty < 1 || qty > 1000) { toast.error("Choose a service and a valid quantity."); return; }
    setBusy(true);
    const { error } = await supabase.from("pre_orders").insert({
      customer_id: me.data.id, product_id: form.product_id, quantity: qty, billing_cycle: form.billing_cycle,
      notes: form.notes.trim().slice(0, 1000) || null, created_by: identity.userId,
    });
    setBusy(false);
    if (error) { toast.error("Could not submit the order."); return; }
    toast.success("Order submitted. We'll review it and send a quotation.");
    setForm({ ...form, notes: "", quantity: "1" });
    void qc.invalidateQueries({ queryKey: ["pre-orders"] });
  }

  const verified = me.data?.status === "VERIFIED";

  return (
    <AppShell variant="client" title="Order service" subtitle="Request new services" email={identity.email}>
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[340px_1fr]">
        <div className="glass space-y-3 rounded-3xl border p-5">
          <p className="font-semibold">New order</p>
          {!verified && <p className="text-xs text-muted-foreground">Ordering opens once your account is verified.</p>}
          <div className="space-y-2.5"><Label>Service</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
              <SelectContent>{(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatIDR(p.unit_price)}/mo</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2.5"><Label>Quantity</Label><Input type="number" min={1} max={1000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div className="space-y-2.5"><Label>Billing</Label>
              <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v as (typeof CYCLES)[number] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CYCLES.map((c) => <SelectItem key={c} value={c}>{c.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2.5"><Label>Notes</Label><Textarea value={form.notes} maxLength={1000} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button className="w-full" disabled={busy || !verified} onClick={() => void submit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} Submit order
          </Button>
          <p className="text-xs text-muted-foreground">Final prices, VAT and setup fees appear on the quotation.</p>
        </div>
        <div className="glass overflow-hidden rounded-3xl border">
          {(orders.data ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            (orders.data ?? []).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 border-b px-5 py-4 last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{(o.products as { name: string } | null)?.name} × {o.quantity}</p>
                  <p className="text-xs text-muted-foreground">{o.billing_cycle.toLowerCase()} · {formatDate(o.created_at)}{o.review_note ? ` · ${o.review_note}` : ""}</p>
                </div>
                <Badge variant={ORDER_BADGE[o.status as keyof typeof ORDER_BADGE]}>{o.status.replace("_", " ").toLowerCase()}</Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
