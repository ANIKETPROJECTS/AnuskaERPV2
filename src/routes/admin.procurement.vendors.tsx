import { createFileRoute } from "@tanstack/react-router";
import { getProcurementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/admin/procurement/vendors")({
  loader: () => getProcurementDataFn({ data: { panel: "admin" } }),
  head: () => ({
    meta: [
      { title: "Vendor Management — Gadsons ERP" },
      { name: "description", content: "Manage the shared procurement vendor directory." },
    ],
  }),
  component: AdminProcurementVendorsPage,
});

function AdminProcurementVendorsPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="vendors" dedicatedView />;
}