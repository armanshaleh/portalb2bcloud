import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StaffContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
};

async function assertStaff(context: StaffContext) {
  const { data, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (error || !data) throw new Error("Forbidden: staff role required.");
}

export type CustomerRow = {
  id: string;
  customer_code: string;
  customer_type: "ENT" | "IND";
  status: string;
  company_name: string | null;
  full_name: string | null;
  verified_email: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerDetail = {
  customer: CustomerRow & {
    npwp_number: string | null;
    nib_number: string | null;
    kemenkumham_sk: string | null;
    director_name: string | null;
    director_ktp_number: string | null;
    ktp_number: string | null;
    verified_at: string | null;
  };
  contacts: Array<{
    id: string;
    contact_type: string;
    name: string;
    email: string;
    phone: string | null;
    position: string | null;
  }>;
  bankAccounts: Array<{
    id: string;
    account_type: string;
    bank_name: string;
    account_number: string;
    account_name: string;
  }>;
  documents: Array<{
    id: string;
    doc_type: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    status: string;
    created_at: string;
  }>;
  notes: Array<{ id: string; note: string; author_email: string | null; created_at: string }>;
  documentUrls: Record<string, string>;
};

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ customers: CustomerRow[] }> => {
    await assertStaff(context as StaffContext);
    const { data, error } = await context.supabase
      .from("customers")
      .select(
        "id, customer_code, customer_type, status, company_name, full_name, verified_email, rejection_reason, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load customers.");
    return { customers: (data ?? []) as CustomerRow[] };
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string }) => input)
  .handler(async ({ context, data }): Promise<CustomerDetail | null> => {
    await assertStaff(context as StaffContext);
    const customerId = data.customerId;

    const [customerRes, contactsRes, banksRes, docsRes, notesRes] = await Promise.all([
      context.supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
      context.supabase
        .from("customer_contacts")
        .select("id, contact_type, name, email, phone, position")
        .eq("customer_id", customerId),
      context.supabase
        .from("bank_accounts")
        .select("id, account_type, bank_name, account_number, account_name")
        .eq("customer_id", customerId),
      context.supabase
        .from("legal_documents")
        .select("id, doc_type, original_name, mime_type, file_size, status, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("admin_notes")
        .select("id, note, author_email, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);
    if (customerRes.error || !customerRes.data) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: paths } = await context.supabase
      .from("legal_documents")
      .select("id, storage_path")
      .eq("customer_id", customerId);
    const documentUrls: Record<string, string> = {};
    for (const row of paths ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("legal-documents")
        .createSignedUrl(row.storage_path, 3600);
      if (signed) documentUrls[row.id] = signed.signedUrl;
    }

    return {
      customer: customerRes.data as CustomerDetail["customer"],
      contacts: (contactsRes.data ?? []) as CustomerDetail["contacts"],
      bankAccounts: (banksRes.data ?? []) as CustomerDetail["bankAccounts"],
      documents: (docsRes.data ?? []) as CustomerDetail["documents"],
      notes: (notesRes.data ?? []) as CustomerDetail["notes"],
      documentUrls,
    };
  });

export type StatusAction = "verify" | "reject" | "suspend" | "reactivate";

export const setCustomerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; action: StatusAction; note?: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    await assertStaff(context as StaffContext);
    const { supabase, userId } = context as StaffContext;
    const { customerId, action, note } = data;

    const patch: {
      status?: string;
      verified_at?: string;
      verified_by?: string;
      rejection_reason?: string | null;
    } = {};
    if (action === "verify") {
      patch["status"] = "VERIFIED";
      patch["verified_at"] = new Date().toISOString();
      patch["verified_by"] = userId;
      patch["rejection_reason"] = null;
    } else if (action === "reject") {
      patch["status"] = "REJECTED";
      patch["rejection_reason"] = (note ?? "").trim() || "Registration rejected.";
    } else if (action === "suspend") {
      patch["status"] = "SUSPENDED";
    } else if (action === "reactivate") {
      patch["status"] = "VERIFIED";
      patch["rejection_reason"] = null;
    } else {
      return { ok: false, error: "Unknown action." };
    }

    const { error } = await supabase.from("customers").update(patch).eq("id", customerId);
    if (error) return { ok: false, error: "Could not update the customer." };

    if (action === "verify") {
      await supabase
        .from("legal_documents")
        .update({ status: "VERIFIED", reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("customer_id", customerId)
        .eq("status", "PENDING");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabase.auth.getUser();
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      actor_email: me.user?.email ?? null,
      action: `customer.${action}`,
      entity_type: "customer",
      entity_id: customerId,
      details: { note: note ?? null },
    });
    return { ok: true };
  });

export const addAdminNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; note: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    await assertStaff(context as StaffContext);
    const note = data.note.trim();
    if (!note) return { ok: false, error: "Note is empty." };
    const { data: me } = await context.supabase.auth.getUser();
    const { error } = await context.supabase.from("admin_notes").insert({
      customer_id: data.customerId,
      author_id: (context as StaffContext).userId,
      author_email: me.user?.email ?? null,
      note: note.slice(0, 2000),
    });
    if (error) return { ok: false, error: "Could not save the note." };
    return { ok: true };
  });
