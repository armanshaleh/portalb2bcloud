import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Archive, ArchiveRestore, KeyRound, Loader2, Mail, Plus, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { getMyIdentity } from "@/lib/identity.functions";
import {
  archiveCustomer,
  createStaffUser,
  listManagedUsers,
  sendResetLink,
  setStaffActive,
  setUserPassword,
} from "@/lib/users.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/backend/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Users · Wise Cloud Backend" },
      { name: "description", content: "Manage staff accounts, reset passwords and archive customers." },
      { property: "og:title", content: "Users · Wise Cloud Backend" },
      { property: "og:description", content: "Staff and customer account management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.roles.includes("superuser") && !identity.roles.includes("admin"))
      throw redirect({ to: identity.isStaff ? "/backend/dashboard" : "/user/dashboard" });
    return { identity };
  },
  component: UsersPage,
});

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@!";
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

const pill = "rounded-full px-2.5 py-1 text-xs font-semibold";

function UsersPage() {
  const { identity } = Route.useRouteContext();
  const listFn = useServerFn(listManagedUsers);
  const createFn = useServerFn(createStaffUser);
  const pwFn = useServerFn(setUserPassword);
  const linkFn = useServerFn(sendResetLink);
  const activeFn = useServerFn(setStaffActive);
  const archiveFn = useServerFn(archiveCustomer);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["managed-users"], queryFn: () => listFn() });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "operator" as "operator" | "admin", password: genPassword() });
  const [pwTarget, setPwTarget] = useState<{ userId: string; email: string } | null>(null);
  const [newPw, setNewPw] = useState("");
  const [archTarget, setArchTarget] = useState<{ id: string; code: string; archive: boolean } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  async function run<T extends { ok: boolean; error?: string }>(p: Promise<T>, msg: string) {
    setBusy(true);
    try {
      const r = await p;
      if (!r.ok) return toast.error(r.error ?? "Failed."), false;
      toast.success(msg);
      void refetch();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const staff = data?.staff ?? [];
  const customers = (data?.customers ?? []).filter((c) => (showArchived ? c.archivedAt : !c.archivedAt));
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "";

  return (
    <AppShell variant="staff" title="Users" subtitle="Staff accounts · passwords · customer archive" email={identity.email}>
      <div className="mx-auto max-w-6xl">
        <Tabs defaultValue="staff">
          <TabsList className="mb-4">
            <TabsTrigger value="staff">Staff & operators</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="staff">
            <div className="glass overflow-hidden rounded-3xl border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
                <div>
                  <p className="font-display text-sm font-semibold">Internal team</p>
                  <p className="text-xs text-muted-foreground">{staff.length} accounts</p>
                </div>
                <Button size="sm" onClick={() => { setForm({ name: "", email: "", role: "operator", password: genPassword() }); setAddOpen(true); }}>
                  <Plus /> Add staff
                </Button>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <ul className="divide-y">
                  {staff.map((s) => (
                    <li key={s.userId} className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto]">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name || s.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.email} · last sign-in {s.lastSignIn ? formatDateTime(s.lastSignIn) : "never"}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {s.roles.map((r) => (
                          <span key={r} className={cn(pill, r === "superuser" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                            {r.toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setPwTarget({ userId: s.userId, email: s.email }); setNewPw(genPassword()); }}>
                          <KeyRound /> Password
                        </Button>
                        {!s.roles.includes("superuser") && s.userId !== identity.userId && (
                          <>
                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(activeFn({ data: { userId: s.userId, active: false } }), "Account disabled.")}>
                              <ShieldOff /> Disable
                            </Button>
                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(activeFn({ data: { userId: s.userId, active: true } }), "Account enabled.")}>
                              <ShieldCheck /> Enable
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="customers">
            <div className="glass overflow-hidden rounded-3xl border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
                <div className="flex gap-1.5">
                  <Button size="sm" variant={showArchived ? "ghost" : "secondary"} onClick={() => setShowArchived(false)}>Active</Button>
                  <Button size="sm" variant={showArchived ? "secondary" : "ghost"} onClick={() => setShowArchived(true)}>Archived</Button>
                </div>
                <p className="text-xs text-muted-foreground">{customers.length} customers</p>
              </div>
              {customers.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">{showArchived ? "No archived customers." : "No customers."}</p>
              ) : (
                <ul className="divide-y">
                  {customers.map((c) => (
                    <li key={c.id} className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[9rem_1fr_auto]">
                      <span className="tabular-nums tracking-tight text-sm font-semibold">{c.code}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.email} · {c.archivedAt ? `archived ${formatDateTime(c.archivedAt)}` : c.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {!c.archivedAt && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setPwTarget({ userId: c.userId, email: c.email }); setNewPw(genPassword()); }}>
                              <KeyRound /> Password
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setArchTarget({ id: c.id, code: c.code, archive: true }); setConfirmCode(""); }}>
                              <Archive /> Archive
                            </Button>
                          </>
                        )}
                        {c.archivedAt && (
                          <Button variant="ghost" size="sm" onClick={() => { setArchTarget({ id: c.id, code: c.code, archive: false }); setConfirmCode(c.code); }}>
                            <ArchiveRestore /> Restore
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>The account is active immediately. Share the password securely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "operator" | "admin" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operator — tickets & network</SelectItem>
                  {data?.isSuperuser && <SelectItem value="admin">Admin — full operations</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Initial password</Label>
              <div className="flex gap-2">
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <Button variant="outline" type="button" onClick={() => setForm({ ...form, password: genPassword() })}>Generate</Button>
              </div>
            </div>
            <div className="flex justify-start pt-2">
              <Button disabled={busy} onClick={async () => { if (await run(createFn({ data: form }), "Staff account created.")) setAddOpen(false); }}>
                {busy && <Loader2 className="animate-spin" />} Create account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>{pwTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>New password</Label>
              <div className="flex gap-2">
                <Input value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                <Button variant="outline" type="button" onClick={() => setNewPw(genPassword())}>Generate</Button>
              </div>
            </div>
            <div className="flex flex-wrap justify-start gap-2 pt-2">
              <Button disabled={busy} onClick={async () => { if (pwTarget && (await run(pwFn({ data: { userId: pwTarget.userId, password: newPw } }), "Password updated."))) setPwTarget(null); }}>
                <KeyRound /> Set password
              </Button>
              <Button variant="outline" disabled={busy} onClick={async () => { if (pwTarget && (await run(linkFn({ data: { email: pwTarget.email, redirectTo } }), "Reset link sent."))) setPwTarget(null); }}>
                <Mail /> Email reset link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archTarget} onOpenChange={(o) => !o && setArchTarget(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{archTarget?.archive ? "Archive customer" : "Restore customer"}</DialogTitle>
            <DialogDescription>
              {archTarget?.archive
                ? "Login is blocked and active services are suspended. Invoices, documents and history are kept."
                : "Login is re-enabled. Suspended services stay suspended until reactivated."}
            </DialogDescription>
          </DialogHeader>
          {archTarget?.archive && (
            <div className="space-y-2">
              <Label>Type {archTarget.code} to confirm</Label>
              <Input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
            </div>
          )}
          <div className="flex justify-start pt-2">
            <Button
              variant={archTarget?.archive ? "destructive" : "default"}
              disabled={busy || confirmCode !== archTarget?.code}
              onClick={async () => {
                if (archTarget && (await run(archiveFn({ data: { customerId: archTarget.id, archive: archTarget.archive } }), archTarget.archive ? "Customer archived." : "Customer restored.")))
                  setArchTarget(null);
              }}
            >
              {archTarget?.archive ? "Archive" : "Restore"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
