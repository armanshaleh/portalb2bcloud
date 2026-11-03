import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX = 10 * 1024 * 1024;
const fileSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  size: z.number().int().min(1).max(MAX),
  dataBase64: z.string().min(1).max(Math.ceil((MAX * 4) / 3) + 8),
});
type FileIn = z.infer<typeof fileSchema>;

async function storeFile(userId: string, file: FileIn) {
  const binary = atob(file.dataBase64);
  if (binary.length > MAX) throw new Error("File exceeds 10 MB.");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
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
    if (error || !t) throw new Error("Could not open ticket.");
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
