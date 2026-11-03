import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { CATEGORY_LABEL, TicketStatus, TicketThread, type Ticket } from "@/components/ticket-thread";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/backend/tickets")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tickets · Wise Cloud Backend" },
      { name: "description", content: "Handle customer support, datacenter visit and goods in/out tickets." },
      { property: "og:title", content: "Tickets · Wise Cloud Backend" },
      { property: "og:description", content: "Customer ticket queue for the Wise Cloud NOC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/tickets" });
    return { identity };
  },
  component: StaffTickets,
});

const FILTERS = ["OPEN", "IN_PROGRESS", "APPROVED", "REJECTED", "CLOSED", "ALL"] as const;

function makeEpass() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = crypto.getRandomValues(new Uint32Array(8));
  return "EP-" + Array.from(arr, (n) => chars[n % chars.length]).join("");
}

function StaffTickets() {
  const { identity } = Route.useRouteContext();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("OPEN");
  const [view, setView] = useState<Ticket | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["tickets", "staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id,ticket_no,category,subject,description,details,attachment_path,status,epass_code,created_at,customers(customer_code,company_name,full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Ticket[];
    },
  });
  const shown = filter === "ALL" ? data : data.filter((t) => t.status === filter);

  async function setStatus(t: Ticket, status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "CLOSED") {
    const patch: { status: typeof status; epass_code?: string } = { status };
    if (status === "APPROVED" && t.category === "VISIT_DC" && !t.epass_code) patch.epass_code = makeEpass();
    const { error } = await supabase.from("tickets").update(patch).eq("id", t.id);
    if (error) return void toast.error(error.message);
    toast.success("Ticket updated.");
    setView({ ...t, ...patch });
    void qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  return (
    <AppShell variant="staff" title="Tickets" subtitle="Support & datacenter operations" email={identity.email}>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f.replace("_", " ")} ({f === "ALL" ? data.length : data.filter((t) => t.status === f).length})
            </Button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : shown.length === 0 ? (
          <p className="glass rounded-3xl border py-16 text-center text-sm text-muted-foreground">No tickets.</p>
        ) : (
          <div className="glass overflow-hidden rounded-3xl border">
            {shown.map((t) => (
              <button key={t.id} type="button" onClick={() => setView(t)} className="flex w-full items-center justify-between gap-3 border-b px-5 py-4 text-left last:border-0 hover:bg-card/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.ticket_no} · {CATEGORY_LABEL[t.category]} · {t.customers?.company_name ?? t.customers?.full_name} ({t.customers?.customer_code}) · {formatDate(t.created_at)}
                  </p>
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
          {view && (
            <>
              <TicketThread ticket={view} staff />
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {view.status === "OPEN" && <Button size="sm" variant="outline" onClick={() => void setStatus(view, "IN_PROGRESS")}>Start</Button>}
                {view.status !== "APPROVED" && view.status !== "CLOSED" && <Button size="sm" onClick={() => void setStatus(view, "APPROVED")}>{view.category === "VISIT_DC" ? "Approve & issue E-Pass" : "Approve"}</Button>}
                {view.status !== "REJECTED" && view.status !== "CLOSED" && <Button size="sm" variant="outline" onClick={() => void setStatus(view, "REJECTED")}>Reject</Button>}
                {view.status !== "CLOSED" && <Button size="sm" variant="ghost" onClick={() => void setStatus(view, "CLOSED")}>Close</Button>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
