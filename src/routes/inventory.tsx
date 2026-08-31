import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ArrowDownCircle, ArrowUpCircle, Check, ChevronRight, Clock3, Package, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { num } from "@/lib/erp-data";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { SubHubShell } from "@/components/erp/SubHubShell";

export type View = "inventory" | "history" | "adjustment";
type InventoryRow = { name: string; category: string; unit: string; quantity: number; batches: number; expiry: string; price: number; status: "Available" | "Low stock" | "Out of stock" };

const products: InventoryRow[] = [
  { name: "Washer", category: "Purchased", unit: "pcs", quantity: 4200, batches: 3, expiry: "—", price: 210, status: "Available" },
  { name: "Pivot Pin", category: "Purchased", unit: "pcs", quantity: 1800, batches: 2, expiry: "—", price: 260, status: "Available" },
  { name: "Screw M3x8", category: "Purchased", unit: "pcs", quantity: 620, batches: 1, expiry: "—", price: 95, status: "Low stock" },
  { name: "Ball Float Body", category: "Molded", unit: "pcs", quantity: 0, batches: 0, expiry: "—", price: 128, status: "Out of stock" },
  { name: "Seal Gasket", category: "Purchased", unit: "pcs", quantity: 2480, batches: 2, expiry: "—", price: 340, status: "Available" },
  { name: "Valve Seat Insert", category: "Purchased", unit: "pcs", quantity: 940, batches: 2, expiry: "—", price: 640, status: "Low stock" },
  { name: "Retainer Clip", category: "Molded", unit: "pcs", quantity: 3100, batches: 2, expiry: "—", price: 118, status: "Available" },
  { name: "Label Sticker", category: "Purchased", unit: "pcs", quantity: 7600, batches: 4, expiry: "—", price: 70, status: "Available" },
];

const movements = [
  { date: "23 Aug 2026, 11:42 AM", type: "Order deduction", product: "Washer", hub: "F8", reference: "#FT-10842", change: -120, balance: 4200 },
  { date: "23 Aug 2026, 10:18 AM", type: "Stock adjustment", product: "Seal Gasket", hub: "F9", reference: "ADJ-1042", change: 280, balance: 2480 },
  { date: "22 Aug 2026, 7:30 PM", type: "Order restored", product: "Pivot Pin", hub: "Fp", reference: "#FT-10821", change: 80, balance: 1800 },
  { date: "22 Aug 2026, 5:10 PM", type: "Order deduction", product: "Retainer Clip", hub: "F8", reference: "#FT-10805", change: -200, balance: 3100 },
];

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory Management — Float ERP" }] }),
  component: () => <InventoryManagement initialView="inventory" />,
});

export function InventoryManagement({ initialView }: { initialView: View }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const view: View = pathname.endsWith("/history") ? "history" : pathname.endsWith("/adjustment") ? "adjustment" : initialView;
  const [query, setQuery] = useState("");

  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.category} ${product.status}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0);
  const stockValue = products.reduce((sum, product) => sum + product.quantity * product.price, 0);
  const lowStock = products.filter((product) => product.status !== "Available").length;
  const title = view === "inventory" ? "Inventory" : view === "history" ? "Inventory History" : "Stock Adjustment";

  return (
    <SubHubShell actions={view === "inventory" ? <Link to="/inventory/adjustment" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><SlidersHorizontal className="size-4" /> Adjust stock</Link> : null}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-6 py-4"><div><p className="mb-1 text-xs font-semibold text-muted-foreground">SubHub / Inventory Management</p><h1 className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{view === "inventory" ? "Track current stock, batches, expiry dates, and inventory value." : view === "history" ? "Review every stock movement across products and batches." : "Add stock, remove stock, and record a clear reason for every adjustment."}</p></div></header>
      {view === "inventory" ? <InventoryTable products={filteredProducts} query={query} setQuery={setQuery} /> : null}
      {view === "history" ? <HistoryTable /> : null}
      {view === "adjustment" ? <Adjustment onSaved={() => {}} /> : null}
    </SubHubShell>
  );
}

export function InventoryHistoryPage() {
  return <InventoryManagement initialView="history" />;
}

export function InventoryAdjustmentPage() {
  return <InventoryManagement initialView="adjustment" />;
}

function Overview({ totalUnits, stockValue, lowStock, setView }: { totalUnits: number; stockValue: number; lowStock: number; setView: (view: View) => void }) {
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Total stock units" value={num(totalUnits)} hint="across active hubs" /><Kpi label="Inventory value" value={`₹${stockValue.toLocaleString("en-IN")}`} hint="current stock value" /><Kpi label="Products tracked" value={String(products.length)} hint="raw material products" /><Kpi label="Attention needed" value={String(lowStock)} tone={lowStock ? "warn" : "good"} hint="low or out of stock" /></div><div className="grid gap-6 xl:grid-cols-3"><Panel title="Stock health" description="Current inventory status across the selected hub" className="xl:col-span-2"><div className="grid gap-3 p-5 sm:grid-cols-3"><div className="rounded-lg bg-success/10 p-4"><p className="text-xs text-muted-foreground">Available</p><p className="mt-2 text-2xl font-semibold text-success">{products.filter((p) => p.status === "Available").length}</p><p className="text-xs text-muted-foreground">products in healthy stock</p></div><div className="rounded-lg bg-warning/10 p-4"><p className="text-xs text-muted-foreground">Low stock</p><p className="mt-2 text-2xl font-semibold text-warning">{products.filter((p) => p.status === "Low stock").length}</p><p className="text-xs text-muted-foreground">replenishment needed</p></div><div className="rounded-lg bg-destructive/10 p-4"><p className="text-xs text-muted-foreground">Out of stock</p><p className="mt-2 text-2xl font-semibold text-destructive">{products.filter((p) => p.status === "Out of stock").length}</p><p className="text-xs text-muted-foreground">currently unavailable</p></div></div><div className="border-t border-border p-5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Stock coverage</span><span>78%</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 w-[78%] rounded-full bg-success" /></div></div></Panel><Panel title="Quick actions" description="Common Hub Manager tasks"><div className="space-y-2 p-4"><button type="button" onClick={() => setView("inventory")} className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-muted"><Package className="size-4 text-primary" /><span><strong className="block text-sm">View inventory</strong><small className="text-xs text-muted-foreground">Browse products, batches, and stock</small></span><ChevronRight className="ml-auto size-4 text-muted-foreground" /></button><button type="button" onClick={() => setView("history")} className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-muted"><Clock3 className="size-4 text-primary" /><span><strong className="block text-sm">Review history</strong><small className="text-xs text-muted-foreground">See every stock movement</small></span><ChevronRight className="ml-auto size-4 text-muted-foreground" /></button><button type="button" onClick={() => setView("adjustment")} className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-muted"><SlidersHorizontal className="size-4 text-primary" /><span><strong className="block text-sm">Adjust stock</strong><small className="text-xs text-muted-foreground">Add or remove stock with a reason</small></span><ChevronRight className="ml-auto size-4 text-muted-foreground" /></button></div></Panel></div></>;
}

function InventoryTable({ products, query, setQuery }: { products: InventoryRow[]; query: string; setQuery: (value: string) => void }) {
  return <Panel title="Inventory" description="Track current stock, batches, expiry dates, and inventory value" action={<button type="button" className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs"><RefreshCw className="size-3.5" /> Refresh</button>}><div className="border-b border-border p-4"><label className="relative block max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm outline-none focus:border-primary" /></label></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Product</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 text-right font-medium">Quantity</th><th className="px-5 py-3 text-right font-medium">Batches</th><th className="px-5 py-3 text-right font-medium">Unit value</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.name} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="px-5 py-3 font-medium">{product.name}<span className="ml-2 text-xs text-muted-foreground">{product.unit}</span></td><td className="px-5 py-3 text-muted-foreground">{product.category}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(product.quantity)}</td><td className="tabular px-5 py-3 text-right">{product.batches}</td><td className="tabular px-5 py-3 text-right">₹{product.price}</td><td className="px-5 py-3"><Tag tone={product.status === "Available" ? "good" : product.status === "Low stock" ? "warn" : "bad"}>{product.status}</Tag></td></tr>)}</tbody></table></div></Panel>;
}

function HistoryTable() {
  return <Panel title="Inventory History" description="Review every stock movement across products and hubs" action={<button type="button" className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs"><RefreshCw className="size-3.5" /> Refresh</button>}><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Movement</th><th className="px-5 py-3 font-medium">Product</th><th className="px-5 py-3 font-medium">Hub</th><th className="px-5 py-3 font-medium">Reference</th><th className="px-5 py-3 text-right font-medium">Change</th><th className="px-5 py-3 text-right font-medium">Balance</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.reference} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{movement.date}</td><td className="px-5 py-3">{movement.change > 0 ? <ArrowUpCircle className="mr-2 inline size-4 text-success" /> : <ArrowDownCircle className="mr-2 inline size-4 text-destructive" />}{movement.type}</td><td className="px-5 py-3 font-medium">{movement.product}</td><td className="px-5 py-3">{movement.hub}</td><td className="tabular px-5 py-3 text-muted-foreground">{movement.reference}</td><td className={`tabular px-5 py-3 text-right font-semibold ${movement.change > 0 ? "text-success" : "text-destructive"}`}>{movement.change > 0 ? "+" : ""}{movement.change}</td><td className="tabular px-5 py-3 text-right">{num(movement.balance)}</td></tr>)}</tbody></table></div></Panel>;
}

function Adjustment({ onSaved }: { onSaved?: (() => void) | undefined }) {
  return <Panel title="Stock adjustment" description="Add stock, remove stock, and record a clear reason for every adjustment"><AdjustmentForm {...(onSaved ? { onSaved } : {})} /></Panel>;
}

function AdjustmentForm({ onSaved }: { onSaved?: (() => void) | undefined }) {
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  return <div className="p-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Product<select value={product} onChange={(event) => setProduct(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Select product</option>{products.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label className="text-sm font-medium">Action<select className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option>Add stock</option><option>Remove stock</option></select></label><label className="text-sm font-medium">Quantity<input required type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input px-3 text-sm" /></label><label className="text-sm font-medium">Reason<input defaultValue="New stock received" className="mt-1.5 h-10 w-full rounded-md border border-input px-3 text-sm" /></label><label className="text-sm font-medium md:col-span-2">Notes<textarea rows={3} placeholder="Write notes here..." className="mt-1.5 w-full resize-none rounded-md border border-input px-3 py-2 text-sm" /></label></div><div className="mt-5 flex justify-end border-t border-border pt-4"><button type="button" disabled={!product || !quantity} onClick={onSaved} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Check className="size-4" /> Save adjustment</button></div></div>;
}

function AdjustmentDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/20"><div className="flex h-full w-full max-w-md flex-col bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Adjust stock</h2><p className="mt-1 text-sm text-muted-foreground">Record a Hub Manager inventory adjustment.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-muted"><X className="size-5" /></button></div><div className="mt-6 flex-1"><AdjustmentForm onSaved={onSaved} /></div></div></div>;
}