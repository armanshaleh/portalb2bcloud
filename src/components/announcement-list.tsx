import { Badge } from "@/components/ui/badge";

export const CATEGORY_LABEL = {
  MAINTENANCE: "Scheduled maintenance",
  NETWORK_UPGRADE: "Network upgrade",
  INCIDENT: "Emergency incident",
  GENERAL: "General info",
} as const;

export type Announcement = {
  id: string;
  title: string;
  body: string;
  category: keyof typeof CATEGORY_LABEL;
  is_published: boolean;
  created_at: string;
};

export function AnnouncementItem({ a, actions }: { a: Announcement; actions?: React.ReactNode }) {
  const variant = a.category === "INCIDENT" ? "danger" : a.category === "MAINTENANCE" ? "warning" : "success";
  return (
    <article className="glass rounded-3xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={variant}>{CATEGORY_LABEL[a.category]}</Badge>
          {!a.is_published && <Badge variant="outline">Draft</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</span>
      </div>
      <h3 className="mt-3 font-display text-base font-semibold">{a.title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
      {actions && <div className="mt-4 flex gap-2">{actions}</div>}
    </article>
  );
}
