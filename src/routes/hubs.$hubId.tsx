import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Boxes, CheckCircle2, ClipboardList, Factory, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { HubBatchBrowser } from "@/components/erp/HubBatchBrowser";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { getAdminHubDetailFn } from "@/production";
import type { AdminHubDetail, HubSummary } from "@/production.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/hubs/$hubId")({
  head: () => ({
    meta: [
      { title: "Hub details — Float ERP" },
      { name: "description", content: "Live operational details for a SubHub." },
    ],
  }),
  component: HubDetails,
});

function statusTone(status: HubSummary["status"] | "Unstarted"): "good" | "warn" | "bad" | "neutral" {
  if (status === "Complete" || status === "Over target") return "good";
  if (status === "In progress") return "warn";
  if (status === "Awaiting update") return "bad";
  return "neutral";
}

function dateTime(value: string | null | undefined) {
  return value ? value.slice(0, 16).replace("T", " ") : "—";
}

function HubDetails() {
  const { hubId } = Route.useParams();
  const [data, setData] = useState<AdminHubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const result = await getAdminHubDetailFn({ data: { hubId } });
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [hubId]);

  if (loading && !data) {
    return (
      <Shell title="Loading hub details" subtitle="Getting the latest live workspace data">
        <div className="p-8 text-center text-sm text-muted-foreground">Loading hub details…</div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell title="Hub details unavailable" subtitle="The requested live SubHub could not be loaded" actions={<Link to="/hubs" className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"><ArrowLeft className="size-4" /> All hubs</Link>}>
        <Panel title="Unable to load hub">
          <p role="alert" className="p-5 text-sm text-destructive">{error || "The requested hub could not be found."}</p>
        </Panel>
      </Shell>
    );
  }

  const { hub, manager, orders, reports, inventory, activities, dailyProduction } = data;
  return (
    <Shell
      title={`${hub.subhubName} · ${hub.name}`}
      subtitle="Complete live operational view for this factory / hub"
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
          <Link to="/hubs" className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"><ArrowLeft className="size-4" /> All hubs</Link>
        </div>
      }
    >
      <div className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Assigned target" value={num(hub.target)} hint={`${hub.orderCount} assigned ${hub.orderCount === 1 ? "order" : "orders"}`} />
          <Kpi label="Produced" value={num(hub.produced)} tone="good" hint={`${hub.reportCount} production reports`} />
          <Kpi label="Stock units" value={num(hub.stockUnits)} tone="neutral" hint={`₹${hub.stockValue.toLocaleString("en-IN")} stock value`} />
          <Kpi label="Completion" value={`${hub.completion}%`} tone={statusTone(hub.status)} hint={hub.status} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Hub profile" description="Live manager and workspace information" className="lg:col-span-2">
            <dl className="grid gap-x-8 divide-y divide-border text-sm sm:grid-cols-2 sm:divide-y-0">
              <ProfileRow label="Factory / hub" value={hub.subhubName} icon={Factory} />
              <ProfileRow label="Manager" value={hub.name} icon={ClipboardList} />
              <ProfileRow label="Email" value={manager.email} icon={ClipboardList} />
              <ProfileRow label="Account status" value={manager.active ? "Active" : "Inactive"} icon={CheckCircle2} />
              <ProfileRow label="Created" value={dateTime(manager.createdAt)} icon={ClipboardList} />
              <ProfileRow label="Last production report" value={dateTime(hub.lastProductionDate)} icon={TrendingUp} />
            </dl>
          </Panel>
          <Panel title="Capacity & workload" description="Open target units compared with declared capacity">
            <div className="space-y-4 p-5 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Declared capacity</span><span className="tabular font-semibold">{hub.capacityUnits === null ? "Unlimited" : `${num(hub.capacityUnits)} units`}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Open target units</span><span className="tabular font-semibold">{num(hub.openUnits)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Available capacity</span><span className={`tabular font-semibold ${hub.overloaded ? "text-destructive" : "text-success"}`}>{hub.availableUnits === null ? "Unlimited" : num(hub.availableUnits)}</span></div>
              <div className="border-t border-border pt-4"><Tag tone={hub.overloaded ? "bad" : statusTone(hub.status)}>{hub.overloaded ? "Over capacity" : hub.status}</Tag></div>
            </div>
          </Panel>
        </div>

        <Panel title="Production by day" description="Manager-entered production reports stored in this hub workspace">
          {dailyProduction.length === 0 ? <Empty text="No production reports recorded for this hub." /> : <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">{dailyProduction.slice(0, 12).map((day) => <div key={day.date} className="rounded-md border border-border bg-muted/15 p-4"><p className="text-xs text-muted-foreground">{day.date}</p><p className="tabular mt-1 text-xl font-semibold">{num(day.quantity)}</p><p className="text-xs text-muted-foreground">units produced</p></div>)}</div>}
        </Panel>

        <Panel title="Assigned production orders" description="Every order currently assigned to this hub">
          {orders.length === 0 ? <Empty text="No production orders assigned to this hub." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 font-medium">Product / variant</th><th className="px-5 py-3 text-right font-medium">Target</th><th className="px-5 py-3 text-right font-medium">Produced</th><th className="px-5 py-3 text-right font-medium">Remaining</th><th className="px-5 py-3 font-medium">Due</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="tabular px-5 py-3 font-medium">{order.orderNumber}</td><td className="px-5 py-3"><p className="font-medium">{order.productName}</p><p className="text-xs text-muted-foreground">{order.variantName} · {order.variantCode}</p></td><td className="tabular px-5 py-3 text-right">{num(order.target)}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(order.produced)}</td><td className="tabular px-5 py-3 text-right">{num(order.remaining)}</td><td className="tabular whitespace-nowrap px-5 py-3">{order.dueDate}</td><td className="px-5 py-3"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td></tr>)}</tbody></table></div>}
        </Panel>

        <Panel title="Production report history" description="Detailed report entries and batch allocation references">
          {reports.length === 0 ? <Empty text="No production reports recorded for this hub." /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Order / variant</th><th className="px-5 py-3 text-right font-medium">Quantity</th><th className="px-5 py-3 font-medium">Notes</th><th className="px-5 py-3 font-medium">Batch allocation</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id} className="border-b border-border/70 last:border-0"><td className="tabular whitespace-nowrap px-5 py-3">{report.date}</td><td className="px-5 py-3"><p className="font-medium">{report.orderNumber}</p><p className="text-xs text-muted-foreground">{report.productName} · {report.variantName} · {report.variantCode}</p></td><td className="tabular px-5 py-3 text-right font-semibold">{num(report.quantity)}</td><td className="max-w-[260px] px-5 py-3 text-muted-foreground">{report.notes || "—"}</td><td className="px-5 py-3 text-xs text-muted-foreground">{report.batchAllocation?.allocations?.length ? report.batchAllocation.allocations.map((allocation) => `${allocation.batchCode} (${num(allocation.quantity)})`).join(", ") : "FIFO allocation not recorded"}</td></tr>)}</tbody></table></div>}
        </Panel>

        <Panel title="Current inventory" description="All raw materials and final products stored in this hub workspace">
          {inventory.items.length === 0 ? <Empty text="No inventory items recorded for this hub." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 text-right font-medium">Quantity</th><th className="px-5 py-3 text-right font-medium">Unit price</th><th className="px-5 py-3 font-medium">Last updated</th></tr></thead><tbody>{inventory.items.map((item) => <tr key={item.code} className="border-b border-border/70 last:border-0"><td className="px-5 py-3"><p className="font-medium">{item.name}</p><p className="tabular text-xs text-muted-foreground">{item.code}</p></td><td className="px-5 py-3"><Tag tone={item.category === "Float" ? "info" : "neutral"}>{item.category === "Float" ? "Final product" : "Raw material"}</Tag></td><td className="tabular px-5 py-3 text-right font-semibold">{num(item.quantity)} {item.unit}</td><td className="tabular px-5 py-3 text-right">₹{item.price.toLocaleString("en-IN")}</td><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{dateTime(item.loggedAt)}</td></tr>)}</tbody></table></div>}
        </Panel>

        <div className="space-y-6">
          <HubBatchBrowser hubId={hubId} panel="admin" initialBatches={inventory.batches} />
          <Panel title="Quality history" description="Quality deductions recorded in this hub workspace">
            {inventory.qualityLogs.length === 0 ? <Empty text="No quality records recorded for this hub." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Issue</th><th className="px-5 py-3 text-right font-medium">Units</th><th className="px-5 py-3 font-medium">Notes</th></tr></thead><tbody>{inventory.qualityLogs.map((log) => <tr key={log.id} className="border-b border-border/70 last:border-0"><td className="tabular whitespace-nowrap px-5 py-3 text-xs">{dateTime(log.date)}</td><td className="px-5 py-3"><p className="font-medium">{log.product}</p><p className="tabular text-xs text-muted-foreground">{log.code} · {log.batchCode || "FIFO"}</p></td><td className="px-5 py-3"><Tag tone="bad">{log.issue}</Tag></td><td className="tabular px-5 py-3 text-right font-semibold text-destructive">-{num(log.quantity)}</td><td className="max-w-[220px] truncate px-5 py-3 text-muted-foreground">{log.notes || "—"}</td></tr>)}</tbody></table></div>}
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Inventory movement history" description="Latest receipts, production, consumption, quality and adjustments">
            {inventory.batchMovements.length === 0 ? <Empty text="No batch movements recorded for this hub." /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Item / batch</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 text-right font-medium">Change</th><th className="px-5 py-3 font-medium">Reason</th></tr></thead><tbody>{inventory.batchMovements.slice(0, 100).map((movement) => <tr key={movement.id} className="border-b border-border/70 last:border-0"><td className="tabular whitespace-nowrap px-5 py-3 text-xs">{dateTime(movement.createdAt)}</td><td className="px-5 py-3"><p className="font-medium">{movement.itemCode}</p><p className="tabular text-xs text-muted-foreground">{movement.batchCode}</p></td><td className="px-5 py-3"><Tag tone={movement.quantityDelta > 0 ? "good" : movement.type === "QUALITY" ? "bad" : "neutral"}>{movement.type}</Tag></td><td className={`tabular px-5 py-3 text-right font-semibold ${movement.quantityDelta > 0 ? "text-success" : "text-destructive"}`}>{movement.quantityDelta > 0 ? "+" : ""}{num(movement.quantityDelta)}</td><td className="max-w-[220px] truncate px-5 py-3 text-muted-foreground">{movement.reason}</td></tr>)}</tbody></table></div>}
          </Panel>
          <Panel title="Order activity" description="Assignment and production changes affecting this hub">
            {activities.length === 0 ? <Empty text="No order activity recorded for this hub." /> : <div className="divide-y divide-border">{activities.map((activity) => <div key={activity.id} className="flex gap-3 px-5 py-3 text-sm"><div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary"><ArrowRight className="size-3.5" /></div><div className="min-w-0"><p className="font-medium">{activity.summary}</p><p className="mt-0.5 text-xs text-muted-foreground">{activity.details}</p><p className="mt-1 text-xs text-muted-foreground">{activity.actorName} · {dateTime(activity.createdAt)}</p></div></div>)}</div>}
          </Panel>
        </div>
      </div>
    </Shell>
  );
}

function ProfileRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Factory }) {
  return <div className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 sm:border-b-0"><Icon className="size-4 text-muted-foreground" /><span className="text-muted-foreground">{label}</span><span className="ml-auto max-w-[55%] truncate text-right font-medium">{value}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="p-8 text-center text-sm text-muted-foreground"><Boxes className="mx-auto mb-2 size-6" />{text}</p>;
}