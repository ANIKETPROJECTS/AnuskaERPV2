import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  Check,
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
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import {
  createProcurementOrderFn,
  createVendorFn,
  deleteOrArchiveVendorFn,
  getProcurementDataFn,
  updateProcurementOrderStatusFn,
  updateVendorFn,
} from "@/procurement";
import type { ProcurementData, ProcurementOrder, ProcurementStatus, ProcurementVendor } from "@/procurement.server";
import { PROCUREMENT_STATUSES } from "@/lib/procurement-types";
import { subparts } from "@/lib/erp-data";

export const Route = createFileRoute("/procurement")({
  loader: () => getProcurementDataFn(),
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

type Tab = "orders" | "vendors";
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

function nextStatus(status: ProcurementStatus): ProcurementStatus | null {
  const index = PROCUREMENT_STATUSES.indexOf(status);
  return PROCUREMENT_STATUSES[index + 1] ?? null;
}

function Procurement() {
  const auth = useAuth();
  const result = Route.useLoaderData();
  const isAdmin = auth.user?.panel === "admin";
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
    const response = await getProcurementDataFn();
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
        const searchable = [order.orderNumber, order.vendorName, order.materialName, order.materialCode, order.subhubName, order.notes].join(" ").toLowerCase();
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
        if (sortBy === "orderDate-asc") return a.orderDate.localeCompare(b.orderDate);
        if (sortBy === "delivery-asc") return a.expectedDelivery.localeCompare(b.expectedDelivery);
        if (sortBy === "amount-desc") return b.totalAmount - a.totalAmount;
        if (sortBy === "quantity-desc") return b.quantity - a.quantity;
        if (sortBy === "vendor-asc") return a.vendorName.localeCompare(b.vendorName);
        return b.orderDate.localeCompare(a.orderDate);
      });
  }, [data.orders, fromDate, orderDate, query, sortBy, statusFilter, subhubFilter, toDate, vendorFilter]);

  const visibleVendors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.vendors.filter((vendor) => !normalized || [vendor.name, vendor.contactName, vendor.phone, vendor.email, vendor.city, vendor.state, vendor.categories.join(" ")].join(" ").toLowerCase().includes(normalized));
  }, [data.vendors, query]);

  const selectedVendor = data.vendors.find((vendor) => vendor.id === selectedVendorId);
  const selectedVendorOrders = selectedVendorId ? data.orders.filter((order) => order.vendorId === selectedVendorId) : [];
  const hasFilters = Boolean(query || vendorFilter !== "all" || subhubFilter !== "all" || statusFilter !== "all" || sortBy !== "orderDate-desc" || orderDate || fromDate || toDate);

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

  async function advanceOrder(order: ProcurementOrder) {
    const status = nextStatus(order.status);
    if (!status) return;
    setNotice("");
    const response = await updateProcurementOrderStatusFn({ data: { id: order.id, status } });
    if (!response.ok) setError(response.message);
    else {
      setNotice(`${order.orderNumber} moved to ${status}.`);
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
    const response = await deleteOrArchiveVendorFn({ data: { id: vendor.id } });
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

  const content = (
    <div className="space-y-6">
      {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{notice}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Active vendors" value={num(data.summary.vendorCount)} hint={isAdmin ? `${data.vendors.length} total records` : "shared vendor directory"} />
        <Kpi label="Open orders" value={num(data.summary.openOrders)} tone="warn" hint={`${num(data.summary.unitsOnOrder)} units in progress`} />
        <Kpi label="Committed spend" value={inr(data.summary.committedSpend)} hint="open procurement orders" />
        <Kpi label="On-time delivery" value={data.summary.onTimeRate === null ? "—" : `${data.summary.onTimeRate}%`} tone={data.summary.onTimeRate === null ? "neutral" : data.summary.onTimeRate >= 85 ? "good" : "warn"} hint={`${data.summary.completedOrders} completed orders`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border bg-card p-1" role="tablist" aria-label="Procurement sections">
          <button type="button" role="tab" aria-selected={tab === "orders"} onClick={() => setTab("orders")} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${tab === "orders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <ClipboardList className="size-4" /> Order Management
          </button>
          <button type="button" role="tab" aria-selected={tab === "vendors"} onClick={() => setTab("vendors")} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${tab === "vendors" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <Store className="size-4" /> Vendor Management
          </button>
        </div>
        <div className="flex gap-2">
          {isAdmin ? <button type="button" onClick={openCreateVendor} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted"><Plus className="size-4" /> Add vendor</button> : null}
          <button type="button" onClick={() => setShowOrderForm(true)} className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"><PackagePlus className="size-4" /> New procurement order</button>
          <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </div>

      {tab === "orders" ? (
        <>
          <OrderFilters
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
          <Panel title="Procurement orders" description={`${filteredOrders.length} of ${data.orders.length} orders · every row is stored in MongoDB`}>
            {loading ? <Loading /> : <OrderTable orders={filteredOrders} isAdmin={isAdmin} onAdvance={(order) => void advanceOrder(order)} />}
          </Panel>
          {isAdmin ? <AdminReports data={data} /> : null}
        </>
      ) : (
        <>
          <Panel title="Vendor directory" description={isAdmin ? "Create, edit, archive, and review every procurement vendor." : "Active vendors are shared across the procurement directory. Vendor changes are managed by the Master Admin."}>
            <VendorTable vendors={visibleVendors} data={data} isAdmin={isAdmin} onSelect={setSelectedVendorId} selectedVendorId={selectedVendorId} onEdit={openEditVendor} onRemove={(vendor) => void removeVendor(vendor)} />
          </Panel>
          {selectedVendor ? <VendorDetail vendor={selectedVendor} orders={selectedVendorOrders} onClose={() => setSelectedVendorId("")} /> : null}
        </>
      )}

      {showOrderForm ? <OrderForm data={data} isAdmin={isAdmin} onClose={() => setShowOrderForm(false)} onSaved={async (message) => { setShowOrderForm(false); setNotice(message); await reload(); }} /> : null}
      {vendorFormMode ? <VendorForm mode={vendorFormMode} vendor={editingVendor} onClose={() => setVendorFormMode(null)} onSaved={async (message) => { setVendorFormMode(null); setNotice(message); await reload(); }} /> : null}
    </div>
  );

  return isAdmin ? (
    <Shell title="Procurement" subtitle="Live vendor management, purchase orders, and SubHub-wide delivery reporting">{content}</Shell>
  ) : (
    <SubHubShell title="Procurement" subtitle={`Manage ${auth.user?.subhubName ?? "this SubHub"} vendors and procurement orders`}>{content}</SubHubShell>
  );
}

function OrderFilters({
  query, setQuery, vendorFilter, setVendorFilter, subhubFilter, setSubhubFilter, statusFilter, setStatusFilter, sortBy, setSortBy,
  orderDate, setOrderDate, fromDate, setFromDate, toDate, setToDate, vendors, subhubs, hasFilters, clearFilters,
}: {
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
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5"><Filter className="size-4 text-primary" /><div><h2 className="text-sm font-semibold">Search and filter orders</h2><p className="text-xs text-muted-foreground">Use an exact date or a date range; filters can be combined.</p></div></div>
      <div className="filter-toolbar overflow-x-auto border-b border-border bg-muted/10 px-5 py-4">
        <label className="min-w-[230px] flex-1 text-xs font-medium">Search<span className="relative mt-1.5 block"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PO, vendor, material, SubHub…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm font-normal outline-none focus:border-primary" /></span></label>
        <SelectFilter label="Vendor" value={vendorFilter} onChange={setVendorFilter}><option value="all">All vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</SelectFilter>
        {subhubs.length ? <SelectFilter label="SubHub" value={subhubFilter} onChange={setSubhubFilter}><option value="all">All SubHubs</option>{subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.name}</option>)}</SelectFilter> : null}
        <SelectFilter label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as ProcurementStatus | "all")}><option value="all">All statuses</option>{PROCUREMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</SelectFilter>
        <SelectFilter label="Sort" value={sortBy} onChange={(value) => setSortBy(value as SortKey)}><option value="orderDate-desc">Newest order date</option><option value="orderDate-asc">Oldest order date</option><option value="delivery-asc">Expected delivery</option><option value="amount-desc">Highest amount</option><option value="quantity-desc">Highest quantity</option><option value="vendor-asc">Vendor A–Z</option></SelectFilter>
        <DateFilter label="Exact order date" value={orderDate} onChange={setOrderDate} />
        <DateFilter label="From" value={fromDate} onChange={setFromDate} />
        <DateFilter label="To" value={toDate} onChange={setToDate} />
        {hasFilters ? <button type="button" onClick={clearFilters} className="mt-[21px] h-9 shrink-0 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted">Clear</button> : null}
      </div>
    </div>
  );
}

function SelectFilter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="shrink-0 text-xs font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-9 min-w-32 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary">{children}</select></label>;
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="shrink-0 text-xs font-medium">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary" /></label>;
}

function OrderTable({ orders, isAdmin, onAdvance }: { orders: ProcurementOrder[]; isAdmin: boolean; onAdvance: (order: ProcurementOrder) => void }) {
  return orders.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-sm">
        <thead className="border-b border-border bg-muted/15 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Order</th>{isAdmin ? <th className="px-5 py-3 font-medium">SubHub</th> : null}<th className="px-5 py-3 font-medium">Vendor</th><th className="px-5 py-3 font-medium">Material</th><th className="px-5 py-3 text-right font-medium">Qty</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3 font-medium">Ordered</th><th className="px-5 py-3 font-medium">Expected</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Action</th></tr></thead>
        <tbody>{orders.map((order) => { const next = nextStatus(order.status); return <tr key={order.id} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="px-5 py-3"><Link to="/po/$id" params={{ id: order.id }} className="font-semibold text-primary hover:underline">{order.orderNumber}</Link><p className="mt-1 text-[11px] text-muted-foreground">{order.notes || "No notes"}</p></td>{isAdmin ? <td className="px-5 py-3 text-xs">{order.subhubName}</td> : null}<td className="px-5 py-3 font-medium">{order.vendorName}</td><td className="px-5 py-3"><span className="font-medium">{order.materialName}</span><span className="tabular ml-2 text-xs text-muted-foreground">{order.materialCode}</span></td><td className="tabular px-5 py-3 text-right">{num(order.quantity)}</td><td className="tabular px-5 py-3 text-right">{inr(order.totalAmount)}</td><td className="tabular whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDate(order.orderDate)}</td><td className="tabular whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDate(order.expectedDelivery)}</td><td className="px-5 py-3"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td><td className="px-5 py-3 text-right">{next ? <button type="button" onClick={() => onAdvance(order)} className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10" title={`Move to ${next}`}><ArrowRight className="size-3.5" /> Advance</button> : <span className="text-xs text-muted-foreground">Complete</span>}</td></tr>; })}</tbody>
      </table>
    </div>
  ) : <EmptyState icon={<ShoppingCart className="size-7" />} title="No procurement orders found" description="Create an order or change the current search and filters." />;
}

function VendorTable({ vendors, data, isAdmin, onSelect, selectedVendorId, onEdit, onRemove }: { vendors: ProcurementVendor[]; data: ProcurementData; isAdmin: boolean; onSelect: (id: string) => void; selectedVendorId: string; onEdit: (vendor: ProcurementVendor) => void; onRemove: (vendor: ProcurementVendor) => void }) {
  const performanceByVendor = new Map(data.vendorPerformance.map((item) => [item.vendorId, item]));
  return vendors.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="border-b border-border bg-muted/15 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Vendor</th><th className="px-5 py-3 font-medium">Contact</th><th className="px-5 py-3 font-medium">Categories</th><th className="px-5 py-3 text-right font-medium">Orders</th><th className="px-5 py-3 text-right font-medium">Spend</th><th className="px-5 py-3 text-right font-medium">Performance</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead><tbody>{vendors.map((vendor) => { const performance = performanceByVendor.get(vendor.id); return <tr key={vendor.id} className={`border-b border-border/70 last:border-0 hover:bg-muted/40 ${selectedVendorId === vendor.id ? "bg-primary/5" : ""}`}><td className="px-5 py-4"><button type="button" onClick={() => onSelect(selectedVendorId === vendor.id ? "" : vendor.id)} className="text-left font-semibold hover:text-primary">{vendor.name}</button><div className="mt-1 flex items-center gap-2"><Tag tone={vendor.status === "active" ? "good" : "neutral"}>{vendor.status}</Tag>{vendor.paymentTerms ? <span className="text-xs text-muted-foreground">{vendor.paymentTerms}</span> : null}</div></td><td className="px-5 py-4 text-xs text-muted-foreground">{vendor.contactName || "—"}<br />{vendor.phone || vendor.email || "No contact saved"}</td><td className="max-w-48 px-5 py-4 text-xs text-muted-foreground">{vendor.categories.length ? vendor.categories.join(" · ") : "General materials"}</td><td className="tabular px-5 py-4 text-right font-medium">{performance?.orders ?? 0}<p className="text-[11px] font-normal text-muted-foreground">{performance?.pendingOrders ?? 0} pending</p></td><td className="tabular px-5 py-4 text-right">{inr(performance?.spend ?? 0)}</td><td className="px-5 py-4 text-right">{performance?.onTimeRate === null || performance?.onTimeRate === undefined ? <span className="text-xs text-muted-foreground">No deliveries yet</span> : <Tag tone={performance.onTimeRate >= 85 ? "good" : "warn"}>{performance.onTimeRate}% on time</Tag>}</td><td className="px-5 py-4 text-right">{isAdmin ? <div className="inline-flex gap-1"><button type="button" onClick={() => onEdit(vendor)} className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted"><Edit3 className="size-3.5" /> Edit</button><button type="button" onClick={() => onRemove(vendor)} className="inline-flex items-center gap-1 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"><Archive className="size-3.5" /> Archive</button></div> : <button type="button" onClick={() => onSelect(vendor.id)} className="text-xs font-medium text-primary hover:underline">View history</button>}</td></tr>; })}</tbody></table></div> : <EmptyState icon={<Store className="size-7" />} title="No vendors found" description={isAdmin ? "Add the first vendor to start placing procurement orders." : "The Master Admin has not added any active vendors yet."} />;
}

function VendorDetail({ vendor, orders, onClose }: { vendor: ProcurementVendor; orders: ProcurementOrder[]; onClose: () => void }) {
  return <Panel title={`${vendor.name} · purchase history`} description={`${orders.length} orders · ${vendor.paymentTerms || "Payment terms not specified"}`} action={<button type="button" onClick={onClose} aria-label="Close vendor history" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>}>{orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 font-medium">Material</th><th className="px-5 py-3 text-right font-medium">Qty</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-3"><Link to="/po/$id" params={{ id: order.id }} className="font-medium text-primary hover:underline">{order.orderNumber}</Link><p className="text-xs text-muted-foreground">{formatDate(order.orderDate)}</p></td><td className="px-5 py-3 text-xs">{order.subhubName}</td><td className="px-5 py-3">{order.materialName}</td><td className="tabular px-5 py-3 text-right">{num(order.quantity)}</td><td className="tabular px-5 py-3 text-right">{inr(order.totalAmount)}</td><td className="px-5 py-3"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td></tr>)}</tbody></table></div> : <EmptyState icon={<History className="size-7" />} title="No purchase history" description="Orders placed with this vendor will appear here." />}</Panel>;
}

function AdminReports({ data }: { data: ProcurementData }) {
  return <div className="grid gap-6 lg:grid-cols-2"><Panel title="SubHub procurement report" description="Spend, quantities, and order status across every active SubHub.">{data.subhubSummary.length ? <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 text-right font-medium">Orders</th><th className="px-5 py-3 text-right font-medium">Units</th><th className="px-5 py-3 text-right font-medium">Spend</th><th className="px-5 py-3 text-right font-medium">Status</th></tr></thead><tbody>{data.subhubSummary.map((row) => <tr key={row.subhubName} className="border-b border-border/70 last:border-0"><td className="px-5 py-3 font-medium">{row.subhubName}</td><td className="tabular px-5 py-3 text-right">{row.orders}</td><td className="tabular px-5 py-3 text-right">{num(row.quantity)}</td><td className="tabular px-5 py-3 text-right">{inr(row.spend)}</td><td className="px-5 py-3 text-right text-xs text-muted-foreground">{row.pendingOrders} pending · {row.completedOrders} complete</td></tr>)}</tbody></table></div> : <EmptyState icon={<Users className="size-7" />} title="No SubHub orders yet" description="Orders created for SubHubs will be summarized here." />}</Panel><Panel title="Vendor performance" description="Order volume, spend and completed-delivery reliability.">{data.vendorPerformance.length ? <ul className="divide-y divide-border">{data.vendorPerformance.map((vendor) => <li key={vendor.vendorId} className="flex items-center gap-4 px-5 py-3.5 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium">{vendor.vendorName}</p><p className="mt-1 text-xs text-muted-foreground">{vendor.orders} orders · {inr(vendor.spend)} spend</p></div><div className="text-right">{vendor.onTimeRate === null ? <span className="text-xs text-muted-foreground">No deliveries</span> : <Tag tone={vendor.onTimeRate >= 85 ? "good" : "warn"}>{vendor.onTimeRate}% on time</Tag>}<p className="mt-1 text-xs text-muted-foreground">{vendor.pendingOrders} pending</p></div></li>)}</ul> : <EmptyState icon={<Truck className="size-7" />} title="No performance data yet" description="Vendor metrics appear once orders are created." />}</Panel></div>;
}

function VendorForm({ mode, vendor, onClose, onSaved }: { mode: "create" | "edit"; vendor: ProcurementVendor | null; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState(() => ({ name: vendor?.name ?? "", contactName: vendor?.contactName ?? "", phone: vendor?.phone ?? "", email: vendor?.email ?? "", address: vendor?.address ?? "", city: vendor?.city ?? "", state: vendor?.state ?? "", pincode: vendor?.pincode ?? "", paymentTerms: vendor?.paymentTerms ?? "30 days credit", categories: vendor?.categories.join(", ") ?? "", notes: vendor?.notes ?? "" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = { ...form, categories: form.categories.split(",").map((value) => value.trim()).filter(Boolean) };
    const response = mode === "edit" && vendor ? await updateVendorFn({ data: { ...data, id: vendor.id } }) : await createVendorFn({ data });
    if (!response.ok) setError(response.message);
    else await onSaved(`${form.name} ${mode === "edit" ? "was updated" : "was added"} successfully.`);
    setBusy(false);
  }
  return <Drawer title={mode === "edit" ? "Edit vendor" : "Add vendor"} subtitle="Vendor information is shared with authorized procurement users." onClose={onClose}><form onSubmit={submit} className="space-y-4"><TextField label="Vendor name" value={form.name} required onChange={(value) => setForm({ ...form, name: value })} placeholder="Sanjay Brass Works" /><div className="grid gap-4 sm:grid-cols-2"><TextField label="Contact person" value={form.contactName} onChange={(value) => setForm({ ...form, contactName: value })} /><TextField label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><TextField label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><TextField label="Payment terms" value={form.paymentTerms} onChange={(value) => setForm({ ...form, paymentTerms: value })} /><TextField label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} /><TextField label="State" value={form.state} onChange={(value) => setForm({ ...form, state: value })} /><TextField label="Pincode" value={form.pincode} onChange={(value) => setForm({ ...form, pincode: value })} /></div><TextField label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /><TextField label="Categories" value={form.categories} onChange={(value) => setForm({ ...form, categories: value })} placeholder="Brass, fasteners, molded parts" /><label className="block text-sm font-medium">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>{error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}<DrawerActions busy={busy} submitLabel={mode === "edit" ? "Save changes" : "Create vendor"} onClose={onClose} /></form></Drawer>;
}

function OrderForm({ data, isAdmin, onClose, onSaved }: { data: ProcurementData; isAdmin: boolean; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [vendorId, setVendorId] = useState("");
  const [addingVendor, setAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");
  const [subhubUserId, setSubhubUserId] = useState("");
  const [materialCode, setMaterialCode] = useState(subparts[0]?.code ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDelivery, setExpectedDelivery] = useState(dateAfter(7));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsedQuantity = Number(quantity);
    const parsedPrice = Number(unitPrice);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Enter a whole-number quantity and a valid non-negative unit price.");
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
    setBusy(true);
    const response = await createProcurementOrderFn({ data: { vendorId: addingVendor ? undefined : vendorId || undefined, newVendor: addingVendor ? { name: newVendorName, phone: newVendorPhone, email: newVendorEmail } : undefined, subhubUserId: isAdmin ? subhubUserId : undefined, materialCode, quantity: parsedQuantity, unitPrice: parsedPrice, orderDate, expectedDelivery, notes } });
    if (!response.ok) setError(response.message);
    else await onSaved(`${response.order.orderNumber} was created successfully.`);
    setBusy(false);
  }
  return <Drawer title="New procurement order" subtitle={isAdmin ? "Create an order for a selected SubHub and vendor." : "Create an order for this SubHub. You can add a new vendor without leaving the form."} onClose={onClose}><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">{isAdmin ? "Destination SubHub" : "Destination"}{isAdmin ? <select required value={subhubUserId} onChange={(event) => setSubhubUserId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select SubHub</option>{data.subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.name}</option>)}</select> : <div className="mt-1.5 rounded-md border border-border bg-muted/20 px-3 py-2.5 text-sm">{data.orders[0]?.subhubName ?? "This SubHub workspace"}</div>}</label><div><div className="flex items-center justify-between gap-3"><label className="text-sm font-medium">{addingVendor ? "New vendor" : "Vendor"}</label><button type="button" onClick={() => { setAddingVendor(!addingVendor); setVendorId(""); }} className="text-xs font-medium text-primary hover:underline">{addingVendor ? "Choose existing vendor" : "＋ Add new vendor"}</button></div>{addingVendor ? <div className="mt-1.5 grid gap-3 sm:grid-cols-2"><TextField label="Vendor name" value={newVendorName} required onChange={setNewVendorName} placeholder="New vendor name" /><TextField label="Phone" value={newVendorPhone} onChange={setNewVendorPhone} /><TextField label="Email" type="email" value={newVendorEmail} onChange={setNewVendorEmail} /></div> : <select required value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select active vendor</option>{data.vendors.filter((vendor) => vendor.status === "active").map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.categories.length ? ` · ${vendor.categories.join(", ")}` : ""}</option>)}</select>}</div><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Raw material<select required value={materialCode} onChange={(event) => setMaterialCode(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{subparts.map((part) => <option key={part.code} value={part.code}>{part.name} · {part.code}</option>)}</select></label><TextField label="Quantity" type="number" required value={quantity} onChange={setQuantity} placeholder="1000" /><TextField label="Unit price (₹)" type="number" required value={unitPrice} onChange={setUnitPrice} placeholder="125" /><TextField label="Order date" type="date" required value={orderDate} onChange={setOrderDate} /><TextField label="Expected delivery" type="date" required value={expectedDelivery} onChange={setExpectedDelivery} /></div><label className="block text-sm font-medium">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Delivery instructions, quotation reference, or remarks…" className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>{error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}<DrawerActions busy={busy} submitLabel="Create order" onClose={onClose} /></form></Drawer>;
}

function TextField({ label, value, onChange, type = "text", required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="block text-sm font-medium">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>;
}

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-40 flex justify-end bg-black/25" role="dialog" aria-modal="true"><div className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Procurement workspace</p><h2 className="mt-2 text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button></div><div className="mt-7 flex-1">{children}</div></div></div>;
}

function DrawerActions({ busy, submitLabel, onClose }: { busy: boolean; submitLabel: string; onClose: () => void }) {
  return <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5"><button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button><button type="submit" disabled={busy} className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"><Check className="size-4" />{busy ? "Saving…" : submitLabel}</button></div>;
}

function Loading() {
  return <p className="p-10 text-center text-sm text-muted-foreground">Loading live procurement data…</p>;
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="p-10 text-center text-muted-foreground"><div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">{icon}</div><p className="mt-3 font-medium text-foreground">{title}</p><p className="mt-1 text-sm">{description}</p></div>;
}