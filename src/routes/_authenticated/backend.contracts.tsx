import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { uploadContract } from "@/lib/portal.functions";
import { formatDate } from "@/lib/format";
import type { PreparedFile } from "@/lib/upload";
import { AppShell } from "@/components/app-shell";
import { ContractViewer, type ContractRow } from "@/components/contract-viewer";
import { UploadField } from "@/components/upload-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/backend/contracts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contracts · Wise Cloud Backend" },
      { name: "description", content: "Upload and manage confidential customer contracts with watermarked viewing." },
      { property: "og:title", content: "Contracts · Wise Cloud Backend" },
      { property: "og:description", content: "Confidential customer contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/dashboard" });
    return { identity };
  },
  component: BackendContracts,
});

const TYPES = ["MSA", "SLA", "NDA", "ADDENDUM", "OTHER"] as const;

function BackendContracts() {
  const { identity } = Route.useRouteContext();
  const qc = useQueryClient();
  const uploadFn = useServerFn(uploadContract);
  const [form, setForm] = useState({ customerId: "", title: "", contractType: "MSA" as (typeof TYPES)[number], startDate: "", endDate: "" });
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<ContractRow | null>(null);

  const customers = useQuery({
    queryKey: ["contract-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,customer_code,company_name,full_name").order("customer_code")).data ?? [],
  });
  const contracts = useQuery({
    queryKey: ["contracts", "all"],
    queryFn: async () => (await supabase.from("contracts").select("*, customers(customer_code,company_name,full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  async function submit() {
    if (!file || !form.customerId || form.title.trim().length < 2) return toast.error("Choose a customer, title and file.");
    setBusy(true);
    try {
      await uploadFn({
        data: {
          ...form,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          file: { originalName: file.originalName, mimeType: file.mimeType as "application/pdf", size: file.size, dataBase64: file.dataBase64 },
        },
      });
      toast.success("Contract uploaded. The customer has been notified.");
      setForm({ ...form, title: "", startDate: "", endDate: "" });
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["contracts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this contract?")) return;
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) return toast.error("Could not delete.");
    void qc.invalidateQueries({ queryKey: ["contracts"] });
  }

  return (
    <AppShell variant="staff" title="Contracts" subtitle="Confidential agreements" email={identity.email}>
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[360px_1fr]">
        <div className="glass space-y-3 rounded-3xl border p-5">
          <p className="font-semibold">Upload contract</p>
          <div className="space-y-1.5"><Label>Customer</Label>
            <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.customer_code} · {c.company_name ?? c.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} /></div>
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={form.contractType} onValueChange={(v) => setForm({ ...form, contractType: v as (typeof TYPES)[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>End</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <UploadField docType="OTHER" label="File (PDF/JPG/PNG, max 10 MB)" value={file} onChange={setFile} disabled={busy} />
          <Button className="w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </Button>
        </div>
        <div className="glass overflow-hidden rounded-3xl border">
          {contracts.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (contracts.data ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No contracts uploaded yet.</p>
          ) : (
            (contracts.data ?? []).map((c) => {
              const cust = c.customers as { customer_code: string; company_name: string | null; full_name: string | null } | null;
              return (
                <div key={c.id} className="flex items-center gap-3 border-b px-5 py-4 last:border-0">
                  <button type="button" onClick={() => setOpen(c)} className="min-w-0 flex-1 text-left hover:text-primary">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{cust?.customer_code} · {cust?.company_name ?? cust?.full_name} · {formatDate(c.start_date)} – {formatDate(c.end_date)}</p>
                  </button>
                  <Badge variant="secondary">{c.contract_type}</Badge>
                  <Button size="icon" variant="ghost" aria-label="Delete contract" onClick={() => void remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })
          )}
        </div>
      </div>
      <ContractViewer contract={open} viewer={identity.email} onClose={() => setOpen(null)} />
    </AppShell>
  );
}
