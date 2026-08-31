import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/subhub/raw-materials")({
  beforeLoad: () => {
    throw redirect({ to: "/raw-materials" });
  },
});