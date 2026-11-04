import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { createBillingDocument, transitionBillingDocument } from "@/lib/billing.functions";
import { computeTotals } from "@/lib/billing-calc";
import { formatDate, formatIDR } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { BillingDocView, DOC_LABEL, DOC_SELECT, StatusBadge, type BillingDoc } from "@/components/billing-doc-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BillingAttachments } from "@/components/billing-attachments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/backend/billing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Billing · Wise Cloud Backend" },
      { name: "description", content: "Create quotations, invoices and POs with ATT numbering, PPN and e-Meterai, and approve them." },
      { property: "og:title", content: "Billing · Wise Cloud Backend" },
      { property: "og:description", content: "Billing documents with superuser approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/billing" });
    return { identity };
  },
  component: StaffBilling,
});

type DocType = BillingDoc["doc_type"];

/** Coretax-ready CSV of approved/sent/paid invoices (DPP 11/12, PPN 12%). */
function exportCoretax(docs: BillingDoc[]) {
  const rows = docs.filter((d) => d.doc_type === "INV" && ["APPROVED", "SENT", "PAID"].includes(d.status));
  const header = ["doc_number", "issue_date", "customer_code", "customer_type", "customer_name", "subtotal", "dpp", "ppn", "e_meterai", "total", "status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((d) =>
    [d.doc_number, d.issue_date, d.customers?.customer_code, d.customers?.customer_type, d.customers?.company_name ?? d.customers?.full_name, d.subtotal, d.dpp, d.vat, d.stamp_duty, d.total, d.status].map(esc).join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `coretax-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
type Line = { description: string; quantity: string; unit_price: string };

function StaffBilling() {
  const { identity } = Route.useRouteContext();
  const isSuperuser = identity.roles.includes("superuser");
  const qc = useQueryClient();
  const createFn = useServerFn(createBillingDocument);
  const transitionFn = useServerFn(transitionBillingDocument);
  const [tab, setTab] = useState<"all" | "pending">("all");
  const [view, setView] = useState<BillingDoc | null>(null);
  const [creating, setCreating] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["billing", "staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_documents").select(DOC_SELECT).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BillingDoc[];
    },
  });
  const shown = tab === "pending" ? data.filter((d) => d.status === "PENDING_APPROVAL") : data;
  const pendingCount = data.filter((d) => d.status === "PENDING_APPROVAL").length;

  async function act(d: BillingDoc, action: "approve" | "reject" | "send" | "mark_paid" | "cancel") {
    let note: string | undefined;
    if (action === "reject") {
      note = prompt("Revision note for the creator:") ?? undefined;
      if (note === undefined) return;
    }
    try {
      await transitionFn({ data: { id: d.id, action, note } });
      toast.success("Document updated.");
      setView(null);
      void qc.invalidateQueries({ queryKey: ["billing"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    }
  }

  return (
    <AppShell
      variant="staff"
      title="Billing"
      subtitle="Quotations, invoices & POs · IDR"
      email={identity.email}
    >
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="glass flex flex-wrap items-center gap-2 rounded-3xl border px-5 py-3">
          <Button size="sm" variant={tab === "all" ? "default" : "outline"} onClick={() => setTab("all")}>All</Button>
          <Button size="sm" variant={tab === "pending" ? "default" : "outline"} onClick={() => setTab("pending")}>
            Pending approval ({pendingCount})
          </Button>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => exportCoretax(data)}>Export Coretax CSV</Button>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New document</Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : shown.length === 0 ? (
          <p className="glass rounded-3xl border py-16 text-center text-sm text-muted-foreground">No documents.</p>
        ) : (
          <div className="glass overflow-hidden rounded-3xl border">
            {shown.map((d) => (
              <button key={d.id} type="button" onClick={() => setView(d)} className="flex w-full items-center justify-between gap-3 border-b px-5 py-4 text-left last:border-0 hover:bg-card/60">
                <div className="min-w-0">
                  <p className="truncate tabular-nums tracking-tight text-sm">{d.doc_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {DOC_LABEL[d.doc_type]} · {d.customers?.company_name ?? d.customers?.full_name} ({d.customers?.customer_code}) · {formatDate(d.issue_date)}
                  </p>
                  {d.status === "REJECTED" && d.revision_note && <p className="text-xs text-destructive">Revision: {d.revision_note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatIDR(d.total)}</span>
                  <StatusBadge status={d.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Document</DialogTitle></DialogHeader>
          {view && (
            <>
              <BillingDocView doc={view} />
              <BillingAttachments documentId={view.id} canUpload={false} />
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {isSuperuser && (view.status === "PENDING_APPROVAL" || view.status === "REJECTED") && (
                  <>
                    <Button size="sm" onClick={() => void act(view, "approve")}>Approve</Button>
                    {view.status === "PENDING_APPROVAL" && <Button size="sm" variant="outline" onClick={() => void act(view, "reject")}>Reject with note</Button>}
                  </>
                )}
                {!isSuperuser && view.status === "PENDING_APPROVAL" && <p className="text-xs text-muted-foreground">Waiting for superuser approval — cannot be sent yet.</p>}
                {view.status === "APPROVED" && <Button size="sm" onClick={() => void act(view, "send")}>Mark as sent</Button>}
                {(view.status === "APPROVED" || view.status === "SENT") && <Button size="sm" variant="outline" onClick={() => void act(view, "mark_paid")}>Mark as paid</Button>}
                {view.status !== "PAID" && view.status !== "CANCELLED" && <Button size="sm" variant="ghost" onClick={() => void act(view, "cancel")}>Cancel</Button>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (payload) => {
          try {
            const r = await createFn({ data: payload });
            toast.success(`${r.doc_number} created · awaiting approval`);
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ["billing"] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed.");
          }
        }}
      />
    </AppShell>
  );
}

function CreateDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (p: {
    doc_type: DocType;
    customer_id: string;
    due_date: string | null;
    notes: string | null;
    items: { description: string; quantity: number; unit_price: number }[];
  }) => Promise<void>;
}) {
  const [docType, setDocType] = useState<DocType>("INV");
  const [customerId, setCustomerId] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const [busy, setBusy] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["billing-customers"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,customer_code,customer_type,company_name,full_name")
        .eq("status", "VERIFIED")
        .order("customer_code");
      if (error) throw error;
      return data;
    },
  });
  const customer = customers.find((c) => c.id === customerId);
  const parsed = lines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0 }));
  const totals = useMemo(() => computeTotals(parsed, customer?.customer_type ?? "IND"), [parsed, customer]);

  async function submit() {
    if (!customerId) return void toast.error("Choose a customer.");
    if (parsed.some((p) => !p.description.trim() || p.quantity <= 0)) return void toast.error("Every line needs a description and quantity.");
    setBusy(true);
    await onCreate({ doc_type: docType, customer_id: customerId, due_date: due || null, notes: notes.trim() || null, items: parsed });
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>New billing document</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DOC_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Customer (verified)</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.customer_code} · {c.company_name ?? c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="due">Due date</Label>
            <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Line items</Label>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_130px_36px] gap-2">
              <Input placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
              <Input type="number" min={0} placeholder="Unit price" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
              <Button size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setLines([...lines, { description: "", quantity: "1", unit_price: "" }])}><Plus className="h-4 w-4" /> Add line</Button>
        </div>
        <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatIDR(totals.subtotal)}</dd></div>
          {customer?.customer_type === "ENT" && <div className="flex justify-between"><dt className="text-muted-foreground">DPP 11/12 · PPN 12%</dt><dd>{formatIDR(totals.vat)}</dd></div>}
          {totals.stamp_duty > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">e-Meterai</dt><dd>{formatIDR(totals.stamp_duty)}</dd></div>}
          <div className="flex justify-between border-t pt-1 font-semibold"><dt>Total</dt><dd>{formatIDR(totals.total)}</dd></div>
        </dl>
        <Button disabled={busy} onClick={() => void submit()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit for approval</Button>
      </DialogContent>
    </Dialog>
  );
}
