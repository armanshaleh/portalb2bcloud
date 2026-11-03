import { describe, expect, it } from "vitest";
import { computeTotals, preOrderLines } from "@/lib/billing-calc";

describe("preOrderLines", () => {
  it("quarterly multiplies the monthly price by 3", () => {
    expect(preOrderLines("Rack", 1_000_000, 0, 2, "QUARTERLY")).toEqual([
      { description: "Rack (quarterly, 3 mo)", quantity: 2, unit_price: 3_000_000 },
    ]);
  });
  it("adds the setup fee once per unit", () => {
    const l = preOrderLines("Rack", 1_000_000, 500_000, 1, "MONTHLY");
    expect(l[1]).toMatchObject({ quantity: 1, unit_price: 500_000 });
    expect(computeTotals(l, "IND").total).toBe(1_500_000);
  });
});
