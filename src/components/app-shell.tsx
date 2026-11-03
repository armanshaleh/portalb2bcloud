import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = {
  to: "/backend/dashboard" | "/backend/invitations" | "/backend/monitors" | "/user/dashboard" | "/user/network";
  label: string;
  icon: LucideIcon;
};

const STAFF_NAV: NavItem[] = [
  { to: "/backend/dashboard", label: "Customers", icon: LayoutDashboard },
  { to: "/backend/invitations", label: "Invitations", icon: Mail },
  { to: "/backend/monitors", label: "Network monitor", icon: Activity },
];

const CLIENT_NAV: NavItem[] = [
  { to: "/user/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/user/network", label: "Network status", icon: Activity },
];

const SPRING = "transition-all duration-300 ease-spring";

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("wc-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }
  return { dark, toggle };
}

export function AppShell({
  variant,
  title,
  subtitle,
  email,
  actions,
  children,
}: {
  variant: "staff" | "client";
  title: string;
  subtitle?: string | undefined;
  email?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const { dark, toggle } = useTheme();
  const nav = variant === "staff" ? STAFF_NAV : CLIENT_NAV;

  useEffect(() => {
    setCollapsed(localStorage.getItem("wc-sidebar") === "collapsed");
  }, []);
  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("wc-sidebar", next ? "collapsed" : "expanded");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  const itemClass = (active: boolean) =>
    cn(
      "group flex items-center gap-3 rounded-2xl text-sm font-medium",
      SPRING,
      "liquid shadow-none",
      collapsed ? "h-12 w-12 justify-center" : "h-11 px-3",
      active
        ? "bg-gradient-brand text-primary-foreground shadow-elevated"
        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  function withTip(label: string, node: ReactNode) {
    if (!collapsed) return node;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" className="rounded-full px-3 py-1.5 text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="min-h-screen ">
        <aside
          className={cn(
            "fixed inset-y-3 left-3 z-30 hidden flex-col rounded-3xl border border-sidebar-border glass md:flex",
            SPRING,
            collapsed ? "w-20 items-center" : "w-64",
          )}
        >
          <div className={cn("flex items-center gap-3 py-5", collapsed ? "justify-center" : "px-5")}>
            <div className="bg-gradient-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-elevated">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-display text-sm font-bold leading-tight">{BRAND.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{BRAND.legalName}</p>
                <p className="text-[10px] italic text-primary">{BRAND.tagline}</p>
              </div>
            )}
          </div>

          <nav className={cn("flex-1 space-y-1.5 py-2", collapsed ? "px-0" : "px-3")}>
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <div key={item.to}>
                  {withTip(
                    item.label,
                    <Link to={item.to} className={itemClass(active)}>
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>,
                  )}
                </div>
              );
            })}
          </nav>

          <div className={cn("space-y-1.5 border-t border-sidebar-border py-3", collapsed ? "px-0" : "px-3")}>
            {withTip(
              dark ? "Light mode" : "Dark mode",
              <button type="button" onClick={toggle} className={cn(itemClass(false), "w-full")}>
                {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
              </button>,
            )}
            {withTip(
              "Sign out",
              <button type="button" onClick={() => void signOut()} className={cn(itemClass(false), "w-full")}>
                <LogOut className="h-[18px] w-[18px]" />
                {!collapsed && <span>Sign out</span>}
              </button>,
            )}
            {withTip(
              collapsed ? "Expand" : "Collapse",
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={cn(itemClass(false), "w-full")}
              >
                {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
                {!collapsed && <span>Collapse</span>}
              </button>,
            )}
          </div>
        </aside>

        <div className={cn(SPRING, collapsed ? "md:pl-[6.5rem]" : "md:pl-[17.5rem]")}>
          <header className="sticky top-0 z-20 px-4 pt-3 md:pr-3 md:pl-0">
            <div className="glass flex items-center justify-between gap-3 rounded-2xl border px-5 py-3">
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {email && <span className="hidden text-muted-foreground lg:inline">{email}</span>}
                {actions}
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Toggle theme"
                  className={cn("flex h-9 w-9 items-center justify-center rounded-xl border md:hidden", SPRING)}
                >
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  className={cn("flex h-9 w-9 items-center justify-center rounded-xl border md:hidden", SPRING)}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Mobile nav pills */}
            <nav className="mt-2 flex gap-2 overflow-x-auto md:hidden">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                    SPRING,
                    pathname.startsWith(item.to) ? "bg-gradient-brand text-primary-foreground" : "glass text-muted-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" /> {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="p-4 md:py-6 md:pr-3 md:pl-0">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
