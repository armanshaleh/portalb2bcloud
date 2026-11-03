import { Moon, Sun } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useTheme } from "@/components/app-shell";

const PUBLIC_PATHS = ["/auth", "/register", "/forgot-password", "/reset-password"];

/** Floating glass Light/Dark pill shown on public (signed-out) pages. */
export function FloatingThemeToggle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { dark, toggle } = useTheme();
  if (!PUBLIC_PATHS.includes(pathname)) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="glass liquid fixed right-6 top-6 z-50 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-foreground hover:bg-card/80"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}
