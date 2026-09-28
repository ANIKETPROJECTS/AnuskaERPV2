import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardList,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductionTargetsNav } from "@/components/erp/ProductionTargetsNav";
import { Shell } from "@/components/erp/Shell";
import { Tag } from "@/components/erp/bits";
import { TablePagination } from "@/components/erp/TablePagination";
import { listAssignableSubhubsFn, listProductionOrdersFn } from "@/production";
import type { AssignableSubhub, ProductionOrder } from "@/production.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders & Production Targets — Float ERP" },
      { name: "description", content: "Assign real production targets to SubHubs and track completed output by order." },
    ],
  }),
  component: Orders,
});

function statusTone(status: ProductionOrder["status"]): "good" | "warn" | "bad" | "neutral" {
  if (status === "Complete") return "good";
  if (status === "Over target") return "good";
  if (status === "In progress") return "warn";
  return "neutral";
}

function formatOrderDate(value: string) {
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: value.includes("T") ? "Asia/Kolkata" : "UTC" }).format(parsed);
}

function Orders() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [subhubs, setSubhubs] = useState<AssignableSubhub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProductionOrder["status"] | "all">("all");
  const [orderPage, setOrderPage] = useState(1);
  const orderPageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const [ordersResult, subhubResult] = await Promise.all([listProductionOrdersFn(), listAssignableSubhubsFn()]);
    if (ordersResult.ok) setOrders(ordersResult.orders);
    else setError(ordersResult.message);
    if (subhubResult.ok) setSubhubs(subhubResult.subhubs);
    else setError(subhubResult.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      const searchable = [
        order.orderNumber,
        order.subhubName,
        order.productCode,
        order.productName,
        order.variantCode,
        order.variantName,
        order.notes,
      ].join(" ").toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesSubhub = subhubFilter === "all" || order.subhubUserId === subhubFilter;
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesSubhub && matchesStatus;
    });
    return [...filtered].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [orders, search, statusFilter, subhubFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [search, statusFilter, subhubFilter]);

  const paginatedOrders = useMemo(() => {
    const pageCount = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
    const currentPage = Math.min(orderPage, pageCount);
    const start = (currentPage - 1) * orderPageSize;
    return filteredOrders.slice(start, start + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  return (
    <Shell
      title="Orders & Production Targets"
      subtitle="Assign work to SubHubs and track daily production"
      actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
      }
    >
      <div className="space-y-5">
        <ProductionTargetsNav active="orders" />
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <section aria-labelledby="production-orders-heading" className="space-y-4">
          <div>
            <h2 id="production-orders-heading" className="text-base font-semibold">Production orders</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search or filter the work assigned to each SubHub.</p>
          </div>
          <div className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="min-w-56 flex-1 text-xs font-medium text-muted-foreground">
              Search orders
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order, SubHub or product"
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground sm:min-w-44">
              SubHub
              <select
                value={subhubFilter}
                onChange={(event) => setSubhubFilter(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
              >
                <option value="all">All SubHubs</option>
                {subhubs.map((subhub) => (
                  <option key={subhub.id} value={subhub.id}>{subhub.subhubName}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground sm:min-w-40">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
              >
                <option value="all">All statuses</option>
                <option value="Unstarted">Not started</option>
                <option value="In progress">In progress</option>
                <option value="Complete">Complete</option>
                <option value="Over target">Over target</option>
              </select>
            </label>
            {(search || subhubFilter !== "all" || statusFilter !== "all") ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSubhubFilter("all");
                  setStatusFilter("all");
                }}
                className="h-10 px-2 text-sm font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            ) : null}
            <p className="pb-2 text-xs text-muted-foreground sm:ml-auto">
              {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}
            </p>
          </div>
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading production orders…</p>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No production orders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Assign a target to start tracking daily production.</p>
              <Link to="/production-targets" className="rule-header mt-4 inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium">
                <Plus className="size-4" /> Assign targets
              </Link>
            </div>
          ) : !filteredOrders.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No orders match these filters.</p>
          ) : (
            <div className="overflow-x-auto border-y border-border">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order / SubHub</th>
                    <th className="px-4 py-3 font-medium">Product / variant</th>
                    <th className="px-4 py-3 text-right font-medium">Target</th>
                    <th className="px-4 py-3 text-right font-medium">Produced</th>
                    <th className="px-4 py-3 text-right font-medium">Remaining</th>
                    <th className="px-4 py-3 font-medium">Due date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredOrders.length > 0 ? (
            <TablePagination
              total={filteredOrders.length}
              page={orderPage}
              pageSize={orderPageSize}
              onPageChange={setOrderPage}
              onPageSizeChange={() => undefined}
              showPageSizeSelect={false}
            />
          ) : null}
        </section>

      </div>
    </Shell>
  );
}
function OrderRow({ order }: { order: ProductionOrder }) {
  return (
    <tr className="border-b border-border/70 hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          to="/production-orders/$orderId"
          params={{ orderId: order.id }}
          className="tabular font-semibold text-primary hover:underline"
        >
          {order.orderNumber}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">{order.subhubName}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium">{order.productName}</p>
        <p className="mt-1 text-xs text-muted-foreground">{order.variantName} · {order.variantCode}</p>
      </td>
      <td className="tabular px-4 py-3 text-right font-medium">{num(order.target)}</td>
      <td className="tabular px-4 py-3 text-right">{num(order.produced)}</td>
      <td className="tabular px-4 py-3 text-right font-medium">{num(order.remaining)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-xs">{formatOrderDate(order.dueDate)}</td>
      <td className="px-4 py-3"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td>
      <td className="px-4 py-3 text-right">
        <Link
          to="/production-orders/$orderId"
          params={{ orderId: order.id }}
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-primary/5"
        >
          View details <ArrowRight className="size-4" />
        </Link>
      </td>
    </tr>
  );
}
