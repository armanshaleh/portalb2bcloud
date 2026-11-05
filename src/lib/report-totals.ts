export function reportTotals(docs: Array<{ doc_type: string; status: string; total: number | string; vat: number | string }>) {
  const invoices = docs.filter((d) => d.doc_type === "INV" && ["APPROVED", "SENT", "PAID"].includes(d.status));
  const paid = invoices.filter((d) => d.status === "PAID");
  const sum = (rows: typeof invoices) => rows.reduce((s, d) => s + Number(d.total), 0);
  return { invoiced: sum(invoices), paid: sum(paid), outstanding: sum(invoices.filter((d) => d.status !== "PAID")), vat: paid.reduce((s,d) => s + Number(d.vat),0) };
}