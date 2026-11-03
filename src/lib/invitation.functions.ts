import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function hashInviteToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function assertStaff(context: Ctx) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden: staff role required.");
}

export type InvitationRow = {
  id: string;
  email: string;
  customer_type: "ENT" | "IND";
  display_name: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ invitations: InvitationRow[] }> => {
    await assertStaff(context as Ctx);
    const { data, error } = await context.supabase
      .from("client_invitations")
      .select("id, email, customer_type, display_name, expires_at, accepted_at, revoked_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load invitations.");
    return { invitations: (data ?? []) as InvitationRow[] };
  });

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  customerType: z.enum(["ENT", "IND"]),
  displayName: z.string().trim().min(1).max(200),
});

/** Staff-only: creates a single-use invitation and returns the raw token once (only its hash is stored). */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    await assertStaff(context as Ctx);
    const email = data.email.toLowerCase();
    const { count } = await context.supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("verified_email", email);
    if (count && count > 0) return { ok: false, error: "A customer with this email already exists." };

    // Revoke older open invitations for the same email so only the newest link works
    await context.supabase
      .from("client_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null);

    const token = randomToken();
    const { error } = await context.supabase.from("client_invitations").insert({
      email,
      customer_type: data.customerType,
      display_name: data.displayName,
      token_hash: await hashInviteToken(token),
      invited_by: context.userId,
    });
    if (error) return { ok: false, error: "Could not create the invitation." };
    return { ok: true, token };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context as Ctx);
    const { error } = await context.supabase
      .from("client_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("accepted_at", null);
    return { ok: !error };
  });

export type InvitationLookup =
  | { ok: true; email: string; customerType: "ENT" | "IND"; displayName: string }
  | { ok: false; error: string };

/** Public: resolves an invitation token to its locked email/type. Returns nothing else. */
export const lookupInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<InvitationLookup> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("client_invitations")
      .select("email, customer_type, display_name, expires_at, accepted_at, revoked_at")
      .eq("token_hash", await hashInviteToken(data.token))
      .maybeSingle();
    if (!inv || inv.revoked_at) return { ok: false, error: "This invitation link is not valid." };
    if (inv.accepted_at) return { ok: false, error: "This invitation has already been used. Please sign in." };
    if (new Date(inv.expires_at).getTime() < Date.now())
      return { ok: false, error: "This invitation has expired. Ask our team for a new one." };
    return { ok: true, email: inv.email, customerType: inv.customer_type, displayName: inv.display_name };
  });
