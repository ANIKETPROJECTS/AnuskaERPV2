import { createFileRoute } from "@tanstack/react-router";
import { getProcurementManagementDataFn } from "@/procurement";
import { ProcurementOrderBuilderPage } from "@/routes/procurement";

export const Route = createFileRoute("/procurement-management/new-order")({
  loader: () => getProcurementManagementDataFn(),
  head: () => ({
    meta: [
      { title: "New Procurement Order — Gadsons ERP" },
      { name: "description", content: "Assign purchase-order materials across multiple factories." },
    ],
  }),
  component: NewManagedProcurementOrderPage,
});

function NewManagedProcurementOrderPage() {
  return (
    <ProcurementOrderBuilderPage
      result={Route.useLoaderData()}
      panel="procurement"
      backTo="/procurement-management/orders"
    />
  );
}
