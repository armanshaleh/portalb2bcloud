import { createFileRoute, redirect } from "@tanstack/react-router";

// Invitations now live in Users -> Customers; keep the old URL working.
export const Route = createFileRoute("/_authenticated/backend/invitations")({
  head: () => ({ meta: [{ title: "Customer invitations · Wise Cloud Backend" }, { name: "description", content: "Manage Wise Cloud customer invitations in Users." }, { property: "og:title", content: "Customer invitations · Wise Cloud Backend" }, { property: "og:description", content: "Wise Cloud invitation management." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/backend/users", search: { tab: "customers", view: "invites" }, replace: true });
  },
});
