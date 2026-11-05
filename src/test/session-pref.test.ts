import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setRememberFlag, watchSessionWindow } from "../lib/session-pref";
describe("four-hour inactivity", () => {
  let stop = () => {};
  const signOut = vi.fn().mockResolvedValue({});
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-05T08:00:00Z")); localStorage.clear(); signOut.mockClear(); });
  afterEach(() => { stop(); vi.useRealTimers(); });
  const start = () => { stop = watchSessionWindow({ auth: { signOut } } as unknown as SupabaseClient); };
  it("signs out after exactly four hours without user input", () => {
    setRememberFlag(false); start(); vi.advanceTimersByTime(4 * 60 * 60 * 1000 - 60000); expect(signOut).not.toHaveBeenCalled(); vi.advanceTimersByTime(60000); expect(signOut).toHaveBeenCalledOnce();
  });
  it("extends the window on actual activity", () => {
    setRememberFlag(false); start(); vi.advanceTimersByTime(3 * 60 * 60 * 1000); window.dispatchEvent(new Event("keydown")); vi.advanceTimersByTime(60 * 60 * 1000); expect(signOut).not.toHaveBeenCalled(); vi.advanceTimersByTime(3 * 60 * 60 * 1000); expect(signOut).toHaveBeenCalledOnce();
  });
  it("keeps remembered sessions persistent", () => { setRememberFlag(true); start(); vi.advanceTimersByTime(5 * 60 * 60 * 1000); expect(signOut).not.toHaveBeenCalled(); });
});