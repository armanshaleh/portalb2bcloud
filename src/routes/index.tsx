import { createFileRoute, redirect } from "@tanstack/react-router";

// Single login page for all roles: everyone goes through /auth.
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Wise Cloud Portal" }, { name: "description", content: "Secure Wise Cloud customer and staff portal." }, { property: "og:title", content: "Wise Cloud Portal" }, { property: "og:description", content: "Secure Wise Cloud portal access." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
