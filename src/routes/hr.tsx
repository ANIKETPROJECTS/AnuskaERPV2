import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { BarChart3, CalendarCheck, CalendarDays, Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { getAdminHeadcountReportFn } from "@/hr";
import type { AdminHeadcountReport, AdminHeadcountSummary } from "@/hr.server";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — Admin · Gadsons ERP" }] }),
  component: AdminHr,
});

type ReportView = "date" | "range" | "month";

const emptyReport: AdminHeadcountReport = {
  startDate: "",
  endDate: "",
  subhubs: [],
  summaries: [],
  entries: [],
};

function currentDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AdminHr() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/hr") return <Outlet />;
  return <AdminHrPage />;
}

function AdminHrPage() {
  const [view, setView] = useState<ReportView>("date");
  const [date, setDate] = useState(currentDate);
  const [startDate, setStartDate] = useState(currentDate);
  const [endDate, setEndDate] = useState(currentDate);
  const [month, setMonth] = useState(() => currentDate().slice(0, 7));
  const [report, setReport] = useState<AdminHeadcountReport>(emptyReport);
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    setLoading(true);
    setError("");
    try {
      const result = await getAdminHeadcountReportFn({
        data: view === "date"
          ? { rangeType: "date", date }
          : view === "range"
            ? { rangeType: "range", startDate, endDate }
            : { rangeType: "month", month },
      });
      if (result.ok) setReport(result.data);
      else {
        setReport(emptyReport);
        setError(result.message);
      }
    } catch {
      setReport(emptyReport);
      setError("The headcount report could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [date, endDate, month, startDate, view]);

  const filteredSummaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return report.summaries
      .filter((row) => (subhubFilter === "all" || row.subhubId === subhubFilter)
        && (!query || `${row.subhubName} ${row.subhubManagerName}`.toLowerCase().includes(query)))
      .sort((left, right) => right.totalPresent - left.totalPresent || left.subhubName.localeCompare(right.subhubName));
  }, [report.summaries, search, subhubFilter]);

  const filteredEntries = useMemo(
    () => report.entries.filter((entry) => subhubFilter === "all" || entry.subhubId === subhubFilter),
    [report.entries, subhubFilter],
  );

  const totals = useMemo(() => ({
    totalPresent: report.entries.reduce((total, entry) => total + entry.presentCount, 0),
    reportedDays: report.entries.length,
    averagePresent: report.entries.length
      ? Math.round((report.entries.reduce((total, entry) => total + entry.presentCount, 0) / report.entries.length) * 10) / 10
      : 0,
  }), [report.entries]);

  function exportReport() {
    downloadCsv(`headcount-${report.startDate || "report"}-to-${report.endDate || "today"}.csv`, [
      ["Date", "SubHub", "SubHub manager", "People present"],
      ...filteredEntries.map((entry) => [entry.date, entry.subhubName, entry.subhubManagerName, entry.presentCount]),
    ]);
  }

  const periodLabel = report.startDate
    ? report.startDate === report.endDate ? formatDate(report.startDate) : `${formatDate(report.startDate)} – ${formatDate(report.endDate)}`
    : "selected period";

  return (
    <Shell title="HR & Attendance" subtitle="Review daily present headcount reported by every active SubHub.">
      <div className="space-y-6">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarCheck className="size-5" /></div>
              <div>
                <h2 className="font-semibold">Present headcount report</h2>
                <p className="mt-1 text-sm text-muted-foreground">Reports use only the daily number entered by each SubHub Manager.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium">
                Report view
                <select value={view} onChange={(event) => setView(event.target.value as ReportView)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal">
                  <option value="date">Specific date</option>
                  <option value="range">Date range</option>
                  <option value="month">Month</option>
                </select>
              </label>
              {view === "date" ? <label className="text-xs font-medium">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label> : null}
              {view === "range" ? <><label className="text-xs font-medium">From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label><label className="text-xs font-medium">To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label></> : null}
              {view === "month" ? <label className="text-xs font-medium">Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label> : null}
              <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm disabled:opacity-50"><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
              <button type="button" onClick={exportReport} disabled={!filteredEntries.length} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"><Download className="size-4" /> Export CSV</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-4">
            {([["date", "Daily"], ["range", "Date range"], ["month", "Monthly"]] as Array<[ReportView, string]>).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setView(value)} className={`rounded-md px-3 py-2 text-sm font-medium ${view === value ? "bg-primary text-primary-foreground" : "border border-input bg-card text-muted-foreground hover:bg-muted"}`}>{label}</button>
            ))}
          </div>
        </section>

        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Active SubHubs" value={String(report.subhubs.length)} />
          <Metric label="Total reported presence" value={String(totals.totalPresent)} tone="success" />
          <Metric label="Reported days" value={String(totals.reportedDays)} />
          <Metric label="Average per reported day" value={String(totals.averagePresent)} tone="primary" />
        </div>

        <section className="panel overflow-hidden">
          <div className="filter-toolbar border-b border-border bg-muted/10 px-5 py-4">
            <label className="min-w-56 flex-1 text-xs font-medium">
              Search SubHub or manager
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" />
            </label>
            <label className="text-xs font-medium">
              SubHub
              <select value={subhubFilter} onChange={(event) => setSubhubFilter(event.target.value)} className="mt-1.5 h-9 min-w-52 rounded-md border border-input bg-background px-3 text-sm font-normal">
                <option value="all">All active SubHubs</option>
                {report.subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{periodLabel}</span>
            <span>{filteredSummaries.length} of {report.summaries.length} SubHubs visible</span>
          </div>
          {loading ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Loading headcount report…</p>
          ) : !report.summaries.length ? (
            <Empty icon={<CalendarDays className="mx-auto size-8" />} title="No active SubHubs found" detail="Active SubHub workspaces will appear here." />
          ) : !filteredSummaries.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No SubHubs match the current filters.</p>
          ) : (
            <SummaryTable rows={filteredSummaries} singleDate={view === "date"} />
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-start gap-3">
              <BarChart3 className="mt-0.5 size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Daily entries</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every saved headcount record in {periodLabel}.</p>
              </div>
            </div>
          </div>
          {!filteredEntries.length ? (
            <Empty icon={<CalendarDays className="mx-auto size-8" />} title="No headcount recorded" detail="The report will populate when SubHub Managers save their daily count." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 font-medium">SubHub manager</th><th className="px-5 py-3 text-right font-medium">People present</th></tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => <tr key={`${entry.subhubId}:${entry.date}`} className="border-b border-border/70 last:border-0"><td className="px-5 py-3 font-medium">{formatDate(entry.date)}</td><td className="px-5 py-3">{entry.subhubName}</td><td className="px-5 py-3 text-muted-foreground">{entry.subhubManagerName}</td><td className="tabular px-5 py-3 text-right font-semibold text-success">{entry.presentCount}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="text-xs text-muted-foreground">Reports are read-only in Admin. Daily headcount entries are managed inside each SubHub workspace.</p>
      </div>
    </Shell>
  );
}

function SummaryTable({ rows, singleDate }: { rows: AdminHeadcountSummary[]; singleDate: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 font-medium">SubHub manager</th><th className="px-5 py-3 text-right font-medium">{singleDate ? "Present today" : "Total present"}</th><th className="px-5 py-3 text-right font-medium">{singleDate ? "Reported" : "Average present"}</th><th className="px-5 py-3 text-right font-medium">Reported days</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => <tr key={row.subhubId} className="border-b border-border/70 last:border-0"><td className="px-5 py-3 font-medium">{row.subhubName}</td><td className="px-5 py-3 text-muted-foreground">{row.subhubManagerName}</td><td className="tabular px-5 py-3 text-right font-semibold text-success">{singleDate ? row.totalPresent || "—" : row.totalPresent}</td><td className="tabular px-5 py-3 text-right text-muted-foreground">{singleDate ? row.reportedDays ? "Yes" : "Not reported" : row.averagePresent || "—"}</td><td className="tabular px-5 py-3 text-right">{row.reportedDays}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, tone = "foreground" }: { label: string; value: string; tone?: "foreground" | "success" | "primary" }) {
  return <div className="panel p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`tabular mt-2 text-2xl font-semibold ${tone === "foreground" ? "" : `text-${tone}`}`}>{value}</p></div>;
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="p-10 text-center text-muted-foreground">{icon}<p className="mt-3 font-medium text-foreground">{title}</p><p className="mt-1 text-sm">{detail}</p></div>;
}