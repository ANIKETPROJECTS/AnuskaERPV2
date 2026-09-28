import { createFileRoute } from "@tanstack/react-router";
import { ProductionWorkforceDashboard } from "@/components/erp/ProductionWorkforceDashboard";

export const Route = createFileRoute("/production")({
  head: () => ({
    meta: [
      { title: "Production & Workforce — Float ERP" },
      {
        name: "description",
        content: "Combined daily production output and SubHub workforce headcount reports.",
      },
      { property: "og:title", content: "Production & Workforce — Float ERP" },
      {
        property: "og:description",
        content: "Track combined production output and aggregate SubHub attendance over time.",
      },
    ],
  }),
  component: Production,
});

function Production() {
  return <ProductionWorkforceDashboard />;
}