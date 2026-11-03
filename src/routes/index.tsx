import { createFileRoute, redirect } from "@tanstack/react-router";

// Single login page for all roles: everyone goes through /auth.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
