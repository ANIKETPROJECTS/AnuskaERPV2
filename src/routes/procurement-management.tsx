import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/procurement-management")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/procurement-management") {
      throw redirect({ to: "/procurement-management/orders" });
    }
  },
});
