import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function assertStaff(context: Ctx) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden: staff role required.");
}

export type MonitorStatus = "UP" | "DOWN" | "DEGRADED" | "MAINTENANCE" | "PENDING";

export type MonitorView = {
  id: string;
  name: string;
  location: string | null;
  category: string;
  status: MonitorStatus;
  last_latency_ms: number | null;
  last_checked_at: string | null;
  uptime24h: number | null;
  avgLatency24h: number | null;
  beats: Array<{ status: MonitorStatus; latency_ms: number | null; checked_at: string }>;
};

const BEATS_SHOWN = 48;

async function buildViews(supabase: Ctx["supabase"], monitors: Array<{ id: string; name: string; location: string | null; category: string; status: string; last_latency_ms: number | string | null; last_checked_at: string | null }>): Promise<MonitorView[]> {
  if (monitors.length === 0) return [];
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: beats } = await supabase
    .from("monitor_heartbeats")
    .select("monitor_id, status, latency_ms, checked_at")
    .in("monitor_id", monitors.map((m) => m.id))
    .gte("checked_at", since)
    .order("checked_at", { ascending: false })
    .limit(5000);
  return monitors.map((m) => {
    const own = (beats ?? []).filter((b) => b.monitor_id === m.id);
    const counted = own.filter((b) => b.status !== "MAINTENANCE" && b.status !== "PENDING");
    const up = counted.filter((b) => b.status === "UP" || b.status === "DEGRADED").length;
    const lat = own.map((b) => (b.latency_ms === null ? null : Number(b.latency_ms))).filter((v): v is number => v !== null);
    return {
      id: m.id,
      name: m.name,
      location: m.location ?? null,
      category: m.category,
      status: m.status as MonitorStatus,
      last_latency_ms: m.last_latency_ms === null ? null : Number(m.last_latency_ms),
      last_checked_at: m.last_checked_at ?? null,
      uptime24h: counted.length ? (up / counted.length) * 100 : null,
      avgLatency24h: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null,
      beats: own
        .slice(0, BEATS_SHOWN)
        .reverse()
        .map((b) => ({
          status: b.status as MonitorStatus,
          latency_ms: b.latency_ms === null ? null : Number(b.latency_ms),
          checked_at: b.checked_at,
        })),
    };
  });
}

const MONITOR_COLS = "id, name, location, category, status, last_latency_ms, last_checked_at";

/** Client: only monitors explicitly assigned to the caller's customer (enforced by RLS). */
export const listMyMonitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ monitors: MonitorView[] }> => {
    const { data: customer } = await context.supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!customer) return { monitors: [] };
    const { data: assigned } = await context.supabase
      .from("monitor_assignments")
      .select("monitor_id")
      .eq("customer_id", customer.id);
    const ids = (assigned ?? []).map((a) => a.monitor_id);
    if (ids.length === 0) return { monitors: [] };
    const { data: monitors } = await context.supabase
      .from("network_monitors")
      .select(MONITOR_COLS)
      .in("id", ids)
      .eq("is_active", true)
      .order("name");
    return { monitors: await buildViews(context.supabase, monitors ?? []) };
  });

export type StaffMonitor = MonitorView & { kuma_monitor_id: number | null; is_active: boolean; customerIds: string[] };

export const listAllMonitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ monitors: StaffMonitor[]; customers: Array<{ id: string; label: string; code: string }> }> => {
    await assertStaff(context as Ctx);
    const [{ data: monitors }, { data: assignments }, { data: customers }] = await Promise.all([
      context.supabase.from("network_monitors").select(`${MONITOR_COLS}, kuma_monitor_id, is_active`).order("name"),
      context.supabase.from("monitor_assignments").select("monitor_id, customer_id"),
      context.supabase.from("customers").select("id, customer_code, company_name, full_name").order("customer_code"),
    ]);
    const views = await buildViews(context.supabase, monitors ?? []);
    return {
      monitors: views.map((v) => {
        const raw = (monitors ?? []).find((m) => m.id === v.id);
        if (!raw) throw new Error("Monitor not found.");
        return {
          ...v,
          kuma_monitor_id: raw.kuma_monitor_id,
          is_active: raw.is_active,
          customerIds: (assignments ?? []).filter((a) => a.monitor_id === v.id).map((a) => a.customer_id),
        };
      }),
      customers: (customers ?? []).map((c) => ({
        id: c.id,
        code: c.customer_code,
        label: c.company_name ?? c.full_name ?? c.customer_code,
      })),
    };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional().nullable(),
  category: z.enum(["FACILITY", "DEDICATED", "TRANSIT"]),
  kumaMonitorId: z.number().int().positive().nullable(),
});

export const saveMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context as Ctx);
    const row = {
      name: data.name,
      location: data.location || null,
      category: data.category,
      kuma_monitor_id: data.kumaMonitorId,
    };
    const res = data.id
      ? await context.supabase.from("network_monitors").update(row).eq("id", data.id)
      : await context.supabase.from("network_monitors").insert(row);
    if (res.error) {
      return {
        ok: false as const,
        error: res.error.code === "23505" ? "That Uptime Kuma monitor ID is already linked." : "Could not save the monitor.",
      };
    }
    return { ok: true as const };
  });

export const deleteMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context as Ctx);
    const { error } = await context.supabase.from("network_monitors").delete().eq("id", data.id);
    return { ok: !error };
  });

/** Replaces the full set of customers allowed to see one monitor. */
export const setMonitorAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ monitorId: z.string().uuid(), customerIds: z.array(z.string().uuid()).max(5000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context as Ctx);
    const { error } = await context.supabase.rpc("replace_monitor_assignments", {
      _monitor_id: data.monitorId, _customer_ids: [...new Set(data.customerIds)],
    });
    return { ok: !error };
  });

/** Superuser-only: the webhook token to paste into Uptime Kuma's notification headers. */
export const getKumaWebhookConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ allowed: boolean; token: string | null }> => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superuser",
    });
    if (!isSuper) return { allowed: false, token: null };
    return { allowed: true, token: process.env["UPTIME_KUMA_WEBHOOK_SECRET"] ?? null };
  });
