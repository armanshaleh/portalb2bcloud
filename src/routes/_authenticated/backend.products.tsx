import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { formatIDR } from "@/lib/format";
import { proRata } from "@/lib/lifecycle";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/backend/products")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Products & pricing · Wise Cloud Backend" },
      { name: "description", content: "Manage the Wise Cloud product catalogue, setup fees and per-customer private prices." },
      { property: "og:title", content: "Products & pricing · Wise Cloud Backend" },
      { property: "og:description", content: "Product catalogue and private customer pricing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/dashboard" });
    return { identity };
  },
  component: Products,
});

const CATS = ["COLOCATION", "DEDICATED_INTERNET", "CLOUD_SERVER", "OTHER"] as const;

function Products() {
  const { identity } = Route.useRouteContext();
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", category: "OTHER" as (typeof CATS)[number], unit_price: "", setup_fee: "" });
  const [price, setPrice] = useState({ customer_id: "", product_id: "", unit_price: "", setup_fee: "" });
  const [calc, setCalc] = useState({ monthly: "", date: "" });

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("code")).data ?? [],
  });
  const customers = useQuery({
    queryKey: ["price-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,customer_code,company_name,full_name").order("customer_code")).data ?? [],
  });
  const prices = useQuery({
    queryKey: ["customer-prices"],
    queryFn: async () =>
      (await supabase.from("customer_prices").select("id,unit_price,setup_fee,customers(customer_code),products(code,name)").order("updated_at", { ascending: false })).data ?? [],
  });

  async function addProduct() {
    if (!form.code.trim() || !form.name.trim()) return void toast.error("Code and name are required.");
    const { error } = await supabase.from("products").insert({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      unit_price: Number(form.unit_price) || 0,
      setup_fee: Number(form.setup_fee) || 0,
    });
    if (error) return void toast.error(error.message);
    setForm({ code: "", name: "", category: "OTHER", unit_price: "", setup_fee: "" });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }
  async function toggle(id: string, is_active: boolean) {
    await supabase.from("products").update({ is_active: !is_active }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["products"] });
  }
  async function savePrice() {
    if (!price.customer_id || !price.product_id || !price.unit_price) return void toast.error("Choose customer, product and price.");
    const { error } = await supabase.from("customer_prices").upsert(
      { customer_id: price.customer_id, product_id: price.product_id, unit_price: Number(price.unit_price), setup_fee: Number(price.setup_fee) || 0, updated_by: identity.userId, updated_at: new Date().toISOString() },
      { onConflict: "customer_id,product_id" },
    );
    if (error) return void toast.error(error.message);
    toast.success("Private price saved (logged in audit trail).");
    void qc.invalidateQueries({ queryKey: ["customer-prices"] });
  }
  async function removePrice(id: string) {
    await supabase.from("customer_prices").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["customer-prices"] });
  }

  const pr = calc.monthly && calc.date ? proRata(Number(calc.monthly), new Date(`${calc.date}T00:00:00Z`)) : null;

  return (
    <AppShell variant="staff" title="Products & pricing" subtitle="Catalogue · private prices · pro-rata" email={identity.email}>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="glass space-y-4 rounded-3xl border p-5">
          <h2 className="font-display font-semibold">Catalogue</h2>
          <div className="grid gap-2 sm:grid-cols-6">
            <Input placeholder="Code (CLC)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={10} />
            <Input className="sm:col-span-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as (typeof CATS)[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Monthly price" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
            <Input type="number" placeholder="Setup fee" value={form.setup_fee} onChange={(e) => setForm({ ...form, setup_fee: e.target.value })} />
          </div>
          <div className="-mt-1 flex justify-start"><Button size="sm" onClick={() => void addProduct()}><Plus className="h-4 w-4" /> Add product</Button></div>
          {products.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
            <div className="divide-y rounded-2xl border">
              {(products.data ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><span className="tabular-nums tracking-tight">{p.code}</span> · {p.name} <span className="text-xs text-muted-foreground">({p.category})</span></div>
                  <div className="flex items-center gap-3">
                    <span>{formatIDR(p.unit_price)} / mo · setup {formatIDR(p.setup_fee)}</span>
                    <button type="button" onClick={() => void toggle(p.id, p.is_active)}>
                      <Badge variant={p.is_active ? "success" : "outline"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass space-y-4 rounded-3xl border p-5">
          <h2 className="font-display font-semibold">Private customer prices</h2>
          <div className="grid gap-2 sm:grid-cols-5">
            <Select value={price.customer_id} onValueChange={(v) => setPrice({ ...price, customer_id: v })}>
              <SelectTrigger className="sm:col-span-2"><SelectValue placeholder="Customer" /></SelectTrigger>
              <SelectContent>{(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.customer_code} · {c.company_name ?? c.full_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={price.product_id} onValueChange={(v) => setPrice({ ...price, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>{(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Price" value={price.unit_price} onChange={(e) => setPrice({ ...price, unit_price: e.target.value })} />
            <Input type="number" placeholder="Setup fee" value={price.setup_fee} onChange={(e) => setPrice({ ...price, setup_fee: e.target.value })} />
          </div>
          <div className="-mt-1 flex justify-start"><Button size="sm" onClick={() => void savePrice()}>Save private price</Button></div>
          <div className="divide-y rounded-2xl border">
            {(prices.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{(p.customers as { customer_code: string } | null)?.customer_code} · {(p.products as { code: string; name: string } | null)?.name}</span>
                <span className="flex items-center gap-3">{formatIDR(p.unit_price)} · setup {formatIDR(p.setup_fee)}
                  <Button size="icon" variant="ghost" onClick={() => void removePrice(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass space-y-5 rounded-3xl border p-5">
          <h2 className="font-display font-semibold">Pro-rata calculator</h2>
          <div className="grid max-w-lg gap-2 sm:grid-cols-2">
            <div className="space-y-2"><Label>Monthly price</Label><Input type="number" value={calc.monthly} onChange={(e) => setCalc({ ...calc, monthly: e.target.value })} /></div>
            <div className="space-y-2"><Label>Activation date</Label><Input type="date" value={calc.date} onChange={(e) => setCalc({ ...calc, date: e.target.value })} /></div>
          </div>
          {pr !== null && <p className="text-sm">First-month charge: <span className="font-semibold">{formatIDR(pr)}</span></p>}
        </section>
      </div>
    </AppShell>
  );
}
