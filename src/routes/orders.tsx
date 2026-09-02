import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  History,
  Plus,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { getAdminProductionDashboardFn, getProductionOrderActivityFn, listAssignableSubhubsFn, reassignProductionOrderFn } from "@/production";
import type { AdminProductionDashboard, AssignableSubhub, ProductionOrder, ProductionOrderActivity } from "@/production.server";
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

function Orders() {
  const [dashboard, setDashboard] = useState<AdminProductionDashboard | null>(null);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [subhubs, setSubhubs] = useState<AssignableSubhub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Record<string, ProductionOrderActivity[]>>({});
  const [activityLoading, setActivityLoading] = useState("");
  const [reassigningOrderId, setReassigningOrderId] = useState("");

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

  const totalTarget = orders.reduce((sum, order) => sum + order.target, 0);
  const totalProduced = orders.reduce((sum, order) => sum + order.produced, 0);
  const totalRemaining = orders.reduce((sum, order) => sum + order.remaining, 0);
  const completion = totalTarget ? Math.round((totalProduced / totalTarget) * 100) : 0;

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

  return (
    <Shell
      title="Orders & Production Targets"
      subtitle="Set hub capacity, assign work, and analyze manager-entered production"
      actions={
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
            <RefreshCw className="size-4" /> Refresh
          </button>
          <Link to="/production-targets" className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
            <Plus className="size-4" /> Assign target
          </Link>
        </div>
      }
    >
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Assigned target" value={num(totalTarget)} hint={`${orders.length} live orders`} />
          <Kpi label="Produced" value={num(totalProduced)} tone="good" hint="manager-entered output" />
          <Kpi label="Remaining" value={num(totalRemaining)} tone="warn" hint="across assigned orders" />
          <Kpi label="Completion" value={`${completion}%`} tone={completion >= 100 ? "good" : "neutral"} hint="all SubHubs combined" />
        </div>

        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <Panel title="Hub capacity & workload" description="Capacity is declared by each Hub Manager. Admin can use this live data to assign work and monitor automatic reassignment.">
          <div className="divide-y divide-border">
            {loading && !dashboard ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading hub capacity…</p>
            ) : dashboard?.hubs.length ? (
              dashboard.hubs.map((hub) => (
                <HubCapacityRow
                  key={hub.userId}
                  hub={hub}
                />
              ))
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">Create an active SubHub Manager to define capacity.</p>
            )}
          </div>
        </Panel>

        {dashboard ? <ProductionCharts dashboard={dashboard} /> : null}

        {dashboard?.recentReassignments.length ? (
          <Panel title="Recent automatic reassignments" description="Orders moved when their previous hub exceeded its configured active target capacity.">
            <div className="divide-y divide-border">
              {dashboard.recentReassignments.map((reassignment, index) => (
                <div key={`${reassignment.orderNumber}-${reassignment.createdAt}-${index}`} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{reassignment.orderNumber} · {reassignment.variantName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{reassignment.productName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Tag tone="warn">{reassignment.fromHub}</Tag>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <Tag tone="good">{reassignment.toHub}</Tag>
                  </div>
                  <time className="text-xs text-muted-foreground">{reassignment.createdAt.slice(0, 10)}</time>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title="Assigned production orders" description="Each order belongs to one SubHub and can be reported against day by day.">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading live orders…</p>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No production targets assigned yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Assign the first order to a SubHub Manager to start collecting daily output.</p>
               <Link to="/production-targets" className="rule-header mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
                <Plus className="size-4" /> Assign target
               </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order / SubHub</th>
                    <th className="px-5 py-3 font-medium">Product variant</th>
                    <th className="px-5 py-3 text-right font-medium">Target</th>
                    <th className="px-5 py-3 text-right font-medium">Produced</th>
                    <th className="px-5 py-3 text-right font-medium">Due date</th>
                    <th className="px-5 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      subhubs={subhubs}
                      activity={activities[order.id] ?? []}
                      activityLoading={activityLoading === order.id}
                      reassigning={reassigningOrderId === order.id}
                      activityOpen={expandedOrderId === order.id}
                      onToggleActivity={() => void toggleActivity(order.id)}
                      onReassign={(subhubUserId, reason) => void reassignOrder(order.id, subhubUserId, reason)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

    </Shell>
  );
}

function HubCapacityRow({ hub }: { hub: AdminProductionDashboard["hubs"][number] }) {
  const capacityLabel = hub.capacityUnits === null ? "No limit" : num(hub.capacityUnits);
  const loadLabel = hub.capacityUnits === null
    ? `${num(hub.openUnits)} open units`
    : `${num(hub.openUnits)} / ${num(hub.capacityUnits)} units`;
  const status = hub.overloaded ? "Overloaded" : hub.capacityUnits === null ? "Unrestricted" : "Within capacity";
  const statusTone = hub.overloaded ? "bad" : hub.capacityUnits === null ? "neutral" : "good";

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
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
        <Settings2 className="size-4 text-muted-foreground" />
        <span><span className="text-xs uppercase tracking-wide text-muted-foreground">Declared capacity</span><span className="tabular ml-2 font-semibold">{capacityLabel}</span></span>
      </div>
      {hub.overloaded ? <AlertTriangle className="size-5 text-destructive" aria-label="Hub is overloaded" /> : null}
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
  onToggleActivity,
  onReassign,
}: {
  order: ProductionOrder;
  subhubs: AssignableSubhub[];
  activity?: ProductionOrderActivity[];
  activityLoading: boolean;
  reassigning: boolean;
  activityOpen: boolean;
  onToggleActivity: () => void;
  onReassign: (subhubUserId: string, reason: string) => void;
}) {
  const [destinationId, setDestinationId] = useState(order.subhubUserId);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setDestinationId(order.subhubUserId);
  }, [order.subhubUserId]);

  return (
    <>
      <tr className="border-b border-border/70 hover:bg-muted/40">
        <td className="px-5 py-4">
          <p className="tabular font-semibold">{order.orderNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">{order.subhubName}</p>
          <button type="button" onClick={onToggleActivity} className="mt-2 text-xs font-medium text-primary hover:underline">
            {activityLoading ? "Loading activity…" : activityOpen ? "Hide activity" : "View activity"}
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              aria-label={`Destination SubHub for ${order.orderNumber}`}
              className="h-8 max-w-44 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
            >
              {subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.subhubName}</option>)}
            </select>
            <button
              type="button"
              disabled={reassigning || destinationId === order.subhubUserId}
              onClick={() => onReassign(destinationId, reason)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <ArrowRight className="size-3.5" /> {reassigning ? "Moving…" : "Move order"}
            </button>
          </div>
          {destinationId !== order.subhubUserId ? (
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (optional)"
              aria-label={`Reason for moving ${order.orderNumber}`}
              className="mt-2 h-8 w-full max-w-64 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
            />
          ) : null}
        </td>
        <td className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.productName}</p>
          <p className="mt-1 font-medium">{order.variantName}</p>
          <p className="tabular text-xs text-muted-foreground">{order.variantCode}</p>
        </td>
        <td className="tabular px-5 py-4 text-right font-semibold">{num(order.target)}</td>
        <td className="tabular px-5 py-4 text-right">{num(order.produced)}</td>
        <td className="tabular px-5 py-4 text-right text-muted-foreground">{order.dueDate}</td>
        <td className="px-5 py-4 text-right"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td>
      </tr>
      {activityOpen ? (
        <tr className="border-b border-border/70">
          <td colSpan={6} className="bg-muted/10 px-5 py-4">
            <ActivityTimeline activities={activity ?? []} loading={activityLoading} />
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

function ProductionCharts({ dashboard }: { dashboard: AdminProductionDashboard }) {
  const productionPoints = dashboard.dailyProduction.length ? dashboard.dailyProduction : dashboard.weeklyProduction;
  const hubTotals = dashboard.chartHubs.map((hub) => ({
    label: hub.subhubName,
    value: productionPoints.reduce((total, point) => total + Number(point[hub.key] ?? 0), 0),
  }));
  const weeklyPoints = dashboard.weeklyProduction.slice(-6).map((point) => ({
    label: point.label.replace("Week of ", ""),
    value: Number(point.total),
  }));
  const chartStyle = {
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-card)",
    fontSize: 12,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Production by SubHub" description="Finished units reported in the current period.">
        {hubTotals.length === 0 || hubTotals.every((hub) => hub.value === 0) ? (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No production reports are available yet.
          </div>
        ) : (
          <div className="h-72 p-4" role="img" aria-label="Column chart showing production by SubHub">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hubTotals} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => [`${num(Number(value))} units`, "Produced"]} />
                <Bar dataKey="value" name="Produced" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  <LabelList dataKey="value" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Weekly production totals" description="Total finished units across all SubHubs.">
        {weeklyPoints.length === 0 ? (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No weekly production reports are available yet.
          </div>
        ) : (
          <div className="h-72 p-4" role="img" aria-label="Column chart showing weekly production totals">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPoints} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => [`${num(Number(value))} units`, "Produced"]} />
                <Bar dataKey="value" name="Produced" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  <LabelList dataKey="value" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}
