import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { reviewPreOrder } from "@/lib/portal.functions";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/backend/orders")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pre-orders · Wise Cloud Backend" },
      { name: "description", content: "Review customer pre-orders and convert approved ones into quotations." },
      { property: "og:title", content: "Pre-orders · Wise Cloud Backend" },
      { property: "og:description", content: "Customer pre-order approvals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/dashboard" });
    return { identity };
  },
  component: BackendOrders,
});

const BADGE = { PENDING_APPROVAL: "warning", APPROVED: "success", REJECTED: "danger" } as const;

function BackendOrders() {
  const { identity } = Route.useRouteContext();
  const isSu = identity.roles.includes("superuser");
  const qc = useQueryClient();
  const reviewFn = useServerFn(reviewPreOrder);
  const [tab, setTab] = useState<keyof typeof BADGE>("PENDING_APPROVAL");
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["pre-orders", "all", tab],
    queryFn: async () =>
      (await supabase.from("pre_orders").select("*, products(name,code), customers(customer_code,company_name,full_name), billing_documents(doc_number)").eq("status", tab).order("created_at", { ascending: false })).data ?? [],
  });

  async function review(id: string, action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Reason for rejection (shown to customer):") ?? undefined : undefined;
    setBusy(id);
    try {
      await reviewFn({ data: { id, action, note } });
      toast.success(action === "approve" ? "Approved — quotation created in Billing." : "Pre-order rejected.");
      void qc.invalidateQueries({ queryKey: ["pre-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell variant="staff" title="Pre-orders" subtitle="Superuser approval" email={identity.email}>
      <div className="mx-auto max-w-5xl space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as keyof typeof BADGE)}>
          <TabsList>
            <TabsTrigger value="PENDING_APPROVAL">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        {!isSu && tab === "PENDING_APPROVAL" && <p className="text-xs text-muted-foreground">Only a superuser can approve or reject.</p>}
        <div className="glass overflow-hidden rounded-3xl border">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : data.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            data.map((o) => {
              const c = o.customers as { customer_code: string; company_name: string | null; full_name: string | null } | null;
              const doc = o.billing_documents as { doc_number: string | null } | null;
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-3 border-b px-5 py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{(o.products as { name: string } | null)?.name} × {o.quantity} · {o.billing_cycle.toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">{c?.customer_code} · {c?.company_name ?? c?.full_name} · {formatDate(o.created_at)}{o.notes ? ` · ${o.notes}` : ""}</p>
                    {doc?.doc_number && <p className="font-mono text-xs text-primary">{doc.doc_number}</p>}
                  </div>
                  <Badge variant={BADGE[o.status as keyof typeof BADGE]}>{o.status.replace("_", " ").toLowerCase()}</Badge>
                  {isSu && o.status === "PENDING_APPROVAL" && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy === o.id} onClick={() => void review(o.id, "approve")}><Check className="h-4 w-4" /> Approve</Button>
                      <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => void review(o.id, "reject")}><X className="h-4 w-4" /> Reject</Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
