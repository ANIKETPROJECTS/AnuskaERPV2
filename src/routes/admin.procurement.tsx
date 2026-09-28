import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/procurement")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin/procurement") {
      throw redirect({ to: "/admin/procurement/orders" });
    }
  },
});