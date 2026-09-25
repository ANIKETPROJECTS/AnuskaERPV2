import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart, RefreshCw, Search, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { TablePagination } from "@/components/erp/TablePagination";
import { getManagerProductionDataFn } from "@/production";
import type { ManagerProductionData, ProductionOrder, ProductionReport } from "@/production.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/subhub/reports")({
  head: () => ({ meta: [{ title: "Hub Reports — SubHub · Float ERP" }] }),
  component: HubReports,
});

const emptyData: ManagerProductionData = {
  subhubName: "",
  orders: [],
  reports: [],
  capacityUnits: null,
  openUnits: 0,
  availableUnits: null,
  overloaded: false,
};

type ReportSortKey = "date-desc" | "date-asc" | "order-asc" | "quantity-desc" | "quantity-asc" | "updated-desc";

function reportOrderLabel(orderId: string, ordersById: Map<string, ProductionOrder>) {
  const order = ordersById.get(orderId);
  return order ? `${order.orderNumber} · ${order.variantName}` : `Archived order · ${orderId}`;
}

function HubReports() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<ReportSortKey>("date-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    setLoading(true);
    const result = await getManagerProductionDataFn();
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
  }, []);

  const ordersById = useMemo(() => new Map(data.orders.map((order) => [order.id, order])), [data.orders]);
  const reportOrderIds = useMemo(
    () => [...new Set(data.reports.map((report) => report.orderId))]
      .sort((left, right) => reportOrderLabel(left, ordersById).localeCompare(reportOrderLabel(right, ordersById))),
    [data.reports, ordersById],
  );
  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const matchingReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.reports
      .filter((report) => {
        if (dateRangeInvalid) return false;
        if (dateFrom && report.date < dateFrom) return false;
        if (dateTo && report.date > dateTo) return false;
        if (orderFilter !== "all" && report.orderId !== orderFilter) return false;
        if (!query) return true;
        const order = ordersById.get(report.orderId);
        const searchText = [
          report.date,
          report.orderId,
          report.quantity,
          report.notes,
          report.updatedAt,
          order?.orderNumber,
          order?.productName,
          order?.variantName,
          order?.variantCode,
        ].join(" ").toLowerCase();
        return searchText.includes(query);
      })
      .sort((left, right) => {
        const dateOrder = left.date.localeCompare(right.date) || left.id.localeCompare(right.id);
        switch (sortBy) {
          case "date-asc":
            return dateOrder;
          case "order-asc":
            return reportOrderLabel(left.orderId, ordersById).localeCompare(reportOrderLabel(right.orderId, ordersById)) || -dateOrder;
          case "quantity-desc":
            return right.quantity - left.quantity || -dateOrder;
          case "quantity-asc":
            return left.quantity - right.quantity || -dateOrder;
          case "updated-desc":
            return right.updatedAt.localeCompare(left.updatedAt) || -dateOrder;
          case "date-desc":
          default:
            return -dateOrder;
        }
      });
  }, [data.reports, dateFrom, dateRangeInvalid, dateTo, orderFilter, ordersById, search, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, orderFilter, pageSize, search, sortBy]);

  const pageCount = Math.max(1, Math.ceil(matchingReports.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageReports = matchingReports.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const target = data.orders.reduce((sum, order) => sum + order.target, 0);
  const produced = data.orders.reduce((sum, order) => sum + order.produced, 0);
  const completion = target ? Math.round((produced / target) * 100) : 0;

  function clearFilters() {
    setSearch("");
    setOrderFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("date-desc");
    setPage(1);
  }

  return (
    <SubHubShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SubHub / Hub Reports</p><h1 className="mt-2 text-xl font-semibold">Saved day reports</h1><p className="mt-1 text-sm text-muted-foreground">{data.subhubName || "Your workspace"} · search and review your saved production reports.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
      </header>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-3"><Stat icon={<TrendingUp className="size-5" />} label="Assigned target" value={num(target)} helper={`${data.orders.length} orders`} /><Stat icon={<FileBarChart className="size-5" />} label="Produced" value={num(produced)} helper="from saved day reports" /><Stat icon={<TrendingUp className="size-5" />} label="Completion" value={`${completion}%`} helper="against your target" /></div>
        <div className="panel">
          <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Order performance</h2><p className="mt-1 text-sm text-muted-foreground">Only orders assigned to {data.subhubName || "this SubHub"}.</p></div>
          {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading reports…</p> : data.orders.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No assigned orders yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Variant</th><th className="px-5 py-3 text-right font-medium">Target</th><th className="px-5 py-3 text-right font-medium">Produced</th><th className="px-5 py-3 text-right font-medium">Status</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-3"><p className="font-medium">{order.variantName}</p><p className="tabular text-xs text-muted-foreground">{order.orderNumber}</p></td><td className="tabular px-5 py-3 text-right">{num(order.target)}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(order.produced)}</td><td className="px-5 py-3 text-right text-xs">{order.status}</td></tr>)}</tbody></table></div>}
        </div>
        <div className="panel">
          <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Saved day reports</h2><p className="mt-1 text-sm text-muted-foreground">Filter and review reports stored in this SubHub workspace.</p></div>
          <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 xl:grid-cols-6">
            <label className="text-xs font-medium text-muted-foreground xl:col-span-2">Search reports
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, product, date, notes…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary" />
              </div>
            </label>
            <label className="text-xs font-medium text-muted-foreground">Order
              <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary">
                <option value="all">All orders</option>
                {reportOrderIds.map((orderId) => <option key={orderId} value={orderId}>{reportOrderLabel(orderId, ordersById)}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">From date
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">To date
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">Sort by
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as ReportSortKey)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary">
                <option value="date-desc">Newest date</option>
                <option value="date-asc">Oldest date</option>
                <option value="order-asc">Order name</option>
                <option value="quantity-desc">Highest quantity</option>
                <option value="quantity-asc">Lowest quantity</option>
                <option value="updated-desc">Recently updated</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            {dateRangeInvalid ? <p role="alert" className="text-sm text-destructive">From date must be on or before the to date.</p> : <p className="text-sm text-muted-foreground">{num(matchingReports.length)} report{matchingReports.length === 1 ? "" : "s"} found</p>}
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-primary hover:underline">Clear filters</button>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading saved reports…</p> : matchingReports.length === 0 ? (
            <div className="p-8 text-center">
              <FileBarChart className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">{data.reports.length ? "No reports match these filters" : "No reports submitted yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{data.reports.length ? "Adjust the search or filters and try again." : "Use Daily production to save a day-end report."}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Order / variant</th><th className="px-5 py-3 text-right font-medium">Produced</th><th className="px-5 py-3 font-medium">Notes</th><th className="px-5 py-3 text-right font-medium">Updated</th></tr>
                  </thead>
                  <tbody>{pageReports.map((report: ProductionReport) => {
                    const order = ordersById.get(report.orderId);
                    return <tr key={report.id} className="border-b border-border/70 last:border-0">
                      <td className="tabular whitespace-nowrap px-5 py-3">{report.date}</td>
                      <td className="px-5 py-3">
                        {order ? <><p className="font-medium">{order.orderNumber}</p><p className="text-xs text-muted-foreground">{order.productName} · {order.variantName} · {order.variantCode}</p></> : <><p className="font-medium">Archived order</p><p className="text-xs text-muted-foreground">{report.orderId}</p></>}
                      </td>
                      <td className="tabular whitespace-nowrap px-5 py-3 text-right font-semibold">{num(report.quantity)}</td>
                      <td className="max-w-[280px] px-5 py-3 text-muted-foreground">{report.notes || "—"}</td>
                      <td className="tabular whitespace-nowrap px-5 py-3 text-right text-xs text-muted-foreground">{report.updatedAt.slice(0, 10)}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <TablePagination total={matchingReports.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50, 100]} />
            </>
          )}
        </div>
      </section>
    </SubHubShell>
  );
}

function Stat({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return <div className="rounded-xl border border-border bg-white p-4 shadow-sm"><div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div><p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}