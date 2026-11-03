import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { nextStage, type Stage } from "@/lib/lifecycle";

const COPY: Record<Stage, { title: string; body: (n: string) => string }> = {
  REMIND_7: { title: "Payment reminder (7 days)", body: (n) => `${n} is due in 7 days.` },
  REMIND_3: { title: "Payment reminder (3 days)", body: (n) => `${n} is due in 3 days.` },
  OVERDUE_1: { title: "Invoice overdue", body: (n) => `${n} is overdue. Please pay to avoid suspension.` },
  SUSPEND_7: { title: "Account suspended", body: (n) => `${n} is 7 days overdue; your services are suspended.` },
  TERMINATE_30: { title: "Services terminated", body: (n) => `${n} is 30 days overdue; services were terminated.` },
};

export const Route = createFileRoute("/api/public/cron/billing-lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: docs, error } = await supabaseAdmin
          .from("billing_documents")
          .select("id, doc_number, due_date, lifecycle_stage, customer_id, customers(user_id)")
          .eq("doc_type", "INV")
          .in("status", ["APPROVED", "SENT"])
          .not("due_date", "is", null);
        if (error) return new Response("Query failed", { status: 500 });
        const today = new Date();
        let applied = 0;
        for (const d of docs ?? []) {
          const stage = nextStage(d.due_date as string, today, d.lifecycle_stage);
          if (!stage) continue;
          const userId = (d.customers as { user_id: string } | null)?.user_id;
          if (userId) {
            await supabaseAdmin.from("notifications").insert({
              user_id: userId,
              title: COPY[stage].title,
              body: COPY[stage].body(d.doc_number ?? "Invoice"),
              link: "/user/billing",
            });
          }
          if (stage === "SUSPEND_7") {
            await supabaseAdmin.from("customers").update({ status: "SUSPENDED" }).eq("id", d.customer_id);
            await supabaseAdmin.from("user_services").update({ status: "SUSPENDED", suspended_at: today.toISOString() }).eq("customer_id", d.customer_id).eq("status", "ACTIVE");
          }
          if (stage === "TERMINATE_30") {
            await supabaseAdmin.from("user_services").update({ status: "TERMINATED", terminated_at: today.toISOString() }).eq("customer_id", d.customer_id).neq("status", "TERMINATED");
          }
          await supabaseAdmin.from("billing_documents").update({ lifecycle_stage: stage }).eq("id", d.id);
          await supabaseAdmin.from("audit_logs").insert({ action: `lifecycle.${stage}`, entity_type: "billing_document", entity_id: d.id });
          applied += 1;
        }
        return Response.json({ ok: true, applied });
      },
    },
  },
});
