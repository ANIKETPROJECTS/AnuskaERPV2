import { createFileRoute } from "@tanstack/react-router";
import { getProcurementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/admin/procurement/hub-stock")({
  loader: () => getProcurementDataFn({ data: { panel: "admin" } }),
  head: () => ({
    meta: [
      { title: "Hub Stock & Targets — Gadsons ERP" },
      { name: "description", content: "Review SubHub stock against active production targets." },
    ],
  }),
  component: AdminProcurementHubStockPage,
});

function AdminProcurementHubStockPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="needs" dedicatedView />;
}