import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Uptime Kuma heartbeat status codes: 0 = down, 1 = up, 2 = pending, 3 = maintenance
const KUMA_STATUS = { 0: "DOWN", 1: "UP", 2: "PENDING", 3: "MAINTENANCE" } as const;

const payloadSchema = z.object({
  heartbeat: z
    .object({
      status: z.number().int().min(0).max(3),
      ping: z.number().nullable().optional(),
      msg: z.string().max(1000).nullable().optional(),
      time: z.string().max(64).optional(),
      monitorID: z.number().int().optional(),
    })
    .nullable()
    .optional(),
  monitor: z.object({ id: z.number().int() }).passthrough().nullable().optional(),
  msg: z.string().max(2000).optional(),
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseKumaTime(t: string | undefined): string {
  if (!t) return new Date().toISOString();
  // Kuma sends "YYYY-MM-DD HH:mm:ss.SSS" in UTC
  const d = new Date(t.includes("T") ? t : `${t.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export const Route = createFileRoute("/api/public/uptime/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["UPTIME_KUMA_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.startsWith("Bearer ")
          ? auth.slice(7).trim()
          : (new URL(request.url).searchParams.get("token") ?? "");
        if (!safeEqual(provided, secret)) return new Response("Unauthorized", { status: 401 });

        let body: z.infer<typeof payloadSchema>;
        try {
          body = payloadSchema.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }
        const kumaId = body.monitor?.id ?? body.heartbeat?.monitorID;
        if (!body.heartbeat || kumaId === undefined) {
          // Kuma "test notification" has no heartbeat — acknowledge it
          return Response.json({ ok: true, test: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: monitor, error: lookupError } = await supabaseAdmin
          .from("network_monitors")
          .select("id")
          .eq("kuma_monitor_id", kumaId)
          .maybeSingle();
        if (lookupError) return new Response("Monitor lookup failed", { status: 500 });
        if (!monitor) return Response.json({ ok: true, ignored: "unlinked monitor" });

        const status = KUMA_STATUS[body.heartbeat.status as 0 | 1 | 2 | 3];
        const latency = typeof body.heartbeat.ping === "number" ? body.heartbeat.ping : null;
        const checkedAt = parseKumaTime(body.heartbeat.time);

        const { error: heartbeatError } = await supabaseAdmin.from("monitor_heartbeats").insert({
          monitor_id: monitor.id,
          status,
          latency_ms: latency,
          message: body.heartbeat.msg?.slice(0, 500) ?? null,
          checked_at: checkedAt,
        });
        if (heartbeatError) return new Response("Heartbeat save failed", { status: 500 });
        const { error: updateError } = await supabaseAdmin
          .from("network_monitors")
          .update({ status, last_latency_ms: latency, last_checked_at: checkedAt })
          .eq("id", monitor.id)
          .or(`last_checked_at.is.null,last_checked_at.lte.${checkedAt}`);
        if (updateError) return new Response("Monitor update failed", { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
