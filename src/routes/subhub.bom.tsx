import { createFileRoute } from "@tanstack/react-router";
import { BomPage } from "./bom";

export const Route = createFileRoute("/subhub/bom")({
  component: () => <BomPage readOnly />,
});