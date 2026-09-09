import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ClipboardList, History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerProductionDataFn, getProductionOrderActivityFn } from "@/production";
import type { ProductionOrder, ProductionOrderActivity, ProductionReport } from "@/production.server";
import { num } from "@/lib/erp-data";
import { demoActivities, demoOrder, demoReports } from "@/lib/production-demo";

export const Route = createFileRoute("/subhub/production/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order details — Hub Manager · SubHub" }] }),
  component: ProductionOrderDetails,
});

type PageData = {
  order: ProductionOrder;
  reports: ProductionReport[];
  activities: ProductionOrderActivity[];
  demo?: boolean;
};

function ProductionOrderDetails() {
  const { orderId } = Route.useParams();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      getManagerProductionDataFn(),
      getProductionOrderActivityFn({ data: { orderId, panel: "subhub" } }),
    ]).then(([managerResult, activityResult]) => {
      if (!active) return;
      const order = managerResult.ok ? managerResult.data.orders.find((item) => item.id === orderId) : undefined;
      if (!order) {
        setData({ order: { ...demoOrder, id: orderId }, reports: demoReports.map((report) => ({ ...report, orderId })), activities: demoActivities.map((activity) => ({ ...activity, orderId })), demo: true });
        return;
      }
      setData({
        order,
        reports: managerResult.data.reports.filter((report) => report.orderId === orderId),
        activities: activityResult.ok ? activityResult.activities : [],
      });
      setError("");
    }).catch(() => {
      if (active) setError("The order details could not be loaded.");
    });
    return () => { active = false; };
  }, [orderId]);

  return (
    <SubHubShell actions={<Link to="/subhub/production" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" /> Back to assigned orders</Link>}>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {!data ? (
          <p className="text-sm text-muted-foreground">Loading order details…</p>
        ) : (
          <OrderDetails data={data} />
        )}
      </section>
    </SubHubShell>
  );
}

function OrderDetails({ data }: { data: PageData }) {
  const { order, reports, activities } = data;
  const history = useMemo(() => {
    let runningTotal = 0;
    return [...reports]
      .sort((left, right) => `${left.date}${left.updatedAt}`.localeCompare(`${right.date}${right.updatedAt}`))
      .map((report) => {
        runningTotal += report.quantity;
        return { report, remaining: Math.max(0, order.target - runningTotal) };
      })
      .reverse();
  }, [order.target, reports]);

  return (
    <>
      <div>
        {data.demo ? <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"><strong>Demo data:</strong> This sample order is shown because no live order was found.</div> : null}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SubHub / Hub Manager / Order details</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{order.variantName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{order.orderNumber} · {order.variantCode} · Due {order.dueDate}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === "Complete" || order.status === "Over target" ? "bg-success/10 text-success" : order.status === "In progress" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>{order.status}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Target" value={num(order.target)} />
        <SummaryCard label="Produced so far" value={num(order.produced)} tone="text-primary" />
        <SummaryCard label="Target left" value={num(order.remaining)} tone={order.remaining ? "text-warning" : "text-success"} />
      </div>

      <section className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /><h2 className="font-semibold">Production by date</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Every saved production entry for this order, newest first.</p>
        </div>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-3 font-medium">Production date</th><th className="px-5 py-3 font-medium">Saved at</th><th className="px-5 py-3 text-right font-medium">Produced</th><th className="px-5 py-3 text-right font-medium">Target left</th><th className="px-5 py-3 font-medium">Notes</th></tr>
              </thead>
              <tbody>
                {history.map(({ report, remaining }) => (
                  <tr key={report.id} className="border-b border-border/70 last:border-0">
                    <td className="tabular px-5 py-3 font-medium">{report.date}</td>
                    <td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{formatDateTime(report.updatedAt)}</td>
                    <td className="tabular px-5 py-3 text-right font-semibold">{num(report.quantity)}</td>
                    <td className="tabular px-5 py-3 text-right">{num(remaining)}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{report.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="p-8 text-center text-sm text-muted-foreground">No production has been recorded for this order yet.</p>}
      </section>

      <section className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2"><History className="size-4 text-primary" /><h2 className="font-semibold">Order log</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Assignments and production updates recorded for this order.</p>
        </div>
        {activities.length ? (
          <div className="divide-y divide-border">
            {activities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
          </div>
        ) : <p className="p-8 text-center text-sm text-muted-foreground">No order log entries yet.</p>}
      </section>
    </>
  );
}

function ActivityRow({ activity }: { activity: ProductionOrderActivity }) {
  return <div className="flex gap-3 px-5 py-4"><div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="font-medium">{activity.summary}</p><time className="tabular text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</time></div><p className="mt-1 text-sm text-muted-foreground">{activity.details}</p><p className="mt-1 text-xs text-muted-foreground">By {activity.actorName} · {activity.actorRole}</p></div></div>;
}

function SummaryCard({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border border-border bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p></div>;
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}