import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateUpload } from "@/lib/file-validation";

const MAX = 10 * 1024 * 1024;
const fileSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  size: z.number().int().min(1).max(MAX),
  dataBase64: z.string().min(1).max(Math.ceil((MAX * 4) / 3) + 8),
});
type FileIn = z.infer<typeof fileSchema>;

async function storeFile(userId: string, file: FileIn) {
  const bytes = validateUpload(file);
  const ext = file.mimeType === "application/pdf" ? "pdf" : file.mimeType === "image/png" ? "png" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage.from("legal-documents").upload(path, bytes, { contentType: file.mimeType });
  if (error) throw new Error("Upload failed.");
  return { path, size: bytes.length };
}

/** Client uploads payment proof / PPh 23 / signed scan for one of their own released documents. */
export const uploadBillingAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ documentId: z.string().uuid(), kind: z.enum(["PROOF_OF_TRANSFER", "PPH23_CERTIFICATE", "SIGNED_DOCUMENT"]), file: fileSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // RLS: returns the row only if the caller owns the customer and the doc is released
    const { data: doc } = await context.supabase
      .from("billing_documents")
      .select("id, customer_id, customers(user_id)")
      .eq("id", data.documentId)
      .maybeSingle();
    const ownerId = (doc?.customers as { user_id: string } | null)?.user_id;
    if (!doc || ownerId !== context.userId) throw new Error("Document not found.");
    const stored = await storeFile(context.userId, data.file);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("billing_attachments").insert({
      document_id: doc.id,
      customer_id: doc.customer_id,
      kind: data.kind,
      storage_path: stored.path,
      original_name: data.file.originalName,
      mime_type: data.file.mimeType,
      file_size: stored.size,
      uploaded_by: context.userId,
    });
    if (error) {
      await supabaseAdmin.storage.from("legal-documents").remove([stored.path]);
      throw new Error("Could not save attachment.");
    }
    return { ok: true };
  });

const ticketSchema = z.object({
  category: z.enum(["GENERAL", "TECHNICAL", "VISIT_DC", "GOODS_IN", "GOODS_OUT", "REACTIVATION", "BILLING"]),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).nullable(),
  details: z.record(z.string(), z.string().max(1000)),
  file: fileSchema.nullable(),
});

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ticketSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: customer } = await context.supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!customer) throw new Error("No customer account.");
    if (data.category === "GOODS_OUT" && !data.file) throw new Error("Goods Out requires an authorization letter.");
    const stored = data.file ? await storeFile(context.userId, data.file) : null;
    const { data: t, error } = await context.supabase
      .from("tickets")
      .insert({
        customer_id: customer.id,
        created_by: context.userId,
        category: data.category,
        subject: data.subject,
        description: data.description,
        details: data.details,
        attachment_path: stored?.path ?? null,
      })
      .select("ticket_no")
      .single();
    if (error || !t) {
      if (stored) { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); await supabaseAdmin.storage.from("legal-documents").remove([stored.path]); }
      throw new Error("Could not open ticket.");
    }
    return t;
  });

/** Signed URL for a private file; storage RLS limits reads to the owner folder or staff. */
export const getFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: s, error } = await context.supabase.storage.from("legal-documents").createSignedUrl(data.path, 300);
    if (error || !s) throw new Error("File not available.");
    return { url: s.signedUrl };
  });

/** Superuser reviews a pre-order; approval converts it into a PENDING_APPROVAL quotation. */
export const reviewPreOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]), note: z.string().max(1000).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isSu } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superuser" });
    if (!isSu) throw new Error("Only a superuser can review pre-orders.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: po } = await supabaseAdmin
      .from("pre_orders")
      .select("*, products(name, unit_price, setup_fee), customers(customer_type, user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!po || po.status !== "PENDING_APPROVAL") throw new Error("Pre-order is no longer pending.");
    const customer = po.customers as { customer_type: "ENT" | "IND"; user_id: string };
    const now = new Date().toISOString();
    if (data.action === "reject") {
      await supabaseAdmin.from("pre_orders").update({ status: "REJECTED", review_note: data.note ?? null, reviewed_by: context.userId, reviewed_at: now }).eq("id", po.id);
      await supabaseAdmin.from("notifications").insert({ user_id: customer.user_id, title: "Pre-order rejected", body: data.note ?? null, link: "/user/orders" });
      return { ok: true };
    }
    const product = po.products as { name: string; unit_price: number; setup_fee: number };
    const { data: custom } = await supabaseAdmin
      .from("customer_prices").select("unit_price, setup_fee").eq("customer_id", po.customer_id).eq("product_id", po.product_id).maybeSingle();
    const { computeTotals, preOrderLines } = await import("@/lib/billing-calc");
    const items = preOrderLines(product.name, Number(custom?.unit_price ?? product.unit_price), Number(custom?.setup_fee ?? product.setup_fee), po.quantity, po.billing_cycle);
    const { data: doc, error } = await supabaseAdmin
      .from("billing_documents")
      .insert({ doc_type: "QUO", customer_id: po.customer_id, notes: `From pre-order. ${po.notes ?? ""}`.trim(), created_by: context.userId, due_date: null, ...computeTotals(items, customer.customer_type) })
      .select("id, doc_number").single();
    if (error || !doc) throw new Error("Could not create quotation.");
    await supabaseAdmin.from("billing_items").insert(items.map((i, idx) => ({ document_id: doc.id, ...i, amount: Math.round(i.quantity * i.unit_price), sort_order: idx })));
    await supabaseAdmin.from("pre_orders").update({ status: "APPROVED", quotation_id: doc.id, review_note: data.note ?? null, reviewed_by: context.userId, reviewed_at: now }).eq("id", po.id);
    await supabaseAdmin.from("notifications").insert({ user_id: customer.user_id, title: "Pre-order approved", body: `Quotation ${doc.doc_number ?? ""} is being prepared.`, link: "/user/orders" });
    return { ok: true, docNumber: doc.doc_number };
  });

/** Staff upload a confidential contract into the customer's private folder. */
export const uploadContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      customerId: z.string().uuid(),
      title: z.string().trim().min(2).max(200),
      contractType: z.enum(["MSA", "SLA", "NDA", "ADDENDUM", "OTHER"]),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      file: fileSchema,
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Forbidden");
    const { data: c } = await context.supabase.from("customers").select("id, user_id").eq("id", data.customerId).maybeSingle();
    if (!c) throw new Error("Customer not found.");
    const stored = await storeFile(c.user_id, data.file);
    const { error } = await context.supabase.from("contracts").insert({
      customer_id: c.id, title: data.title, contract_type: data.contractType, file_path: stored.path,
      mime_type: data.file.mimeType, start_date: data.startDate, end_date: data.endDate, uploaded_by: context.userId,
    });
    if (error) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("legal-documents").remove([stored.path]);
      throw new Error("Could not save contract.");
    }
    return { ok: true };
  });
