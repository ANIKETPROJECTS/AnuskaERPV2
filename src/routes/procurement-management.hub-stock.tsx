import { createFileRoute } from "@tanstack/react-router";
import { getProcurementManagementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/procurement-management/hub-stock")({
  loader: () => getProcurementManagementDataFn(),
  head: () => ({
    meta: [
      { title: "Hub Stock & Targets — Gadsons ERP" },
      { name: "description", content: "Review SubHub stock against active production targets." },
    ],
  }),
  component: HubStockPage,
});

function HubStockPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="needs" />;
}
