import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyIdentity = {
  userId: string;
  email: string;
  roles: string[];
  isStaff: boolean;
};

/** Identity + role lookup for the signed-in user (roles live only in user_roles). */
const fetchMyIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyIdentity> => {
    const { supabase, userId } = context;
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? "";
    const { data: roleRows, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error("Could not load your profile.");
    const roles = (roleRows ?? []).map((r) => r.role as string);
    return {
      userId,
      email,
      roles,
      isStaff: roles.some((r) => r === "superuser" || r === "admin" || r === "operator"),
    };
  });

/** Retries transient network drops (e.g. server reload) before giving up. */
export async function getMyIdentity(): Promise<MyIdentity> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetchMyIdentity();
    } catch (e) {
      lastError = e;
      if (!(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}
