import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HeadcountDateTotal } from "@/lib/admin-headcount-report";
import { num } from "@/lib/erp-data";
import type {
  AdminProductionHistoryRow,
  ProductionOrder,
} from "@/production.server";
import { Panel, Tag } from "@/components/erp/bits";

export const productionViews = [
  { id: "output", label: "Daily output" },
  { id: "subhubs", label: "SubHub comparison" },
  { id: "workforce", label: "Workforce presence" },
  { id: "orders", label: "Order progress" },
  { id: "reports", label: "Production log" },
] as const;

export type ProductionView = (typeof productionViews)[number]["id"];

export type DailyOutputPoint = {
  date: string;
  quantity: number;
  reports: number;
};

export type SubhubOutputPoint = {
  id: string;
  name: string;
  managerName: string;
  quantity: number;
  reports: number;
  latestDate: string;
};

export function ProductionWorkforcePanels({
  activeView,
  rangeLabel,
  productionReportCount,
  dailyOutput,
  subhubOutput,
  headcountLoading,
  headcountError,
  dailyHeadcount,
  presentTotal,
  headcountSubhubs,
  visibleOrders,
  filteredOrderCount,
  orderPage,
  orderPageCount,
  onOrderPageChange,
  periodQuantityByOrder,
  visibleReports,
  filteredReportCount,
  reportPage,
  reportPageCount,
  onReportPageChange,
}: {
  activeView: ProductionView;
  rangeLabel: string;
  productionReportCount: number;
  dailyOutput: DailyOutputPoint[];
  subhubOutput: SubhubOutputPoint[];
  headcountLoading: boolean;
  headcountError: string;
  dailyHeadcount: HeadcountDateTotal[];
  presentTotal: number;
  headcountSubhubs: number;
  visibleOrders: ProductionOrder[];
  filteredOrderCount: number;
  orderPage: number;
  orderPageCount: number;
  onOrderPageChange: (page: number) => void;
  periodQuantityByOrder: ReadonlyMap<string, number>;
  visibleReports: AdminProductionHistoryRow[];
  filteredReportCount: number;
  reportPage: number;
  reportPageCount: number;
  onReportPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-5">
      <section
        id="production-panel-output"
        role="tabpanel"
        aria-labelledby="production-tab-output"
        tabIndex={0}
        hidden={activeView !== "output"}
      >
        <Panel
          title="Combined daily output"
          description={`Reported finished units per day · ${rangeLabel} · ${num(productionReportCount)} production reports`}
        >
          {dailyOutput.length === 0 ? (
            <EmptyState text="No production output matches these filters." />
          ) : (
            <div className="h-[340px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyOutput} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    stroke="var(--color-muted-foreground)"
                    fontSize={13}
                    minTickGap={24}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatNumber}
                    stroke="var(--color-muted-foreground)"
                    fontSize={13}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => formatFullDate(String(label))}
                    formatter={(value) => [`${formatNumber(value)} units`, "Output"]}
                  />
                  <Bar dataKey="quantity" name="Units produced" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <p className="mt-3 text-sm text-muted-foreground">
          Output is combined from saved production reports. No worker-level production figures are used.
        </p>
      </section>

      <section
        id="production-panel-subhubs"
        role="tabpanel"
        aria-labelledby="production-tab-subhubs"
        tabIndex={0}
        hidden={activeView !== "subhubs"}
      >
        <Panel
          title="Output by SubHub"
          description={`Combined units and report counts · ${rangeLabel}`}
        >
          {subhubOutput.length === 0 ? (
            <EmptyState text="No SubHub output matches these filters." />
          ) : (
            <>
              <div className="h-[360px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subhubOutput} layout="vertical" margin={{ top: 8, right: 20, left: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis
                      type="number"
                      dataKey="quantity"
                      tickFormatter={formatNumber}
                      stroke="var(--color-muted-foreground)"
                      fontSize={13}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      stroke="var(--color-muted-foreground)"
                      fontSize={14}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-muted)" }}
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${formatNumber(value)} units`, "Output"]}
                    />
                    <Bar dataKey="quantity" name="Units produced" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full min-w-[720px] text-base">
                  <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">SubHub</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Manager</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Reports</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Units produced</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Latest report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subhubOutput.map((hub) => (
                      <tr key={hub.id}>
                        <th scope="row" className="px-4 py-4 text-left font-semibold">{hub.name}</th>
                        <td className="px-4 py-4 text-muted-foreground">{hub.managerName}</td>
                        <td className="tabular px-4 py-4 text-right">{num(hub.reports)}</td>
                        <td className="tabular px-4 py-4 text-right font-semibold">{num(hub.quantity)}</td>
                        <td className="tabular px-4 py-4 text-right">{formatFullDate(hub.latestDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </section>

      <section
        id="production-panel-workforce"
        role="tabpanel"
        aria-labelledby="production-tab-workforce"
        tabIndex={0}
        hidden={activeView !== "workforce"}
        className="space-y-4"
      >
        {headcountError ? (
          <p role="alert" className="border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-base text-destructive">
            {headcountError}
          </p>
        ) : null}
        <Panel
          title="Combined present headcount"
          description={`Saved SubHub totals by date · ${rangeLabel} · Not individual attendance`}
        >
          {headcountLoading ? (
            <p className="p-6 text-center text-base text-muted-foreground">Loading headcount reports…</p>
          ) : dailyHeadcount.length === 0 ? (
            <EmptyState text="No saved headcount reports match these filters." />
          ) : (
            <>
              <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-border px-5 py-4 text-base">
                <p><span className="text-muted-foreground">Present counts across saved reports: </span><strong>{num(presentTotal)}</strong></p>
                <p><span className="text-muted-foreground">Dates recorded: </span><strong>{num(dailyHeadcount.length)}</strong></p>
                <p><span className="text-muted-foreground">SubHubs reporting: </span><strong>{num(headcountSubhubs)}</strong></p>
              </div>
              <div className="h-[320px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyHeadcount} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      stroke="var(--color-muted-foreground)"
                      fontSize={13}
                      minTickGap={24}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatNumber}
                      stroke="var(--color-muted-foreground)"
                      fontSize={13}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-muted)" }}
                      contentStyle={tooltipStyle}
                      labelFormatter={(label) => formatFullDate(String(label))}
                      formatter={(value) => [`${formatNumber(value)} present`, "Combined headcount"]}
                    />
                    <Bar dataKey="totalPresent" name="Present headcount" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
                Each bar sums saved present counts for reporting SubHubs on that date. Totals across dates are person-days, not unique people; missing reports are not treated as zero.
              </p>
            </>
          )}
        </Panel>
        {!headcountLoading && dailyHeadcount.length > 0 ? (
          <Panel title="Daily workforce summary" description="One aggregate record per SubHub and date">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Combined present</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">SubHubs reporting</th>
                    <th scope="col" className="px-4 py-3 font-semibold">SubHub totals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...dailyHeadcount].reverse().map((day) => (
                    <tr key={day.date}>
                      <th scope="row" className="tabular px-4 py-4 text-left font-semibold">{formatFullDate(day.date)}</th>
                      <td className="tabular px-4 py-4 text-right font-semibold">{num(day.totalPresent)}</td>
                      <td className="tabular px-4 py-4 text-right">{num(day.subhubCount)}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {day.entries.map((entry) => `${entry.subhubName}: ${num(entry.presentCount)}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Workforce presence uses aggregate headcount reports only; no worker names or individual attendance records are shown.
        </p>
      </section>

      <section
        id="production-panel-orders"
        role="tabpanel"
        aria-labelledby="production-tab-orders"
        tabIndex={0}
        hidden={activeView !== "orders"}
      >
        <Panel title="Current order progress" description={`Current lifetime totals with output in ${rangeLabel} shown separately`}>
          {filteredOrderCount === 0 ? (
            <EmptyState text="No production orders match these filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-base">
                  <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                      <th scope="col" className="px-4 py-3 font-semibold">SubHub</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Product / variant</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Target</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Produced</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Remaining</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">In selected period</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/30">
                        <th scope="row" className="tabular whitespace-nowrap px-4 py-4 text-left font-semibold">{order.orderNumber}</th>
                        <td className="px-4 py-4">{order.subhubName}</td>
                        <td className="px-4 py-4">
                          <span className="block font-semibold">{order.productName}</span>
                          <span className="text-sm text-muted-foreground">{order.variantName} · {order.variantCode}</span>
                        </td>
                        <td className="tabular px-4 py-4 text-right">{num(order.target)}</td>
                        <td className="tabular px-4 py-4 text-right font-semibold">{num(order.produced)}</td>
                        <td className="tabular px-4 py-4 text-right">{num(order.remaining)}</td>
                        <td className="tabular px-4 py-4 text-right">{num(periodQuantityByOrder.get(order.id) ?? 0)}</td>
                        <td className="px-4 py-4"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={orderPage}
                pageCount={orderPageCount}
                total={filteredOrderCount}
                onPageChange={onOrderPageChange}
              />
            </>
          )}
        </Panel>
      </section>

      <section
        id="production-panel-reports"
        role="tabpanel"
        aria-labelledby="production-tab-reports"
        tabIndex={0}
        hidden={activeView !== "reports"}
      >
        <Panel
          title="Production report log"
          description={`${num(filteredReportCount)} reports match the selected date, SubHub, product, and search filters`}
        >
          {filteredReportCount === 0 ? (
            <EmptyState text="No production reports match these filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-base">
                  <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                      <th scope="col" className="px-4 py-3 font-semibold">SubHub</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Product / variant</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Units reported</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleReports.map((report) => (
                      <tr key={report.id}>
                        <td className="tabular whitespace-nowrap px-4 py-4">{formatFullDate(report.date)}</td>
                        <td className="px-4 py-4">{report.subhubName}</td>
                        <td className="tabular px-4 py-4 font-semibold">{report.orderNumber}</td>
                        <td className="px-4 py-4">
                          <span className="block font-semibold">{report.productName}</span>
                          <span className="text-sm text-muted-foreground">{report.variantName} · {report.variantCode}</span>
                        </td>
                        <td className="tabular px-4 py-4 text-right font-semibold">{num(report.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={reportPage}
                pageCount={reportPageCount}
                total={filteredReportCount}
                onPageChange={onReportPageChange}
              />
            </>
          )}
        </Panel>
      </section>
    </div>
  );
}

function TablePager({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const first = total ? page * 20 + 1 : 0;
  const last = Math.min(total, (page + 1) * 20);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">Showing {first}–{last} of {num(total)}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          className="min-h-9 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Previous
        </button>
        <span className="flex min-h-9 items-center px-2 text-sm text-muted-foreground">
          Page {page + 1} of {pageCount}
        </span>
        <button
          type="button"
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
          className="min-h-9 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-base text-muted-foreground">{text}</p>;
}

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-IN");
}

function formatShortDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatFullDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function statusTone(status: ProductionOrder["status"]): "good" | "warn" | "neutral" {
  if (status === "Complete" || status === "Over target") return "good";
  if (status === "In progress") return "warn";
  return "neutral";
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  fontSize: 14,
};