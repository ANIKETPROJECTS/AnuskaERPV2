import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Edit3,
  History,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { TablePagination } from "@/components/erp/TablePagination";
import { getAdminProductionDashboardFn, getProductionOrderActivityFn, listAssignableSubhubsFn, reassignProductionOrderFn, setAdminHubCapacityFn } from "@/production";
import { deleteProductionOrderFn, updateProductionOrderFn } from "@/production";
import type { AdminProductionDashboard, AssignableSubhub, ProductionOrder, ProductionOrderActivity } from "@/production.server";
import { bomCatalog } from "@/lib/bom-catalog";
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

type OrderDateField = "all" | "assigned" | "due";
type OrderSort = "assigned-newest" | "assigned-oldest" | "due-soonest" | "due-latest" | "target-high" | "remaining-high" | "progress-high";
type SaveHubCapacity = (subhubUserId: string, capacityUnits: number | null) => Promise<{ ok: true } | { ok: false; message: string }>;

function dateOnly(value: string) {
  if (!value.includes("T")) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(parsed).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}

function formatOrderDate(value: string) {
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: value.includes("T") ? "Asia/Kolkata" : "UTC" }).format(parsed);
}

function Orders() {
  const auth = useAuth();
  const isMasterAdmin = auth.user?.role === "master_admin";
  const [dashboard, setDashboard] = useState<AdminProductionDashboard | null>(null);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [subhubs, setSubhubs] = useState<AssignableSubhub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Record<string, ProductionOrderActivity[]>>({});
  const [activityLoading, setActivityLoading] = useState("");
  const [reassigningOrderId, setReassigningOrderId] = useState("");
  const [search, setSearch] = useState("");
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProductionOrder["status"] | "all">("all");
  const [dateField, setDateField] = useState<OrderDateField>("all");
  const [dateValue, setDateValue] = useState("");
  const [sort, setSort] = useState<OrderSort>("assigned-newest");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);
  const [savingCapacityId, setSavingCapacityId] = useState("");
  const [capacitySuccess, setCapacitySuccess] = useState("");
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [savingOrderId, setSavingOrderId] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [dashboardResult, subhubResult] = await Promise.all([getAdminProductionDashboardFn(), listAssignableSubhubsFn()]);
    if (dashboardResult.ok) {
      setDashboard(dashboardResult.data);
      setOrders(dashboardResult.data.orders);
    } else setError(dashboardResult.message);
    if (subhubResult.ok) setSubhubs(subhubResult.subhubs);
    else setError(subhubResult.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalTarget = orders.reduce((sum, order) => sum + order.target, 0);
  const totalProduced = orders.reduce((sum, order) => sum + order.produced, 0);
  const totalRemaining = orders.reduce((sum, order) => sum + order.remaining, 0);
  const completion = totalTarget ? Math.round((totalProduced / totalTarget) * 100) : 0;
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
      const matchesDate = !dateValue || dateField === "all"
        || (dateField === "assigned" && dateOnly(order.createdAt) === dateValue)
        || (dateField === "due" && order.dueDate === dateValue);
      return matchesSearch && matchesSubhub && matchesStatus && matchesDate;
    });
    return [...filtered].sort((left, right) => {
      if (sort === "assigned-oldest") return left.createdAt.localeCompare(right.createdAt);
      if (sort === "due-soonest") return left.dueDate.localeCompare(right.dueDate) || right.createdAt.localeCompare(left.createdAt);
      if (sort === "due-latest") return right.dueDate.localeCompare(left.dueDate) || right.createdAt.localeCompare(left.createdAt);
      if (sort === "target-high") return right.target - left.target || right.createdAt.localeCompare(left.createdAt);
      if (sort === "remaining-high") return right.remaining - left.remaining || right.createdAt.localeCompare(left.createdAt);
      if (sort === "progress-high") return (right.target ? right.produced / right.target : 0) - (left.target ? left.produced / left.target : 0);
      return right.createdAt.localeCompare(left.createdAt);
    });
  }, [dateField, dateValue, orders, search, sort, statusFilter, subhubFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [dateField, dateValue, search, sort, statusFilter, subhubFilter]);

  const paginatedOrders = useMemo(() => {
    const pageCount = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
    const currentPage = Math.min(orderPage, pageCount);
    const start = (currentPage - 1) * orderPageSize;
    return filteredOrders.slice(start, start + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  async function toggleActivity(orderId: string) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (activities[orderId]) return;
    setActivityLoading(orderId);
    const result = await getProductionOrderActivityFn({ data: { orderId, panel: "admin" } });
    if (result.ok) setActivities((current) => ({ ...current, [orderId]: result.activities }));
    else setError(result.message);
    setActivityLoading("");
  }

  async function reassignOrder(orderId: string, subhubUserId: string, reason: string) {
    setReassigningOrderId(orderId);
    setError("");
    const result = await reassignProductionOrderFn({ data: { orderId, subhubUserId, reason } });
    if (!result.ok) {
      setError(result.message);
    } else {
      setActivities((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setExpandedOrderId(null);
      await load();
    }
    setReassigningOrderId("");
  }

  async function saveHubCapacity(subhubUserId: string, capacityUnits: number | null) {
    setSavingCapacityId(subhubUserId);
    setCapacitySuccess("");
    setError("");
    const result = await setAdminHubCapacityFn({ data: { subhubUserId, capacityUnits } });
    if (!result.ok) {
      setError(result.message);
    } else {
      setCapacitySuccess(`Hub capacity updated${result.reassignments.length ? ` · ${result.reassignments.length} order${result.reassignments.length === 1 ? "" : "s"} automatically reassigned` : ""}.`);
      await load();
    }
    setSavingCapacityId("");
    return result;
  }

  async function saveTarget(input: {
    orderId: string;
    subhubUserId: string;
    productCode: string;
    variantCode: string;
    target: number;
    dueDate: string;
    notes: string;
  }) {
    setSavingOrderId(input.orderId);
    setError("");
    setOrderSuccess("");
    const result = await updateProductionOrderFn({ data: input });
    if (!result.ok) {
      setError(result.message);
    } else {
      setEditingOrder(null);
      setActivities((current) => {
        const next = { ...current };
        delete next[input.orderId];
        return next;
      });
      setOrderSuccess(`${result.order.orderNumber} was updated successfully.`);
      await load();
    }
    setSavingOrderId("");
  }

  async function deleteTarget(order: ProductionOrder) {
    if (!window.confirm(`Delete ${order.orderNumber}? This will permanently remove the target, its production reports, and its activity history.`)) return;
    setSavingOrderId(order.id);
    setError("");
    setOrderSuccess("");
    const result = await deleteProductionOrderFn({ data: { orderId: order.id } });
    if (!result.ok) {
      setError(result.message);
    } else {
      setExpandedOrderId(null);
      setActivities((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      setOrderSuccess(`${result.orderNumber} was deleted successfully.`);
      await load();
    }
    setSavingOrderId("");
  }

  return (
    <Shell
      title="Orders & Production Targets"
      subtitle="Set hub capacity, assign work, and analyze manager-entered production"
      actions={
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
            <RefreshCw className="size-4" /> Refresh
          </button>
          <Link to="/production-targets" className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
            <Plus className="size-4" /> Assign target
          </Link>
        </div>
      }
    >
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Assigned target" value={num(totalTarget)} hint={`${orders.length} live orders`} />
          <Kpi label="Produced" value={num(totalProduced)} tone="good" hint="manager-entered output" />
          <Kpi label="Remaining" value={num(totalRemaining)} tone="warn" hint="across assigned orders" />
          <Kpi label="Completion" value={`${completion}%`} tone={completion >= 100 ? "good" : "neutral"} hint="all SubHubs combined" />
        </div>

        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {capacitySuccess ? <p role="status" className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">{capacitySuccess}</p> : null}
        {orderSuccess ? <p role="status" className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">{orderSuccess}</p> : null}
        <details className="panel group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Hub capacity & workload</h2>
              <p className="text-xs text-muted-foreground">Capacity is declared by each Hub Manager. Review live workload and automatic reassignment settings.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-primary">
              View workload
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="divide-y divide-border">
            {loading && !dashboard ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading hub capacity…</p>
            ) : dashboard?.hubs.length ? (
              dashboard.hubs.map((hub) => (
                <HubCapacityRow
                  key={hub.userId}
                  hub={hub}
                  saving={savingCapacityId === hub.userId}
                  onSave={saveHubCapacity}
                />
              ))
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">Create an active SubHub Manager to define capacity.</p>
            )}
          </div>
        </details>

        {dashboard ? <ProductionCharts dashboard={dashboard} /> : null}

        {dashboard?.recentReassignments.length ? (
          <details className="panel group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Recent automatic reassignments</h2>
                <p className="text-xs text-muted-foreground">Orders moved when their previous hub exceeded its configured active target capacity.</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-primary">
                {dashboard.recentReassignments.length} recent
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="divide-y divide-border">
              {dashboard.recentReassignments.map((reassignment, index) => (
                <div key={`${reassignment.orderNumber}-${reassignment.createdAt}-${index}`} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{reassignment.orderNumber} · {reassignment.variantName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{reassignment.productName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Tag tone="warn">{reassignment.fromHub}</Tag>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <Tag tone="good">{reassignment.toHub}</Tag>
                  </div>
                  <time className="text-xs text-muted-foreground">{reassignment.createdAt.slice(0, 10)}</time>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <Panel title="Assigned production orders" description="Each order belongs to one SubHub and can be reported against day by day.">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading live orders…</p>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No production targets assigned yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Assign the first order to a SubHub Manager to start collecting daily output.</p>
               <Link to="/production-targets" className="rule-header mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
                <Plus className="size-4" /> Assign target
               </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border-b border-border">
                <div className="flex min-w-max items-end gap-3 px-5 py-4">
                  <label className="text-xs font-medium">
                    Search orders
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Order, SubHub, Float, variant, notes…"
                      className="mt-1.5 h-9 w-72 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary"
                    />
                  </label>
                  <label className="text-xs font-medium">
                    SubHub
                    <select value={subhubFilter} onChange={(event) => setSubhubFilter(event.target.value)} className="mt-1.5 h-9 min-w-48 rounded-md border border-input bg-background px-3 text-sm font-normal">
                      <option value="all">All SubHubs</option>
                      {subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.subhubName}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Status
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-1.5 h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm font-normal">
                      <option value="all">All statuses</option>
                      <option value="Unstarted">Unstarted</option>
                      <option value="In progress">In progress</option>
                      <option value="Complete">Complete</option>
                      <option value="Over target">Over target</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Date field
                    <select
                      value={dateField}
                      onChange={(event) => {
                        const nextField = event.target.value as OrderDateField;
                        setDateField(nextField);
                        if (nextField === "all") setDateValue("");
                      }}
                      className="mt-1.5 h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm font-normal"
                    >
                      <option value="all">All dates</option>
                      <option value="assigned">Assigned on</option>
                      <option value="due">Due on</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Specific date
                    <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} disabled={dateField === "all"} className="mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50" />
                  </label>
                  <label className="text-xs font-medium">
                    Sort by
                    <select value={sort} onChange={(event) => setSort(event.target.value as OrderSort)} className="mt-1.5 h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm font-normal">
                      <option value="assigned-newest">Assigned newest</option>
                      <option value="assigned-oldest">Assigned oldest</option>
                      <option value="due-soonest">Due date soonest</option>
                      <option value="due-latest">Due date latest</option>
                      <option value="target-high">Largest target</option>
                      <option value="remaining-high">Most remaining</option>
                      <option value="progress-high">Highest progress</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => { setSearch(""); setSubhubFilter("all"); setStatusFilter("all"); setDateField("all"); setDateValue(""); setSort("assigned-newest"); }} disabled={!search && subhubFilter === "all" && statusFilter === "all" && dateField === "all" && !dateValue && sort === "assigned-newest"} className="h-9 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                    Reset
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground">
                <span>{filteredOrders.length} of {orders.length} assigned orders shown</span>
                <span>{dateField === "assigned" && dateValue ? `Assigned on ${formatOrderDate(dateValue)}` : dateField === "due" && dateValue ? `Due on ${formatOrderDate(dateValue)}` : "All assignment dates"}</span>
              </div>
              {!filteredOrders.length ? (
                <p className="p-10 text-center text-sm text-muted-foreground">No assigned orders match the current filters.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1320px] text-sm">
                      <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3 font-medium">Order / SubHub</th>
                          <th className="px-5 py-3 font-medium">Product variant</th>
                          <th className="px-5 py-3 text-right font-medium">Target</th>
                          <th className="px-5 py-3 text-right font-medium">Produced</th>
                          <th className="px-5 py-3 font-medium">Progress</th>
                          <th className="px-5 py-3 text-right font-medium">Remaining</th>
                          <th className="px-5 py-3 font-medium">Assigned</th>
                          <th className="px-5 py-3 font-medium">Due date</th>
                          <th className="px-5 py-3 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOrders.map((order) => (
                          <OrderRow
                            key={order.id}
                            order={order}
                            subhubs={subhubs}
                            activity={activities[order.id] ?? []}
                            activityLoading={activityLoading === order.id}
                            reassigning={reassigningOrderId === order.id}
                            activityOpen={expandedOrderId === order.id}
                            canManage={isMasterAdmin}
                            saving={savingOrderId === order.id}
                            onToggleActivity={() => void toggleActivity(order.id)}
                            onReassign={(subhubUserId, reason) => void reassignOrder(order.id, subhubUserId, reason)}
                            onEdit={() => setEditingOrder(order)}
                            onDelete={() => void deleteTarget(order)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination total={filteredOrders.length} page={orderPage} pageSize={orderPageSize} onPageChange={setOrderPage} onPageSizeChange={setOrderPageSize} />
                </>
              )}
            </>
          )}
        </Panel>
      </div>
      {editingOrder ? <TargetEditor order={editingOrder} subhubs={subhubs} busy={savingOrderId === editingOrder.id} onClose={() => setEditingOrder(null)} onSave={saveTarget} /> : null}

    </Shell>
  );
}

function HubCapacityRow({
  hub,
  saving,
  onSave,
}: {
  hub: AdminProductionDashboard["hubs"][number];
  saving: boolean;
  onSave: SaveHubCapacity;
}) {
  const [capacityValue, setCapacityValue] = useState(hub.capacityUnits === null ? "" : String(hub.capacityUnits));
  const [validationError, setValidationError] = useState("");
  const capacityLabel = hub.capacityUnits === null ? "No limit" : num(hub.capacityUnits);
  const loadLabel = hub.capacityUnits === null
    ? `${num(hub.openUnits)} open units`
    : `${num(hub.openUnits)} / ${num(hub.capacityUnits)} units`;
  const status = hub.overloaded ? "Overloaded" : hub.capacityUnits === null ? "Unrestricted" : "Within capacity";
  const statusTone = hub.overloaded ? "bad" : hub.capacityUnits === null ? "neutral" : "good";
  const isDirty = capacityValue !== (hub.capacityUnits === null ? "" : String(hub.capacityUnits));

  useEffect(() => {
    setCapacityValue(hub.capacityUnits === null ? "" : String(hub.capacityUnits));
  }, [hub.capacityUnits]);

  async function submitCapacity() {
    const trimmed = capacityValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      setValidationError("Enter a whole number greater than zero, or leave blank for no limit.");
      return;
    }
    setValidationError("");
    const result = await onSave(hub.userId, parsed);
    if (!result.ok) setValidationError(result.message);
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
      <div className="min-w-52 flex-1">
        <p className="font-medium">{hub.subhubName}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hub.name} · {hub.orderCount} active order{hub.orderCount === 1 ? "" : "s"}</p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current load</p>
          <p className="tabular mt-1 font-semibold">{loadLabel}</p>
        </div>
        <Tag tone={statusTone}>{status}</Tag>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void submitCapacity(); }} className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
          <Settings2 className="size-4 text-muted-foreground" />
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">Declared capacity</span>
            <input
              type="number"
              min="1"
              step="1"
              value={capacityValue}
              onChange={(event) => setCapacityValue(event.target.value)}
              placeholder="No limit"
              aria-label={`Declared capacity for ${hub.subhubName}`}
              className="h-8 w-28 rounded-md border border-input bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={!isDirty || saving}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="size-3.5" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="pl-8 text-[11px] text-muted-foreground">Blank means no limit{!isDirty && capacityValue === "" ? "" : ` · Current: ${capacityLabel}`}</p>
        {validationError ? <p className="pl-8 text-xs text-destructive">{validationError}</p> : null}
      </form>
      {hub.overloaded ? <AlertTriangle className="size-5 text-destructive" aria-label="Hub is overloaded" /> : null}
    </div>
  );
}

function TargetEditor({
  order,
  subhubs,
  busy,
  onClose,
  onSave,
}: {
  order: ProductionOrder;
  subhubs: AssignableSubhub[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    orderId: string;
    subhubUserId: string;
    productCode: string;
    variantCode: string;
    target: number;
    dueDate: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [subhubUserId, setSubhubUserId] = useState(order.subhubUserId);
  const [productCode, setProductCode] = useState(order.productCode);
  const [variantCode, setVariantCode] = useState(order.variantCode);
  const [target, setTarget] = useState(String(order.target));
  const [dueDate, setDueDate] = useState(order.dueDate);
  const [notes, setNotes] = useState(order.notes);
  const product = bomCatalog.find((item) => item.code === productCode) ?? bomCatalog[0];

  function changeProduct(nextProductCode: string) {
    const nextProduct = bomCatalog.find((item) => item.code === nextProductCode);
    setProductCode(nextProductCode);
    setVariantCode(nextProduct?.variants[0]?.code ?? "");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave({
      orderId: order.id,
      subhubUserId,
      productCode,
      variantCode,
      target: Number(target),
      dueDate,
      notes,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/25" role="dialog" aria-modal="true" aria-labelledby="edit-production-target-title">
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Admin controls</p>
            <h2 id="edit-production-target-title" className="mt-2 text-xl font-semibold">Edit production target</h2>
            <p className="mt-1 text-sm text-muted-foreground">{order.orderNumber} · update the assigned SubHub, variant, quantity, date, or notes.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close edit target" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            Destination SubHub
            <select required value={subhubUserId} onChange={(event) => setSubhubUserId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary">
              <option value="">Select SubHub</option>
              {subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.subhubName} · {subhub.name}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Float type
              <select required value={productCode} onChange={(event) => changeProduct(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary">
                {bomCatalog.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Variant
              <select required value={variantCode} onChange={(event) => setVariantCode(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary">
                {(product?.variants ?? []).map((variant) => <option key={variant.code} value={variant.code}>{variant.name} · {variant.code}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Target quantity
              <input required type="number" min="1" step="1" value={target} onChange={(event) => setTarget(event.target.value)} className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium">
              Due date
              <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Instructions <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={busy} className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
              <Save className="size-4" /> {busy ? "Saving…" : "Save target"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  subhubs,
  activity,
  activityLoading,
  reassigning,
  activityOpen,
  canManage,
  saving,
  onToggleActivity,
  onReassign,
  onEdit,
  onDelete,
}: {
  order: ProductionOrder;
  subhubs: AssignableSubhub[];
  activity?: ProductionOrderActivity[];
  activityLoading: boolean;
  reassigning: boolean;
  activityOpen: boolean;
  canManage: boolean;
  saving: boolean;
  onToggleActivity: () => void;
  onReassign: (subhubUserId: string, reason: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [destinationId, setDestinationId] = useState(order.subhubUserId);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setDestinationId(order.subhubUserId);
  }, [order.subhubUserId]);

  return (
    <>
      <tr className="border-b border-border/70 hover:bg-muted/40">
        <td className="px-5 py-4">
          <p className="tabular font-semibold">{order.orderNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">{order.subhubName}</p>
          {order.notes ? <p className="mt-2 max-w-64 text-xs text-muted-foreground"><span className="font-medium text-foreground">Notes:</span> {order.notes}</p> : null}
          <button type="button" onClick={onToggleActivity} className="mt-2 text-xs font-medium text-primary hover:underline">
            {activityLoading ? "Loading activity…" : activityOpen ? "Hide activity" : "View activity"}
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              aria-label={`Destination SubHub for ${order.orderNumber}`}
              className="h-8 max-w-44 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
            >
              {subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.subhubName}</option>)}
            </select>
            <button
              type="button"
              disabled={reassigning || destinationId === order.subhubUserId}
              onClick={() => onReassign(destinationId, reason)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <ArrowRight className="size-3.5" /> {reassigning ? "Moving…" : "Move order"}
            </button>
          </div>
          {destinationId !== order.subhubUserId ? (
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (optional)"
              aria-label={`Reason for moving ${order.orderNumber}`}
              className="mt-2 h-8 w-full max-w-64 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
            />
          ) : null}
          {canManage ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
              <button type="button" onClick={onEdit} disabled={saving} className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                <Edit3 className="size-3.5" /> Edit target
              </button>
              <button type="button" onClick={onDelete} disabled={saving} className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/25 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 className="size-3.5" /> {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          ) : null}
        </td>
        <td className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.productName}</p>
          <p className="mt-1 font-medium">{order.variantName}</p>
          <p className="tabular text-xs text-muted-foreground">{order.variantCode}</p>
        </td>
        <td className="tabular px-5 py-4 text-right font-semibold">{num(order.target)}</td>
        <td className="tabular px-5 py-4 text-right">{num(order.produced)}</td>
        <td className="px-5 py-4">
          <div className="min-w-32">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, order.target ? (order.produced / order.target) * 100 : 0)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{order.target ? Math.round((order.produced / order.target) * 100) : 0}% complete</p>
          </div>
        </td>
        <td className="tabular px-5 py-4 text-right font-medium">{num(order.remaining)}</td>
        <td className="tabular px-5 py-4 text-muted-foreground">{formatOrderDate(order.createdAt)}</td>
        <td className="tabular px-5 py-4 text-right text-muted-foreground">{order.dueDate}</td>
        <td className="px-5 py-4 text-right"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td>
      </tr>
      {activityOpen ? (
        <tr className="border-b border-border/70">
          <td colSpan={9} className="bg-muted/10 px-5 py-4">
            <ActivityTimeline activities={activity ?? []} loading={activityLoading} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ActivityTimeline({ activities, loading }: { activities: ProductionOrderActivity[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading order activity…</p>;
  if (!activities.length) return <p className="text-sm text-muted-foreground">No activity has been recorded for this order yet.</p>;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order activity</p>
      <div className="mt-3 space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-3 text-sm">
            <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-medium">{activity.summary}</p>
                <time className="text-xs text-muted-foreground">{activity.createdAt.replace("T", " ").slice(0, 16)}</time>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{activity.details}</p>
              <p className="mt-1 text-xs text-muted-foreground">By {activity.actorName} · {activity.actorRole}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductionCharts({ dashboard }: { dashboard: AdminProductionDashboard }) {
  const productionPoints = dashboard.dailyProduction.length ? dashboard.dailyProduction : dashboard.weeklyProduction;
  const hubTotals = dashboard.chartHubs.map((hub) => ({
    label: hub.subhubName,
    value: productionPoints.reduce((total, point) => total + Number(point[hub.key] ?? 0), 0),
  }));
  const weeklyPoints = dashboard.weeklyProduction.slice(-6).map((point) => ({
    label: point.label.replace("Week of ", ""),
    value: Number(point.total),
  }));
  const chartStyle = {
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-card)",
    fontSize: 12,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Production by SubHub" description="Finished units reported in the current period.">
        {hubTotals.length === 0 || hubTotals.every((hub) => hub.value === 0) ? (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No production reports are available yet.
          </div>
        ) : (
          <div className="h-72 p-4" role="img" aria-label="Column chart showing production by SubHub">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hubTotals} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => [`${num(Number(value))} units`, "Produced"]} />
                <Bar dataKey="value" name="Produced" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  <LabelList dataKey="value" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Weekly production totals" description="Total finished units across all SubHubs.">
        {weeklyPoints.length === 0 ? (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No weekly production reports are available yet.
          </div>
        ) : (
          <div className="h-72 p-4" role="img" aria-label="Column chart showing weekly production totals">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPoints} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => [`${num(Number(value))} units`, "Produced"]} />
                <Bar dataKey="value" name="Produced" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  <LabelList dataKey="value" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}
