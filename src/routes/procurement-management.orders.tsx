import { createFileRoute } from "@tanstack/react-router";
import { getProcurementManagementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/procurement-management/orders")({
  loader: () => getProcurementManagementDataFn(),
  head: () => ({
    meta: [
      { title: "Order Management — Gadsons ERP" },
      { name: "description", content: "Manage purchase orders and delivery status." },
    ],
  }),
  component: OrderManagementPage,
});

function OrderManagementPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="orders" />;
}
