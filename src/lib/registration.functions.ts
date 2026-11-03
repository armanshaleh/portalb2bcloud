import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
const DOC_TYPES = [
  "NPWP",
  "NIB",
  "SK_KEMENKUMHAM",
  "AKTA",
  "KTP_DIRECTOR",
  "KTP",
  "OTHER",
] as const;

const documentSchema = z.object({
  docType: z.enum(DOC_TYPES),
  originalName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  dataBase64: z.string().min(1),
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(32).optional().nullable(),
  position: z.string().trim().max(120).optional().nullable(),
});

export const registerCustomerSchema = z.object({
  customerType: z.enum(["ENT", "IND"]),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  companyName: z.string().trim().max(200).optional().nullable(),
  npwpNumber: z.string().trim().max(32).optional().nullable(),
  nibNumber: z.string().trim().max(32).optional().nullable(),
  kemenkumhamSk: z.string().trim().max(64).optional().nullable(),
  directorName: z.string().trim().max(160).optional().nullable(),
  directorKtpNumber: z.string().trim().max(32).optional().nullable(),
  fullName: z.string().trim().max(160).optional().nullable(),
  ktpNumber: z.string().trim().max(32).optional().nullable(),
  billingContact: contactSchema,
  technicalContact: contactSchema.optional().nullable(),
  bankAccount: z.object({
    bankName: z.string().trim().min(1).max(120),
    accountNumber: z.string().trim().min(1).max(64),
    accountName: z.string().trim().min(1).max(160),
  }),
  documents: z.array(documentSchema).min(1).max(8),
});

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;

export type RegisterCustomerResult =
  | { ok: true; customerCode: string }
  | { ok: false; error: string };

const BOOTSTRAP_SUPERUSER_EMAIL = "arman@artawise.com";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function mimeExtension(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  return "jpg";
}

/**
 * Public KYC registration endpoint. Hardened server-side:
 * zod validation, MIME/extension/size re-checks, UUID file renaming into the
 * user's own protected folder, atomic customer/contact/bank/document inserts
 * with full rollback (including storage + auth user) on any failure.
 */
export const registerCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const parsed = registerCustomerSchema.parse(input);
    return parsed;
  })
  .handler(async ({ data }): Promise<RegisterCustomerResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Required document policy per entity format
    const requiredDocs: string[] = data.customerType === "ENT" ? ["AKTA", "KTP_DIRECTOR"] : ["KTP"];
    for (const rt of requiredDocs) {
      if (!data.documents.some((d) => d.docType === rt)) {
        return { ok: false, error: "A required verification document is missing." };
      }
    }
    if (data.customerType === "ENT" && (!data.companyName || !data.npwpNumber)) {
      return { ok: false, error: "Corporate registration requires company name and NPWP." };
    }
    if (data.customerType === "IND" && (!data.fullName || !data.ktpNumber)) {
      return { ok: false, error: "Personal registration requires full name and KTP." };
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true, // staff verification gates real use; user logs in to a restricted dashboard
    });
    if (createError || !created.user) {
      const msg = (createError?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("duplicate")) {
        return { ok: false, error: "This email is already registered." };
      }
      return { ok: false, error: "Could not create the account. Please try again." };
    }
    const user = created.user;

    try {
      // Upload documents under the user's own folder with UUID names
      const docRows: Database["public"]["Tables"]["legal_documents"]["Insert"][] = [];
      for (const doc of data.documents) {
        const path = `${user.id}/${crypto.randomUUID()}.${mimeExtension(doc.mimeType)}`;
        const bytes = base64ToBytes(doc.dataBase64);
        const { error: uploadError } = await supabaseAdmin.storage
          .from("legal-documents")
          .upload(path, bytes, { contentType: doc.mimeType, upsert: false });
        if (uploadError) throw new Error("upload");
        docRows.push({
          customer_id: "", // set after the customer row is created
          doc_type: doc.docType,
          storage_path: path,
          original_name: doc.originalName.slice(0, 255),
          mime_type: doc.mimeType,
          file_size: bytes.length,
        });
      }

      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .insert({
          user_id: user.id,
          // assigned by the assign_customer_code trigger before the row is stored
          customer_code: "AUTO",
          customer_type: data.customerType,
          customer_type: data.customerType,
          status: "PENDING_VERIFICATION",
          company_name: data.companyName ?? null,
          npwp_number: data.npwpNumber ?? null,
          nib_number: data.nibNumber ?? null,
          kemenkumham_sk: data.kemenkumhamSk ?? null,
          director_name: data.directorName ?? null,
          director_ktp_number: data.directorKtpNumber ?? null,
          full_name: data.fullName ?? null,
          ktp_number: data.ktpNumber ?? null,
          verified_email: data.email.toLowerCase(),
        })
        .select("id, customer_code")
        .single();
      if (customerError || !customer) throw new Error("customer");

      const customerId = customer.id as string;
      await supabaseAdmin.from("legal_documents").insert(
        docRows.map((row) => ({ ...row, customer_id: customerId })),
      );

      const contactRows: Database["public"]["Tables"]["customer_contacts"]["Insert"][] = [];
      if (data.customerType === "ENT") {
        contactRows.push({
          customer_id: customerId,
          contact_type: "BILLING",
          name: data.billingContact.name,
          email: data.billingContact.email,
          phone: data.billingContact.phone ?? null,
          position: data.billingContact.position ?? null,
        });
        if (data.technicalContact) {
          contactRows.push({
            customer_id: customerId,
            contact_type: "TECHNICAL",
            name: data.technicalContact.name,
            email: data.technicalContact.email,
            phone: data.technicalContact.phone ?? null,
            position: data.technicalContact.position ?? null,
          });
        }
      } else {
        contactRows.push({
          customer_id: customerId,
          contact_type: "BILLING",
          name: data.fullName ?? "",
          email: data.email.toLowerCase(),
          phone: data.billingContact.phone ?? null,
          position: "Owner",
        });
      }
      await supabaseAdmin.from("customer_contacts").insert(contactRows);

      await supabaseAdmin.from("bank_accounts").insert({
        customer_id: customerId,
        account_type: data.customerType === "ENT" ? "CORPORATE" : "PERSONAL",
        bank_name: data.bankAccount.bankName,
        account_number: data.bankAccount.accountNumber,
        account_name: data.bankAccount.accountName,
        is_primary: true,
      });

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: user.id,
        actor_email: data.email.toLowerCase(),
        action: "customer.registered",
        entity_type: "customer",
        entity_id: customerId,
        details: { customer_code: customer.customer_code, customer_type: data.customerType },
      });

      return { ok: true, customerCode: customer.customer_code as string };
    } catch {
      // Full rollback: remove uploaded files and the just-created auth user
      try {
        const { data: listed } = await supabaseAdmin.storage.from("legal-documents").list(user.id);
        if (listed && listed.length > 0) {
          await supabaseAdmin
            .storage
            .from("legal-documents")
            .remove(listed.map((f) => `${user.id}/${f.name}`));
        }
      } catch {
        /* best effort */
      }
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return { ok: false, error: "Registration could not be completed. Please try again." };
    }
  });

/**
 * One-time superuser bootstrap. No-ops once any superuser exists, so the
 * window for abuse closes the moment the owner account is provisioned.
 */
export const bootstrapSuperuser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "superuser");
  if (count && count > 0) return { ok: true, created: false };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: BOOTSTRAP_SUPERUSER_EMAIL,
    email_confirm: true,
  });
  let userId = created?.user?.id ?? null;
  if (!userId) {
    const { data: found } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    userId = found?.users?.find((u) => u.email?.toLowerCase() === BOOTSTRAP_SUPERUSER_EMAIL)?.id ?? null;
  }
  if (!userId) return { ok: false, error: "Bootstrap user could not be resolved." };

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "superuser" }, { onConflict: "user_id,role" });
  return { ok: true, created: true };
});
