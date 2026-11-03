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
  } catch {
    /* storage unavailable */
  }
}

export function watchSessionWindow(client: SupabaseClient): () => void {
  function touch() {
    try {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
  }

  try {
    const remember = localStorage.getItem(REMEMBER_KEY);
    const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
    if (remember === "0" && last && Date.now() - last > TTL_MS) {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(LAST_ACTIVE_KEY);
      void client.auth.signOut();
      return () => {};
    }
  } catch {
    /* storage unavailable */
  }

  touch();
  const interval = window.setInterval(touch, 60_000);
  const onVisible = () => {
    if (!document.hidden) touch();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
