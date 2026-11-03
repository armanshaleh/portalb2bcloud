import { describe, expect, it } from "vitest";
import { nextStage, proRata } from "@/lib/lifecycle";

const day = (s: string) => new Date(`${s}T08:00:00Z`);

describe("billing lifecycle", () => {
  it("reminds at H-7", () => expect(nextStage("2026-11-20", day("2026-11-13"), null)).toBe("REMIND_7"));
  it("reminds at H-3", () => expect(nextStage("2026-11-20", day("2026-11-17"), "REMIND_7")).toBe("REMIND_3"));
  it("overdue notice at H+1", () => expect(nextStage("2026-11-20", day("2026-11-21"), "REMIND_3")).toBe("OVERDUE_1"));
  it("suspends at H+7", () => expect(nextStage("2026-11-20", day("2026-11-27"), "OVERDUE_1")).toBe("SUSPEND_7"));
  it("terminates at H+30", () => expect(nextStage("2026-11-20", day("2026-12-20"), "SUSPEND_7")).toBe("TERMINATE_30"));
  it("does not repeat a stage", () => expect(nextStage("2026-11-20", day("2026-11-28"), "SUSPEND_7")).toBeNull());
  it("nothing before H-7", () => expect(nextStage("2026-11-20", day("2026-11-12"), null)).toBeNull());
});

describe("pro-rata", () => {
  it("activation on the 16th of a 30-day month charges 15/30", () => {
    expect(proRata(3_000_000, day("2026-11-16"))).toBe(1_500_000);
  });
});
