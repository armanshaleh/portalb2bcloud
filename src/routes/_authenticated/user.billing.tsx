import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { formatDate, formatIDR } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { BillingDocView, DOC_LABEL, DOC_SELECT, StatusBadge, type BillingDoc } from "@/components/billing-doc-view";
import { BillingAttachments } from "@/components/billing-attachments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/user/billing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Billing · Wise Cloud Portal" },
      { name: "description", content: "Your Wise Cloud invoices, quotations and purchase orders in IDR." },
      { property: "og:title", content: "Billing · Wise Cloud Portal" },
      { property: "og:description", content: "Invoices, quotations and purchase orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (identity.isStaff) throw redirect({ to: "/backend/billing" });
    return { identity };
  },
  component: UserBilling,
});

function UserBilling() {
  const { identity } = Route.useRouteContext();
  const [open, setOpen] = useState<BillingDoc | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["billing", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_documents").select(DOC_SELECT).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BillingDoc[];
    },
  });
  const outstanding = data.filter((d) => d.doc_type === "INV" && d.status !== "PAID").reduce((s, d) => s + Number(d.total), 0);

  return (
    <AppShell variant="client" title="Billing" subtitle="Invoices & documents" email={identity.email}>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="glass rounded-3xl border p-5">
          <p className="text-xs text-muted-foreground">Outstanding invoices</p>
          <p className="font-display text-2xl font-bold">{formatIDR(outstanding)}</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl border py-16 text-center">
            <FileText className="h-8 w-8 text-primary" />
            <p className="font-medium">No billing documents yet.</p>
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-3xl border">
            {data.map((d) => (
              <button key={d.id} type="button" onClick={() => setOpen(d)} className="flex w-full items-center justify-between gap-3 border-b px-5 py-4 text-left last:border-0 hover:bg-card/60">
                <div className="min-w-0">
                  <p className="truncate tabular-nums tracking-tight text-sm">{d.doc_number}</p>
                  <p className="text-xs text-muted-foreground">{DOC_LABEL[d.doc_type]} · due {formatDate(d.due_date)}</p>
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
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Document</DialogTitle></DialogHeader>
          {open && (<><BillingDocView doc={open} /><BillingAttachments documentId={open.id} canUpload={open.status !== "CANCELLED"} /></>)}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
