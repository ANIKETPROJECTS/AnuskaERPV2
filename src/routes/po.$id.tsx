import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Circle, Clock3, Package, Truck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel } from "@/components/erp/bits";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getProcurementOrderFn } from "@/procurement";
import { getAuthStateFn } from "@/auth";
import type { ProcurementStatus } from "@/procurement.server";
import { z } from "zod";

export const Route = createFileRoute("/po/$id")({
  validateSearch: z.object({ panel: z.enum(["admin", "subhub", "procurement"]).optional() }),
  loaderDeps: ({ search }) => ({ panel: search.panel }),
  loader: async ({ params, deps }) => {
    const auth = await getAuthStateFn({ data: deps.panel ? { panel: deps.panel } : {} });
    const panel = deps.panel ?? auth.user?.panel;
    if (!panel) throw notFound();
    const result = await getProcurementOrderFn({ data: { id: params.id, panel } });
    if (!result.ok) throw notFound();
    return { order: result.order };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Purchase unavailable — Gadsons ERP" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.order.orderNumber} — ${loaderData.order.materialName} · Gadsons ERP`;
    return {
      meta: [
        { title },
        { name: "description", content: `Vendor, quantity, spend and delivery timeline for ${loaderData.order.orderNumber}.` },
      ],
    };
  },
  notFoundComponent: PurchaseMissing,
  component: PurchaseDetail,
});

function PurchaseMissing() {
  const { user } = useAuth();
  const content = (
      <Panel title="Nothing here">
        <p className="p-5 text-sm text-muted-foreground">
          Back to <Link to="/procurement" className="text-primary underline">Procurement</Link>.
        </p>
      </Panel>
  );
  return user?.panel === "subhub" ? (
    <SubHubShell title="Purchase not found" subtitle="This order is not available in your procurement workspace">{content}</SubHubShell>
  ) : (
    <Shell title="Purchase not found" subtitle="This order is not available in your procurement workspace">{content}</Shell>
  );
}

function PurchaseDetail() {
  const { order } = Route.useLoaderData();
  const { user } = useAuth();
  const currentIndex = ["Order placed", "Payment done", "Dispatch done", "Delivery done"].indexOf(order.status);
  const content = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Quantity" value={order.quantity.toLocaleString("en-IN")} hint="units ordered" />
        <Kpi label="Order amount" value={`₹${order.totalAmount.toLocaleString("en-IN")}`} hint={`${order.items.length} material line${order.items.length === 1 ? "" : "s"}`} />
        <Kpi label="Status" value={order.status} tone={order.status === "Delivery done" ? "good" : "warn"} />
        <Kpi label="Expected delivery" value={formatDate(order.expectedDelivery)} hint={`ordered ${formatDate(order.orderDate)}`} />
      </div>

      <Panel title="Order status history" description="Every transition is stored with the actor and timestamp.">
        <ol className="divide-y divide-border">
          {(["Order placed", "Payment done", "Dispatch done", "Delivery done"] as ProcurementStatus[]).map((status, index) => {
            const entry = order.statusHistory.find((item) => item.status === status);
            const done = index <= currentIndex;
            return (
              <li key={status} className="flex items-center gap-3 px-5 py-4 text-sm">
                {done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                <span className={done ? "font-medium" : "text-muted-foreground"}>{status}</span>
                {entry ? <span className="ml-auto text-right text-xs text-muted-foreground"><span className="block font-medium text-foreground">{entry.changedByName}</span>{formatTimestamp(entry.changedAt)}</span> : <span className="ml-auto text-xs text-muted-foreground">Pending</span>}
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Procurement details">
          <dl className="divide-y divide-border text-sm">
            <Detail label="Order number" value={order.orderNumber} />
            <Detail label="Vendor" value={order.vendorName} />
            <Detail label="Destination SubHub" value={order.subhubName} />
            <Detail label="Order date" value={formatDate(order.orderDate)} />
            <Detail label="Expected delivery" value={formatDate(order.expectedDelivery)} />
            <Detail label="Created" value={formatTimestamp(order.createdAt)} />
          </dl>
        </Panel>
        <Panel title="Materials in this order" description={`${order.items.length} line${order.items.length === 1 ? "" : "s"} · total quantity ${order.quantity.toLocaleString("en-IN")}`}>
          <div className="divide-y divide-border">
            {order.items.map((item) => <div key={`${item.materialCode}:${item.materialName}`} className="flex items-center gap-4 px-5 py-3 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.materialName}</p><p className="text-xs text-muted-foreground">{item.materialCode}</p></div><div className="text-right"><p className="tabular font-medium">{item.quantity.toLocaleString("en-IN")} units</p><p className="tabular text-xs text-muted-foreground">₹{item.totalAmount.toLocaleString("en-IN")}</p></div></div>)}
          </div>
        </Panel>
        <Panel title="Order notes" description="Receiving instructions and procurement context">
          {order.notes ? <p className="whitespace-pre-wrap p-5 text-sm leading-6 text-muted-foreground">{order.notes}</p> : <div className="p-10 text-center"><Package className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No notes were added to this order.</p></div>}
        </Panel>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground"><Clock3 className="size-4" /> {user?.panel === "subhub" ? "Order details are read-only for SubHub users." : "Status changes are recorded in the procurement audit trail."}<Truck className="ml-auto size-4" /></div>
    </>
  );
  const title = `Purchase ${order.orderNumber}`;
  const subtitle = `${order.items.length === 1 ? order.materialName : `${order.items.length} materials`} · ${order.vendorName} · ${order.subhubName}`;
  const actions = <Link to={user?.panel === "procurement" ? "/procurement-management" : "/procurement"} search={user?.panel === "procurement" ? undefined : { panel: user?.panel ?? "admin" }} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"><ArrowLeft className="size-4" /> Back to procurement</Link>;
  return user?.panel === "subhub" ? (
    <SubHubShell title={title} subtitle={subtitle} actions={actions}>{content}</SubHubShell>
  ) : (
    <Shell title={title} subtitle={subtitle} actions={actions}>{content}</Shell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-3 px-5 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="ml-auto text-right font-medium">{value}</dd></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}