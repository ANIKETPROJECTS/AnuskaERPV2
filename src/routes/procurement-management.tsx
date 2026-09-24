import { createFileRoute } from "@tanstack/react-router";
import { ProcurementPage } from "@/routes/procurement";
import { getProcurementManagementDataFn } from "@/procurement";

export const Route = createFileRoute("/procurement-management")({
  loader: () => getProcurementManagementDataFn(),
  head: () => ({
    meta: [
      { title: "Procurement Management — Gadsons ERP" },
      { name: "description", content: "Review SubHub raw-material needs, purchase orders, vendors, and item requests." },
    ],
  }),
  component: ProcurementManagementPage,
});

function ProcurementManagementPage() {
  return <ProcurementPage result={Route.useLoaderData()} />;
}