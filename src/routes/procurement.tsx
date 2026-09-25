import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  Check,
  ChevronDown,
  ClipboardList,
  Edit3,
  Filter,
  History,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import type { Panel as ProcurementPanel } from "@/auth.server";
import { useAuth } from "@/components/auth/AuthContext";
import { Tag } from "@/components/erp/bits";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { TablePagination } from "@/components/erp/TablePagination";
import { HubBatchBrowser } from "@/components/erp/HubBatchBrowser";
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
      { name: "description", content: "Live vendor and purchase-order management for every Gadsons SubHub." },
      { property: "og:title", content: "Procurement — Gadsons ERP" },
      { property: "og:description", content: "Manage vendors, procurement orders, delivery status and spend." },
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

type Tab = "orders" | "vendors" | "needs" | "requests";
type SortKey = "orderDate-desc" | "orderDate-asc" | "delivery-asc" | "amount-desc" | "quantity-desc" | "vendor-asc";

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

function Procurement() {
  return <ProcurementPage result={Route.useLoaderData()} />;
}

type ProcurementResult = Awaited<ReturnType<typeof getProcurementDataFn>>;

export function ProcurementPage({ result }: { result: ProcurementResult }) {
  const auth = useAuth();
  const canManageProcurement = auth.user?.panel === "admin" || auth.user?.panel === "procurement";
  const panel = auth.user?.panel ?? "admin";
  const [data, setData] = useState<ProcurementData>(result.ok ? result.data : emptyData);
  const [tab, setTab] = useState<Tab>("orders");
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProcurementStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("orderDate-desc");
  const [orderDate, setOrderDate] = useState("");
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
        const matchesOrderDate = !orderDate || order.orderDate === orderDate;
        const matchesFrom = !fromDate || order.orderDate >= fromDate;
        const matchesTo = !toDate || order.orderDate <= toDate;
        return matchesQuery && matchesVendor && matchesSubhub && matchesStatus && matchesOrderDate && matchesFrom && matchesTo;
      })
      .sort((a, b) => {
        if (panel === "subhub") return b.orderDate.localeCompare(a.orderDate);
        if (sortBy === "orderDate-asc") return a.orderDate.localeCompare(b.orderDate);
        if (sortBy === "delivery-asc") return a.expectedDelivery.localeCompare(b.expectedDelivery);
        if (sortBy === "amount-desc" && panel !== "subhub") return b.totalAmount - a.totalAmount;
        if (sortBy === "quantity-desc") return b.quantity - a.quantity;
        if (sortBy === "vendor-asc") return a.vendorName.localeCompare(b.vendorName);
        return b.orderDate.localeCompare(a.orderDate);
      });
  }, [data.orders, fromDate, orderDate, panel, query, sortBy, statusFilter, subhubFilter, toDate, vendorFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [fromDate, orderDate, query, sortBy, statusFilter, subhubFilter, toDate, vendorFilter]);

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

  const selectedVendor = data.vendors.find((vendor) => vendor.id === selectedVendorId);
  const selectedVendorOrders = selectedVendorId ? data.orders.filter((order) => order.vendorId === selectedVendorId) : [];
  const hasFilters = Boolean(query || vendorFilter !== "all" || subhubFilter !== "all" || statusFilter !== "all" || (sortBy !== "orderDate-desc" && !(panel === "subhub" && sortBy === "amount-desc")) || orderDate || fromDate || toDate);

  function clearFilters() {
    setQuery("");
    setVendorFilter("all");
    setSubhubFilter("all");
    setStatusFilter("all");
    setSortBy("orderDate-desc");
    setOrderDate("");
    setFromDate("");
    setToDate("");
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

  const summaryMetrics = [
    ...(canManageProcurement
      ? [{ label: "Active vendors", value: num(data.summary.vendorCount), hint: `${data.vendors.length} total records` }]
      : []),
    ...(panel !== "subhub"
      ? [{ label: "Open orders", value: num(data.summary.openOrders), hint: `${num(data.summary.unitsOnOrder)} units in progress` }]
      : []),
    ...(panel !== "subhub"
      ? [{ label: "Committed spend", value: inr(data.summary.committedSpend), hint: "Open procurement orders" }]
      : []),
    ...(panel !== "subhub"
      ? [{
          label: "On-time delivery",
          value: data.summary.onTimeRate === null ? "—" : `${data.summary.onTimeRate}%`,
          hint: `${data.summary.completedOrders} completed orders`,
        }]
      : []),
  ];

  const content = (
    <div className="space-y-6 text-base">
      {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-base text-success">{notice}</p> : null}

      {summaryMetrics.length ? (
        <section
          aria-label="Procurement summary"
          className="grid gap-x-8 border-y border-border grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        >
          {summaryMetrics.map((metric) => (
            <div key={metric.label} className="py-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              <p className="tabular mt-1 text-3xl font-bold leading-tight">{metric.value}</p>
              <p className="mt-1 text-base text-muted-foreground">{metric.hint}</p>
            </div>
          ))}
        </section>
      ) : null}

      {panel !== "subhub" ? <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-1" role="tablist" aria-label="Procurement sections">
          <button type="button" role="tab" aria-selected={tab === "orders"} onClick={() => setTab("orders")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${tab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <ClipboardList className="size-5" /> Order Management
          </button>
          {canManageProcurement ? <button type="button" role="tab" aria-selected={tab === "vendors"} onClick={() => setTab("vendors")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${tab === "vendors" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Store className="size-5" /> Vendor Management
          </button> : null}
          {canManageProcurement ? <button type="button" role="tab" aria-selected={tab === "needs"} onClick={() => setTab("needs")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${tab === "needs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <PackagePlus className="size-5" /> Hub stock & targets
          </button> : null}
          {canManageProcurement ? <button type="button" role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-base font-semibold ${tab === "requests" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <ClipboardList className="size-5" /> Item requests{data.itemRequests.some((request) => request.status === "Pending") ? ` (${data.itemRequests.filter((request) => request.status === "Pending").length})` : ""}
          </button> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageProcurement && tab === "vendors" ? <button type="button" onClick={openCreateVendor} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted"><Plus className="size-5" /> Add vendor</button> : null}
          {canManageProcurement && tab === "orders" ? <button type="button" onClick={() => setShowOrderForm(true)} className="rule-header inline-flex min-h-12 items-center gap-2 rounded-md px-4 text-base font-semibold"><PackagePlus className="size-5" /> New procurement order</button> : null}
          <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </div> : null}

      {tab === "orders" ? (
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
            sortBy={sortBy}
            setSortBy={setSortBy}
            orderDate={orderDate}
            setOrderDate={setOrderDate}
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
            {panel !== "subhub" ? <SectionHeading title="Procurement orders" description={`${filteredOrders.length} of ${data.orders.length} orders · all order records are stored in MongoDB`} /> : null}
            {loading ? <Loading /> : <OrderTable orders={paginatedOrders} total={filteredOrders.length} page={orderPage} pageSize={orderPageSize} onPageChange={setOrderPage} onPageSizeChange={setOrderPageSize} isAdmin={canManageProcurement} panel={panel} onStatusChange={(order, status) => void updateOrderStatus(order, status)} />}
          </section>
          {canManageProcurement ? <AdminReports data={data} /> : null}
        </>
      ) : tab === "vendors" ? (
        <>
          <section>
            <SectionHeading title="Vendor directory" description="Create, edit, archive, and review the shared procurement vendor directory." />
            <VendorTable vendors={visibleVendors} data={data} isAdmin={canManageProcurement} onSelect={setSelectedVendorId} selectedVendorId={selectedVendorId} onEdit={openEditVendor} onRemove={(vendor) => void removeVendor(vendor)} />
          </section>
          {selectedVendor ? <VendorDetail vendor={selectedVendor} orders={selectedVendorOrders} onClose={() => setSelectedVendorId("")} /> : null}
        </>
      ) : null}
      {tab === "needs" ? <HubMaterialNeeds data={data} panel={panel as "admin" | "procurement"} onSaved={async (message) => { setNotice(message); await reload(); }} /> : null}
      {tab === "requests" ? <ItemRequestsTable requests={data.itemRequests} panel={panel as "admin" | "procurement"} onUpdated={async (message) => { setNotice(message); await reload(); }} /> : null}

      {showOrderForm ? <OrderForm data={data} isAdmin={canManageProcurement} panel={panel as "admin" | "procurement"} onClose={() => setShowOrderForm(false)} onSaved={async (message) => { setShowOrderForm(false); setNotice(message); await reload(); }} /> : null}
      {vendorFormMode ? <VendorForm mode={vendorFormMode} vendor={editingVendor} panel={panel as "admin" | "procurement"} onClose={() => setVendorFormMode(null)} onSaved={async (message) => { setVendorFormMode(null); setNotice(message); await reload(); }} /> : null}
    </div>
  );

  return auth.user?.panel === "subhub" ? (
    <SubHubShell headerTitle="Procurement">
      <div className="space-y-6 px-6 py-5">{content}</div>
    </SubHubShell>
  ) : (
    <Shell title="Procurement" subtitle="Live vendor management, purchase orders, and SubHub-wide delivery reporting">
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
  const [orderHub, setOrderHub] = useState<string | null>(null);
  const [batchHub, setBatchHub] = useState<string | null>(null);

  if (!hubs.length) {
    return <section>
      <SectionHeading title="Hub stock and target material needs" description="Required quantities are calculated from active production targets, reports, hub stock, and outstanding procurement orders." />
      <p className="border-b border-border py-8 text-center text-base text-muted-foreground">No active SubHubs are available.</p>
    </section>;
  }

  return <>
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <SectionHeading title="Hub stock and target material needs" description="Remaining BOM requirements are compared with stock in each SubHub and material already on order." />
        <p className="mt-3 text-base text-muted-foreground">A shortage is the remaining target requirement minus available stock and undelivered procurement quantities. Use each SubHub’s batch register to review individual items and traceability.</p>
      </div>
      {hubs.map((hub) => {
        const { id: hubId, name: hubName, needs } = hub;
        const shortageCount = needs.filter((need) => need.shortageQuantity > 0).length;
        return <section key={hubId} className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div><h3 className="text-lg font-semibold">{hubName}</h3><p className="mt-1 text-base text-muted-foreground">{needs.length} raw materials · {shortageCount} below required quantity</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-expanded={batchHub === hubId} onClick={() => setBatchHub(batchHub === hubId ? null : hubId)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted"><ClipboardList className="size-5" /> {batchHub === hubId ? "Hide batch register" : "Batch register"}</button>
              <button type="button" disabled={!shortageCount} onClick={() => setOrderHub(hubId)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-50"><PackagePlus className="size-5" /> Create order for shortages</button>
            </div>
          </div>
          {needs.length ? (
            <div className="overflow-x-auto border-y border-border">
              <table className="w-full min-w-[760px] text-base">
                <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Raw material</th><th className="px-4 py-3 text-right font-semibold">Needed for remaining targets</th><th className="px-4 py-3 text-right font-semibold">Hub stock</th><th className="px-4 py-3 text-right font-semibold">On order</th><th className="px-4 py-3 text-right font-semibold">Additional quantity</th><th className="px-4 py-3 text-right font-semibold">Stock status</th></tr></thead>
                <tbody>{needs.map((need) => <tr key={need.itemCode} className="border-b border-border/70 last:border-0"><td className="px-4 py-4 font-semibold">{need.itemName}<span className="ml-2 text-sm font-normal text-muted-foreground">{need.itemCode}</span></td><td className="tabular px-4 py-4 text-right">{num(need.requiredQuantity)}</td><td className="tabular px-4 py-4 text-right">{num(need.stockQuantity)}</td><td className="tabular px-4 py-4 text-right">{num(need.onOrderQuantity)}</td><td className={`tabular px-4 py-4 text-right font-semibold ${need.shortageQuantity > 0 ? "text-destructive" : "text-success"}`}>{num(need.shortageQuantity)}</td><td className="px-4 py-4 text-right"><Tag size="md" tone={need.shortageQuantity > 0 ? "warn" : "good"}>{need.shortageQuantity > 0 ? "Low stock" : "Sufficient"}</Tag></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="py-5 text-base text-muted-foreground">No active raw-material targets for this SubHub. Its batch register is still available above.</p>}
          {batchHub === hubId ? <div className="border-t border-border py-4"><HubBatchBrowser hubId={hubId} panel={panel} /></div> : null}
        </section>;
      })}
    </div>
    {orderHub ? <ShortageOrderForm
      data={data}
      needs={data.materialNeeds.filter((need) => need.subhubUserId === orderHub && need.shortageQuantity > 0)}
      panel={panel}
      onClose={() => setOrderHub(null)}
      onSaved={async (message) => { setOrderHub(null); await onSaved(message); }}
    /> : null}
  </>;
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

function ItemRequestsTable({ requests, panel, onUpdated }: { requests: ProcurementItemRequest[]; panel: "admin" | "procurement"; onUpdated: (message: string) => Promise<void> }) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  async function update(request: ProcurementItemRequest, status: "Approved" | "Declined") {
    setBusyId(request.id);
    setError("");
    const result = await updateProcurementItemRequestFn({ data: { id: request.id, status, response: responses[request.id] ?? "", panel } });
    if (!result.ok) setError(result.message);
    else await onUpdated(`${request.itemName} request was ${status.toLowerCase()}.`);
    setBusyId("");
  }
  return <section>
    <SectionHeading title="SubHub item requests" description="Requests submitted by SubHub teams for small supplies, tools, and other items." />
    {error ? <p role="alert" className="border-b border-border bg-destructive/5 py-3 text-base text-destructive">{error}</p> : null}
    {requests.length ? <div className="divide-y divide-border border-b border-border">{requests.map((request) => <article key={request.id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-semibold">{request.itemName}</h3><Tag size="md" tone={request.status === "Approved" ? "good" : request.status === "Declined" ? "neutral" : "warn"}>{request.status}</Tag></div><p className="mt-1 text-base text-muted-foreground">{request.subhubName} · quantity {num(request.quantity)} · {formatDate(request.createdAt.slice(0, 10))}</p>{request.notes ? <p className="mt-2 text-base text-muted-foreground">{request.notes}</p> : null}{request.response ? <p className="mt-2 text-base">Response: {request.response}</p> : null}</div>
      {request.status === "Pending" ? <div className="flex flex-col gap-2 sm:flex-row"><input value={responses[request.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={500} aria-label={`Response to ${request.itemName} request`} placeholder="Response (optional)" className="h-12 min-w-52 rounded-md border border-input px-3 text-base" /><button type="button" disabled={busyId === request.id} onClick={() => void update(request, "Declined")} className="min-h-12 rounded-md border border-input px-4 text-base font-semibold hover:bg-muted disabled:opacity-50">Decline</button><button type="button" disabled={busyId === request.id} onClick={() => void update(request, "Approved")} className="min-h-12 rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-50">Approve</button></div> : null}
    </article>)}</div> : <p className="border-b border-border py-8 text-center text-base text-muted-foreground">No SubHub item requests have been submitted.</p>}
  </section>;
}

function OrderFilters({
  panel, query, setQuery, vendorFilter, setVendorFilter, subhubFilter, setSubhubFilter, statusFilter, setStatusFilter, sortBy, setSortBy,
  orderDate, setOrderDate, fromDate, setFromDate, toDate, setToDate, vendors, subhubs, hasFilters, clearFilters,
}: {
  panel: ProcurementPanel;
  query: string; setQuery: (value: string) => void;
  vendorFilter: string; setVendorFilter: (value: string) => void;
  subhubFilter: string; setSubhubFilter: (value: string) => void;
  statusFilter: ProcurementStatus | "all"; setStatusFilter: (value: ProcurementStatus | "all") => void;
  sortBy: SortKey; setSortBy: (value: SortKey) => void;
  orderDate: string; setOrderDate: (value: string) => void;
  fromDate: string; setFromDate: (value: string) => void;
  toDate: string; setToDate: (value: string) => void;
  vendors: ProcurementVendor[]; subhubs: Array<{ id: string; name: string }>;
  hasFilters: boolean; clearFilters: () => void;
}) {
  return (
    <div className={panel === "subhub" ? "border-b border-border" : "border-y border-border"}>
      {panel !== "subhub" ? <div className="flex items-center gap-3 py-3"><Filter className="size-5 shrink-0 text-primary" /><div><h2 className="text-lg font-semibold">Search and filter orders</h2><p className="mt-1 text-base text-muted-foreground">Use an exact date or a date range; filters can be combined.</p></div></div> : null}
      <div className={`filter-toolbar flex flex-wrap items-end gap-3 ${panel === "subhub" ? "pt-2 pb-4" : "py-4 border-t border-border"}`}>
        <label className="min-w-[230px] flex-1 text-base font-medium">Search<span className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PO, vendor, material, SubHub…" className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-base font-normal outline-none focus:border-primary" /></span></label>
        {panel !== "subhub" ? <SelectFilter label="Vendor" value={vendorFilter} onChange={setVendorFilter}><option value="all">All vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</SelectFilter> : null}
        {subhubs.length ? <SelectFilter label="SubHub" value={subhubFilter} onChange={setSubhubFilter}><option value="all">All SubHubs</option>{subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.name}</option>)}</SelectFilter> : null}
        {panel !== "subhub" ? <SelectFilter label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as ProcurementStatus | "all")}><option value="all">All statuses</option>{PROCUREMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</SelectFilter> : null}
        {panel !== "subhub" ? <SelectFilter label="Sort" value={sortBy} onChange={(value) => setSortBy(value as SortKey)}><option value="orderDate-desc">Newest order date</option><option value="orderDate-asc">Oldest order date</option><option value="delivery-asc">Expected delivery</option><option value="amount-desc">Highest amount</option><option value="quantity-desc">Highest quantity</option><option value="vendor-asc">Vendor A–Z</option></SelectFilter> : null}
        <DateFilter label="Exact order date" value={orderDate} onChange={setOrderDate} />
        {panel !== "subhub" ? <DateFilter label="From" value={fromDate} onChange={setFromDate} /> : null}
        {panel !== "subhub" ? <DateFilter label="To" value={toDate} onChange={setToDate} /> : null}
        {hasFilters ? <button type="button" onClick={clearFilters} className="h-12 shrink-0 rounded-md border border-input bg-background px-4 text-base font-semibold hover:bg-muted">Clear filters</button> : null}
      </div>
    </div>
  );
}

function SelectFilter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="min-w-36 shrink-0 text-base font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary">{children}</select></label>;
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="min-w-40 shrink-0 text-base font-medium">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary" /></label>;
}

function OrderTable({ orders, total, page, pageSize, onPageChange, onPageSizeChange, isAdmin, panel, onStatusChange }: { orders: ProcurementOrder[]; total: number; page: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void; isAdmin: boolean; panel: "admin" | "subhub" | "procurement"; onStatusChange: (order: ProcurementOrder, status: ProcurementStatus) => void }) {
  if (!orders.length) {
    return <EmptyState icon={<ShoppingCart className="size-7" />} title="No procurement orders found" description="Create an order or change the current search and filters." />;
  }

  return (
    <>
      <div className="overflow-x-auto border-y border-border">
        <table className={`w-full text-base ${panel === "subhub" ? "min-w-[820px]" : "min-w-[980px]"}`}>
          <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              {isAdmin ? <th className="px-4 py-3 font-semibold">SubHub</th> : null}
              {panel !== "subhub" ? <th className="px-4 py-3 font-semibold">Vendor</th> : null}
              <th className="px-4 py-3 font-semibold">Materials</th>
              {panel === "subhub" ? <th className="px-4 py-3 font-semibold">Material code</th> : null}
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              {panel !== "subhub" ? <th className="px-4 py-3 text-right font-semibold">Amount</th> : null}
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
                  <td className="px-4 py-4">
                    <Link to="/po/$id" params={{ id: order.id }} search={{ panel }} className="font-semibold text-primary hover:underline">{order.orderNumber}</Link>
                    {panel !== "subhub" ? <p className="mt-1 text-sm text-muted-foreground">{note || "No notes"}</p> : null}
                  </td>
                  {isAdmin ? <td className="px-4 py-4">{order.subhubName}</td> : null}
                  {panel !== "subhub" ? <td className="px-4 py-4 font-semibold">{order.vendorName}</td> : null}
                  <td className="px-4 py-4">
                    {order.items.map((item) => (
                      <p key={`${item.materialCode}:${item.materialName}`} className="font-semibold">
                        {item.materialName}
                        {panel !== "subhub" ? <span className="tabular text-sm font-normal text-muted-foreground"> {item.materialCode}</span> : null}
                      </p>
                    ))}
                  </td>
                  {panel === "subhub" ? (
                    <td className="px-4 py-4">
                      {order.items.map((item) => (
                        <p key={`${item.materialCode}:${item.materialName}`} className="tabular text-sm text-muted-foreground">{item.materialCode}</p>
                      ))}
                    </td>
                  ) : null}
                  <td className="tabular px-4 py-4 text-right">{num(order.quantity)}</td>
                  {panel !== "subhub" ? <td className="tabular px-4 py-4 text-right">{inr(order.totalAmount)}</td> : null}
                  <td className="tabular whitespace-nowrap px-4 py-4">{formatDate(order.orderDate)}</td>
                  <td className="tabular whitespace-nowrap px-4 py-4">{formatDate(order.expectedDelivery)}</td>
                  <td className="px-4 py-4">
                    {panel === "subhub" ? (
                      <span className={`inline-flex items-center rounded px-2.5 py-1 text-sm font-semibold text-white ${solidStatusClass(order.status)}`}>{order.status}</span>
                    ) : <Tag size="md" tone={statusTone(order.status)}>{order.status}</Tag>}
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-4 text-right">
                      <select aria-label={`Change status for ${order.orderNumber}`} value={order.status} onChange={(event) => onStatusChange(order, event.target.value as ProcurementStatus)} className="h-11 min-w-36 rounded-md border border-input bg-background px-2 text-base font-medium outline-none focus:border-primary">
                        {PROCUREMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
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

function VendorTable({ vendors, data, isAdmin, onSelect, selectedVendorId, onEdit, onRemove }: { vendors: ProcurementVendor[]; data: ProcurementData; isAdmin: boolean; onSelect: (id: string) => void; selectedVendorId: string; onEdit: (vendor: ProcurementVendor) => void; onRemove: (vendor: ProcurementVendor) => void }) {
  const performanceByVendor = new Map(data.vendorPerformance.map((item) => [item.vendorId, item]));
  return vendors.length ? <div className="overflow-x-auto border-y border-border"><table className="w-full min-w-[920px] text-base"><thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Vendor</th><th className="px-4 py-3 font-semibold">Contact</th><th className="px-4 py-3 font-semibold">Categories</th><th className="px-4 py-3 text-right font-semibold">Orders</th><th className="px-4 py-3 text-right font-semibold">Spend</th><th className="px-4 py-3 text-right font-semibold">Performance</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead><tbody>{vendors.map((vendor) => { const performance = performanceByVendor.get(vendor.id); return <tr key={vendor.id} className={`border-b border-border/70 last:border-0 hover:bg-muted/40 ${selectedVendorId === vendor.id ? "bg-primary/5" : ""}`}><td className="px-4 py-4"><button type="button" onClick={() => onSelect(selectedVendorId === vendor.id ? "" : vendor.id)} className="text-left font-semibold hover:text-primary">{vendor.name}</button><div className="mt-2 flex flex-wrap items-center gap-2"><Tag size="md" tone={vendor.status === "active" ? "good" : "neutral"}>{vendor.status}</Tag>{vendor.paymentTerms ? <span className="text-sm text-muted-foreground">{vendor.paymentTerms}</span> : null}</div></td><td className="px-4 py-4 text-muted-foreground">{vendor.contactName || "—"}<br />{vendor.phone || vendor.email || "No contact saved"}</td><td className="max-w-48 px-4 py-4 text-muted-foreground">{vendor.categories.length ? vendor.categories.join(" · ") : "General materials"}</td><td className="tabular px-4 py-4 text-right font-semibold">{performance?.orders ?? 0}<p className="text-sm font-normal text-muted-foreground">{performance?.pendingOrders ?? 0} pending</p></td><td className="tabular px-4 py-4 text-right">{inr(performance?.spend ?? 0)}</td><td className="px-4 py-4 text-right">{performance?.onTimeRate === null || performance?.onTimeRate === undefined ? <span className="text-base text-muted-foreground">No deliveries yet</span> : <Tag size="md" tone={performance.onTimeRate >= 85 ? "good" : "warn"}>{performance.onTimeRate}% on time</Tag>}</td><td className="px-4 py-4 text-right">{isAdmin ? <div className="inline-flex gap-1"><button type="button" onClick={() => onEdit(vendor)} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-input px-3 text-base font-semibold hover:bg-muted"><Edit3 className="size-4" /> Edit</button><button type="button" onClick={() => onRemove(vendor)} className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-base font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Archive className="size-4" /> Archive</button></div> : <button type="button" onClick={() => onSelect(vendor.id)} className="text-base font-semibold text-primary hover:underline">View history</button>}</td></tr>; })}</tbody></table></div> : <EmptyState icon={<Store className="size-7" />} title="No vendors found" description={isAdmin ? "Add the first vendor to start placing procurement orders." : "The Master Admin has not added any active vendors yet."} />;
}

function VendorDetail({ vendor, orders, onClose }: { vendor: ProcurementVendor; orders: ProcurementOrder[]; onClose: () => void }) {
  return <section>
    <SectionHeading title={`${vendor.name} · purchase history`} description={`${orders.length} orders · ${vendor.paymentTerms || "Payment terms not specified"}`} action={<button type="button" onClick={onClose} aria-label="Close vendor history" className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-5" /></button>} />
    {orders.length ? <div className="overflow-x-auto border-b border-border"><table className="w-full min-w-[680px] text-base"><thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">SubHub</th><th className="px-4 py-3 font-semibold">Material</th><th className="px-4 py-3 text-right font-semibold">Qty</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0"><td className="px-4 py-4"><Link to="/po/$id" params={{ id: order.id }} className="font-semibold text-primary hover:underline">{order.orderNumber}</Link><p className="text-sm text-muted-foreground">{formatDate(order.orderDate)}</p></td><td className="px-4 py-4">{order.subhubName}</td><td className="px-4 py-4">{order.materialName}</td><td className="tabular px-4 py-4 text-right">{num(order.quantity)}</td><td className="tabular px-4 py-4 text-right">{inr(order.totalAmount)}</td><td className="px-4 py-4"><Tag size="md" tone={statusTone(order.status)}>{order.status}</Tag></td></tr>)}</tbody></table></div> : <EmptyState icon={<History className="size-7" />} title="No purchase history" description="Orders placed with this vendor will appear here." />}
  </section>;
}

function AdminReports({ data }: { data: ProcurementData }) {
  return <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
    <section>
      <SectionHeading title="SubHub procurement report" description="Spend, quantities, and order status across every active SubHub." />
      {data.subhubSummary.length ? <div className="overflow-x-auto border-b border-border"><table className="w-full min-w-[580px] text-base"><thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">SubHub</th><th className="px-4 py-3 text-right font-semibold">Orders</th><th className="px-4 py-3 text-right font-semibold">Units</th><th className="px-4 py-3 text-right font-semibold">Spend</th><th className="px-4 py-3 text-right font-semibold">Status</th></tr></thead><tbody>{data.subhubSummary.map((row) => <tr key={row.subhubName} className="border-b border-border/70 last:border-0"><td className="px-4 py-4 font-semibold">{row.subhubName}</td><td className="tabular px-4 py-4 text-right">{row.orders}</td><td className="tabular px-4 py-4 text-right">{num(row.quantity)}</td><td className="tabular px-4 py-4 text-right">{inr(row.spend)}</td><td className="px-4 py-4 text-right text-base text-muted-foreground">{row.pendingOrders} pending · {row.completedOrders} complete</td></tr>)}</tbody></table></div> : <EmptyState icon={<Users className="size-7" />} title="No SubHub orders yet" description="Orders created for SubHubs will be summarized here." />}
    </section>
    <section>
      <SectionHeading title="Vendor performance" description="Order volume, spend and completed-delivery reliability." />
      {data.vendorPerformance.length ? <ul className="divide-y divide-border border-b border-border">{data.vendorPerformance.map((vendor) => <li key={vendor.vendorId} className="flex items-center gap-4 py-4 text-base"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{vendor.vendorName}</p><p className="mt-1 text-base text-muted-foreground">{vendor.orders} orders · {inr(vendor.spend)} spend</p></div><div className="text-right">{vendor.onTimeRate === null ? <span className="text-base text-muted-foreground">No deliveries</span> : <Tag size="md" tone={vendor.onTimeRate >= 85 ? "good" : "warn"}>{vendor.onTimeRate}% on time</Tag>}<p className="mt-1 text-sm text-muted-foreground">{vendor.pendingOrders} pending</p></div></li>)}</ul> : <EmptyState icon={<Truck className="size-7" />} title="No performance data yet" description="Vendor metrics appear once orders are created." />}
    </section>
  </div>;
}

function VendorForm({ mode, vendor, panel, onClose, onSaved }: { mode: "create" | "edit"; vendor: ProcurementVendor | null; panel: "admin" | "procurement"; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState(() => ({ name: vendor?.name ?? "", contactName: vendor?.contactName ?? "", phone: vendor?.phone ?? "", email: vendor?.email ?? "", address: vendor?.address ?? "", city: vendor?.city ?? "", state: vendor?.state ?? "", pincode: vendor?.pincode ?? "", paymentTerms: vendor?.paymentTerms ?? "30 days credit", categories: vendor?.categories.join(", ") ?? "", notes: vendor?.notes ?? "" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = { ...form, categories: form.categories.split(",").map((value) => value.trim()).filter(Boolean) };
    const response = mode === "edit" && vendor ? await updateVendorFn({ data: { ...data, id: vendor.id, panel } }) : await createVendorFn({ data: { ...data, panel } });
    if (!response.ok) setError(response.message);
    else await onSaved(`${form.name} ${mode === "edit" ? "was updated" : "was added"} successfully.`);
    setBusy(false);
  }
  return <Drawer title={mode === "edit" ? "Edit vendor" : "Add vendor"} subtitle="Vendor information is shared with authorized procurement users." onClose={onClose}><form onSubmit={submit} className="space-y-4"><TextField label="Vendor name" value={form.name} required onChange={(value) => setForm({ ...form, name: value })} placeholder="Sanjay Brass Works" /><div className="grid gap-4 sm:grid-cols-2"><TextField label="Contact person" value={form.contactName} onChange={(value) => setForm({ ...form, contactName: value })} /><TextField label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><TextField label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><TextField label="Payment terms" value={form.paymentTerms} onChange={(value) => setForm({ ...form, paymentTerms: value })} /><TextField label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} /><TextField label="State" value={form.state} onChange={(value) => setForm({ ...form, state: value })} /><TextField label="Pincode" value={form.pincode} onChange={(value) => setForm({ ...form, pincode: value })} /></div><TextField label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /><TextField label="Categories" value={form.categories} onChange={(value) => setForm({ ...form, categories: value })} placeholder="Brass, fasteners, molded parts" /><label className="block text-sm font-medium">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>{error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}<DrawerActions busy={busy} submitLabel={mode === "edit" ? "Save changes" : "Create vendor"} onClose={onClose} /></form></Drawer>;
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
  const [unitPrice, setUnitPrice] = useState("");
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
    const parsedPrice = unitPrice.trim() === "" ? undefined : Number(unitPrice);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) || (parsedPrice === undefined && !isOneOffMaterial)) {
      setError(isOneOffMaterial ? "Enter a whole-number quantity and a valid unit price, or leave the one-off price blank." : "Enter a whole-number quantity and a valid non-negative unit price.");
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
    const response = await createProcurementOrderFn({ data: { panel, vendorId: addingVendor ? undefined : vendorId || undefined, newVendor: addingVendor ? { name: newVendorName, phone: newVendorPhone, email: newVendorEmail } : isMiscellaneousVendor && miscellaneousVendorName.trim() ? { name: miscellaneousVendorName, categories: ["Miscellaneous"] } : undefined, subhubUserId: isAdmin ? subhubUserId : undefined, materialCode, materialName: isOneOffMaterial ? customMaterialName : selectedMaterial?.name, quantity: parsedQuantity, ...(parsedPrice === undefined ? {} : { unitPrice: parsedPrice }), orderDate, expectedDelivery, notes } });
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
          <TextField label={`Unit price (₹)${isOneOffMaterial ? " (optional)" : ""}`} type="number" required={!isOneOffMaterial} value={unitPrice} onChange={setUnitPrice} placeholder={isOneOffMaterial ? "Optional" : "125"} />
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