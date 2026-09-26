import { createFileRoute } from "@tanstack/react-router";
import { getProcurementManagementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/procurement-management/item-requests")({
  loader: () => getProcurementManagementDataFn(),
  head: () => ({
    meta: [
      { title: "Item Requests — Gadsons ERP" },
      { name: "description", content: "Review and manage item requests from SubHubs." },
    ],
  }),
  component: ItemRequestsPage,
});

function ItemRequestsPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="requests" />;
}
