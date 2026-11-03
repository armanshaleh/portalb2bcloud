import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Megaphone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { AppShell } from "@/components/app-shell";
import { AnnouncementItem, type Announcement } from "@/components/announcement-list";

export const Route = createFileRoute("/_authenticated/user/announcements")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Announcements · Wise Cloud Portal" },
      { name: "description", content: "Official maintenance, network and incident announcements from Wise Cloud." },
      { property: "og:title", content: "Announcements · Wise Cloud Portal" },
      { property: "og:description", content: "Official announcements from Wise Cloud." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (identity.isStaff) throw redirect({ to: "/backend/announcements" });
    return { identity };
  },
  component: UserAnnouncements,
});

function UserAnnouncements() {
  const { identity } = Route.useRouteContext();
  const { data = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,body,category,is_published,created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  return (
    <AppShell variant="client" title="Announcements" subtitle="Official updates from Wise Cloud" email={identity.email}>
      <div className="mx-auto max-w-3xl space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl border py-16 text-center">
            <Megaphone className="h-8 w-8 text-primary" />
            <p className="font-medium">No announcements yet.</p>
          </div>
        ) : (
          data.map((a) => <AnnouncementItem key={a.id} a={a} />)
        )}
      </div>
    </AppShell>
  );
}
