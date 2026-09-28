import { createFileRoute } from "@tanstack/react-router";
import { getProcurementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/admin/procurement/orders")({
  loader: () => getProcurementDataFn({ data: { panel: "admin" } }),
  head: () => ({
    meta: [
      { title: "Order Management — Gadsons ERP" },
      { name: "description", content: "Manage purchase orders and delivery status." },
    ],
  }),
  component: AdminProcurementOrdersPage,
});

function AdminProcurementOrdersPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="orders" dedicatedView />;
}