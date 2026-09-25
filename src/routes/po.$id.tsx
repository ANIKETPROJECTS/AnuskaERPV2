import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Circle, Clock3, Package, Truck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { Shell } from "@/components/erp/Shell";
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
    <section>
      <header className="border-b border-border py-3">
        <h2 className="text-lg font-semibold">Nothing here</h2>
      </header>
      <p className="border-b border-border py-5 text-base text-muted-foreground">
        Back to <Link to="/procurement" className="font-semibold text-primary underline">Procurement</Link>.
      </p>
    </section>
  );
  return user?.panel === "subhub" ? (
    <SubHubShell title="Purchase not found" subtitle="This order is not available in your procurement workspace">
      <div className="px-6 py-5">{content}</div>
    </SubHubShell>
  ) : (
    <Shell title="Purchase not found" subtitle="This order is not available in your procurement workspace">
      {content}
    </Shell>
  );
}

function PurchaseDetail() {
  const { order } = Route.useLoaderData();
  const { user } = useAuth();
  const isSubHub = user?.panel === "subhub";
  const currentIndex = ["Order placed", "Payment done", "Dispatch done", "Delivery done"].indexOf(order.status);
  const summaryMetrics = [
    { label: "Quantity", value: order.quantity.toLocaleString("en-IN"), hint: "Units ordered" },
    ...(!isSubHub ? [{ label: "Order amount", value: `₹${order.totalAmount.toLocaleString("en-IN")}`, hint: `${order.items.length} material line${order.items.length === 1 ? "" : "s"}` }] : []),
    { label: "Status", value: order.status, hint: "Current procurement stage" },
    { label: "Expected delivery", value: formatDate(order.expectedDelivery), hint: `Ordered ${formatDate(order.orderDate)}` },
  ];
  const content = (
    <div className="space-y-6 text-base">
      <section
        aria-label="Order summary"
        className={`grid gap-x-8 border-y border-border ${isSubHub ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"}`}
      >
        {summaryMetrics.map((metric) => (
          <div key={metric.label} className="py-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
            <p className="tabular mt-1 text-2xl font-bold leading-tight sm:text-3xl">{metric.value}</p>
            <p className="mt-1 text-base text-muted-foreground">{metric.hint}</p>
          </div>
        ))}
      </section>

      <section>
        <DetailSectionHeading title="Order status history" description="Every transition is stored with the actor and timestamp." />
        <ol className="divide-y divide-border border-b border-border">
          {(["Order placed", "Payment done", "Dispatch done", "Delivery done"] as ProcurementStatus[]).map((status, index) => {
            const entry = order.statusHistory.find((item) => item.status === status);
            const done = index <= currentIndex;
            return (
              <li key={status} className="flex items-center gap-4 px-2 py-4 text-base">
                {done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}
                <span className={done ? "font-semibold" : "text-muted-foreground"}>{status}</span>
                {entry ? <span className="ml-auto text-right text-sm text-muted-foreground"><span className="block text-base font-semibold text-foreground">{entry.changedByName}</span>{formatTimestamp(entry.changedAt)}</span> : <span className="ml-auto text-sm text-muted-foreground">Pending</span>}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
        <section>
          <DetailSectionHeading title="Procurement details" />
          <dl className="divide-y divide-border border-b border-border text-base">
            <Detail label="Order number" value={order.orderNumber} />
            <Detail label="Vendor" value={order.vendorName} />
            <Detail label="Destination SubHub" value={order.subhubName} />
            <Detail label="Order date" value={formatDate(order.orderDate)} />
            <Detail label="Expected delivery" value={formatDate(order.expectedDelivery)} />
            <Detail label="Created" value={formatTimestamp(order.createdAt)} />
          </dl>
        </section>
        <section>
          <DetailSectionHeading title="Materials in this order" description={`${order.items.length} line${order.items.length === 1 ? "" : "s"} · total quantity ${order.quantity.toLocaleString("en-IN")}`} />
          <div className="divide-y divide-border border-b border-border">
            {order.items.map((item) => <div key={`${item.materialCode}:${item.materialName}`} className="flex items-center gap-4 px-2 py-4 text-base"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.materialName}</p><p className="text-sm text-muted-foreground">{item.materialCode}</p></div><div className="text-right"><p className="tabular font-semibold">{item.quantity.toLocaleString("en-IN")} units</p>{!isSubHub ? <p className="tabular text-sm text-muted-foreground">₹{item.totalAmount.toLocaleString("en-IN")}</p> : null}</div></div>)}
          </div>
        </section>
        <section className="lg:col-span-2">
          <DetailSectionHeading title="Order notes" description="Receiving instructions and procurement context." />
          {order.notes ? <p className="whitespace-pre-wrap border-b border-border py-4 text-base leading-7 text-muted-foreground">{order.notes}</p> : <div className="border-b border-border py-8 text-center"><Package className="mx-auto size-8 text-primary" /><p className="mt-3 text-base text-muted-foreground">No notes were added to this order.</p></div>}
        </section>
      </div>
      <div className="flex items-center gap-3 border-y border-border py-3 text-base text-muted-foreground"><Clock3 className="size-5 shrink-0" /> {user?.panel === "subhub" ? "Order details are read-only for SubHub users." : "Status changes are recorded in the procurement audit trail."}<Truck className="ml-auto size-5 shrink-0" /></div>
    </div>
  );
  const title = `Purchase ${order.orderNumber}`;
  const subtitle = `${order.items.length === 1 ? order.materialName : `${order.items.length} materials`} · ${order.vendorName} · ${order.subhubName}`;
  const actions = <Link to={user?.panel === "procurement" ? "/procurement-management" : "/procurement"} search={user?.panel === "procurement" ? undefined : { panel: user?.panel ?? "admin" }} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-4 text-base font-semibold"><ArrowLeft className="size-5" /> Back to procurement</Link>;
  return user?.panel === "subhub" ? (
    <SubHubShell title={title} subtitle={subtitle} actions={actions}>
      <div className="space-y-6 px-6 py-5">{content}</div>
    </SubHubShell>
  ) : (
    <Shell title={title} subtitle={subtitle} actions={actions}>{content}</Shell>
  );
}

function DetailSectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <header className="border-b border-border py-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-base text-muted-foreground">{description}</p> : null}
    </header>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-3 px-2 py-4"><dt className="text-muted-foreground">{label}</dt><dd className="ml-auto text-right font-semibold">{value}</dd></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}