import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { AppShell } from "@/components/app-shell";
import { AnnouncementItem, CATEGORY_LABEL, type Announcement } from "@/components/announcement-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/backend/announcements")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Announcements · Wise Cloud Backend" },
      { name: "description", content: "Publish maintenance, network upgrade and incident announcements to customers." },
      { property: "og:title", content: "Announcements · Wise Cloud Backend" },
      { property: "og:description", content: "Publish official announcements to Wise Cloud customers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/announcements" });
    return { identity };
  },
  component: StaffAnnouncements,
});

type Cat = Announcement["category"];

function StaffAnnouncements() {
  const { identity } = Route.useRouteContext();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Cat>("GENERAL");
  const [saving, setSaving] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["announcements", "staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,body,category,is_published,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["announcements"] });

  async function publish(published: boolean) {
    if (title.trim().length < 3 || body.trim().length < 3) { toast.error("Title and message are required."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("announcements")
      .insert({ title: title.trim(), body: body.trim(), category, is_published: published });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(published ? "Announcement published to all verified customers." : "Saved as draft.");
    setTitle("");
    setBody("");
    void refresh();
  }

  async function togglePublish(a: Announcement) {
    const { error } = await supabase.from("announcements").update({ is_published: !a.is_published }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    void refresh();
  }
  async function remove(a: Announcement) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    void refresh();
  }

  return (
    <AppShell variant="staff" title="Announcements" subtitle="Broadcast official updates to customers" email={identity.email}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[380px_1fr]">
        <section className="glass h-fit space-y-4 rounded-3xl border p-5">
          <h2 className="font-display font-semibold">New announcement</h2>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Cat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-title">Title</Label>
            <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-body">Message</Label>
            <Textarea id="a-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving} onClick={() => void publish(true)}>Publish</Button>
            <Button variant="outline" disabled={saving} onClick={() => void publish(false)}>Save draft</Button>
          </div>
        </section>
        <section className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : data.length === 0 ? (
            <p className="glass rounded-3xl border py-16 text-center text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            data.map((a) => (
              <AnnouncementItem
                key={a.id}
                a={a}
                actions={
                  <>
                    <Button size="sm" variant="outline" onClick={() => void togglePublish(a)}>
                      {a.is_published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(a)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                }
              />
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
