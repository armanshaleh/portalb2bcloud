import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/billing-calc";

describe("computeTotals", () => {
  it("ENT: DPP is 11/12 of subtotal and VAT is 12% of DPP", () => {
    const t = computeTotals([{ quantity: 1, unit_price: 12_000_000 }], "ENT");
    expect(t.dpp).toBe(11_000_000);
    expect(t.vat).toBe(1_320_000);
  });
  it("adds Rp 10.000 e-Meterai when DPP exceeds Rp 10.000.000", () => {
    const t = computeTotals([{ quantity: 1, unit_price: 12_000_000 }], "ENT");
    expect(t.stamp_duty).toBe(10_000);
    expect(t.total).toBe(12_000_000 + 1_320_000 + 10_000);
  });
  it("no e-Meterai when DPP is exactly Rp 10.000.000", () => {
    expect(computeTotals([{ quantity: 1, unit_price: 10_000_000 }], "IND").stamp_duty).toBe(0);
  });
  it("IND has no VAT", () => {
    expect(computeTotals([{ quantity: 2, unit_price: 500_000 }], "IND").vat).toBe(0);
  });
});
