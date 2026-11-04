import type React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Copy, Loader2, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";

import { createInvitation, listInvitations, revokeInvitation, type InvitationRow } from "@/lib/invitation.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function inviteState(i: InvitationRow) {
  if (i.accepted_at) return { label: "Accepted", cls: "bg-success/15 text-success" };
  if (i.revoked_at) return { label: "Revoked", cls: "bg-muted text-muted-foreground" };
  if (new Date(i.expires_at).getTime() < Date.now()) return { label: "Expired", cls: "bg-destructive/15 text-destructive" };
  return { label: "Awaiting sign-up", cls: "bg-primary/15 text-primary" };
}

export function InvitationsPanel({ toolbar }: { toolbar?: React.ReactNode }) {
  const listFn = useServerFn(listInvitations);
  const createFn = useServerFn(createInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["invitations"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"ENT" | "IND">("ENT");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    const res = await createFn({ data: { email, customerType: type, displayName: name } });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setLink(`${window.location.origin}/register?token=${res.token}`);
    void refetch();
  }

  function reset() {
    setOpen(false);
    setLink(null);
    setEmail("");
    setName("");
    setType("ENT");
  }

  async function handleRevoke(id: string) {
    const res = await revokeFn({ data: { id } });
    if (!res.ok) return void toast.error("Could not revoke.");
    toast.success("Invitation revoked.");
    void refetch();
  }

  const invitations = data?.invitations ?? [];

  return (
    <>
      <div className="glass overflow-hidden rounded-3xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
          {toolbar}
          <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-muted-foreground">{invitations.length} invitations</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Invite client
          </Button>
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : invitations.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No invitations yet.</p>
        ) : (
          <ul className="divide-y">
            {invitations.map((i) => {
              const st = inviteState(i);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  {i.customer_type === "ENT" ? (
                    <Building2 className="h-5 w-5 text-primary" />
                  ) : (
                    <UserRound className="h-5 w-5 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.email} · {i.customer_type} · sent {formatDateTime(i.created_at)}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.cls)}>{st.label}</span>
                  {st.label === "Awaiting sign-up" && (
                    <Button variant="ghost" size="sm" onClick={() => void handleRevoke(i.id)}>
                      Revoke
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{link ? "Invitation ready" : "Invite client"}</DialogTitle>
            <DialogDescription>
              {link
                ? "Send this one-time link to the client. It expires in 14 days and is shown only once."
                : "The client sets a password and completes KYC from this link."}
            </DialogDescription>
          </DialogHeader>
          {link ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={link} className="tabular-nums tracking-tight text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy link"
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    toast.success("Link copied.");
                  }}
                >
                  <Copy />
                </Button>
              </div>
              <Button className="w-full" onClick={reset}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
                {(["ENT", "IND"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-xl py-2 text-sm font-medium transition-all duration-300 ease-spring",
                      type === t ? "bg-card shadow-elevated" : "text-muted-foreground",
                    )}
                  >
                    {t === "ENT" ? "Corporate (ENT)" : "Individual (IND)"}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-name">{type === "ENT" ? "Company name" : "Full name"}</Label>
                <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-email">Email</Label>
                <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button
                className="w-full"
                disabled={busy || !name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                onClick={() => void handleCreate()}
              >
                {busy && <Loader2 className="animate-spin" />} Create invitation link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
