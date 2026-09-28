import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Edit3,
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
import { ProductionTargetsNav } from "@/components/erp/ProductionTargetsNav";
import { Shell } from "@/components/erp/Shell";
import { Tag } from "@/components/erp/bits";
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

type SaveHubCapacity = (subhubUserId: string, capacityUnits: number | null) => Promise<{ ok: true } | { ok: false; message: string }>;

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
        {capacitySuccess ? <p role="status" className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">{capacitySuccess}</p> : null}
        {orderSuccess ? <p role="status" className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">{orderSuccess}</p> : null}
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
          )}
          {!loading && filteredOrders.length > 0 ? (
            <TablePagination
              total={filteredOrders.length}
              page={orderPage}
              pageSize={orderPageSize}
              onPageChange={setOrderPage}
              onPageSizeChange={setOrderPageSize}
            />
          ) : null}
        </section>

        <details className="group border-y border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-medium">SubHub capacity & workload</span>
            <span className="flex-1 text-xs text-muted-foreground">Advanced settings</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y divide-border border-t border-border">
            {loading && !dashboard ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading hub capacity…</p>
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
              <p className="py-8 text-sm text-muted-foreground">No active SubHub Managers are available.</p>
            )}
          </div>
        </details>

        {dashboard?.recentReassignments.length ? (
          <details className="group border-b border-border">
            <summary className="flex cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-medium">Recent automatic moves</span>
              <span className="flex-1 text-xs text-muted-foreground">
                {dashboard.recentReassignments.length} {dashboard.recentReassignments.length === 1 ? "order" : "orders"}
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="divide-y divide-border border-t border-border">
              {dashboard.recentReassignments.map((reassignment, index) => (
                <div key={`${reassignment.orderNumber}-${reassignment.createdAt}-${index}`} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <p className="min-w-48 flex-1 font-medium">{reassignment.orderNumber} · {reassignment.variantName}</p>
                  <span className="text-xs text-muted-foreground">{reassignment.fromHub}</span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-medium">{reassignment.toHub}</span>
                  <time className="text-xs text-muted-foreground">{formatOrderDate(reassignment.createdAt)}</time>
                </div>
              ))}
            </div>
          </details>
        ) : null}
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
      <tr className="border-b border-border/70 hover:bg-muted/30">
        <td className="px-4 py-3">
          <p className="tabular font-semibold">{order.orderNumber}</p>
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
          <button
            type="button"
            onClick={onToggleActivity}
            aria-expanded={activityOpen}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            {activityLoading ? "Loading…" : activityOpen ? "Close" : "Manage"}
            <ChevronDown className={`size-4 transition-transform ${activityOpen ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>
      {activityOpen ? (
        <tr className="border-b border-border/70">
          <td colSpan={8} className="bg-muted/10 px-4 py-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-label={`Actions for ${order.orderNumber}`} className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Manage {order.orderNumber}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Assigned to {order.subhubName}</p>
                  {order.notes ? <p className="mt-2 text-sm">{order.notes}</p> : null}
                </div>
                <label className="block max-w-xl text-sm font-medium">
                  Move to another SubHub
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <select
                      value={destinationId}
                      onChange={(event) => setDestinationId(event.target.value)}
                      aria-label={`Destination SubHub for ${order.orderNumber}`}
                      className="h-10 min-w-48 flex-1 rounded-md border border-input bg-background px-3 text-sm font-normal"
                    >
                      {subhubs.map((subhub) => (
                        <option key={subhub.id} value={subhub.id}>{subhub.subhubName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={reassigning || destinationId === order.subhubUserId}
                      onClick={() => onReassign(destinationId, reason)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowRight className="size-4" /> {reassigning ? "Moving…" : "Move order"}
                    </button>
                  </div>
                </label>
                {destinationId !== order.subhubUserId ? (
                  <label className="block max-w-xl text-xs font-medium text-muted-foreground">
                    Reason for moving <span className="font-normal">(optional)</span>
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      aria-label={`Reason for moving ${order.orderNumber}`}
                      className="mt-1 block h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
                    />
                  </label>
                ) : null}
                {canManage ? (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={onEdit}
                      disabled={saving}
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <Edit3 className="size-4" /> Edit target
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={saving}
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" /> {saving ? "Deleting…" : "Delete target"}
                    </button>
                  </div>
                ) : null}
              </section>
              <section aria-label={`History for ${order.orderNumber}`} className="border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <ActivityTimeline activities={activity ?? []} loading={activityLoading} />
              </section>
            </div>
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
