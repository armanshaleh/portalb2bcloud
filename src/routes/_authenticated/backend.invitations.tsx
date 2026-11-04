import { createFileRoute, redirect } from "@tanstack/react-router";

// Invitations now live in Users -> Customers; keep the old URL working.
export const Route = createFileRoute("/_authenticated/backend/invitations")({
  beforeLoad: () => {
    throw redirect({ to: "/backend/users", search: { tab: "customers", view: "invites" } as never, replace: true });
  },
});
