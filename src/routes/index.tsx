import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  Factory,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { getOperationsDashboardFn } from "@/dashboard";
import type { OperationsDashboard } from "@/dashboard";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { inr, num } from "@/lib/erp-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Float ERP — Production & Stock Control Dashboard" },
      {
        name: "description",
        content: "Live overview of orders, production, inventory, shortages, procurement, quality, and workforce activity.",
      },
      { property: "og:title", content: "Float ERP — Live Operations Dashboard" },
      {
        property: "og:description",
        content: "Live production, stock, shortages, procurement, quality, and workforce summaries.",
      },
    ],
  }),
  component: Dashboard,
});

const chartStyle = {
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  fontSize: 12,
};

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626"];

function formatDate(value: string | null): string {
  if (!value) return "No updates";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatShortDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`));
}

function ChartEmpty({ message }: { message: string }) {
  return <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">{message}</div>;
}

function Dashboard() {
  const [data, setData] = useState<OperationsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setRefreshing(true);
    const result = await getOperationsDashboardFn();
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading && !data) {
    return (
      <Shell title="Operations Dashboard" subtitle="Loading live ERP data…">
        <div className="panel flex min-h-64 items-center justify-center text-sm text-muted-foreground">Loading live summaries from every section…</div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell title="Operations Dashboard" subtitle="Live ERP summary">
        <div className="panel p-6">
          <p role="alert" className="text-sm text-destructive">{error || "Dashboard data could not be loaded."}</p>
          <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            <RefreshCw className="size-4" /> Retry
          </button>
        </div>
      </Shell>
    );
  }

  const production = data.production;
  const workforce = data.hr.summaries.reduce(
    (totals, summary) => ({
      employees: totals.employees + 1,
      present: totals.present + summary.present,
      absent: totals.absent + summary.absent,
      late: totals.late + summary.late,
      halfDay: totals.halfDay + summary.halfDay,
    }),
    { employees: 0, present: 0, absent: 0, late: 0, halfDay: 0 },
  );
  const attendanceRecords = workforce.present + workforce.absent + workforce.late + workforce.halfDay;
  const attendanceRate = attendanceRecords ? Math.round((workforce.present / attendanceRecords) * 100) : 0;
  const configuredCapacity = production.hubs.reduce((sum, hub) => sum + (hub.capacityUnits ?? 0), 0);

  const productionPoints = production.dailyProduction.length
    ? production.dailyProduction.map((point) => ({ label: formatShortDate(point.date), produced: point.total }))
    : production.weeklyProduction.map((point) => ({ label: point.label.replace("Week of ", ""), produced: point.total }));
  const hubOutput = production.hubs
    .filter((hub) => hub.orderCount || hub.stockUnits)
    .map((hub) => ({
      hub: hub.subhubName,
      produced: hub.produced,
      remaining: hub.remaining,
      stock: hub.stockUnits,
    }));
  const procurementStatus = [
    { name: "Open", value: data.procurement.summary.pendingOrders },
    { name: "Delivered", value: data.procurement.summary.completedOrders },
  ].filter((item) => item.value > 0);
  const criticalShortages = data.shortages.rows
    .flatMap((row) =>
      Object.entries(row.cells).map(([hubId, cell]) => ({
        code: row.code,
        name: row.name,
        hub: data.shortages.hubs.find((candidate) => candidate.id === hubId)?.name ?? "SubHub",
        gap: Math.max(0, cell.gap),
        required: cell.requirement,
        stock: cell.stock,
      })),
    )
    .filter((row) => row.gap > 0)
    .sort((left, right) => right.gap - left.gap)
    .slice(0, 6);
  const freshness = [...data.inventory.byHub].sort((left, right) => (right.lastUpdated ?? "").localeCompare(left.lastUpdated ?? ""));
  const stockByHub = data.inventory.byHub.filter((hub) => hub.units > 0);
  const qualityRate = data.inventory.totalUnits
    ? Math.round((data.quality.summary.rejectedUnits / data.inventory.totalUnits) * 100)
    : 0;

  return (
    <Shell
      title="Operations Dashboard"
      subtitle={`Live ERP summary · ${data.hr.month || "current period"} · ${production.hubs.length} active SubHubs`}
      actions={
        <button type="button" onClick={() => void load()} disabled={refreshing} className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60">
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing…" : "Refresh data"}
        </button>
      }
    >
      {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Open order qty" value={num(production.totalRemaining)} hint={`${num(production.orders.length)} assigned orders`} tone="warn" />
        <Kpi label="Production attainment" value={`${production.completion}%`} hint={`${num(production.totalProduced)} of ${num(production.totalTarget)} units`} tone={production.completion >= 100 ? "good" : "neutral"} />
        <Kpi label="Inventory units" value={num(data.inventory.totalUnits)} hint={`${num(data.inventory.totalItems)} item codes`} />
        <Kpi label="Shortage deficit" value={num(data.shortages.totalDeficit)} hint={`${data.shortages.affectedParts} parts · ${data.shortages.hubsInDeficit} hubs`} tone={data.shortages.totalDeficit ? "bad" : "good"} />
        <Kpi label="Open procurement" value={num(data.procurement.summary.openOrders)} hint={`${num(data.procurement.summary.unitsOnOrder)} units on order`} tone={data.procurement.summary.openOrders ? "warn" : "good"} />
        <Kpi label="Attendance rate" value={`${attendanceRate}%`} hint={`${workforce.employees} employees · ${data.hr.month || "no month"}`} tone={attendanceRate >= 90 ? "good" : attendanceRecords ? "warn" : "neutral"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Production trend"
          description={production.dailyProduction.length ? "Actual finished units by report date" : "No production reports have been recorded yet"}
          className="xl:col-span-2"
          action={<Link to="/production" className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open production <ArrowUpRight className="size-3" /></Link>}
        >
          {productionPoints.length ? (
            <div className="h-72 p-4" role="img" aria-label="Area chart showing live production reports">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={productionPoints}>
                  <defs>
                    <linearGradient id="live-production" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={chartStyle} formatter={(value) => [`${num(Number(value))} units`, "Produced"]} />
                  <Area type="monotone" dataKey="produced" name="Produced" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#live-production)" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmpty message="Production reports will appear here after a Hub Manager saves output." />}
        </Panel>

        <Panel
          title="Hub output"
          description="Produced versus remaining assigned units"
          action={<Link to="/hubs" className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open hubs <ArrowUpRight className="size-3" /></Link>}
        >
          {hubOutput.length ? (
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hubOutput} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="hub" width={74} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartStyle} formatter={(value, name) => [`${num(Number(value))} units`, name === "produced" ? "Produced" : "Remaining"]} />
                  <Bar dataKey="produced" name="Produced" stackId="units" fill="#2563eb" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="remaining" name="Remaining" stackId="units" fill="#dbeafe" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmpty message="Hub output will appear after production targets are assigned." />}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Critical shortages"
          description="Live BOM requirement compared with SubHub stock"
          className="xl:col-span-2"
          action={<Link to="/shortages" className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open shortages <ArrowUpRight className="size-3" /></Link>}
        >
          {criticalShortages.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Material</th>
                    <th className="px-5 py-2.5 font-medium">Code</th>
                    <th className="px-5 py-2.5 font-medium">SubHub</th>
                    <th className="px-5 py-2.5 text-right font-medium">Stock / required</th>
                    <th className="px-5 py-2.5 text-right font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalShortages.map((row) => (
                    <tr key={`${row.hub}-${row.code}`} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-2.5 font-medium">{row.name}</td>
                      <td className="tabular px-5 py-2.5 text-xs text-muted-foreground">{row.code}</td>
                      <td className="px-5 py-2.5"><Tag tone="info">{row.hub}</Tag></td>
                      <td className="tabular px-5 py-2.5 text-right text-xs text-muted-foreground">{num(row.stock)} / {num(row.required)}</td>
                      <td className="tabular px-5 py-2.5 text-right font-semibold text-destructive">−{num(row.gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">{data.shortages.totalParts ? "No shortage is currently recorded." : "Shortages will appear after production orders and inventory are entered."}</div>}
        </Panel>

        <Panel title="Procurement status" description="Open and delivered purchase orders">
          {procurementStatus.length ? (
            <div className="h-56 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={procurementStatus} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={4}>
                    {procurementStatus.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index]} />)}
                  </Pie>
                  <Tooltip contentStyle={chartStyle} formatter={(value) => [num(Number(value)), "Orders"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                {procurementStatus.map((entry, index) => <span key={entry.name} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} />{entry.name}: {num(entry.value)}</span>)}
              </div>
            </div>
          ) : <ChartEmpty message="Procurement orders will appear here after vendors and purchase orders are added." />}
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Committed open spend: <span className="font-semibold text-foreground">{inr(data.procurement.summary.committedSpend)}</span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Inventory by SubHub"
          description={`Raw material ${num(data.inventory.rawMaterialUnits)} · final product ${num(data.inventory.finalProductUnits)}`}
          className="xl:col-span-2"
          action={<Link to="/inventory" className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open inventory <ArrowUpRight className="size-3" /></Link>}
        >
          {stockByHub.length ? (
            <div className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockByHub} margin={{ top: 20, right: 12, left: 0, bottom: 30 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={50} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={chartStyle} formatter={(value) => [`${num(Number(value))} units`, "Stock"]} />
                  <Bar dataKey="units" name="Stock" fill="#0f6b99" radius={[5, 5, 0, 0]}>
                    <LabelList dataKey="units" position="top" formatter={(value: number) => num(value)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmpty message="Inventory will appear after raw materials or final products are received." />}
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Total stock value: <span className="font-semibold text-foreground">{inr(data.inventory.totalValue)}</span> · Last update: <span className="font-semibold text-foreground">{formatDate(data.inventory.lastUpdated)}</span>
          </div>
        </Panel>

        <Panel title="Workforce & quality" description={`${data.hr.month || "Current period"} attendance and inventory quality`}>
          <div className="grid grid-cols-2 gap-3 p-5">
            <SummaryTile icon={<Users className="size-4" />} label="Employees" value={num(workforce.employees)} detail={`${num(workforce.present)} present marks`} />
            <SummaryTile icon={<PackageCheck className="size-4" />} label="Quality records" value={num(data.quality.summary.records)} detail={`${num(data.quality.summary.rejectedUnits)} rejected units`} />
            <SummaryTile icon={<Factory className="size-4" />} label="Capacity" value={configuredCapacity ? num(configuredCapacity) : "No limit"} detail={`${production.hubs.filter((hub) => hub.capacityUnits !== null).length} hubs configured`} />
            <SummaryTile icon={<ClipboardList className="size-4" />} label="Quality rate" value={`${qualityRate}%`} detail={`${data.quality.summary.subhubsWithIssues} SubHubs with issues`} />
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Attendance marks: {num(attendanceRecords)} · Present {num(workforce.present)} · Absent {num(workforce.absent)} · Late {num(workforce.late)}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Data freshness" description="Latest inventory update per active SubHub">
          {freshness.length ? (
            <ul className="divide-y divide-border">
              {freshness.map((hub) => (
                <li key={hub.userId} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{hub.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(hub.lastUpdated)}</span>
                </li>
              ))}
            </ul>
          ) : <div className="flex min-h-36 items-center justify-center px-5 text-center text-sm text-muted-foreground">No inventory updates have been recorded.</div>}
        </Panel>

        <Panel title="BOM & master data" description="Configured production catalog">
          <div className="grid grid-cols-3 divide-x divide-border p-5 text-center">
            <SummaryTile icon={<Boxes className="mx-auto size-4" />} label="Product families" value={num(data.bom.productFamilies)} />
            <SummaryTile icon={<PackageCheck className="mx-auto size-4" />} label="Variants" value={num(data.bom.variants)} />
            <SummaryTile icon={<ShoppingCart className="mx-auto size-4" />} label="Materials" value={num(data.bom.materials)} />
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">BOM figures are from the configured master catalog; operational totals above are live MongoDB data.</div>
        </Panel>

        <Panel title="Assigned orders" description="Orders needing operational attention" action={<Link to="/orders" className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open orders <ArrowUpRight className="size-3" /></Link>}>
          {production.orders.length ? (
            <ul className="divide-y divide-border">
              {production.orders.slice(0, 5).map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-5 py-3">
                  <ClipboardList className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{order.orderNumber} · {order.variantName}</p>
                    <p className="text-xs text-muted-foreground">{order.subhubName} · due {formatShortDate(order.dueDate)}</p>
                  </div>
                  <Tag tone={order.status === "Complete" ? "good" : order.status === "Over target" ? "info" : "warn"}>{order.status}</Tag>
                </li>
              ))}
            </ul>
          ) : <div className="flex min-h-36 items-center justify-center px-5 text-center text-sm text-muted-foreground">No production orders have been assigned.</div>}
        </Panel>
      </div>

      <div className="panel flex items-start gap-3 border-l-4 border-l-primary p-5">
        <AlertTriangle className="mt-0.5 size-5 text-primary" />
        <div>
          <p className="text-sm font-medium">Live dashboard</p>
          <p className="text-sm text-muted-foreground">
            This overview is calculated from the current orders, SubHub workspaces, inventory, procurement, HR, quality, and BOM records. Empty sections stay empty until data is entered through their respective modules.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function SummaryTile({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="p-2">
      <div className="text-primary">{icon}</div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}