import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { VendorPurchaseHistory } from "@/components/erp/VendorPurchaseHistory";
import { getProcurementManagementDataFn } from "@/procurement";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

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
  const loaderResult = Route.useLoaderData();
  const { vendorId } = Route.useParams();
  const [result, setResult] = useState(loaderResult);
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setResult(loaderResult);
  }, [loaderResult]);

  async function refreshData(isBackgroundRefresh: boolean) {
    if (!isBackgroundRefresh) setRefreshing(true);
    try {
      const response = await getProcurementManagementDataFn();
      if (response.ok) {
        setResult(response);
        setRefreshError("");
      } else {
        setRefreshError(response.message);
      }
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Unable to refresh vendor purchase history.");
    } finally {
      if (!isBackgroundRefresh) setRefreshing(false);
    }
  }

  const runRefresh = useAutoRefresh(refreshData);

  if (!result.ok) {
    return (
      <Shell title="Vendor purchase history">
        <p role="alert" className="border-b border-border py-4 text-base text-destructive">
          {result.message}
        </p>
        <button
          type="button"
          onClick={() => void runRefresh(false)}
          disabled={refreshing}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Retry"}
        </button>
      </Shell>
    );
  }

  const vendor = result.data.vendors.find((item) => item.id === vendorId);
  if (!vendor) {
    return (
      <Shell
        title="Vendor not found"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runRefresh(false)}
              disabled={refreshing}
              className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              to="/procurement-management/vendors"
              className="inline-flex min-h-12 items-center rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted"
            >
              Back to vendor management
            </Link>
          </div>
        }
      >
        <p className="border-b border-border py-4 text-base text-muted-foreground">
          This vendor is unavailable or has been removed.
        </p>
      </Shell>
    );
  }

  const orders = result.data.orders.filter((order) => order.vendorId === vendor.id);
  return (
    <>
      {refreshError ? (
        <p role="alert" className="border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Showing the last loaded purchase history. {refreshError}
        </p>
      ) : null}
      <VendorPurchaseHistory vendor={vendor} orders={orders} />
    </>
  );
}
