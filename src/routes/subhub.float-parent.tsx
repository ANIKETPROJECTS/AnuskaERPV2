import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/subhub/float-parent")({
  head: () => ({
    meta: [
      { title: "SubHub — Float ERP" },
      { name: "description", content: "SubHub operations overview." },
    ],
  }),
  component: () => <Navigate to="/subhub" replace />,
});