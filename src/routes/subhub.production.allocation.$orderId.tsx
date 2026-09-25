import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/subhub/production/allocation/$orderId")({
  beforeLoad: () => {
    throw redirect({ to: "/subhub/production" });
  },
});
