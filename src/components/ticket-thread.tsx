import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getFileUrl } from "@/lib/portal.functions";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const CATEGORY_LABEL = {
  GENERAL: "General",
  TECHNICAL: "Technical support",
  VISIT_DC: "Visit Datacenter",
  GOODS_IN: "Goods In",
  GOODS_OUT: "Goods Out",
  REACTIVATION: "Re-activation",
  BILLING: "Billing",
} as const;

export const FIELD_LABEL: Record<string, string> = {
  visitors: "Visitor names",
  identity_numbers: "Identity numbers (KTP)",
  schedule: "Visit schedule",
  device_type: "Device type",
  brand_model: "Brand / model",
  serial_number: "Serial number",
  rack_u: "Rack U space",
  withdrawal_details: "Withdrawal details",
  removal_date: "Target removal date",
};

export type Ticket = {
  id: string;
  ticket_no: string | null;
  category: keyof typeof CATEGORY_LABEL;
  subject: string;
  description: string | null;
  details: Record<string, string>;
  attachment_path: string | null;
  status: string;
  epass_code: string | null;
  created_at: string;
  customers?: { customer_code: string; company_name: string | null; full_name: string | null } | null;
};

export function TicketStatus({ status }: { status: string }) {
  const v = status === "APPROVED" || status === "CLOSED" ? "success" : status === "REJECTED" ? "danger" : "warning";
  return <Badge variant={v}>{status.replace("_", " ")}</Badge>;
}

export function TicketThread({ ticket, staff }: { ticket: Ticket; staff: boolean }) {
  const qc = useQueryClient();
  const fileFn = useServerFn(getFileUrl);
  const [body, setBody] = useState("");
  const { data: messages = [] } = useQuery({
    queryKey: ["ticket-messages", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("id,body,is_staff,created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });

  async function send() {
    if (!body.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || ticket.status === "CLOSED") return;
    const { error } = await supabase
      .from("ticket_messages")
      .insert({ ticket_id: ticket.id, body: body.trim(), is_staff: staff, author_id: u.user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    void qc.invalidateQueries({ queryKey: ["ticket-messages", ticket.id] });
  }

  async function openFile() {
    if (!ticket.attachment_path) return;
    try {
      const { url } = await fileFn({ data: { path: ticket.attachment_path } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("File not available.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{CATEGORY_LABEL[ticket.category]}</Badge>
        <TicketStatus status={ticket.status} />
        <span className="text-xs text-muted-foreground">{formatDateTime(ticket.created_at)}</span>
      </div>
      {ticket.description && <p className="whitespace-pre-line text-sm">{ticket.description}</p>}
      {Object.keys(ticket.details ?? {}).length > 0 && (
        <dl className="grid gap-2 rounded-2xl border p-3 text-sm sm:grid-cols-2">
          {Object.entries(ticket.details).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{FIELD_LABEL[k] ?? k}</dt>
              <dd className="whitespace-pre-line">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      {ticket.epass_code && ticket.status === "APPROVED" && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-sm">
          <p className="text-xs text-muted-foreground">E-Pass code (show at DC security)</p>
          <p className="tabular-nums tracking-tight text-lg font-bold tracking-widest text-success">{ticket.epass_code}</p>
        </div>
      )}
      {ticket.attachment_path && (
        <Button size="sm" variant="outline" onClick={() => void openFile()}>
          <Paperclip className="h-4 w-4" /> View attachment
        </Button>
      )}
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${m.is_staff ? "bg-primary/10" : "bg-muted"}`}>
            <p className="text-[10px] font-semibold text-muted-foreground">{m.is_staff ? "Wise Cloud NOC" : "Customer"} · {formatDateTime(m.created_at)}</p>
            <p className="whitespace-pre-line">{m.body}</p>
          </div>
        ))}
      </div>
      {ticket.status !== "CLOSED" && (
        <div className="flex gap-2">
          <Textarea rows={2} placeholder="Write a reply…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          <Button size="icon" onClick={() => void send()} aria-label="Send reply"><Send className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
