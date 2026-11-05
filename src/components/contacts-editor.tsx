import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Contact = { id: string; contact_type: string; name: string; email: string; phone: string | null; position: string | null };
type Form = { name: string; email: string; phone: string; position: string };

const TYPES = ["BILLING", "TECHNICAL"] as const;
const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Invalid email").max(200),
  phone: z.string().trim().max(30).regex(/^[0-9+\-\s()]*$/, "Invalid phone"),
  position: z.string().trim().max(100),
});

function toForm(c?: Contact): Form {
  return { name: c?.name ?? "", email: c?.email ?? "", phone: c?.phone ?? "", position: c?.position ?? "" };
}

/** Lets a client keep their own Billing and Technical PIC up to date (RLS: owner manage). */
export function ContactsEditor({ customerId, contacts, onSaved }: { customerId: string; contacts: Contact[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const byType = (t: string) => contacts.find((c) => c.contact_type === t);
  const [forms, setForms] = useState<Record<string, Form>>({});

  function start() {
    setForms(Object.fromEntries(TYPES.map((t) => [t, toForm(byType(t))])));
    setOpen(true);
  }

  async function save() {
    const rows = [];
    for (const t of TYPES) {
      const parsed = schema.safeParse(forms[t]);
      if (!parsed.success) return void toast.error(`${t}: ${parsed.error.issues[0]?.message}`);
      rows.push({
        customer_id: customerId,
        contact_type: t,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        position: parsed.data.position || null,
      });
    }
    setBusy(true);
    const { error } = await supabase.from("customer_contacts").upsert(rows, { onConflict: "customer_id,contact_type" });
    setBusy(false);
    if (error) return void toast.error("Could not save contacts.");
    toast.success("Contacts updated.");
    setOpen(false);
    onSaved();
  }

  const set = (t: string, k: keyof Form, v: string) => setForms((f) => ({ ...f, [t]: { ...(f[t] ?? toForm()), [k]: v } }));

  return (
    <>
      <Button size="sm" variant="outline" onClick={start}>
        <Pencil /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>PIC contacts</DialogTitle>
            <DialogDescription>Keep your Billing and Technical contacts current so invoices and alerts reach the right people.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {TYPES.map((t) => (
              <div key={t} className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t === "BILLING" ? "Billing PIC" : "Technical PIC"}</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Name</Label><Input value={forms[t]?.name ?? ""} onChange={(e) => set(t, "name", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={forms[t]?.email ?? ""} onChange={(e) => set(t, "email", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={forms[t]?.phone ?? ""} onChange={(e) => set(t, "phone", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Position</Label><Input value={forms[t]?.position ?? ""} onChange={(e) => set(t, "position", e.target.value)} /></div>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button disabled={busy} onClick={() => void save()}>
                {busy && <Loader2 className="animate-spin" />} Save contacts
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
