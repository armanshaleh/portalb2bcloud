import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remember-me semantics:
 * - checked   -> persistent session (default, 30-day refresh like the spec's cookie strategy)
 * - unchecked -> session-only access; signed out automatically after 4h without activity
 */
const REMEMBER_KEY = "wc_remember";
const LAST_ACTIVE_KEY = "wc_last_active";
const TTL_MS = 4 * 60 * 60 * 1000;

export function setRememberFlag(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

export function watchSessionWindow(client: SupabaseClient): () => void {
  let signingOut = false;
  function expired() {
    try {
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
      if (localStorage.getItem(REMEMBER_KEY) === "0" && last && Date.now() - last >= TTL_MS) {
        if (!signingOut) { signingOut = true; void client.auth.signOut(); }
        return true;
      }
    } catch { /* storage unavailable */ }
    return false;
  }
  function touch() {
    if (expired()) return;
    try {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
  }

  if (expired()) return () => {};
  if (!localStorage.getItem(LAST_ACTIVE_KEY)) touch();
  const interval = window.setInterval(expired, 60_000);
  const onVisible = () => {
    if (!document.hidden) expired();
  };
  const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
  events.forEach((event) => window.addEventListener(event, touch, { passive: true }));
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(interval);
    events.forEach((event) => window.removeEventListener(event, touch));
    document.removeEventListener("visibilitychange", onVisible);
  };
}
