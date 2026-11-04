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
  LifeBuoy,
  Package,
  ShoppingCart,
  FileSignature,
  BarChart3,
  Receipt,
  Megaphone,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = {
  to: "/backend/dashboard" | "/backend/invitations" | "/backend/monitors" | "/user/dashboard" | "/user/network" | "/backend/announcements" | "/user/announcements" | "/backend/billing" | "/user/billing" | "/backend/tickets" | "/user/tickets" | "/backend/products" | "/backend/orders" | "/backend/contracts" | "/backend/reports" | "/user/orders" | "/user/contracts";
  label: string;
  icon: LucideIcon;
};

const STAFF_NAV: NavItem[] = [
  { to: "/backend/dashboard", label: "Customers", icon: LayoutDashboard },
  { to: "/backend/invitations", label: "Invitations", icon: Mail },
  { to: "/backend/orders", label: "Pre-orders", icon: ShoppingCart },
  { to: "/backend/billing", label: "Billing", icon: Receipt },
  { to: "/backend/products", label: "Products & pricing", icon: Package },
  { to: "/backend/contracts", label: "Contracts", icon: FileSignature },
  { to: "/backend/reports", label: "Reports", icon: BarChart3 },
  { to: "/backend/tickets", label: "Tickets", icon: LifeBuoy },
  { to: "/backend/monitors", label: "Network monitor", icon: Activity },
  { to: "/backend/announcements", label: "Announcements", icon: Megaphone },
];

const CLIENT_NAV: NavItem[] = [
  { to: "/user/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/user/orders", label: "Order service", icon: ShoppingCart },
  { to: "/user/billing", label: "Billing", icon: Receipt },
  { to: "/user/contracts", label: "Contracts", icon: FileSignature },
  { to: "/user/tickets", label: "Support tickets", icon: LifeBuoy },
  { to: "/user/network", label: "Network status", icon: Activity },
  { to: "/user/announcements", label: "Announcements", icon: Megaphone },
];

const SPRING = "transition-colors duration-200 ease-out";
const SMOOTH = "duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

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
      "group flex h-11 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-2xl px-[15px] text-sm font-medium",
      SPRING,
      active
        ? "bg-gradient-brand text-primary-foreground shadow-elevated"
        : "text-muted-foreground hover:bg-card/70 hover:text-sidebar-accent-foreground hover:backdrop-blur-md",
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
            "fixed inset-y-3 left-3 z-30 hidden flex-col overflow-hidden rounded-3xl border border-sidebar-border glass transition-[width] will-change-[width] md:flex",
            SMOOTH,
            collapsed ? "w-[76px]" : "w-64",
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap px-[18px] py-5">
            <div className="bg-gradient-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-elevated">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            {(
              <div className={cn("min-w-0 transition-opacity", SMOOTH, collapsed ? "opacity-0" : "opacity-100")}>
                <p className="font-display text-sm font-bold leading-tight">{BRAND.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{BRAND.legalName}</p>
                <p className="text-[10px] italic text-primary">{BRAND.tagline}</p>
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-3 py-2">
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <div key={item.to}>
                  {withTip(
                    item.label,
                    <Link to={item.to} className={itemClass(active)}>
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <Label show={!collapsed}>{item.label}</Label>
                    </Link>,
                  )}
                </div>
              );
            })}
          </nav>

          <div className="space-y-1.5 border-t border-sidebar-border px-3 py-3">
            {withTip(
              dark ? "Light mode" : "Dark mode",
              <button type="button" onClick={toggle} className={itemClass(false)}>
                {dark ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
                <Label show={!collapsed}>{dark ? "Light mode" : "Dark mode"}</Label>
              </button>,
            )}
            {withTip(
              "Sign out",
              <button type="button" onClick={() => void signOut()} className={itemClass(false)}>
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <Label show={!collapsed}>Sign out</Label>
              </button>,
            )}
            {withTip(
              collapsed ? "Expand" : "Collapse",
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={itemClass(false)}
              >
                {collapsed ? <ChevronsRight className="h-[18px] w-[18px] shrink-0" /> : <ChevronsLeft className="h-[18px] w-[18px] shrink-0" />}
                <Label show={!collapsed}>Collapse</Label>
              </button>,
            )}
          </div>
        </aside>

        <div className={cn("transition-[padding-left]", SMOOTH, collapsed ? "md:pl-[6.25rem]" : "md:pl-[17.5rem]")}>
          <header className="sticky top-0 z-20 px-4 pt-3 md:pr-3 md:pl-0">
            <div className="glass flex items-center justify-between gap-3 rounded-2xl border px-5 py-3">
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {email && <span className="hidden text-muted-foreground lg:inline">{email}</span>}
                <NotificationBell />
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
              <button type="button" onClick={toggle} aria-label="Toggle theme" className={cn("glass flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground", SPRING)}>
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {dark ? "Light" : "Dark"}
              </button>
              <button type="button" onClick={() => void signOut()} className={cn("glass flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground", SPRING)}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </nav>
          </header>
          <main className="p-4 md:py-6 md:pr-3 md:pl-0">
            {actions && (
              <div className="glass mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-3xl border px-5 py-3">
                <p className="font-display text-sm font-semibold">{title}</p>
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Label({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <span className={cn("truncate transition-opacity duration-200 ease-out", show ? "opacity-100 delay-100" : "w-0 opacity-0")}>
      {children}
    </span>
  );
}
