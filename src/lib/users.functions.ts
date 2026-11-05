import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

/** User management is limited to superuser and admin. */
async function assertManager(ctx: Ctx) {
  const [{ data: superuser }, { data: admin }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superuser" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
  ]);
  if (!superuser && !admin) throw new Error("Forbidden: admin role required.");
  return { superuser: Boolean(superuser) };
}

export type StaffUser = { userId: string; email: string; name: string; roles: string[]; createdAt: string; lastSignIn: string | null };
export type ManagedCustomer = {
  id: string;
  userId: string;
  code: string;
  type: "ENT" | "IND";
  name: string;
  email: string;
  status: string;
  archivedAt: string | null;
};

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ staff: StaffUser[]; customers: ManagedCustomer[]; isSuperuser: boolean }> => {
    const { superuser } = await assertManager(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id, role").neq("role", "client");
    const byUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
    const staff: StaffUser[] = [];
    for (const [uid, roles] of byUser) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (!data.user) continue;
      staff.push({
        userId: uid,
        email: data.user.email ?? "",
        name: (data.user.user_metadata?.["full_name"] as string | undefined) ?? "",
        roles,
        createdAt: data.user.created_at,
        lastSignIn: data.user.last_sign_in_at ?? null,
      });
    }
    const { data: cust } = await supabaseAdmin
      .from("customers")
      .select("id, user_id, customer_code, customer_type, company_name, full_name, verified_email, status, archived_at")
      .order("created_at", { ascending: false });
    return {
      isSuperuser: superuser,
      staff: staff.sort((a, b) => a.email.localeCompare(b.email)),
      customers: (cust ?? []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        code: c.customer_code,
        type: c.customer_type,
        name: c.company_name ?? c.full_name ?? "-",
        email: c.verified_email,
        status: c.status,
        archivedAt: c.archived_at,
      })),
    };
  });

const passwordSchema = z.string().min(10, "Password must be at least 10 characters.").max(72);

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().toLowerCase().email().max(255),
      role: z.enum(["operator", "admin"]),
      password: passwordSchema,
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { superuser } = await assertManager(context as Ctx);
    if (data.role === "admin" && !superuser) return { ok: false as const, error: "Only a superuser can create admins." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name },
    });
    if (error || !created.user) return { ok: false as const, error: error?.message ?? "Could not create user." };
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false as const, error: "Could not assign role." };
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "STAFF_CREATED", entity_type: "user", entity_id: created.user.id,
      details: { email: data.email, role: data.role },
    });
    return { ok: true as const };
  });

async function guardTarget(ctx: Ctx, superuser: boolean, targetId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", targetId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!superuser && (roles.includes("superuser") || roles.includes("admin")) && targetId !== ctx.userId)
    throw new Error("Only a superuser can manage admin accounts.");
  return { supabaseAdmin, roles };
}

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), password: passwordSchema }).parse(i))
  .handler(async ({ context, data }) => {
    const { superuser } = await assertManager(context as Ctx);
    const { supabaseAdmin } = await guardTarget(context as Ctx, superuser, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) return { ok: false as const, error: error.message };
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "PASSWORD_SET", entity_type: "user", entity_id: data.userId });
    return { ok: true as const };
  });

export const sendResetLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().email(), redirectTo: z.string().url() }).parse(i))
  .handler(async ({ context, data }) => {
    const { superuser } = await assertManager(context as Ctx);
    const { data: roleRows, error: roleError } = await context.supabase.from("user_roles").select("user_id,role");
    if (roleError) throw new Error("Could not check account permissions.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!superuser) {
      for (const row of roleRows ?? []) {
        if (row.role !== "superuser" && row.role !== "admin") continue;
        const { data: target } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        if (target.user?.email?.toLowerCase() === data.email.toLowerCase())
          await guardTarget(context as Ctx, superuser, row.user_id);
      }
    }
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, { redirectTo: data.redirectTo });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    const { superuser } = await assertManager(context as Ctx);
    if (data.userId === context.userId) return { ok: false as const, error: "You cannot disable yourself." };
    const { supabaseAdmin, roles } = await guardTarget(context as Ctx, superuser, data.userId);
    if (roles.includes("superuser")) return { ok: false as const, error: "Superuser accounts cannot be disabled." };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Archive = soft delete: billing history is kept, login is blocked, active services are suspended. */
export const archiveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ customerId: z.string().uuid(), archive: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertManager(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("customers").select("id, user_id, archived_at, archived_by").eq("id", data.customerId).maybeSingle();
    if (!c) return { ok: false as const, error: "Customer not found." };
    const now = new Date().toISOString();
    const { error: archiveError } = await supabaseAdmin
      .from("customers")
      .update(data.archive ? { archived_at: now, archived_by: context.userId } : { archived_at: null, archived_by: null })
      .eq("id", c.id);
    if (archiveError) return { ok: false as const, error: "Could not update the customer archive." };
    if (data.archive) {
      const { error: serviceError } = await supabaseAdmin.from("user_services").update({ status: "SUSPENDED", suspended_at: now }).eq("customer_id", c.id).eq("status", "ACTIVE");
      if (serviceError) return { ok: false as const, error: "Customer access is blocked, but service suspension failed. Retry the archive." };
    }
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(c.user_id, { ban_duration: data.archive ? "876000h" : "none" });
    if (banError) {
      if (!data.archive) await supabaseAdmin.from("customers").update({ archived_at: c.archived_at, archived_by: c.archived_by }).eq("id", c.id);
      return { ok: false as const, error: "Could not update login access. Retry the operation." };
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: data.archive ? "CUSTOMER_ARCHIVED" : "CUSTOMER_RESTORED", entity_type: "customer", entity_id: c.id,
    });
    return { ok: true as const };
  });
