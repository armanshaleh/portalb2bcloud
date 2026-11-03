import type { ReactNode } from "react";
import type { MonitorStatus, MonitorView } from "@/lib/monitor.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_META: Record<MonitorStatus, { label: string; pill: string; bar: string; dot: string }> = {
  UP: { label: "Operational", pill: "bg-success/15 text-success", bar: "bg-success", dot: "bg-success" },
  DEGRADED: { label: "Degraded", pill: "bg-warning/15 text-warning", bar: "bg-warning", dot: "bg-warning" },
  DOWN: { label: "Down", pill: "bg-destructive/15 text-destructive", bar: "bg-destructive", dot: "bg-destructive" },
  MAINTENANCE: { label: "Maintenance", pill: "bg-primary/15 text-primary", bar: "bg-primary", dot: "bg-primary" },
  PENDING: { label: "Awaiting data", pill: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/40", dot: "bg-muted-foreground" },
};

export function StatusPill({ status }: { status: MonitorStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", m.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot, status === "UP" && "animate-pulse")} />
      {m.label}
    </span>
  );
}

const SLOTS = 48;

export function HeartbeatBar({ beats }: { beats: MonitorView["beats"] }) {
  const padded: Array<MonitorView["beats"][number] | null> = [
    ...Array.from({ length: Math.max(0, SLOTS - beats.length) }, () => null),
    ...beats.slice(-SLOTS),
  ];
  return (
    <TooltipProvider delayDuration={60}>
      <div className="flex h-8 items-end gap-[3px]">
        {padded.map((b, i) =>
          b ? (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "h-full flex-1 rounded-full transition-all duration-300 ease-spring hover:scale-y-110",
                    STATUS_META[b.status].bar,
                  )}
                />
              </TooltipTrigger>
              <TooltipContent className="rounded-xl text-xs">
                {STATUS_META[b.status].label}
                {b.latency_ms !== null ? ` · ${b.latency_ms.toFixed(0)} ms` : ""}
                <br />
                {formatDateTime(b.checked_at)}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span key={i} className="h-full flex-1 rounded-full bg-muted" />
          ),
        )}
      </div>
    </TooltipProvider>
  );
}

export function MonitorCard({ m, footer }: { m: MonitorView; footer?: ReactNode }) {
  return (
    <div className="glass tactile rounded-3xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display font-semibold">{m.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {m.location ?? "—"} · {m.category.toLowerCase()}
          </p>
        </div>
        <StatusPill status={m.status} />
      </div>
      <div className="mt-4">
        <HeartbeatBar beats={m.beats} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Current" value={m.last_latency_ms !== null ? `${m.last_latency_ms.toFixed(0)} ms` : "—"} />
        <Stat label="Avg 24h" value={m.avgLatency24h !== null ? `${m.avgLatency24h.toFixed(0)} ms` : "—"} />
        <Stat label="Uptime 24h" value={m.uptime24h !== null ? `${m.uptime24h.toFixed(2)}%` : "—"} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Last check {formatDateTime(m.last_checked_at)}</p>
      {footer}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-bold">{value}</p>
    </div>
  );
}
