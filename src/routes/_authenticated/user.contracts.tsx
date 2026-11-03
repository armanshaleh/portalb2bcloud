import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileSignature, Loader2, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { ContractViewer, type ContractRow } from "@/components/contract-viewer";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/user/contracts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contracts · Wise Cloud Portal" },
      { name: "description", content: "Your confidential Wise Cloud agreements: MSA, SLA, NDA and addenda." },
      { property: "og:title", content: "Contracts · Wise Cloud Portal" },
      { property: "og:description", content: "Confidential service agreements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (identity.isStaff) throw redirect({ to: "/backend/contracts" });
    return { identity };
  },
  component: UserContracts,
});

function UserContracts() {
  const { identity } = Route.useRouteContext();
  const [open, setOpen] = useState<ContractRow | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["contracts", "mine"],
    queryFn: async () => (await supabase.from("contracts").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <AppShell variant="client" title="Contracts" subtitle="Confidential agreements" email={identity.email}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="glass flex items-center gap-3 rounded-3xl border p-4 text-sm text-muted-foreground">
          <ShieldAlert className="h-5 w-5 text-primary" /> Documents are watermarked with your identity. Please do not share them.
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl border py-16 text-center">
            <FileSignature className="h-8 w-8 text-primary" />
            <p className="font-medium">No contracts yet.</p>
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-3xl border">
            {data.map((c) => (
              <button key={c.id} type="button" onClick={() => setOpen(c)} className="flex w-full items-center justify-between gap-3 border-b px-5 py-4 text-left last:border-0 hover:bg-card/60">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.start_date)} – {formatDate(c.end_date)}</p>
                </div>
                <Badge variant="secondary">{c.contract_type}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
      <ContractViewer contract={open} viewer={identity.email} onClose={() => setOpen(null)} />
    </AppShell>
  );
}
