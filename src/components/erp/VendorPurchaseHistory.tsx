import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/erp/Shell";
import { TablePagination } from "@/components/erp/TablePagination";
import type { ProcurementOrder, ProcurementStatus, ProcurementVendor } from "@/procurement.server";
import { PROCUREMENT_STATUSES } from "@/lib/procurement-types";

const PAGE_SIZE = 25;

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function getStatusClass(status: ProcurementStatus) {
  const classes: Record<ProcurementStatus, string> = {
    "Order placed": "bg-slate-700",
    "Payment done": "bg-blue-700",
    "Dispatch done": "bg-orange-700",
    "Delivery done": "bg-emerald-700",
  };
  return classes[status];
}

export function VendorPurchaseHistory({
  vendor,
  orders,
}: {
  vendor: ProcurementVendor;
  orders: ProcurementOrder[];
}) {
  const [query, setQuery] = useState("");
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProcurementStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const subhubs = useMemo(
    () => [...new Set(orders.map((order) => order.subhubName.trim()).filter(Boolean))].sort(),
    [orders],
  );
  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        const searchable = [
          order.orderNumber,
          order.subhubName,
          order.materialName,
          order.materialCode,
          order.notes,
          order.status,
          formatDate(order.orderDate),
          ...order.items.map((item) => `${item.materialName} ${item.materialCode}`),
        ]
          .join(" ")
          .toLowerCase();
        return (
          (!normalized || searchable.includes(normalized)) &&
          (subhubFilter === "all" || order.subhubName === subhubFilter) &&
          (statusFilter === "all" || order.status === statusFilter) &&
          (!fromDate || order.orderDate >= fromDate) &&
          (!toDate || order.orderDate <= toDate)
        );
      })
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  }, [fromDate, orders, query, statusFilter, subhubFilter, toDate]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, query, statusFilter, subhubFilter, toDate]);

  const visibleOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(
    query.trim() || subhubFilter !== "all" || statusFilter !== "all" || fromDate || toDate,
  );

  function clearFilters() {
    setQuery("");
    setSubhubFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  return (
    <Shell
      title={vendor.name}
      subtitle="Purchase history"
      actions={
        <Link
          to="/procurement-management/vendors"
          className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
          Vendor management
        </Link>
      }
    >
      <div className="space-y-6 text-base">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <label className="min-w-[240px] flex-1 text-sm font-medium text-muted-foreground">
            Search history
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label={`Search purchase history for ${vendor.name}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Order, material, SubHub or status"
                className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base font-normal text-foreground outline-none focus:border-primary"
              />
            </span>
          </label>
          <label className="w-full text-sm font-medium text-muted-foreground sm:w-48">
            SubHub
            <span className="relative mt-1 block">
              <select
                value={subhubFilter}
                onChange={(event) => setSubhubFilter(event.target.value)}
                className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-base font-normal text-foreground"
              >
                <option value="all">All SubHubs</option>
                {subhubs.map((subhub) => (
                  <option key={subhub} value={subhub}>
                    {subhub}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </span>
          </label>
          <label className="w-full text-sm font-medium text-muted-foreground sm:w-44">
            Status
            <span className="relative mt-1 block">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as ProcurementStatus | "all")
                }
                className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-base font-normal text-foreground"
              >
                <option value="all">All statuses</option>
                {PROCUREMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </span>
          </label>
          <label className="w-full text-sm font-medium text-muted-foreground sm:w-40">
            Order date from
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground"
            />
          </label>
          <label className="w-full text-sm font-medium text-muted-foreground sm:w-40">
            Order date to
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground"
            />
          </label>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <X aria-hidden="true" className="size-4" />
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[1080px] table-auto text-base">
            <thead className="border-b border-border text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="min-w-40 px-5 py-4 text-left">Order</th>
                <th className="min-w-40 px-5 py-4 text-left">SubHub</th>
                <th className="min-w-64 px-5 py-4 text-left">Materials</th>
                <th className="min-w-20 px-5 py-4 text-right">Qty</th>
                <th className="min-w-36 px-5 py-4 text-left">Ordered</th>
                <th className="min-w-36 px-5 py-4 text-left">Expected</th>
                <th className="min-w-40 px-5 py-4 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/70 align-middle odd:bg-muted/20 hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-5 py-5">
                    <Link
                      to="/po/$id"
                      params={{ id: order.id }}
                      search={{ panel: "procurement", vendorHistoryId: vendor.id }}
                      className="font-semibold text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="break-words px-5 py-5 text-left">{order.subhubName}</td>
                  <td className="min-w-64 break-words px-5 py-5 text-left">
                    {order.items.length
                      ? order.items.map((item) => item.materialName).join(" · ")
                      : order.materialName}
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-5 text-right font-semibold">
                    {order.quantity.toLocaleString("en-IN")}
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-left">
                    {formatDate(order.orderDate)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-left">
                    {formatDate(order.expectedDelivery)}
                  </td>
                  <td className="px-5 py-5 text-left">
                    <span
                      className={`inline-flex min-h-8 items-center rounded-md px-3 py-1 text-sm font-semibold text-white ${getStatusClass(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 ? (
            <p className="p-8 text-center text-base text-muted-foreground">
              {orders.length === 0
                ? "No purchase history is available for this vendor yet."
                : "No purchase orders match these filters. Adjust or clear your filters."}
            </p>
          ) : null}
        </div>
        <TablePagination
          total={filteredOrders.length}
          page={page}
          pageSize={PAGE_SIZE}
          pageSizeOptions={[PAGE_SIZE]}
          showPageSizeSelect={false}
          onPageChange={setPage}
          onPageSizeChange={() => undefined}
        />
      </div>
    </Shell>
  );
}
