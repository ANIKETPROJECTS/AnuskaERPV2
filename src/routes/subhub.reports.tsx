import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/subhub/reports")({
  head: () => ({ meta: [{ title: "Hub Reports — SubHub" }] }),
  component: () => <Navigate to="/subhub/production" replace />,
});