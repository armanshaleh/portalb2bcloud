import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LifeBuoy, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { createTicket } from "@/lib/portal.functions";
import { formatDate } from "@/lib/format";
import type { PreparedFile } from "@/lib/upload";
import { AppShell } from "@/components/app-shell";
import { UploadField } from "@/components/upload-field";
import { CATEGORY_LABEL, FIELD_LABEL, TicketStatus, TicketThread, type Ticket } from "@/components/ticket-thread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/user/tickets")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Support tickets · Wise Cloud Portal" },
      { name: "description", content: "Open support, datacenter visit and goods in/out tickets with Wise Cloud." },
      { property: "og:title", content: "Support tickets · Wise Cloud Portal" },
      { property: "og:description", content: "Support and datacenter operation tickets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (identity.isStaff) throw redirect({ to: "/backend/tickets" });
    return { identity };
  },
  component: UserTickets,
});

type Cat = Ticket["category"];
const FIELDS: Partial<Record<Cat, { key: string; type?: string; multiline?: boolean }[]>> = {
  VISIT_DC: [{ key: "visitors", multiline: true }, { key: "identity_numbers", multiline: true }, { key: "schedule", type: "datetime-local" }],
  GOODS_IN: [{ key: "device_type" }, { key: "brand_model" }, { key: "serial_number" }, { key: "rack_u" }],
  GOODS_OUT: [{ key: "withdrawal_details", multiline: true }, { key: "serial_number" }, { key: "removal_date", type: "date" }],
};

function UserTickets() {
  const { identity } = Route.useRouteContext();
  const [view, setView] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["tickets", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id,ticket_no,category,subject,description,details,attachment_path,status,epass_code,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Ticket[];
    },
  });

  return (
    <AppShell
      variant="client"
      title="Support tickets"
      subtitle="Support, datacenter visits & goods in/out"
      email={identity.email}
      actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New ticket</Button>}
    >
      <div className="mx-auto max-w-5xl">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl border py-16 text-center">
            <LifeBuoy className="h-8 w-8 text-primary" />
            <p className="font-medium">No tickets yet.</p>
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-3xl border">
            {data.map((t) => (
              <button key={t.id} type="button" onClick={() => setView(t)} className="flex w-full items-center justify-between gap-3 border-b px-5 py-4 text-left last:border-0 hover:bg-card/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.ticket_no} · {CATEGORY_LABEL[t.category]} · {formatDate(t.created_at)}</p>
                </div>
                <TicketStatus status={t.status} />
              </button>
            ))}
          </div>
        )}
      </div>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{view?.ticket_no} · {view?.subject}</DialogTitle></DialogHeader>
          {view && <TicketThread ticket={view} staff={false} />}
        </DialogContent>
      </Dialog>
      <NewTicketDialog open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}

function NewTicketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createTicket);
  const [category, setCategory] = useState<Cat>("GENERAL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = FIELDS[category] ?? [];

  async function submit() {
    if (subject.trim().length < 3) return void toast.error("Subject is required.");
    if (fields.some((f) => !details[f.key]?.trim())) return void toast.error("Please complete all fields.");
    if (category === "GOODS_OUT" && !file) return void toast.error("Authorization letter is required for Goods Out.");
    setBusy(true);
    try {
      const d = Object.fromEntries(fields.map((f) => [f.key, details[f.key] ?? ""]));
      const r = await createFn({
        data: {
          category,
          subject,
          description: description.trim() || null,
          details: d,
          file: file ? { originalName: file.originalName, mimeType: file.mimeType as "application/pdf", size: file.size, dataBase64: file.dataBase64 } : null,
        },
      });
      toast.success(`Ticket ${r.ticket_no} opened.`);
      setSubject(""); setDescription(""); setDetails({}); setFile(null);
      onClose();
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>New ticket</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v as Cat); setDetails({}); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-subj">Subject</Label>
            <Input id="t-subj" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{FIELD_LABEL[f.key]}</Label>
              {f.multiline ? (
                <Textarea rows={2} value={details[f.key] ?? ""} onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })} maxLength={1000} />
              ) : (
                <Input type={f.type ?? "text"} value={details[f.key] ?? ""} onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })} maxLength={1000} />
              )}
            </div>
          ))}
          {category === "GOODS_OUT" && (
            <UploadField docType="AUTHORIZATION_LETTER" label="Authorization letter" required value={file} onChange={setFile} />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
          </div>
          <Button className="w-full" disabled={busy} onClick={() => void submit()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
