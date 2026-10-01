import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getAdminProductionWorkforceDataFn } from "@/production";
import type {
  AdminProductionHistoryRow,
  AdminProductionWorkforceData,
  ProductionOrder,
} from "@/production.server";
import { HubModuleNav } from "@/components/erp/HubModuleNav";
import { Shell } from "@/components/erp/Shell";
import { num } from "@/lib/erp-data";
import {
  groupHeadcountByDate,
  todayInIndia,
  useAdminHeadcountReport,
  type HeadcountDateRange,
} from "@/lib/admin-headcount-report";
import {
  ProductionWorkforcePanels,
  productionViews,
  type DailyOutputPoint,
  type ProductionView,
  type SubhubOutputPoint,
} from "@/components/erp/ProductionWorkforcePanels";

type ProductionFilters = HeadcountDateRange & {
  subhubId: string;
  productCode: string;
  search: string;
};

type DatePreset = "7d" | "30d" | "month" | "all";

const pageSize = 20;
const fieldClass =
  "min-h-11 rounded-md border border-input bg-background px-3 text-base text-foreground";

function dateRangeFor(preset: DatePreset): HeadcountDateRange {
  if (preset === "all") return { startDate: "", endDate: "" };
  const endDate = todayInIndia();
  const start = new Date(`${endDate}T00:00:00.000Z`);
  if (preset === "7d") start.setUTCDate(start.getUTCDate() - 6);
  else if (preset === "30d") start.setUTCDate(start.getUTCDate() - 29);
  else start.setUTCDate(1);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

const defaultDateRange = dateRangeFor("30d");
const initialFilters: ProductionFilters = {
  ...defaultDateRange,
  subhubId: "all",
  productCode: "all",
  search: "",
};

function formatFullDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function describeRange(range: HeadcountDateRange) {
  if (!range.startDate && !range.endDate) return "All saved dates";
  if (range.startDate && range.endDate && range.startDate === range.endDate) {
    return formatFullDate(range.startDate);
  }
  return `${range.startDate ? formatFullDate(range.startDate) : "Earliest"} – ${range.endDate ? formatFullDate(range.endDate) : "Latest"}`;
}

function filterMatches(row: AdminProductionHistoryRow, filters: ProductionFilters) {
  if (filters.startDate && row.date < filters.startDate) return false;
  if (filters.endDate && row.date > filters.endDate) return false;
  if (filters.subhubId !== "all" && row.subhubUserId !== filters.subhubId) return false;
  if (filters.productCode !== "all" && row.productCode !== filters.productCode) return false;
  const query = filters.search.trim().toLowerCase();
  if (!query) return true;
  return [
    row.orderNumber,
    row.productName,
    row.variantName,
    row.variantCode,
    row.subhubName,
  ].join(" ").toLowerCase().includes(query);
}

function orderMatches(order: ProductionOrder, filters: ProductionFilters) {
  if (filters.subhubId !== "all" && order.subhubUserId !== filters.subhubId) return false;
  if (filters.productCode !== "all" && order.productCode !== filters.productCode) return false;
  const query = filters.search.trim().toLowerCase();
  if (!query) return true;
  return [
    order.orderNumber,
    order.productName,
    order.variantName,
    order.variantCode,
    order.subhubName,
  ].join(" ").toLowerCase().includes(query);
}

function ProductionWorkforceDashboard() {
  const [data, setData] = useState<AdminProductionWorkforceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<ProductionView>("output");
  const [filters, setFilters] = useState<ProductionFilters>(() => ({ ...initialFilters }));
  const [appliedFilters, setAppliedFilters] = useState<ProductionFilters>(() => ({ ...initialFilters }));
  const [selectedPreset, setSelectedPreset] = useState<DatePreset | null>("30d");
  const [filterError, setFilterError] = useState("");
  const [orderPage, setOrderPage] = useState(0);
  const [reportPage, setReportPage] = useState(0);
  const {
    report: headcountReport,
    loading: headcountLoading,
    error: headcountError,
    applyRange,
  } = useAdminHeadcountReport(defaultDateRange);

  const loadProduction = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminProductionWorkforceDataFn();
      if (result.ok) {
        setData(result.data);
        setOrderPage(0);
        setReportPage(0);
        setError("");
      } else {
        setError(result.message);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Production data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProduction();
  }, [loadProduction]);

  const filteredReports = useMemo(
    () => (data?.reports ?? []).filter((row) => filterMatches(row, appliedFilters)),
    [data, appliedFilters],
  );

  const dailyOutput = useMemo<DailyOutputPoint[]>(() => {
    const grouped = new Map<string, DailyOutputPoint>();
    filteredReports.forEach((row) => {
      const point = grouped.get(row.date) ?? { date: row.date, quantity: 0, reports: 0 };
      point.quantity += row.quantity;
      point.reports += 1;
      grouped.set(row.date, point);
    });
    return [...grouped.values()].sort((left, right) => left.date.localeCompare(right.date));
  }, [filteredReports]);

  const subhubOutput = useMemo<SubhubOutputPoint[]>(() => {
    const grouped = new Map<string, SubhubOutputPoint>();
    const managers = new Map((data?.subhubs ?? []).map((hub) => [hub.id, hub.managerName]));
    filteredReports.forEach((row) => {
      const point = grouped.get(row.subhubUserId) ?? {
        id: row.subhubUserId,
        name: row.subhubName,
        managerName: managers.get(row.subhubUserId) ?? "—",
        quantity: 0,
        reports: 0,
        latestDate: row.date,
      };
      point.quantity += row.quantity;
      point.reports += 1;
      if (row.date > point.latestDate) point.latestDate = row.date;
      grouped.set(row.subhubUserId, point);
    });
    return [...grouped.values()].sort((left, right) => right.quantity - left.quantity);
  }, [data, filteredReports]);

  const productOptions = useMemo(() => {
    const products = new Map<string, string>();
    (data?.orders ?? []).forEach((order) => products.set(order.productCode, order.productName));
    (data?.reports ?? []).forEach((report) => products.set(report.productCode, report.productName));
    return [...products.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [data]);

  const filteredOrders = useMemo(
    () => (data?.orders ?? []).filter((order) => orderMatches(order, appliedFilters)),
    [data, appliedFilters],
  );

  const periodQuantityByOrder = useMemo(() => {
    const totals = new Map<string, number>();
    filteredReports.forEach((report) => {
      totals.set(report.orderId, (totals.get(report.orderId) ?? 0) + report.quantity);
    });
    return totals;
  }, [filteredReports]);

  const headcountEntries = useMemo(
    () => headcountReport.entries.filter(
      (entry) => appliedFilters.subhubId === "all" || entry.subhubId === appliedFilters.subhubId,
    ),
    [headcountReport.entries, appliedFilters.subhubId],
  );
  const dailyHeadcount = useMemo(
    () => groupHeadcountByDate(headcountEntries).sort((left, right) => left.date.localeCompare(right.date)),
    [headcountEntries],
  );
  const presentTotal = headcountEntries.reduce((sum, entry) => sum + entry.presentCount, 0);
  const headcountSubhubs = new Set(headcountEntries.map((entry) => entry.subhubId)).size;

  const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const reportPageCount = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const visibleOrders = filteredOrders.slice(orderPage * pageSize, (orderPage + 1) * pageSize);
  const visibleReports = filteredReports.slice(reportPage * pageSize, (reportPage + 1) * pageSize);

  function commitFilters(next: ProductionFilters, preset: DatePreset | null) {
    if (Boolean(next.startDate) !== Boolean(next.endDate)) {
      setFilterError("Choose both dates, or clear both dates to view all time.");
      return;
    }
    if (next.startDate && next.endDate && next.startDate > next.endDate) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }
    setFilterError("");
    setFilters(next);
    setAppliedFilters(next);
    setSelectedPreset(preset ?? (!next.startDate && !next.endDate ? "all" : null));
    setOrderPage(0);
    setReportPage(0);
    applyRange({ startDate: next.startDate, endDate: next.endDate });
  }

  function choosePreset(preset: DatePreset) {
    const range = dateRangeFor(preset);
    commitFilters({ ...filters, ...range }, preset);
  }

  function resetFilters() {
    commitFilters({ ...initialFilters }, "30d");
  }

  async function refresh() {
    applyRange({
      startDate: appliedFilters.startDate,
      endDate: appliedFilters.endDate,
    });
    await loadProduction();
  }

  const productionFiltersVisible = activeView !== "workforce";
  const rangeLabel = describeRange(appliedFilters);

  return (
    <Shell
      title="Production & Workforce"
      subtitle="Combined production output and reported SubHub headcount"
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || headcountLoading}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 py-2 text-base font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading || headcountLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
      headerNav={
        <HubModuleNav
          active={activeView}
          ariaLabel="Production and workforce views"
          idPrefix="production"
          items={productionViews}
          onSelect={(view) => setActiveView(view)}
        />
      }
    >
      <div className="space-y-5">
        <section aria-label="Production and workforce filters" className="space-y-4 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { id: "7d", label: "Last 7 days" },
              { id: "30d", label: "Last 30 days" },
              { id: "month", label: "This month" },
              { id: "all", label: "All time" },
            ] as const).map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selectedPreset === preset.id}
                onClick={() => choosePreset(preset.id)}
                className={`min-h-10 rounded-md border px-3 text-base font-medium transition-colors ${
                  selectedPreset === preset.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">Applied: {rangeLabel}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              From
              <input
                aria-label="From date"
                type="date"
                max={todayInIndia()}
                value={filters.startDate}
                onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              To
              <input
                aria-label="To date"
                type="date"
                max={todayInIndia()}
                value={filters.endDate}
                onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              SubHub
              <select
                value={filters.subhubId}
                onChange={(event) => setFilters((current) => ({ ...current, subhubId: event.target.value }))}
                className={fieldClass}
              >
                <option value="all">All SubHubs</option>
                {(data?.subhubs ?? []).map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}{hub.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </label>
            {productionFiltersVisible ? (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Product
                  <select
                    value={filters.productCode}
                    onChange={(event) => setFilters((current) => ({ ...current, productCode: event.target.value }))}
                    className={fieldClass}
                  >
                    <option value="all">All products</option>
                    {productOptions.map((product) => (
                      <option key={product.code} value={product.code}>
                        {product.name} · {product.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Search
                  <input
                    type="search"
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Order, variant, or SubHub"
                    className={fieldClass}
                  />
                </label>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {filterError ? <p role="alert" className="text-sm text-destructive">{filterError}</p> : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-10 rounded-md border border-input px-4 text-base font-medium hover:bg-muted"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => commitFilters(filters, null)}
                className="min-h-10 rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Apply filters
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Product and search filters apply to production views. Workforce presence uses the date and SubHub filters.
          </p>
        </section>

        {error ? (
          <p role="alert" className="border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-base text-destructive">
            {error}
          </p>
        ) : null}
        {loading && !data ? <p className="py-8 text-center text-base text-muted-foreground">Loading production records…</p> : null}

        <ProductionWorkforcePanels
          activeView={activeView}
          rangeLabel={rangeLabel}
          productionReportCount={filteredReports.length}
          dailyOutput={dailyOutput}
          subhubOutput={subhubOutput}
          headcountLoading={headcountLoading}
          headcountError={headcountError}
          dailyHeadcount={dailyHeadcount}
          presentTotal={presentTotal}
          headcountSubhubs={headcountSubhubs}
          visibleOrders={visibleOrders}
          filteredOrderCount={filteredOrders.length}
          orderPage={orderPage}
          orderPageCount={orderPageCount}
          onOrderPageChange={setOrderPage}
          periodQuantityByOrder={periodQuantityByOrder}
          visibleReports={visibleReports}
          filteredReportCount={filteredReports.length}
          reportPage={reportPage}
          reportPageCount={reportPageCount}
          onReportPageChange={setReportPage}
        />
      </div>
    </Shell>
  );
}

export { ProductionWorkforceDashboard };