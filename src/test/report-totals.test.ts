import { expect, it } from "vitest";
import { reportTotals } from "../lib/report-totals";
it("excludes unapproved documents and counts collected VAT only from paid invoices", () => {
  const docs = ["PENDING_APPROVAL", "REJECTED", "CANCELLED", "APPROVED", "SENT", "PAID"].map((status) => ({ doc_type: "INV", status, total: 1110000, vat: 110000 }));
  expect(reportTotals(docs)).toEqual({ invoiced: 3330000, paid: 1110000, outstanding: 2220000, vat: 110000 });
});