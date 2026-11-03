/** Coretax DJP billing math. IDR, rounded to whole rupiah. */
export const VAT_RATE = 0.12;
export const STAMP_DUTY = 10_000;
export const STAMP_THRESHOLD = 10_000_000;

export type LineInput = { quantity: number; unit_price: number };

export function computeTotals(items: LineInput[], customerType: "ENT" | "IND") {
  const subtotal = Math.round(items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
  // ENT (PKP): DPP = 11/12 × subtotal, VAT 12% of DPP. IND (non-PKP): no VAT, DPP = subtotal.
  const dpp = customerType === "ENT" ? Math.round((subtotal * 11) / 12) : subtotal;
  const vat = customerType === "ENT" ? Math.round(dpp * VAT_RATE) : 0;
  const stamp_duty = dpp > STAMP_THRESHOLD ? STAMP_DUTY : 0;
  return { subtotal, dpp, vat, stamp_duty, total: subtotal + vat + stamp_duty };
}

export const CYCLE_MONTHS = { MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12 } as const;
export type Cycle = keyof typeof CYCLE_MONTHS;

/** Quotation lines for a pre-order: recurring fee × cycle months × qty, plus one-time setup fee × qty. */
export function preOrderLines(
  name: string,
  unitPrice: number,
  setupFee: number,
  quantity: number,
  cycle: Cycle,
) {
  const months = CYCLE_MONTHS[cycle];
  const lines = [{ description: `${name} (${cycle.toLowerCase()}, ${months} mo)`, quantity, unit_price: unitPrice * months }];
  if (setupFee > 0) lines.push({ description: `${name} — one-time setup fee`, quantity, unit_price: setupFee });
  return lines;
}
