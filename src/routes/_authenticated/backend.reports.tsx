import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { formatDate, formatIDR } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/backend/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reports · Wise Cloud Backend" },
      { name: "description", content: "Revenue, receivables and customer reports with Excel export." },
      { property: "og:title", content: "Reports · Wise Cloud Backend" },
      { property: "og:description", content: "Billing analytics and Excel export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/dashboard" });
    return { identity };
  },
  component: Reports,
});

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function Reports() {
  const { identity } = Route.useRouteContext();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const docs = useQuery({
    queryKey: ["report-docs", from, to],
    queryFn: async () =>
      (await supabase
        .from("billing_documents")
        .select("doc_number,doc_type,status,subtotal,dpp,vat,stamp_duty,total,due_date,created_at,customers(customer_code,company_name,full_name)")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at")).data ?? [],
  });
  const customers = useQuery({
    queryKey: ["report-customers"],
    queryFn: async () => (await supabase.from("customers").select("customer_code,customer_type,status,company_name,full_name,email,created_at").order("customer_code")).data ?? [],
  });

  const stats = useMemo(() => {
    const inv = (docs.data ?? []).filter((d) => d.doc_type === "INV" && d.status !== "CANCELLED" && d.status !== "REJECTED");
    const sum = (arr: typeof inv) => arr.reduce((s, d) => s + Number(d.total), 0);
    return {
      invoiced: sum(inv),
      paid: sum(inv.filter((d) => d.status === "PAID")),
      outstanding: sum(inv.filter((d) => d.status !== "PAID")),
      vat: inv.reduce((s, d) => s + Number(d.vat), 0),
    };
  }, [docs.data]);

  async function exportXlsx() {
    setBusy(true);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const h = (v: string) => ({ value: v, fontWeight: "bold" as const });
      const docRows = [
        ["Number", "Type", "Status", "Customer", "Subtotal (IDR)", "DPP (IDR)", "VAT (IDR)", "e-Meterai (IDR)", "Total (IDR)", "Due", "Created"].map(h),
        ...(docs.data ?? []).map((d) => {
          const c = d.customers as { customer_code: string; company_name: string | null; full_name: string | null } | null;
          return [
            { value: d.doc_number ?? "" }, { value: d.doc_type }, { value: d.status },
            { value: `${c?.customer_code ?? ""} ${c?.company_name ?? c?.full_name ?? ""}`.trim() },
            ...[d.subtotal, d.dpp, d.vat, d.stamp_duty, d.total].map((n) => ({ value: Number(n), format: "#,##0" })),
            { value: d.due_date ?? "" }, { value: d.created_at.slice(0, 10) },
          ];
        }),
      ];
      const custRows = [
        ["Code", "Type", "Status", "Name", "Email", "Joined"].map(h),
        ...(customers.data ?? []).map((c) => [c.customer_code, c.customer_type, c.status, c.company_name ?? c.full_name ?? "", c.email ?? "", c.created_at.slice(0, 10)].map((v) => ({ value: String(v) }))),
      ];
      const blob = (await writeXlsxFile([docRows, custRows] as never, { sheets: ["Billing documents", "Customers"], fontFamily: "Arial", fontSize: 10 })) as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wisecloud-report-${from}_${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      toast.error("Export failed.");
    } finally {
      setBusy(false);
    }
  }

  const cards = [
    ["Invoiced", stats.invoiced], ["Paid", stats.paid], ["Outstanding", stats.outstanding], ["VAT collected", stats.vat],
  ] as const;

  return (
    <AppShell variant="staff" title="Reports" subtitle="Revenue & receivables" email={identity.email}>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="glass flex flex-wrap items-end gap-3 rounded-3xl border p-5">
          <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button className="ml-auto" disabled={busy || docs.isLoading} onClick={() => void exportXlsx()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export Excel
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, v]) => (
            <div key={label} className="glass rounded-3xl border p-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-display text-xl font-bold">{formatIDR(v)}</p>
            </div>
          ))}
        </div>
        <div className="glass overflow-x-auto rounded-3xl border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">{["Number", "Customer", "Status", "Total", "Created"].map((t) => <th key={t} className="px-4 py-3 font-medium">{t}</th>)}</tr>
            </thead>
            <tbody>
              {(docs.data ?? []).map((d, i) => {
                const c = d.customers as { customer_code: string } | null;
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{d.doc_number}</td>
                    <td className="px-4 py-3">{c?.customer_code}</td>
                    <td className="px-4 py-3 text-xs">{d.status}</td>
                    <td className="px-4 py-3">{formatIDR(d.total)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(d.created_at)}</td>
                  </tr>
                );
              })}
              {(docs.data ?? []).length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No documents in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
