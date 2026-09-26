import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/erp/Shell";
import { VendorPurchaseHistory } from "@/components/erp/VendorPurchaseHistory";
import { getProcurementManagementDataFn } from "@/procurement";

export const Route = createFileRoute("/procurement-management/vendor-history/$vendorId")({
  loader: () => getProcurementManagementDataFn(),
  head: () => ({
    meta: [
      { title: "Vendor purchase history — Gadsons ERP" },
      {
        name: "description",
        content: "Search and filter purchase history for a procurement vendor.",
      },
    ],
  }),
  component: VendorHistoryPage,
});

function VendorHistoryPage() {
  const result = Route.useLoaderData();
  const { vendorId } = Route.useParams();

  if (!result.ok) {
    return (
      <Shell title="Vendor purchase history">
        <p role="alert" className="border-b border-border py-4 text-base text-destructive">
          {result.message}
        </p>
      </Shell>
    );
  }

  const vendor = result.data.vendors.find((item) => item.id === vendorId);
  if (!vendor) {
    return (
      <Shell
        title="Vendor not found"
        actions={
          <Link
            to="/procurement-management/vendors"
            className="inline-flex min-h-12 items-center rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted"
          >
            Back to vendor management
          </Link>
        }
      >
        <p className="border-b border-border py-4 text-base text-muted-foreground">
          This vendor is unavailable or has been removed.
        </p>
      </Shell>
    );
  }

  const orders = result.data.orders.filter((order) => order.vendorId === vendor.id);
  return <VendorPurchaseHistory vendor={vendor} orders={orders} />;
}
