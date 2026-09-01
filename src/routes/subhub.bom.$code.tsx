import { createFileRoute } from "@tanstack/react-router";
import { BomStructurePage } from "./bom.$code";

export const Route = createFileRoute("/subhub/bom/$code")({
  component: () => {
    const { code } = Route.useParams();
    return <BomStructurePage code={code} readOnly />;
  },
});