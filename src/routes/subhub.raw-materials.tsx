import { createFileRoute } from "@tanstack/react-router";
import { RawMaterialsPage } from "./raw-materials";

export const Route = createFileRoute("/subhub/raw-materials")({
  component: () => <RawMaterialsPage readOnly />,
});