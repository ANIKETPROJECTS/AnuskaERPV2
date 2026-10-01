import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Boxes, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { HubBatchBrowser } from "@/components/erp/HubBatchBrowser";
import { HubModuleNav } from "@/components/erp/HubModuleNav";
import { Shell } from "@/components/erp/Shell";
import { Tag } from "@/components/erp/bits";
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

const hubDetailViews = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "daily", label: "Daily output" },
  { id: "reports", label: "Reports" },
  { id: "inventory", label: "Inventory" },
  { id: "batches", label: "Batches" },
  { id: "quality", label: "Quality" },
  { id: "movements", label: "Movements" },
  { id: "activity", label: "Activity" },
] as const;

type HubDetailView = (typeof hubDetailViews)[number]["id"];

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
  return <HubDetailsView key={hubId} hubId={hubId} />;
}

function HubDetailsView({ hubId }: { hubId: string }) {
  const [data, setData] = useState<AdminHubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<HubDetailView>("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminHubDetailFn({ data: { hubId } });
      if (result.ok) setData(result.data);
      else setError(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hub details could not be refreshed.");
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <Shell title="Loading hub details" subtitle="Getting the latest live workspace data">
        <div className="py-8 text-center text-base text-muted-foreground">Loading hub details…</div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell
        title="Hub details unavailable"
        subtitle="The requested live SubHub could not be loaded"
        actions={
          <Link to="/hubs" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 py-2 text-base font-medium">
            <ArrowLeft className="size-4" /> All hubs
          </Link>
        }
      >
        <p role="alert" className="border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-base text-destructive">
          {error || "The requested hub could not be found."}
        </p>
      </Shell>
    );
  }

  const { hub, manager, orders, reports, inventory, activities, dailyProduction } = data;

  return (
    <Shell
      title={hub.subhubName}
      subtitle={`${hub.name} · ${manager.active ? "Active manager" : "Inactive manager"}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 py-2 text-base font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <Link to="/hubs" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 py-2 text-base font-medium hover:bg-muted">
            <ArrowLeft className="size-4" /> All hubs
          </Link>
        </div>
      }
      headerNav={
        <HubModuleNav
          active={activeView}
          ariaLabel={`${hub.subhubName} sections`}
          idPrefix="hub-detail"
          items={hubDetailViews}
          onSelect={(view) => setActiveView(view)}
        />
      }
    >
      <div className="space-y-5">
        {error ? <p role="alert" className="border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-base text-destructive">{error}</p> : null}

        <section
          id="hub-detail-panel-overview"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-overview"
          tabIndex={0}
          hidden={activeView !== "overview"}
          className="grid gap-x-10 gap-y-8 lg:grid-cols-2"
        >
          <div className="space-y-3">
            <SectionHeading title="SubHub profile" description="Manager and workspace details" />
            <KeyValueList items={[
              { label: "Manager", value: hub.name },
              { label: "Email", value: manager.email },
              { label: "Account status", value: manager.active ? "Active" : "Inactive" },
              { label: "Created", value: dateTime(manager.createdAt) },
              { label: "Last production report", value: dateTime(hub.lastProductionDate) },
              { label: "Production status", value: <Tag tone={statusTone(hub.status)}>{hub.status}</Tag> },
              { label: "Assigned orders", value: num(hub.orderCount) },
              { label: "Assigned target", value: `${num(hub.target)} units` },
              { label: "Produced", value: `${num(hub.produced)} units` },
              { label: "Remaining", value: `${num(hub.remaining)} units` },
              { label: "Stock", value: `${num(hub.stockUnits)} units · ₹${hub.stockValue.toLocaleString("en-IN")}` },
            ]} />
          </div>
          <div className="space-y-3">
            <SectionHeading title="Capacity & workload" description="Active open targets compared with declared capacity" />
            <KeyValueList items={[
              { label: "Declared capacity", value: hub.capacityUnits === null ? "No limit" : `${num(hub.capacityUnits)} units` },
              { label: "Current load", value: `${num(hub.openUnits)} open units` },
              { label: "Available capacity", value: hub.availableUnits === null ? "No limit" : `${num(hub.availableUnits)} units` },
              { label: "Capacity status", value: <Tag tone={hub.overloaded ? "bad" : statusTone(hub.status)}>{hub.overloaded ? "Over capacity" : hub.status}</Tag> },
            ]} />
          </div>
        </section>

        <section
          id="hub-detail-panel-orders"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-orders"
          tabIndex={0}
          hidden={activeView !== "orders"}
          className="space-y-4"
        >
          <SectionHeading title="Assigned orders" description="Every production order currently assigned to this SubHub" />
          {orders.length === 0 ? <Empty text="No production orders are assigned to this SubHub." /> : (
            <div className="overflow-x-auto border-b border-border">
              <table className="w-full min-w-[900px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Product / variant</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Target</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Produced</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Remaining</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Due</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30">
                      <td className="tabular whitespace-nowrap px-4 py-4 font-semibold">{order.orderNumber}</td>
                      <td className="px-4 py-4">
                        <span className="block font-semibold">{order.productName}</span>
                        <span className="text-sm text-muted-foreground">{order.variantName} · {order.variantCode}</span>
                      </td>
                      <td className="tabular px-4 py-4 text-right">{num(order.target)}</td>
                      <td className="tabular px-4 py-4 text-right font-semibold">{num(order.produced)}</td>
                      <td className="tabular px-4 py-4 text-right">{num(order.remaining)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-4">{order.dueDate}</td>
                      <td className="px-4 py-4"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="hub-detail-panel-daily"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-daily"
          tabIndex={0}
          hidden={activeView !== "daily"}
          className="space-y-4"
        >
          <SectionHeading title="Daily output" description="Daily production totals recorded in this SubHub workspace" />
          {dailyProduction.length === 0 ? <Empty text="No production totals are recorded for this SubHub." /> : (
            <div className="overflow-x-auto border-b border-border">
              <table className="w-full min-w-[480px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Units produced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dailyProduction.slice(0, 12).map((day) => (
                    <tr key={day.date}>
                      <td className="tabular px-4 py-4">{day.date}</td>
                      <td className="tabular px-4 py-4 text-right font-semibold">{num(day.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="hub-detail-panel-reports"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-reports"
          tabIndex={0}
          hidden={activeView !== "reports"}
          className="space-y-4"
        >
          <SectionHeading title="Production reports" description="Report entries, notes, and batch-allocation references" />
          {reports.length === 0 ? <Empty text="No production reports are recorded for this SubHub." /> : (
            <div className="overflow-x-auto border-b border-border">
              <table className="w-full min-w-[980px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Order / variant</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Quantity</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Notes</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Batch allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td className="tabular whitespace-nowrap px-4 py-4">{report.date}</td>
                      <td className="px-4 py-4">
                        <span className="block font-semibold">{report.orderNumber}</span>
                        <span className="text-sm text-muted-foreground">{report.productName} · {report.variantName} · {report.variantCode}</span>
                      </td>
                      <td className="tabular px-4 py-4 text-right font-semibold">{num(report.quantity)}</td>
                      <td className="max-w-[260px] px-4 py-4 text-muted-foreground">{report.notes || "—"}</td>
                      <td className="max-w-[360px] px-4 py-4 text-sm text-muted-foreground">
                        {report.batchAllocation?.allocations?.length
                          ? report.batchAllocation.allocations.map((allocation) => `${allocation.batchCode} (${num(allocation.quantity)})`).join(", ")
                          : "FIFO allocation not recorded"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="hub-detail-panel-inventory"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-inventory"
          tabIndex={0}
          hidden={activeView !== "inventory"}
          className="space-y-4"
        >
          <SectionHeading
            title="Current inventory"
            description={`Raw materials and final products · ${num(hub.stockUnits)} units · ₹${hub.stockValue.toLocaleString("en-IN")} total value`}
          />
          {inventory.items.length === 0 ? <Empty text="No inventory items are recorded for this SubHub." /> : (
            <div className="overflow-x-auto border-b border-border">
              <table className="w-full min-w-[800px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Item</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Quantity</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Unit price</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Last updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventory.items.map((item) => (
                    <tr key={item.code}>
                      <td className="px-4 py-4">
                        <span className="block font-semibold">{item.name}</span>
                        <span className="tabular text-sm text-muted-foreground">{item.code}</span>
                      </td>
                      <td className="px-4 py-4"><Tag tone={item.category === "Float" ? "info" : "neutral"}>{item.category === "Float" ? "Final product" : "Raw material"}</Tag></td>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-right font-semibold">{num(item.quantity)} {item.unit}</td>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-right">₹{item.price.toLocaleString("en-IN")}</td>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">{dateTime(item.loggedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="hub-detail-panel-batches"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-batches"
          tabIndex={0}
          hidden={activeView !== "batches"}
          className="space-y-4"
        >
          <HubBatchBrowser hubId={hubId} panel="admin" initialBatches={inventory.batches} />
        </section>

        <section
          id="hub-detail-panel-quality"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-quality"
          tabIndex={0}
          hidden={activeView !== "quality"}
          className="space-y-4"
        >
          <SectionHeading title="Quality history" description="Quality deductions recorded in this SubHub workspace" />
          {inventory.qualityLogs.length === 0 ? <Empty text="No quality records are recorded for this SubHub." /> : (
            <div className="overflow-x-auto border-b border-border">
              <table className="w-full min-w-[720px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Item</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Issue</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Units</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventory.qualityLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-sm">{dateTime(log.date)}</td>
                      <td className="px-4 py-4">
                        <span className="block font-semibold">{log.product}</span>
                        <span className="tabular text-sm text-muted-foreground">{log.code} · {log.batchCode || "FIFO"}</span>
                      </td>
                      <td className="px-4 py-4"><Tag tone="bad">{log.issue}</Tag></td>
                      <td className="tabular px-4 py-4 text-right font-semibold text-destructive">-{num(log.quantity)}</td>
                      <td className="max-w-[260px] px-4 py-4 text-muted-foreground">{log.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="hub-detail-panel-movements"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-movements"
          tabIndex={0}
          hidden={activeView !== "movements"}
          className="space-y-4"
        >
          <SectionHeading title="Inventory movements" description="Receipts, production, consumption, quality, and adjustments" />
          {inventory.batchMovements.length === 0 ? <Empty text="No inventory movements are recorded for this SubHub." /> : (
            <div className="overflow-x-auto border-b border-border">
              <table className="w-full min-w-[760px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Item / batch</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Change</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventory.batchMovements.slice(0, 100).map((movement) => (
                    <tr key={movement.id}>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-sm">{dateTime(movement.createdAt)}</td>
                      <td className="px-4 py-4">
                        <span className="block font-semibold">{movement.itemCode}</span>
                        <span className="tabular text-sm text-muted-foreground">{movement.batchCode}</span>
                      </td>
                      <td className="px-4 py-4"><Tag tone={movement.quantityDelta > 0 ? "good" : movement.type === "QUALITY" ? "bad" : "neutral"}>{movement.type}</Tag></td>
                      <td className={`tabular px-4 py-4 text-right font-semibold ${movement.quantityDelta > 0 ? "text-success" : "text-destructive"}`}>
                        {movement.quantityDelta > 0 ? "+" : ""}{num(movement.quantityDelta)}
                      </td>
                      <td className="max-w-[260px] px-4 py-4 text-muted-foreground">{movement.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="hub-detail-panel-activity"
          role="tabpanel"
          aria-labelledby="hub-detail-tab-activity"
          tabIndex={0}
          hidden={activeView !== "activity"}
          className="space-y-4"
        >
          <SectionHeading title="Order activity" description="Assignment and production changes affecting this SubHub" />
          {activities.length === 0 ? <Empty text="No order activity is recorded for this SubHub." /> : (
            <div className="divide-y divide-border border-b border-border">
              {activities.map((activity) => (
                <article key={activity.id} className="py-4 first:pt-0">
                  <p className="text-base font-semibold">{activity.summary}</p>
                  <p className="mt-1 text-base text-muted-foreground">{activity.details}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{activity.actorName} · {dateTime(activity.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-border pb-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-base text-muted-foreground">{description}</p>
    </div>
  );
}

function KeyValueList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border border-b border-border">
      {items.map((item) => (
        <div key={item.label} className="flex min-h-12 items-center justify-between gap-6 py-3">
          <dt className="text-base text-muted-foreground">{item.label}</dt>
          <dd className="max-w-[60%] text-right text-base font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-10 text-center text-base text-muted-foreground">
      <Boxes className="mx-auto mb-2 size-6" />
      {text}
    </p>
  );
}