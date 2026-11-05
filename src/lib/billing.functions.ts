import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals } from "@/lib/billing-calc";

const DOC_TYPES = ["QUO", "INV", "PO", "FMO", "REC"] as const;

async function requireStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

const createSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  customer_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().max(2000).nullable(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(300),
        quantity: z.number().positive().max(100000),
        unit_price: z.number().min(0).max(1e13),
      }),
    )
    .min(1)
    .max(50),
});

/** Staff create a document; it always starts PENDING_APPROVAL. Totals are computed server-side. */
export const createBillingDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { data: customer } = await context.supabase
      .from("customers")
      .select("id, customer_type")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (!customer) throw new Error("Customer not found.");
    const totals = computeTotals(data.items, customer.customer_type);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin
      .from("billing_documents")
      .insert({
        doc_type: data.doc_type,
        customer_id: data.customer_id,
        due_date: data.due_date,
        notes: data.notes,
        created_by: context.userId,
        ...totals,
      })
      .select("id, doc_number")
      .single();
    if (error || !doc) throw new Error("Could not create document.");
    const { error: itemErr } = await supabaseAdmin.from("billing_items").insert(
      data.items.map((i, idx) => ({
        document_id: doc.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: Math.round(i.quantity * i.unit_price),
        sort_order: idx,
      })),
    );
    if (itemErr) {
      await supabaseAdmin.from("billing_documents").delete().eq("id", doc.id);
      throw new Error("Could not save line items.");
    }
    return doc;
  });

const transitionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "send", "mark_paid", "cancel"]),
  note: z.string().max(1000).optional(),
});

/** Approve/reject = superuser only. Send/paid/cancel = staff, only after approval. */
export const transitionBillingDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => transitionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { data: doc } = await context.supabase
      .from("billing_documents")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found.");

    let patch: Record<string, unknown>;
    if (data.action === "approve" || data.action === "reject") {
      const { data: isSu } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superuser" });
      if (!isSu) throw new Error("Only a superuser can approve or reject.");
      if (doc.status !== "PENDING_APPROVAL" && doc.status !== "REJECTED") throw new Error("Document is not awaiting approval.");
      patch =
        data.action === "approve"
          ? { status: "APPROVED", approved_by: context.userId, approved_at: new Date().toISOString(), revision_note: null }
          : { status: "REJECTED", revision_note: data.note?.trim() || "Please revise." };
    } else if (data.action === "send") {
      if (doc.status !== "APPROVED") throw new Error("Only approved documents can be sent.");
      patch = { status: "SENT" };
    } else if (data.action === "mark_paid") {
      if (doc.status !== "APPROVED" && doc.status !== "SENT") throw new Error("Document must be approved first.");
      patch = { status: "PAID", paid_at: new Date().toISOString() };
    } else {
      if (doc.status === "PAID") throw new Error("Paid documents cannot be cancelled.");
      patch = { status: "CANCELLED" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin.from("billing_documents").update(patch as never).eq("id", data.id).eq("status", doc.status).select("id").maybeSingle();
    if (error || !updated) throw new Error("Document changed; refresh before trying again.");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: `billing.${data.action}`,
      entity_type: "billing_document",
      entity_id: data.id,
      details: data.note ? { note: data.note } : null,
    });
    return { ok: true };
  });
