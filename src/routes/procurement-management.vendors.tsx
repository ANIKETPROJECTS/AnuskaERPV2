import { createFileRoute } from "@tanstack/react-router";
import { getProcurementManagementDataFn } from "@/procurement";
import { ProcurementPage } from "@/routes/procurement";

export const Route = createFileRoute("/procurement-management/vendors")({
  loader: () => getProcurementManagementDataFn(),
  head: () => ({
    meta: [
      { title: "Vendor Management — Gadsons ERP" },
      { name: "description", content: "Manage the shared procurement vendor directory." },
    ],
  }),
  component: VendorManagementPage,
});

function VendorManagementPage() {
  return <ProcurementPage result={Route.useLoaderData()} view="vendors" />;
}
