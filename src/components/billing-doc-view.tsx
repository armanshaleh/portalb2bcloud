import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { formatDate, formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const DOC_LABEL = { QUO: "Quotation", INV: "Invoice", PO: "Purchase Order", FMO: "Form Order", REC: "Receipt" } as const;

export type BillingDoc = {
  id: string;
  doc_type: keyof typeof DOC_LABEL;
  doc_number: string | null;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  dpp: number;
  vat: number;
  stamp_duty: number;
  total: number;
  notes: string | null;
  revision_note: string | null;
  customers: { customer_code: string; customer_type: string; company_name: string | null; full_name: string | null } | null;
};

export const DOC_SELECT =
  "id,doc_type,doc_number,status,issue_date,due_date,subtotal,dpp,vat,stamp_duty,total,notes,revision_note,customers(customer_code,customer_type,company_name,full_name)";

export function StatusBadge({ status }: { status: string }) {
  const v =
    status === "PAID" || status === "APPROVED" || status === "SENT"
      ? "success"
      : status === "PENDING_APPROVAL"
        ? "warning"
        : status === "REJECTED" || status === "CANCELLED"
          ? "danger"
          : "outline";
  return <Badge variant={v}>{status.replace("_", " ")}</Badge>;
}

export function BillingDocView({ doc }: { doc: BillingDoc }) {
  const { data: items, isLoading } = useQuery({
    queryKey: ["billing-items", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_items")
        .select("id,description,quantity,unit_price,amount")
        .eq("document_id", doc.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const name = doc.customers?.company_name ?? doc.customers?.full_name ?? "—";
  const isEnt = doc.customers?.customer_type === "ENT";

  return (
    <div className="space-y-5 print:text-black">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="font-display text-lg font-bold">{BRAND.name}</p>
          <p className="text-xs text-muted-foreground">{BRAND.legalName}</p>
          <p className="text-xs italic text-primary">{BRAND.tagline}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold uppercase tracking-wide">{DOC_LABEL[doc.doc_type]}</p>
          <p className="font-mono text-xs">{doc.doc_number}</p>
          <div className="mt-1"><StatusBadge status={doc.status} /></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Bill to</p>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{doc.customers?.customer_code}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Issue date · Due date</p>
          <p>{formatDate(doc.issue_date)} · {formatDate(doc.due_date)}</p>
        </div>
      </div>
      {isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b"><th className="py-2 text-left">Description</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id} className="border-b">
                <td className="py-2">{i.description}</td>
                <td className="text-right">{i.quantity}</td>
                <td className="text-right">{formatIDR(i.unit_price)}</td>
                <td className="text-right">{formatIDR(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <Row k="Subtotal" v={formatIDR(doc.subtotal)} />
        {isEnt && <Row k="DPP (11/12)" v={formatIDR(doc.dpp)} />}
        {isEnt && <Row k="PPN 12%" v={formatIDR(doc.vat)} />}
        {doc.stamp_duty > 0 && <Row k="e-Meterai" v={formatIDR(doc.stamp_duty)} />}
        <div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd>{formatIDR(doc.total)}</dd></div>
      </dl>
      {doc.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{doc.notes}</p>}
      <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print / Save PDF
      </Button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}
