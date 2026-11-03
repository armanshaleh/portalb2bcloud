import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyCustomerOverview = {
  customer: {
    id: string;
    customer_code: string;
    customer_type: "ENT" | "IND";
    status: string;
    company_name: string | null;
    npwp_number: string | null;
    nib_number: string | null;
    kemenkumham_sk: string | null;
    director_name: string | null;
    full_name: string | null;
    ktp_number: string | null;
    verified_email: string;
    rejection_reason: string | null;
    created_at: string;
  } | null;
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
    storage_path: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    status: string;
    created_at: string;
  }>;
  services: Array<{
    id: string;
    service_code: string;
    service_name: string;
    status: string;
    billing_cycle: string;
    unit_price: number;
    activated_at: string | null;
  }>;
};

/** Client's own data, enforced by RLS (owner-scoped SELECT policies). */
export const getMyCustomerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyCustomerOverview> => {
    const { supabase, userId } = context;
    const { data: customer, error } = await supabase
      .from("customers")
      .select(
        "id, customer_code, customer_type, status, company_name, npwp_number, nib_number, kemenkumham_sk, director_name, full_name, ktp_number, verified_email, rejection_reason, created_at",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your account.");

    if (!customer) {
      return { customer: null, contacts: [], bankAccounts: [], documents: [], services: [] };
    }
    const customerId = customer.id as string;

    const [contactsRes, banksRes, docsRes, servicesRes] = await Promise.all([
      supabase
        .from("customer_contacts")
        .select("id, contact_type, name, email, phone, position")
        .eq("customer_id", customerId),
      supabase
        .from("bank_accounts")
        .select("id, account_type, bank_name, account_number, account_name")
        .eq("customer_id", customerId),
      supabase
        .from("legal_documents")
        .select(
          "id, doc_type, storage_path, original_name, mime_type, file_size, status, created_at",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true }),
      supabase
        .from("user_services")
        .select(
          "id, service_code, service_name, status, billing_cycle, unit_price, activated_at",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);

    return {
      customer: customer as MyCustomerOverview["customer"],
      contacts: (contactsRes.data ?? []) as MyCustomerOverview["contacts"],
      bankAccounts: (banksRes.data ?? []) as MyCustomerOverview["bankAccounts"],
      documents: (docsRes.data ?? []) as MyCustomerOverview["documents"],
      services: (servicesRes.data ?? []) as MyCustomerOverview["services"],
    };
  });
