import { createFileRoute } from "@tanstack/react-router";
import { getProcurementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/admin/procurement/item-requests")({
  loader: () => getProcurementDataFn({ data: { panel: "admin" } }),
  head: () => ({
    meta: [
      { title: "Item Requests — Gadsons ERP" },
      { name: "description", content: "Review and manage item requests from SubHubs." },
    ],
  }),
  component: AdminProcurementItemRequestsPage,
});

function AdminProcurementItemRequestsPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="requests" dedicatedView />;
}