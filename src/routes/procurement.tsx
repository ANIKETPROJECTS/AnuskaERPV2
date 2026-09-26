import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Edit3,
  Eye,
  History,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";
import { z } from "zod";
import type { Panel as ProcurementPanel } from "@/auth.server";
import { useAuth } from "@/components/auth/AuthContext";
import { Panel, Tag } from "@/components/erp/bits";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { TablePagination } from "@/components/erp/TablePagination";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  createProcurementOrderFn,
  updateProcurementItemRequestFn,
  createVendorFn,
  deleteOrArchiveVendorFn,
  getProcurementDataFn,
  updateProcurementOrderStatusFn,
  updateVendorFn,
} from "@/procurement";
import type { HubMaterialNeed, ProcurementData, ProcurementItemRequest, ProcurementOrder, ProcurementStatus, ProcurementVendor } from "@/procurement.server";
import { MISCELLANEOUS_VENDOR_ID, ONE_OFF_MATERIAL_CODE, PROCUREMENT_STATUSES } from "@/lib/procurement-types";
import { useRawMaterials } from "@/lib/raw-material-store";

export const Route = createFileRoute("/procurement")({
  validateSearch: z.object({ panel: z.enum(["admin", "subhub", "procurement"]).optional() }),
  loaderDeps: ({ search }) => ({ panel: search.panel ?? "procurement" }),
  loader: ({ deps }) => getProcurementDataFn({ data: { panel: deps.panel } }),
  head: () => ({
    meta: [
      { title: "Procurement — Gadsons ERP" },
      { name: "description", content: "Manage vendors, procurement orders, and delivery status across Gadsons SubHubs." },
      { property: "og:title", content: "Procurement — Gadsons ERP" },
      { property: "og:description", content: "Manage vendors, procurement orders, and delivery status across Gadsons SubHubs." },
    ],
  }),
  component: Procurement,
});

const emptyData: ProcurementData = {
  vendors: [],
  orders: [],
  subhubs: [],
  vendorPerformance: [],
  subhubSummary: [],
  materialNeeds: [],
  itemRequests: [],
  summary: {
    vendorCount: 0,
    openOrders: 0,
    unitsOnOrder: 0,
    committedSpend: 0,
    completedOrders: 0,
    pendingOrders: 0,
    onTimeRate: null,
  },
};

export type ProcurementView = "orders" | "vendors" | "needs" | "requests";
type Tab = ProcurementView;

const PROCUREMENT_VIEW_TITLES: Record<ProcurementView, string> = {
  orders: "Order Management",
  vendors: "Vendor Management",
  needs: "Hub stock & targets",
  requests: "Item requests",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function dateFromKey(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function dateToKey(date: Date | undefined) {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function num(value: number) {
  return value.toLocaleString("en-IN");
}

function statusTone(status: ProcurementStatus): "good" | "warn" | "info" | "neutral" {
  if (status === "Delivery done") return "good";
  if (status === "Dispatch done") return "info";
  if (status === "Payment done") return "warn";
  return "neutral";
}

function solidStatusClass(status: ProcurementStatus) {
  if (status === "Delivery done") return "bg-emerald-700";
  if (status === "Dispatch done") return "bg-blue-700";
  if (status === "Payment done") return "bg-amber-700";
  return "bg-slate-700";
}

const ORDER_ACTION_STATUSES = PROCUREMENT_STATUSES.filter((status) => status !== "Payment done");
const ORDER_FILTER_STATUSES = PROCUREMENT_STATUSES.filter((status) => status !== "Payment done");

function Procurement() {
  return <ProcurementPage result={Route.useLoaderData()} />;
}

type ProcurementResult = Awaited<ReturnType<typeof getProcurementDataFn>>;

export function ProcurementPage({
  result,
  view,
}: {
  result: ProcurementResult;
  view?: ProcurementView;
}) {
  const auth = useAuth();
  const canManageProcurement = auth.user?.panel === "admin" || auth.user?.panel === "procurement";
  const panel = auth.user?.panel ?? "admin";
  const [data, setData] = useState<ProcurementData>(result.ok ? result.data : emptyData);
  const [tab, setTab] = useState<Tab>("orders");
  const activeTab = view ?? tab;
  const [query, setQuery] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState<ProcurementVendor["status"] | "all">(
    "all",
  );
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState("all");
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorFilter, setVendorFilter] = useState("all");
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProcurementStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(panel === "subhub" ? 25 : 10);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [vendorFormMode, setVendorFormMode] = useState<"create" | "edit" | null>(null);
  const [editingVendor, setEditingVendor] = useState<ProcurementVendor | null>(null);
  const [loading, setLoading] = useState(!result.ok);
  const [error, setError] = useState(result.ok ? "" : result.message);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
  }, [result]);

  useEffect(() => {
    if (panel === "procurement" && activeTab === "requests") setNotice("");
  }, [activeTab, panel]);

  async function reload() {
    setLoading(true);
    const response = await getProcurementDataFn({ data: { panel } });
    if (response.ok) {
      setData(response.data);
      setError("");
    } else {
      setError(response.message);
    }
    setLoading(false);
  }

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.orders
      .filter((order) => {
        const searchable = [order.orderNumber, order.vendorName, order.materialName, order.materialCode, ...order.items.map((item) => `${item.materialName} ${item.materialCode}`), order.subhubName, order.notes].join(" ").toLowerCase();
        const matchesQuery = !normalized || searchable.includes(normalized);
        const matchesVendor = vendorFilter === "all" || order.vendorId === vendorFilter;
        const matchesSubhub = subhubFilter === "all" || order.subhubUserId === subhubFilter;
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        const matchesFrom = !fromDate || order.orderDate >= fromDate;
        const matchesTo = !toDate || order.orderDate <= toDate;
        return matchesQuery && matchesVendor && matchesSubhub && matchesStatus && matchesFrom && matchesTo;
      })
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  }, [data.orders, fromDate, query, statusFilter, subhubFilter, toDate, vendorFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [fromDate, query, statusFilter, subhubFilter, toDate, vendorFilter]);

  useEffect(() => {
    setOrderPageSize(panel === "subhub" ? 25 : 10);
    setOrderPage(1);
  }, [panel]);

  const paginatedOrders = useMemo(() => {
    const pageCount = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
    const currentPage = Math.min(orderPage, pageCount);
    const start = (currentPage - 1) * orderPageSize;
    return filteredOrders.slice(start, start + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  const visibleVendors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.vendors.filter((vendor) => !normalized || [vendor.name, vendor.contactName, vendor.phone, vendor.email, vendor.city, vendor.state, vendor.categories.join(" ")].join(" ").toLowerCase().includes(normalized));
  }, [data.vendors, query]);
  const vendorCategories = useMemo(() => {
    const categories = data.vendors.flatMap((vendor) =>
      vendor.categories.map((category) => category.trim()).filter(Boolean),
    );
    return [...new Set(categories)].sort((a, b) => a.localeCompare(b));
  }, [data.vendors]);
  const filteredProcurementVendors = useMemo(() => {
    const normalized = vendorQuery.trim().toLowerCase();
    return data.vendors
      .filter((vendor) => {
        const searchable = [
          vendor.name,
          vendor.contactName,
          vendor.phone,
          vendor.email,
          vendor.city,
          vendor.state,
          vendor.categories.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return (
          (!normalized || searchable.includes(normalized)) &&
          (vendorStatusFilter === "all" || vendor.status === vendorStatusFilter) &&
          (vendorCategoryFilter === "all" || vendor.categories.includes(vendorCategoryFilter))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.vendors, vendorCategoryFilter, vendorQuery, vendorStatusFilter]);
  const vendorPageSize = 25;
  const paginatedProcurementVendors = filteredProcurementVendors.slice(
    (vendorPage - 1) * vendorPageSize,
    vendorPage * vendorPageSize,
  );
  const hasVendorFilters = Boolean(
    vendorQuery.trim() || vendorStatusFilter !== "all" || vendorCategoryFilter !== "all",
  );

  useEffect(() => {
    setVendorPage(1);
  }, [vendorCategoryFilter, vendorQuery, vendorStatusFilter]);

  const selectedVendor = data.vendors.find((vendor) => vendor.id === selectedVendorId);
  const selectedVendorOrders = selectedVendorId ? data.orders.filter((order) => order.vendorId === selectedVendorId) : [];
  const hasFilters = Boolean(query || vendorFilter !== "all" || subhubFilter !== "all" || statusFilter !== "all" || fromDate || toDate);

  function clearFilters() {
    setQuery("");
    setVendorFilter("all");
    setSubhubFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  function clearVendorFilters() {
    setVendorQuery("");
    setVendorStatusFilter("all");
    setVendorCategoryFilter("all");
  }

  async function updateOrderStatus(order: ProcurementOrder, status: ProcurementStatus) {
    if (status === order.status) return;
    setNotice("");
    const response = await updateProcurementOrderStatusFn({ data: { id: order.id, status, panel } });
    if (!response.ok) setError(response.message);
    else {
      setNotice(`${order.orderNumber} changed from ${order.status} to ${status}.`);
      await reload();
    }
  }

  async function removeVendor(vendor: ProcurementVendor) {
    const hasHistory = data.orders.some((order) => order.vendorId === vendor.id);
    const actionLabel = hasHistory ? "Archive" : "Delete";
    const actionDescription = hasHistory
      ? "Its order history will remain available for reporting."
      : "This vendor has no order history and will be permanently removed.";
    if (!window.confirm(`${actionLabel} ${vendor.name}? ${actionDescription}`)) return;
    const response = await deleteOrArchiveVendorFn({ data: { id: vendor.id, panel: panel as "admin" | "procurement" } });
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setNotice(`${vendor.name} ${response.action === "archived" ? "was archived safely" : "was deleted"}.`);
    if (selectedVendorId === vendor.id) setSelectedVendorId("");
    await reload();
  }

  function openCreateVendor() {
    setEditingVendor(null);
    setVendorFormMode("create");
    setError("");
  }

  function openEditVendor(vendor: ProcurementVendor) {
    setEditingVendor(vendor);
    setVendorFormMode("edit");
    setError("");
  }

  const summaryMetrics =
    panel === "subhub" || (panel === "procurement" && activeTab !== "orders")
      ? []
      : activeTab === "orders"
        ? [
            {
              label: "Open orders",
              value: num(data.summary.openOrders),
              hint: `${num(data.summary.unitsOnOrder)} units in progress`,
            },
            {
              label: "Delayed orders",
              value: num(
                data.orders.filter(
                  (order) => order.status !== "Delivery done" && order.expectedDelivery < today(),
                ).length,
              ),
              hint: "Past expected delivery date",
            },
          ]
        : [
            ...(canManageProcurement
              ? [{ label: "Active vendors", value: num(data.summary.vendorCount), hint: `${data.vendors.length} total records` }]
              : []),
            { label: "Open orders", value: num(data.summary.openOrders), hint: `${num(data.summary.unitsOnOrder)} units in progress` },
            { label: "Committed spend", value: inr(data.summary.committedSpend), hint: "Open procurement orders" },
            {
              label: "On-time delivery",
              value: data.summary.onTimeRate === null ? "—" : `${data.summary.onTimeRate}%`,
              hint: `${data.summary.completedOrders} completed orders`,
            },
          ];

  const content = (
    <div className={`space-y-5 ${activeTab === "orders" ? "text-sm" : "text-base"}`}>
      {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive">{error}</p> : null}
      {notice && !(panel === "procurement" && activeTab === "requests") ? (
        <p
          role="status"
          className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-base text-success"
        >
          {notice}
        </p>
      ) : null}

      {summaryMetrics.length ? (
        <section
          aria-label="Procurement summary"
          className={`grid gap-x-8 border-y border-border grid-cols-1 sm:grid-cols-2 ${activeTab === "orders" ? "xl:grid-cols-2" : "xl:grid-cols-4"}`}
        >
          {summaryMetrics.map((metric) => (
            <div key={metric.label} className="py-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              <p className="tabular mt-1 text-3xl font-bold leading-tight">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.hint}</p>
            </div>
          ))}
        </section>
      ) : null}

      {panel !== "subhub" && !(panel === "procurement" && (activeTab === "requests" || activeTab === "vendors" || activeTab === "orders" || activeTab === "needs")) ? <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-end lg:justify-between">
        {panel !== "procurement" ? <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-1" role="tablist" aria-label="Procurement sections">
          <button type="button" role="tab" aria-selected={activeTab === "orders"} onClick={() => setTab("orders")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${activeTab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <ClipboardList className="size-5" /> Order Management
          </button>
          {canManageProcurement ? <button type="button" role="tab" aria-selected={activeTab === "vendors"} onClick={() => setTab("vendors")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${activeTab === "vendors" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Store className="size-5" /> Vendor Management
          </button> : null}
          {canManageProcurement ? <button type="button" role="tab" aria-selected={activeTab === "needs"} onClick={() => setTab("needs")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${activeTab === "needs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <PackagePlus className="size-5" /> Hub stock & targets
          </button> : null}
          {canManageProcurement ? <button type="button" role="tab" aria-selected={activeTab === "requests"} onClick={() => setTab("requests")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${activeTab === "requests" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <ClipboardList className="size-5" /> Item requests{data.itemRequests.some((request) => request.status === "Pending") ? ` (${data.itemRequests.filter((request) => request.status === "Pending").length})` : ""}
          </button> : null}
        </div> : null}
        <div className="flex flex-wrap gap-2">
          {canManageProcurement && activeTab === "vendors" && panel !== "procurement" ? <button type="button" onClick={openCreateVendor} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted"><Plus className="size-5" /> Add vendor</button> : null}
          {activeTab !== "orders" && activeTab !== "needs" && !(panel === "procurement" && activeTab === "requests") ? <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button> : null}
        </div>
      </div> : null}

      {activeTab === "orders" ? (
        <>
          <OrderFilters
            panel={panel}
            query={query}
            setQuery={setQuery}
            vendorFilter={vendorFilter}
            setVendorFilter={setVendorFilter}
            subhubFilter={subhubFilter}
            setSubhubFilter={setSubhubFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            vendors={data.vendors}
            subhubs={data.subhubs}
            hasFilters={hasFilters}
            clearFilters={clearFilters}
          />
          <section>
            {panel !== "subhub" ? <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-semibold">Procurement orders</h2><p className="text-xs text-muted-foreground">{filteredOrders.length} of {data.orders.length} orders</p></div> : null}
            {loading ? <Loading /> : <OrderTable orders={paginatedOrders} total={filteredOrders.length} page={orderPage} pageSize={orderPageSize} onPageChange={setOrderPage} onPageSizeChange={setOrderPageSize} isAdmin={canManageProcurement} panel={panel} onStatusChange={(order, status) => void updateOrderStatus(order, status)} />}
          </section>
        </>
      ) : activeTab === "vendors" ? (
        <>
          <section className="space-y-4">
            {panel !== "procurement" ? (
              <SectionHeading
                title="Vendor directory"
                description="Create, edit, archive, and review the shared procurement vendor directory."
              />
            ) : null}
            {panel === "procurement" ? (
              <VendorFilters
                query={vendorQuery}
                setQuery={setVendorQuery}
                statusFilter={vendorStatusFilter}
                setStatusFilter={setVendorStatusFilter}
                categoryFilter={vendorCategoryFilter}
                setCategoryFilter={setVendorCategoryFilter}
                categories={vendorCategories}
                hasFilters={hasVendorFilters}
                clearFilters={clearVendorFilters}
              />
            ) : null}
            <VendorTable
              vendors={panel === "procurement" ? paginatedProcurementVendors : visibleVendors}
              data={data}
              panel={panel as "admin" | "procurement"}
              isAdmin={canManageProcurement}
              onSelect={setSelectedVendorId}
              selectedVendorId={selectedVendorId}
              onEdit={openEditVendor}
              onRemove={(vendor) => void removeVendor(vendor)}
              emptyDescription={
                panel === "procurement" && data.vendors.length > 0
                  ? "No vendors match these filters. Adjust or clear your filters."
                  : undefined
              }
            />
            {panel === "procurement" ? (
              <TablePagination
                total={filteredProcurementVendors.length}
                page={vendorPage}
                pageSize={vendorPageSize}
                pageSizeOptions={[25]}
                showPageSizeSelect={false}
                onPageChange={setVendorPage}
                onPageSizeChange={() => undefined}
              />
            ) : null}
          </section>
          {selectedVendor && panel === "procurement" ? (
            <VendorDetailsDrawer vendor={selectedVendor} onClose={() => setSelectedVendorId("")} />
          ) : null}
          {selectedVendor && panel !== "procurement" ? (
            <VendorDetail
              vendor={selectedVendor}
              orders={selectedVendorOrders}
              onClose={() => setSelectedVendorId("")}
            />
          ) : null}
        </>
      ) : null}
      {activeTab === "needs" ? <HubMaterialNeeds data={data} panel={panel as "admin" | "procurement"} onSaved={async (message) => { setNotice(message); await reload(); }} /> : null}
      {activeTab === "requests" ? (
        <ItemRequestsTable
          requests={data.itemRequests}
          panel={panel as "admin" | "procurement"}
          onUpdated={async (message) => {
            if (panel === "procurement") setNotice("");
            else setNotice(message);
            await reload();
          }}
        />
      ) : null}

      {showOrderForm ? <OrderForm data={data} isAdmin={canManageProcurement} panel={panel as "admin" | "procurement"} onClose={() => setShowOrderForm(false)} onSaved={async (message) => { setShowOrderForm(false); setNotice(message); await reload(); }} /> : null}
      {vendorFormMode ? <VendorForm mode={vendorFormMode} vendor={editingVendor} panel={panel as "admin" | "procurement"} onClose={() => setVendorFormMode(null)} onSaved={async (message) => { setVendorFormMode(null); setNotice(message); await reload(); }} /> : null}
    </div>
  );

  return auth.user?.panel === "subhub" ? (
    <SubHubShell headerTitle="Procurement">
      <div className="space-y-6 px-6 py-5">{content}</div>
    </SubHubShell>
  ) : (
    <Shell
      title={panel === "procurement" ? PROCUREMENT_VIEW_TITLES[activeTab] : "Procurement"}
      subtitle={panel === "procurement" ? undefined : "Live vendor and purchase-order management across Gadsons SubHubs"}
      actions={
        canManageProcurement && activeTab === "orders" ? (
          <button
            type="button"
            onClick={() => setShowOrderForm(true)}
            className="rule-header inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold"
          >
            <PackagePlus className="size-4" /> New procurement order
          </button>
        ) : panel === "procurement" && activeTab === "vendors" ? (
          <button
            type="button"
            onClick={openCreateVendor}
            className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted"
          >
            <Plus className="size-5" /> Add vendor
          </button>
        ) : undefined
      }
    >
      {content}
    </Shell>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border py-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-base text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

function HubMaterialNeeds({ data, panel, onSaved }: { data: ProcurementData; panel: "admin" | "procurement"; onSaved: (message: string) => Promise<void> }) {
  const hubs = useMemo(() => data.subhubs.map((hub) => ({
    ...hub,
    needs: data.materialNeeds.filter((need) => need.subhubUserId === hub.id),
  })), [data.materialNeeds, data.subhubs]);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [orderHub, setOrderHub] = useState<string | null>(null);

  if (!hubs.length) {
    return <div className="panel p-8 text-center text-sm text-muted-foreground">No active SubHubs are available.</div>;
  }

  const selectedHub = hubs.find((hub) => hub.id === selectedHubId);

  if (!selectedHub) {
    return (
      <section aria-label="SubHub stock overview">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Choose a hub</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select a card to review its stock and shortages.</p>
          </div>
          <p className="text-xs text-muted-foreground">{num(hubs.length)} hubs</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hubs.map((hub) => {
            const shortageCount = hub.needs.filter((need) => need.shortageQuantity > 0).length;
            const coverageLabel = hub.needs.length === 0
              ? "No targets"
              : shortageCount
                ? `${num(shortageCount)} ${shortageCount === 1 ? "shortage" : "shortages"}`
                : "All covered";
            return (
              <button
                key={hub.id}
                type="button"
                aria-label={`View ${hub.name}: ${shortageCount} shortages across ${hub.needs.length} materials`}
                onClick={() => setSelectedHubId(hub.id)}
                className="panel group w-full p-5 text-left transition hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">SubHub</p>
                    <h3 className="mt-1 truncate text-base font-semibold">{hub.name}</h3>
                  </div>
                  <Tag tone={hub.needs.length === 0 ? "neutral" : shortageCount ? "warn" : "good"}>
                    {coverageLabel}
                  </Tag>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Materials</p>
                    <p className="tabular mt-1 text-xl font-semibold">{num(hub.needs.length)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Shortages</p>
                    <p className={`tabular mt-1 text-xl font-semibold ${shortageCount ? "text-destructive" : "text-success"}`}>{num(shortageCount)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm font-medium text-primary">
                  <span>View hub details</span>
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const shortageCount = selectedHub.needs.filter((need) => need.shortageQuantity > 0).length;
  const coverageLabel = selectedHub.needs.length === 0
    ? "No targets"
    : shortageCount
      ? `${num(shortageCount)} ${shortageCount === 1 ? "shortage" : "shortages"}`
      : "All covered";
  const selectedNeeds = data.materialNeeds.filter(
    (need) => need.subhubUserId === selectedHub.id && need.shortageQuantity > 0,
  );

  return (
    <>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedHubId(null)}
          className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary hover:bg-muted"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All hubs
        </button>

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Hub stock & targets</p>
              <h2 className="mt-1 text-lg font-semibold">{selectedHub.name}</h2>
            </div>
            <Tag tone={selectedHub.needs.length === 0 ? "neutral" : shortageCount ? "warn" : "good"}>
              {coverageLabel}
            </Tag>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Materials tracked</p>
              <p className="tabular mt-1 text-2xl font-semibold">{num(selectedHub.needs.length)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Shortages</p>
              <p className={`tabular mt-1 text-2xl font-semibold ${shortageCount ? "text-destructive" : "text-success"}`}>{num(shortageCount)}</p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!shortageCount}
            onClick={() => setOrderHub(selectedHub.id)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PackagePlus aria-hidden="true" className="size-4" />
            Create order for shortages
          </button>
        </div>

        <Panel title="Materials for this hub">
          {selectedHub.needs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 text-right font-semibold">Needed</th>
                    <th className="px-4 py-3 text-right font-semibold">In stock</th>
                    <th className="px-4 py-3 text-right font-semibold">Already ordered</th>
                    <th className="px-4 py-3 text-right font-semibold">Still needed</th>
                    <th className="px-4 py-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHub.needs.map((need) => (
                    <tr key={need.itemCode} className="border-t border-border/70">
                      <td className="px-4 py-3">
                        <p className="font-medium">{need.itemName}</p>
                        <p className="text-xs text-muted-foreground">{need.itemCode}</p>
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-right">{num(need.requiredQuantity)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-right">{num(need.stockQuantity)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-right">{num(need.onOrderQuantity)}</td>
                      <td className={`tabular whitespace-nowrap px-4 py-3 text-right font-semibold ${need.shortageQuantity > 0 ? "text-destructive" : "text-success"}`}>
                        {num(need.shortageQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Tag tone={need.shortageQuantity > 0 ? "warn" : "good"}>
                          {need.shortageQuantity > 0 ? "Shortage" : "Sufficient"}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">No active material targets for this hub.</p>
          )}
        </Panel>

      </div>
      {orderHub ? (
        <ShortageOrderForm
          data={data}
          needs={selectedNeeds}
          panel={panel}
          onClose={() => setOrderHub(null)}
          onSaved={async (message) => {
            setOrderHub(null);
            await onSaved(message);
          }}
        />
      ) : null}
    </>
  );
}

function ShortageOrderForm({ data, needs, panel, onClose, onSaved }: { data: ProcurementData; needs: HubMaterialNeed[]; panel: "admin" | "procurement"; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>(needs.map((need) => need.itemCode));
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDelivery, setExpectedDelivery] = useState(dateAfter(7));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hubId = needs[0]?.subhubUserId ?? "";
  const hubName = needs[0]?.subhubName ?? "SubHub";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!vendorId) {
      setError("Choose a vendor before creating the order.");
      return;
    }
    const selectedNeeds = needs.filter((need) => selected.includes(need.itemCode));
    if (selectedNeeds.some((need) => !(prices[need.itemCode] ?? "").trim())) {
      setError("Enter a unit price for every selected material.");
      return;
    }
    const items = selectedNeeds.map((need) => {
      const price = Number(prices[need.itemCode] ?? 0);
      return { materialCode: need.itemCode, materialName: need.itemName, quantity: need.shortageQuantity, unitPrice: price };
    });
    if (!items.length) {
      setError("Select at least one material with a shortage.");
      return;
    }
    if (items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      setError("Enter a valid non-negative unit price for every selected material.");
      return;
    }
    setBusy(true);
    const response = await createProcurementOrderFn({
      data: { panel, subhubUserId: hubId, vendorId, items, orderDate, expectedDelivery, notes },
    });
    if (!response.ok) {
      setError(response.message);
      setBusy(false);
      return;
    }
    await onSaved(`${response.order.orderNumber} was created for ${hubName} with ${items.length} material line${items.length === 1 ? "" : "s"}.`);
    setBusy(false);
  }

  return <Drawer title="Create shortage procurement order" subtitle={`Assign the missing materials for ${hubName} in one order.`} onClose={onClose}>
    <form onSubmit={(event) => void submit(event)} className="space-y-5 text-base [&_input]:h-12 [&_input]:text-base [&_label]:text-base [&_select]:h-12 [&_select]:text-base [&_textarea]:text-base">
      <label className="block text-sm font-medium">Vendor
        <select required value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-base">
          <option value="">Choose an active vendor</option>{data.vendors.filter((vendor) => vendor.status === "active").map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          <option value={MISCELLANEOUS_VENDOR_ID}>Miscellaneous</option>
        </select>
      </label>
      <div className="divide-y divide-border border-y border-border">
        {needs.map((need) => <label key={need.itemCode} className="grid grid-cols-[auto_minmax(0,1fr)_7rem] items-center gap-3 px-2 py-4">
          <input type="checkbox" checked={selected.includes(need.itemCode)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, need.itemCode] : current.filter((code) => code !== need.itemCode))} className="size-4 accent-[var(--color-primary)]" />
          <span className="min-w-0"><span className="block truncate text-base font-semibold">{need.itemName}</span><span className="text-sm text-muted-foreground">{need.itemCode} · order {num(need.shortageQuantity)} units</span></span>
          <input aria-label={`Unit price for ${need.itemName}`} required={selected.includes(need.itemCode)} type="number" min="0" step="0.01" value={prices[need.itemCode] ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [need.itemCode]: event.target.value }))} className="h-11 w-28 rounded-md border border-input px-2 text-right text-base" />
        </label>)}
      </div>
      <p className="text-base text-muted-foreground">Enter the quoted unit price for each selected material. Shortage quantities are prefilled from current hub targets and stock.</p>
      <div className="grid gap-3 sm:grid-cols-2"><TextField label="Order date" type="date" required value={orderDate} onChange={setOrderDate} /><TextField label="Expected delivery" type="date" required value={expectedDelivery} onChange={setExpectedDelivery} /></div>
      <label className="block text-base font-medium">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={500} placeholder="Supplier quote or delivery instructions" className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base" /></label>
      {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-3 text-base text-destructive">{error}</p> : null}
      <DrawerActions busy={busy} submitLabel="Create procurement order" onClose={onClose} />
    </form>
  </Drawer>;
}

function ItemRequestsTable({
  requests,
  panel,
  onUpdated,
}: {
  requests: ProcurementItemRequest[];
  panel: "admin" | "procurement";
  onUpdated: (message: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProcurementItemRequest["status"] | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const factories = useMemo(
    () =>
      [...new Set(requests.map((request) => request.subhubName.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [requests],
  );
  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return requests
      .filter((request) => {
        const requestDay = requestDateKey(request.createdAt);
        const searchable = [
          request.itemName,
          request.subhubName,
          request.quantity,
          request.notes,
          request.status,
          formatRequestDateTime(request.createdAt),
        ]
          .join(" ")
          .toLowerCase();
        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (factoryFilter === "all" || request.subhubName.trim() === factoryFilter) &&
          (statusFilter === "all" || request.status === statusFilter) &&
          (!fromDate || (requestDay !== "" && requestDay >= fromDate)) &&
          (!toDate || (requestDay !== "" && requestDay <= toDate))
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requests, query, factoryFilter, statusFilter, fromDate, toDate]);
  const visibleRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = Boolean(
    query.trim() || factoryFilter !== "all" || statusFilter !== "all" || fromDate || toDate,
  );

  useEffect(() => {
    setPage(1);
  }, [query, factoryFilter, statusFilter, fromDate, toDate]);

  function clearFilters() {
    setQuery("");
    setFactoryFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  async function update(request: ProcurementItemRequest, status: "Approved" | "Declined") {
    setBusyId(request.id);
    setError("");
    try {
      const result = await updateProcurementItemRequestFn({
        data: { id: request.id, status, response: "", panel },
      });
      if (!result.ok) setError(result.message);
      else {
        setPage(1);
        await onUpdated(`${request.itemName} request was ${status.toLowerCase()}.`);
      }
    } catch {
      setError("Unable to update this item request. Please try again.");
    } finally {
      setBusyId("");
    }
  }
  return (
    <section>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <label className="relative min-w-[240px] flex-1 text-sm font-medium text-muted-foreground">
          Search requests
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search item requests"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Factory, item, notes or status"
              className="h-10 w-full rounded-md border border-input pl-9 pr-3 text-base font-normal text-foreground outline-none focus:border-primary"
            />
          </span>
        </label>
        <label className="w-full text-sm font-medium text-muted-foreground sm:w-44">
          Factory
          <span className="relative mt-1 block">
            <select
              value={factoryFilter}
              onChange={(event) => setFactoryFilter(event.target.value)}
              className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-9 text-base font-normal text-foreground"
            >
              <option value="all">All factories</option>
              {factories.map((factory) => (
                <option key={factory} value={factory}>
                  {factory}
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
          Status
          <span className="relative mt-1 block">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ProcurementItemRequest["status"] | "all")
              }
              className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-9 text-base font-normal text-foreground"
            >
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Declined">Declined</option>
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </span>
        </label>
        <label className="w-full text-sm font-medium text-muted-foreground sm:w-44">
          From date
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => setFromDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground"
          />
        </label>
        <label className="w-full text-sm font-medium text-muted-foreground sm:w-44">
          To date
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground"
          />
        </label>
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <X aria-hidden="true" className="size-4" />
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="border-b border-border bg-destructive/5 px-4 py-3 text-base text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] table-fixed text-base">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[18%]" />
            <col className="w-[24%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead className="border-b border-border text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Date / time</th>
              <th className="px-3 py-3">Factory</th>
              <th className="px-3 py-3">Requirement</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((request) => {
              const statusColor =
                request.status === "Approved"
                  ? "bg-green-700"
                  : request.status === "Declined"
                    ? "bg-red-700"
                    : "bg-amber-700";
              return (
                <tr
                  key={request.id}
                  className="border-b border-border/70 align-middle odd:bg-muted/20 hover:bg-muted/40"
                >
                  <td className="tabular whitespace-nowrap px-3 py-4 text-center text-sm text-muted-foreground">
                    {formatRequestDateTime(request.createdAt)}
                  </td>
                  <td className="break-words px-3 py-4 text-center font-medium">
                    {request.subhubName || "Unknown factory"}
                  </td>
                  <td className="px-3 py-4 text-center">
                    <p className="break-words font-semibold">{request.itemName}</p>
                    {request.notes ? (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {request.notes}
                      </p>
                    ) : null}
                  </td>
                  <td className="tabular px-3 py-4 text-center font-semibold">
                    {num(request.quantity)}
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white ${statusColor}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    {request.status === "Pending" ? (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void update(request, "Approved")}
                          className="h-9 rounded-md bg-primary px-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {busyId === request.id ? "Saving…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void update(request, "Declined")}
                          className="h-9 rounded-md border border-input bg-white px-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRequests.length === 0 ? (
          <p className="border-b border-border p-8 text-center text-base text-muted-foreground">
            {requests.length === 0
              ? "No SubHub item requests have been submitted."
              : "No item requests match these filters. Adjust or clear your filters."}
          </p>
        ) : null}
      </div>
      <TablePagination
        total={filteredRequests.length}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={[10, 25, 50]}
        showPageSizeSelect={false}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </section>
  );
}

function requestDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function formatRequestDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function OrderFilters({
  panel, query, setQuery, vendorFilter, setVendorFilter, subhubFilter, setSubhubFilter, statusFilter, setStatusFilter,
  fromDate, setFromDate, toDate, setToDate, vendors, subhubs, hasFilters, clearFilters,
}: {
  panel: ProcurementPanel;
  query: string; setQuery: (value: string) => void;
  vendorFilter: string; setVendorFilter: (value: string) => void;
  subhubFilter: string; setSubhubFilter: (value: string) => void;
  statusFilter: ProcurementStatus | "all"; setStatusFilter: (value: ProcurementStatus | "all") => void;
  fromDate: string; setFromDate: (value: string) => void;
  toDate: string; setToDate: (value: string) => void;
  vendors: ProcurementVendor[]; subhubs: Array<{ id: string; name: string }>;
  hasFilters: boolean; clearFilters: () => void;
}) {
  return (
    <div className={panel === "subhub" ? "border-b border-border" : "border-y border-border"}>
      <div className={`filter-toolbar flex flex-wrap items-end gap-2 ${panel === "subhub" ? "pt-2 pb-3" : "py-3 border-t border-border"}`}>
        <label className="min-w-[220px] flex-1 text-xs font-medium">Search<span className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PO, vendor, material, SubHub…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs font-normal outline-none focus:border-primary" /></span></label>
        {panel !== "subhub" ? <SelectFilter label="Vendor" value={vendorFilter} onChange={setVendorFilter}><option value="all">All vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</SelectFilter> : null}
        {subhubs.length ? <SelectFilter label="SubHub" value={subhubFilter} onChange={setSubhubFilter}><option value="all">All SubHubs</option>{subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.name}</option>)}</SelectFilter> : null}
        {panel !== "subhub" ? <SelectFilter label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as ProcurementStatus | "all")}><option value="all">All statuses</option>{ORDER_FILTER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</SelectFilter> : null}
        {panel !== "subhub" ? <DateRangeFilter fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} /> : null}
        {hasFilters ? <button type="button" onClick={clearFilters} className="h-9 shrink-0 rounded-md border border-input bg-background px-3 text-xs font-semibold hover:bg-muted">Clear filters</button> : null}
      </div>
    </div>
  );
}

function SelectFilter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="min-w-36 shrink-0 text-xs font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-normal outline-none focus:border-primary">{children}</select></label>;
}

function DateRangeFilter({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
}: {
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
}) {
  const selected: DateRange | undefined =
    fromDate || toDate
      ? { from: dateFromKey(fromDate), to: dateFromKey(toDate) }
      : undefined;
  const label =
    fromDate && toDate
      ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
      : fromDate
        ? `${formatDate(fromDate)} – Select end date`
        : toDate
          ? `Through ${formatDate(toDate)}`
          : "Select date range";

  return (
    <label className="w-full shrink-0 text-xs font-medium sm:w-52">
      Order date range
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Choose order date range"
            className="mt-1 flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-xs font-normal outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            Select a start date, then an end date.
          </div>
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(range) => {
              setFromDate(dateToKey(range?.from));
              setToDate(dateToKey(range?.to));
            }}
          />
        </PopoverContent>
      </Popover>
    </label>
  );
}

function OrderTable({ orders, total, page, pageSize, onPageChange, onPageSizeChange, isAdmin, panel, onStatusChange }: { orders: ProcurementOrder[]; total: number; page: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void; isAdmin: boolean; panel: "admin" | "subhub" | "procurement"; onStatusChange: (order: ProcurementOrder, status: ProcurementStatus) => void }) {
  if (!orders.length) {
    return <EmptyState icon={<ShoppingCart className="size-7" />} title="No procurement orders found" description="Create an order or change the current search and filters." />;
  }

  return (
    <>
      <div className="overflow-x-auto border-y border-border">
        <table className={`w-full text-sm ${panel === "subhub" ? "min-w-[760px]" : "min-w-[1120px]"}`}>
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              {isAdmin ? <th className="px-4 py-3 font-semibold">SubHub</th> : null}
              {panel !== "subhub" ? <th className="px-4 py-3 font-semibold">Vendor</th> : null}
              <th className="px-4 py-3 font-semibold">Materials</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Ordered</th>
              <th className="px-4 py-3 font-semibold">Expected</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {isAdmin ? <th className="px-4 py-3 text-right font-semibold">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const note = order.notes.trim();
              return (
                <tr key={order.id} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-3">
                    <Link to="/po/$id" params={{ id: order.id }} search={{ panel }} className="font-semibold text-primary hover:underline">{order.orderNumber}</Link>
                    {panel !== "subhub" ? <p className="mt-1 text-xs text-muted-foreground">{note || "No notes"}</p> : null}
                  </td>
                  {isAdmin ? <td className="px-3 py-3">{order.subhubName}</td> : null}
                  {panel !== "subhub" ? <td className="px-3 py-3 font-semibold">{order.vendorName}</td> : null}
                  <td className="px-3 py-3">
                    {order.items.map((item) => (
                      <div key={`${item.materialCode}:${item.materialName}`} className="mb-1 last:mb-0">
                        <p className="font-semibold">{item.materialName}</p>
                        <p className="tabular text-xs font-normal text-muted-foreground">{item.materialCode}</p>
                      </div>
                    ))}
                  </td>
                  <td className="tabular px-3 py-3 text-right">{num(order.quantity)}</td>
                  <td className="tabular whitespace-nowrap px-3 py-3">{formatDate(order.orderDate)}</td>
                  <td className="tabular whitespace-nowrap px-3 py-3">{formatDate(order.expectedDelivery)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold text-white ${solidStatusClass(order.status)}`}>{order.status}</span>
                  </td>
                  {isAdmin ? (
                    <td className="px-3 py-3 text-right">
                      <select aria-label={`Change status for ${order.orderNumber}`} value={order.status === "Payment done" ? "" : order.status} onChange={(event) => onStatusChange(order, event.target.value as ProcurementStatus)} className={`h-9 min-w-36 rounded-md border-0 px-2 text-xs font-semibold text-white outline-none focus:ring-2 focus:ring-primary ${solidStatusClass(order.status)}`}>
                        {order.status === "Payment done" ? <option value="" disabled>Update status</option> : null}
                        {ORDER_ACTION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        showPageSizeSelect={panel !== "subhub"}
        size="md"
      />
    </>
  );
}

function VendorFilters({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  hasFilters,
  clearFilters,
}: {
  query: string;
  setQuery: (value: string) => void;
  statusFilter: ProcurementVendor["status"] | "all";
  setStatusFilter: (value: ProcurementVendor["status"] | "all") => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  categories: string[];
  hasFilters: boolean;
  clearFilters: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 p-4">
      <label className="min-w-[240px] flex-1 text-sm font-medium text-muted-foreground">
        Search vendors
        <span className="relative mt-1 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search vendors"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Vendor, contact, phone, email or location"
            className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base font-normal text-foreground outline-none focus:border-primary"
          />
        </span>
      </label>
      <label className="w-full text-sm font-medium text-muted-foreground sm:w-40">
        Status
        <span className="relative mt-1 block">
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ProcurementVendor["status"] | "all")
            }
            className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-base font-normal text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </span>
      </label>
      <label className="w-full text-sm font-medium text-muted-foreground sm:w-52">
        Category
        <span className="relative mt-1 block">
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-base font-normal text-foreground"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </span>
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
  );
}

function VendorTable({
  vendors,
  data,
  panel,
  isAdmin,
  onSelect,
  selectedVendorId,
  onEdit,
  onRemove,
  emptyDescription,
}: {
  vendors: ProcurementVendor[];
  data: ProcurementData;
  panel: "admin" | "procurement";
  isAdmin: boolean;
  onSelect: (id: string) => void;
  selectedVendorId: string;
  onEdit: (vendor: ProcurementVendor) => void;
  onRemove: (vendor: ProcurementVendor) => void;
  emptyDescription?: string;
}) {
  const performanceByVendor = new Map(data.vendorPerformance.map((item) => [item.vendorId, item]));
  const showAdminMetrics = panel === "admin";
  const tableClassName = showAdminMetrics
    ? "w-full min-w-[1120px] text-base"
    : "w-full min-w-[900px] table-auto text-base";

  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={<Store className="size-7" />}
        title="No vendors found"
        description={
          emptyDescription ??
          (isAdmin
            ? "Add the first vendor to start placing procurement orders."
            : "The Master Admin has not added any active vendors yet.")
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto border-y border-border">
      <table className={tableClassName}>
        <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="min-w-44 px-4 py-3 font-semibold">Vendor</th>
            {panel === "procurement" ? (
              <>
                <th className="min-w-40 px-4 py-3 font-semibold">Contact person</th>
                <th className="min-w-36 px-4 py-3 font-semibold">Phone</th>
              </>
            ) : (
              <th className="px-4 py-3 font-semibold">Contact</th>
            )}
            <th className="min-w-40 px-4 py-3 font-semibold">Categories</th>
            {showAdminMetrics ? (
              <th className="px-4 py-3 text-right font-semibold">Orders</th>
            ) : null}
            {showAdminMetrics ? (
              <>
                <th className="px-4 py-3 text-right font-semibold">Spend</th>
                <th className="px-4 py-3 text-right font-semibold">Performance</th>
              </>
            ) : null}
            <th className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => {
            const performance = performanceByVendor.get(vendor.id);
            return (
              <tr
                key={vendor.id}
                className={`border-b border-border/70 last:border-0 hover:bg-muted/40 ${
                  selectedVendorId === vendor.id ? "bg-primary/5" : ""
                }`}
              >
                <td className="px-4 py-4">
                  {panel === "procurement" ? (
                    <Link
                      to="/procurement-management/vendor-history/$vendorId"
                      params={{ vendorId: vendor.id }}
                      className="font-semibold text-primary hover:underline"
                    >
                      {vendor.name}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(selectedVendorId === vendor.id ? "" : vendor.id)}
                      className="text-left font-semibold hover:text-primary"
                    >
                      {vendor.name}
                    </button>
                  )}
                  {panel === "admin" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Tag size="md" tone={vendor.status === "active" ? "good" : "neutral"}>
                        {vendor.status}
                      </Tag>
                      {vendor.paymentTerms ? (
                        <span className="text-sm text-muted-foreground">{vendor.paymentTerms}</span>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                {panel === "procurement" ? (
                  <>
                    <td className="px-4 py-4 text-left">{vendor.contactName || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-left">{vendor.phone || "—"}</td>
                  </>
                ) : (
                  <td className="px-4 py-4 text-muted-foreground">
                    {vendor.contactName || "—"}
                    <br />
                    {vendor.phone || vendor.email || "No contact saved"}
                  </td>
                )}
                <td className="max-w-56 px-4 py-4 text-muted-foreground">
                  {vendor.categories.length ? vendor.categories.join(" · ") : "General materials"}
                </td>
                {showAdminMetrics ? (
                  <>
                    <td className="tabular px-4 py-4 text-right font-semibold">
                      {performance?.orders ?? 0}
                      <p className="text-sm font-normal text-muted-foreground">
                        {performance?.pendingOrders ?? 0} pending
                      </p>
                    </td>
                    <td className="tabular px-4 py-4 text-right">{inr(performance?.spend ?? 0)}</td>
                    <td className="px-4 py-4 text-right">
                      {performance?.onTimeRate === null || performance?.onTimeRate === undefined ? (
                        <span className="text-base text-muted-foreground">No deliveries yet</span>
                      ) : (
                        <Tag size="md" tone={performance.onTimeRate >= 85 ? "good" : "warn"}>
                          {performance.onTimeRate}% on time
                        </Tag>
                      )}
                    </td>
                  </>
                ) : null}
                <td className="px-4 py-4 text-right">
                  {panel === "procurement" ? (
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(vendor)}
                        title={`Edit ${vendor.name}`}
                        aria-label={`Edit ${vendor.name}`}
                        className="inline-flex size-10 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <Edit3 aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelect(selectedVendorId === vendor.id ? "" : vendor.id)}
                        title={`View details for ${vendor.name}`}
                        aria-label={`View details for ${vendor.name}`}
                        className="inline-flex size-10 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  ) : isAdmin ? (
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(vendor)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-md border border-input px-3 text-base font-semibold hover:bg-muted"
                      >
                        <Edit3 className="size-4" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(vendor)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-base font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Archive className="size-4" /> Archive
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(vendor.id)}
                      className="text-base font-semibold text-primary hover:underline"
                    >
                      View history
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VendorDetail({ vendor, orders, onClose }: { vendor: ProcurementVendor; orders: ProcurementOrder[]; onClose: () => void }) {
  return <section>
    <SectionHeading title={`${vendor.name} · purchase history`} description={`${orders.length} orders · ${vendor.paymentTerms || "Payment terms not specified"}`} action={<button type="button" onClick={onClose} aria-label="Close vendor history" className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-5" /></button>} />
    {orders.length ? <div className="overflow-x-auto border-b border-border"><table className="w-full min-w-[680px] text-base"><thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">SubHub</th><th className="px-4 py-3 font-semibold">Material</th><th className="px-4 py-3 text-right font-semibold">Qty</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0"><td className="px-4 py-4"><Link to="/po/$id" params={{ id: order.id }} className="font-semibold text-primary hover:underline">{order.orderNumber}</Link><p className="text-sm text-muted-foreground">{formatDate(order.orderDate)}</p></td><td className="px-4 py-4">{order.subhubName}</td><td className="px-4 py-4">{order.materialName}</td><td className="tabular px-4 py-4 text-right">{num(order.quantity)}</td><td className="tabular px-4 py-4 text-right">{inr(order.totalAmount)}</td><td className="px-4 py-4"><Tag size="md" tone={statusTone(order.status)}>{order.status}</Tag></td></tr>)}</tbody></table></div> : <EmptyState icon={<History className="size-7" />} title="No purchase history" description="Orders placed with this vendor will appear here." />}
  </section>;
}

function VendorDetailsDrawer({
  vendor,
  onClose,
}: {
  vendor: ProcurementVendor;
  onClose: () => void;
}) {
  const location = [
    vendor.address,
    [vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const details = [
    { label: "Contact person", value: vendor.contactName },
    { label: "Phone", value: vendor.phone },
    { label: "Email", value: vendor.email },
    { label: "Location", value: location },
    {
      label: "Categories",
      value: vendor.categories.length ? vendor.categories.join(" · ") : "General materials",
    },
    { label: "Notes", value: vendor.notes },
  ];

  return (
    <Drawer title={vendor.name} subtitle="Vendor details" onClose={onClose}>
      <dl className="grid gap-5 sm:grid-cols-2">
        {details.map(({ label, value }) => (
          <div
            key={label}
            className={label === "Categories" || label === "Notes" ? "sm:col-span-2" : ""}
          >
            <dt className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 break-words font-medium">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 border-t border-border pt-5">
        <Link
          to="/procurement-management/vendor-history/$vendorId"
          params={{ vendorId: vendor.id }}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-4 font-semibold hover:bg-muted"
        >
          <History aria-hidden="true" className="size-4" />
          Open purchase history
        </Link>
      </div>
    </Drawer>
  );
}

function VendorForm({
  mode,
  vendor,
  panel,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  vendor: ProcurementVendor | null;
  panel: "admin" | "procurement";
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState(() => ({
    name: vendor?.name ?? "",
    contactName: vendor?.contactName ?? "",
    phone: vendor?.phone ?? "",
    email: vendor?.email ?? "",
    address: vendor?.address ?? "",
    city: vendor?.city ?? "",
    state: vendor?.state ?? "",
    pincode: vendor?.pincode ?? "",
    paymentTerms: vendor?.paymentTerms ?? (panel === "admin" ? "30 days credit" : ""),
    categories: vendor?.categories.join(", ") ?? "",
    notes: vendor?.notes ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = {
      ...form,
      categories: form.categories
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };
    const response =
      mode === "edit" && vendor
        ? await updateVendorFn({ data: { ...data, id: vendor.id, panel } })
        : await createVendorFn({ data: { ...data, panel } });
    if (!response.ok) {
      setError(response.message);
    } else {
      await onSaved(`${form.name} ${mode === "edit" ? "was updated" : "was added"} successfully.`);
    }
    setBusy(false);
  }

  return (
    <Drawer
      title={mode === "edit" ? "Edit vendor" : "Add vendor"}
      subtitle="Vendor information is shared with authorized procurement users."
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <TextField
          label="Vendor name"
          value={form.name}
          required
          onChange={(value) => setForm({ ...form, name: value })}
          placeholder="Sanjay Brass Works"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Contact person"
            value={form.contactName}
            onChange={(value) => setForm({ ...form, contactName: value })}
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm({ ...form, email: value })}
          />
          {panel === "admin" ? (
            <TextField
              label="Payment terms"
              value={form.paymentTerms}
              onChange={(value) => setForm({ ...form, paymentTerms: value })}
            />
          ) : null}
          <TextField
            label="City"
            value={form.city}
            onChange={(value) => setForm({ ...form, city: value })}
          />
          <TextField
            label="State"
            value={form.state}
            onChange={(value) => setForm({ ...form, state: value })}
          />
          <TextField
            label="Pincode"
            value={form.pincode}
            onChange={(value) => setForm({ ...form, pincode: value })}
          />
        </div>
        <TextField
          label="Address"
          value={form.address}
          onChange={(value) => setForm({ ...form, address: value })}
        />
        <TextField
          label="Categories"
          value={form.categories}
          onChange={(value) => setForm({ ...form, categories: value })}
          placeholder="Brass, fasteners, molded parts"
        />
        <label className="block text-sm font-medium">
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <DrawerActions
          busy={busy}
          submitLabel={mode === "edit" ? "Save changes" : "Create vendor"}
          onClose={onClose}
        />
      </form>
    </Drawer>
  );
}

function OrderForm({ data, isAdmin, panel, onClose, onSaved }: { data: ProcurementData; isAdmin: boolean; panel: "admin" | "procurement"; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const materials = useRawMaterials();
  const [vendorId, setVendorId] = useState("");
  const [addingVendor, setAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");
  const [miscellaneousVendorName, setMiscellaneousVendorName] = useState("");
  const [subhubUserId, setSubhubUserId] = useState("");
  const [materialCode, setMaterialCode] = useState(materials[0]?.code ?? ONE_OFF_MATERIAL_CODE);
  const [customMaterialName, setCustomMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDelivery, setExpectedDelivery] = useState(dateAfter(7));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedMaterial = materials.find((material) => material.code === materialCode);
  const isMiscellaneousVendor = !addingVendor && vendorId === MISCELLANEOUS_VENDOR_ID;
  const isOneOffMaterial = materialCode === ONE_OFF_MATERIAL_CODE;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      setError("Enter a whole-number quantity.");
      return;
    }
    if (isAdmin && !subhubUserId) {
      setError("Select the destination SubHub.");
      return;
    }
    if (addingVendor && !newVendorName.trim()) {
      setError("Enter the new vendor name.");
      return;
    }
    if (isOneOffMaterial && !customMaterialName.trim()) {
      setError("Enter the name of the one-off material.");
      return;
    }
    setBusy(true);
    const response = await createProcurementOrderFn({ data: { panel, vendorId: addingVendor ? undefined : vendorId || undefined, newVendor: addingVendor ? { name: newVendorName, phone: newVendorPhone, email: newVendorEmail } : isMiscellaneousVendor && miscellaneousVendorName.trim() ? { name: miscellaneousVendorName, categories: ["Miscellaneous"] } : undefined, subhubUserId: isAdmin ? subhubUserId : undefined, materialCode, materialName: isOneOffMaterial ? customMaterialName : selectedMaterial?.name, quantity: parsedQuantity, orderDate, expectedDelivery, notes } });
    if (!response.ok) setError(response.message);
    else await onSaved(`${response.order.orderNumber} was created successfully.`);
    setBusy(false);
  }
  return (
    <Drawer
      title="New procurement order"
      subtitle={isAdmin ? "Create an order for a selected SubHub and vendor." : "Create an order for this SubHub. You can add a new vendor without leaving the form."}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5 text-base">
        <label className="block font-medium">
          {isAdmin ? "Destination SubHub" : "Destination"}
          {isAdmin ? (
            <select required value={subhubUserId} onChange={(event) => setSubhubUserId(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3">
              <option value="">Select SubHub</option>
              {data.subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.name}</option>)}
            </select>
          ) : (
            <p className="mt-1 font-normal text-foreground">{data.orders[0]?.subhubName ?? "This SubHub workspace"}</p>
          )}
        </label>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">{addingVendor ? "New vendor" : "Vendor"}</p>
            <button type="button" onClick={() => { setAddingVendor(!addingVendor); setVendorId(""); }} className="font-semibold text-primary hover:underline">
              {addingVendor ? "Choose existing vendor" : "＋ Add new vendor"}
            </button>
          </div>
          {addingVendor ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <TextField label="Vendor name" value={newVendorName} required onChange={setNewVendorName} placeholder="New vendor name" />
              <TextField label="Phone" value={newVendorPhone} onChange={setNewVendorPhone} />
              <TextField label="Email" type="email" value={newVendorEmail} onChange={setNewVendorEmail} />
            </div>
          ) : (
            <>
              <select required value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3">
                <option value="">Select active vendor</option>
                <option value={MISCELLANEOUS_VENDOR_ID}>Miscellaneous</option>
                {data.vendors.filter((vendor) => vendor.status === "active").map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.categories.length ? ` · ${vendor.categories.join(", ")}` : ""}</option>)}
              </select>
              {isMiscellaneousVendor ? (
                <div className="mt-3 border-l-2 border-primary py-1 pl-4">
                  <TextField label="Miscellaneous supplier name (optional)" value={miscellaneousVendorName} onChange={setMiscellaneousVendorName} placeholder="Local hardware shop" />
                  <p className="mt-2 text-base text-muted-foreground">Leave blank to save the vendor as Miscellaneous.</p>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RawMaterialPicker materials={materials} value={materialCode} onChange={setMaterialCode} />
          {isOneOffMaterial ? <TextField label="One-off material name" value={customMaterialName} required onChange={setCustomMaterialName} placeholder="Pair of scissors or duct tape" /> : <div />}
          <TextField label="Quantity" type="number" required value={quantity} onChange={setQuantity} placeholder="1000" />
          <TextField label="Order date" type="date" required value={orderDate} onChange={setOrderDate} />
          <TextField label="Expected delivery" type="date" required value={expectedDelivery} onChange={setExpectedDelivery} />
        </div>

        <label className="block font-medium">
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Delivery instructions, quotation reference, or remarks…" className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary" />
        </label>
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-3 text-base text-destructive">{error}</p> : null}
        <DrawerActions busy={busy} submitLabel="Create order" onClose={onClose} />
      </form>
    </Drawer>
  );
}

function RawMaterialPicker({ materials, value, onChange }: { materials: ReturnType<typeof useRawMaterials>; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedMaterial = materials.find((material) => material.code === value);
  const filteredMaterials = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return materials;
    return materials.filter((material) => `${material.name} ${material.code}`.toLowerCase().includes(normalizedQuery));
  }, [materials, query]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const label = value === ONE_OFF_MATERIAL_CODE ? "New one-off material…" : selectedMaterial ? `${selectedMaterial.name} · ${selectedMaterial.code}` : "Select raw material";

  return (
    <div ref={pickerRef} className="relative block text-base font-medium">
      <span>Raw material</span>
      <input required aria-hidden="true" tabIndex={-1} value={value} onChange={() => undefined} className="pointer-events-none absolute h-px w-px opacity-0" />
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-1 flex h-12 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-base font-normal outline-none focus:border-primary">
        <span className={value ? "truncate text-foreground" : "text-muted-foreground"}>{label}</span>
        <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-lg">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search raw materials…" aria-label="Search raw materials" className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-base outline-none focus:border-primary" />
          </div>
        </div>
        <div role="listbox" aria-label="Raw materials" className="max-h-72 overflow-y-auto p-1">
          <button type="button" role="option" aria-selected={value === ONE_OFF_MATERIAL_CODE} onClick={() => { onChange(ONE_OFF_MATERIAL_CODE); setQuery(""); setOpen(false); }} className={`w-full rounded px-3 py-3 text-left text-base font-semibold ${value === ONE_OFF_MATERIAL_CODE ? "bg-primary/10 text-primary" : "text-primary hover:bg-muted"}`}>
            New one-off material…<span className="mt-1 block text-sm font-normal text-muted-foreground">For scissors, duct tape, or other unique items</span>
          </button>
          {filteredMaterials.length ? filteredMaterials.map((material) => <button type="button" role="option" aria-selected={value === material.code} key={material.code} onClick={() => { onChange(material.code); setQuery(""); setOpen(false); }} className={`w-full rounded px-3 py-3 text-left text-base ${value === material.code ? "bg-muted font-semibold text-foreground" : "text-foreground hover:bg-muted"}`}>
            <span className="block truncate">{material.name}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{material.code}</span>
          </button>) : <p className="px-3 py-4 text-center text-base text-muted-foreground">No raw materials match “{query}”.</p>}
        </div>
      </div> : null}
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="block text-base font-medium">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary" /></label>;
}

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-40 flex justify-end bg-black/25" role="dialog" aria-modal="true"><div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Procurement workspace</p><h2 className="mt-2 text-2xl font-semibold">{title}</h2><p className="mt-1 text-base text-muted-foreground">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-5" /></button></div><div className="mt-7 flex-1 text-base [&_button]:min-h-12 [&_button]:text-base [&_input:not([type=checkbox]):not([type=radio])]:h-12 [&_input:not([type=checkbox]):not([type=radio])]:text-base [&_label]:text-base [&_p]:text-base [&_select]:h-12 [&_select]:text-base [&_textarea]:text-base">{children}</div></div></div>;
}

function DrawerActions({ busy, submitLabel, onClose }: { busy: boolean; submitLabel: string; onClose: () => void }) {
  return <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5"><button type="button" onClick={onClose} className="min-h-12 rounded-md border border-input px-4 text-base font-semibold hover:bg-muted">Cancel</button><button type="submit" disabled={busy} className="rule-header inline-flex min-h-12 items-center gap-2 rounded-md px-4 text-base font-semibold disabled:opacity-60"><Check className="size-5" />{busy ? "Saving…" : submitLabel}</button></div>;
}

function Loading() {
  return <p className="border-b border-border py-8 text-center text-base text-muted-foreground">Loading live procurement data…</p>;
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="border-b border-border py-8 text-center text-muted-foreground"><div className="mx-auto flex size-10 items-center justify-center text-primary">{icon}</div><p className="mt-3 text-lg font-semibold text-foreground">{title}</p><p className="mt-1 text-base">{description}</p></div>;
}