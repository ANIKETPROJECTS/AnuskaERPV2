import { createFileRoute } from "@tanstack/react-router";
import { getProcurementDataFn } from "@/procurement";
import { ProcurementOrderBuilderPage } from "@/routes/procurement";

export const Route = createFileRoute("/admin/procurement/new-order")({
  loader: () => getProcurementDataFn({ data: { panel: "admin" } }),
  head: () => ({
    meta: [
      { title: "New Procurement Order — Gadsons ERP" },
      { name: "description", content: "Assign purchase-order materials across multiple factories." },
    ],
  }),
  component: NewAdminProcurementOrderPage,
});

function NewAdminProcurementOrderPage() {
  return (
    <ProcurementOrderBuilderPage
      result={Route.useLoaderData()}
      panel="admin"
      backTo="/admin/procurement/orders"
    />
  );
}
