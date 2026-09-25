import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Download, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { getAdminHeadcountReportFn } from "@/hr";
import type { AdminHeadcountReport, AdminHeadcountSummary } from "@/hr.server";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — Gadsons ERP" }] }),
  component: AdminHr,
});

type ReportView = "date" | "week" | "range" | "month";

const emptyReport: AdminHeadcountReport = {
  startDate: "",
  endDate: "",
  subhubs: [],
  summaries: [],
  entries: [],
  changes: [],
};

function currentDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
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
  return `"${String(value).replace(/"/g, '""')}"`;
}

function AdminHr() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.replace(/\/+$/, "") !== "/hr") return <Outlet />;
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = currentDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminHeadcountReportFn({
        data:
          view === "month"
            ? { rangeType: "month", month }
            : view === "range"
              ? { rangeType: "range", startDate, endDate }
              : { rangeType: view, date },
      });
      if (result.ok) {
        setReport(result.data);
      } else {
        setReport(emptyReport);
        setError(result.message);
      }
    } catch {
      setReport(emptyReport);
      setError("The HR report could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [date, endDate, month, startDate, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchesSubhub = (id: string) => subhubFilter === "all" || id === subhubFilter;
  const filteredSummaries = report.summaries.filter(
    (summary) =>
      matchesSubhub(summary.subhubId) &&
      (!normalizedQuery ||
        `${summary.subhubName} ${summary.subhubManagerName}`
          .toLowerCase()
          .includes(normalizedQuery)),
  );
  const filteredEntries = report.entries.filter(
    (entry) =>
      matchesSubhub(entry.subhubId) &&
      (!normalizedQuery ||
        `${entry.subhubName} ${entry.subhubManagerName}`.toLowerCase().includes(normalizedQuery)),
  );
  const peopleCount = filteredEntries.reduce((total, entry) => total + entry.presentCount, 0);
  const averagePerDay = filteredEntries.length
    ? Math.round(peopleCount / filteredEntries.length)
    : 0;
  const period = report.startDate
    ? report.startDate === report.endDate
      ? formatDate(report.startDate)
      : `${formatDate(report.startDate)} – ${formatDate(report.endDate)}`
    : "the selected dates";

  function exportCsv() {
    const rows = [
      ["Date", "SubHub", "Manager", "People present", "Last saved"],
      ...filteredEntries.map((entry) => [
        entry.date,
        entry.subhubName,
        entry.subhubManagerName,
        entry.presentCount,
        entry.updatedAt,
      ]),
    ];
    const contents = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `headcount-${report.startDate || date}-${report.endDate || date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell
      title="HR & Attendance"
      subtitle="Read-only report of the daily people count for each SubHub."
      actions={
        <Link
          to="/hr/history"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-white px-4 text-base font-semibold hover:bg-muted"
        >
          View history <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      }
    >
      <main className="space-y-4 px-6 pb-6">
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive"
          >
            {error}
          </p>
        ) : null}

        <section className="min-w-0">
          <header className="border-b border-border py-4">
            <h2 className="text-lg font-semibold">Present headcount</h2>
            <p className="mt-1 text-base text-muted-foreground">
              One total count for each SubHub and day. Admin can review these records but cannot
              change them.
            </p>
          </header>

          <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-border py-4 text-base">
            <span>
              <strong className="tabular">{filteredSummaries.length}</strong> SubHubs
            </span>
            <span>
              <strong className="tabular">{filteredEntries.length}</strong> daily entries
            </span>
            <span>
              <strong className="tabular">{peopleCount}</strong> people across saved days
            </span>
            <span>
              <strong className="tabular">{averagePerDay}</strong> average per saved day
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-b border-border py-4">
            <label className="w-full text-base font-medium text-muted-foreground sm:w-44">
              Show
              <select
                value={view}
                onChange={(event) => setView(event.target.value as ReportView)}
                className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
              >
                <option value="date">One day</option>
                <option value="week">One week</option>
                <option value="range">Date range</option>
                <option value="month">One month</option>
              </select>
            </label>
            {view === "date" || view === "week" ? (
              <label className="w-full text-base font-medium text-muted-foreground sm:w-48">
                Date
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
                />
              </label>
            ) : null}
            {view === "range" ? (
              <>
                <label className="w-full text-base font-medium text-muted-foreground sm:w-48">
                  From
                  <input
                    type="date"
                    value={startDate}
                    max={today}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
                  />
                </label>
                <label className="w-full text-base font-medium text-muted-foreground sm:w-48">
                  To
                  <input
                    type="date"
                    value={endDate}
                    max={today}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
                  />
                </label>
              </>
            ) : null}
            {view === "month" ? (
              <label className="w-full text-base font-medium text-muted-foreground sm:w-48">
                Month
                <input
                  type="month"
                  value={month}
                  max={today.slice(0, 7)}
                  onChange={(event) => setMonth(event.target.value)}
                  className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredEntries.length === 0}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-input bg-white px-4 text-base font-medium hover:bg-muted/40 disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-b border-border py-4">
            <label className="min-w-[220px] flex-1 text-base font-medium text-muted-foreground">
              Search
              <span className="relative mt-1 block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="SubHub or manager"
                  className="h-12 w-full rounded-md border border-input bg-white pl-9 pr-3 text-base font-normal text-foreground outline-none focus:border-primary"
                />
              </span>
            </label>
            <label className="w-full text-base font-medium text-muted-foreground sm:w-56">
              SubHub
              <select
                value={subhubFilter}
                onChange={(event) => setSubhubFilter(event.target.value)}
                className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
              >
                <option value="all">All SubHubs</option>
                {report.subhubs.map((subhub) => (
                  <option key={subhub.id} value={subhub.id}>
                    {subhub.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="border-b border-border py-3 text-base text-muted-foreground">
            Showing {period}
          </p>

          {loading ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              Loading headcount summary…
            </p>
          ) : filteredSummaries.length === 0 ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              No headcount entries found for this period.
            </p>
          ) : (
            <SummaryTable summaries={filteredSummaries} singleDate={view === "date"} />
          )}
        </section>
      </main>
    </Shell>
  );
}

function SummaryTable({
  summaries,
  singleDate,
}: {
  summaries: AdminHeadcountSummary[];
  singleDate: boolean;
}) {
  return (
    <div className="w-full overflow-x-auto border-b border-border">
      <table className="w-full min-w-[760px] text-base">
        <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">SubHub</th>
            <th className="px-4 py-3 font-semibold">Manager</th>
            {singleDate ? (
              <th className="px-4 py-3 text-center font-semibold">People present</th>
            ) : (
              <>
                <th className="px-4 py-3 text-center font-semibold">Days saved</th>
                <th className="px-4 py-3 text-center font-semibold">Total across days</th>
                <th className="px-4 py-3 text-center font-semibold">Average each day</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.subhubId} className="border-b border-border/70 last:border-0">
              <td className="px-4 py-4 font-medium">{summary.subhubName}</td>
              <td className="px-4 py-4 text-muted-foreground">
                {summary.subhubManagerName || "—"}
              </td>
              {singleDate ? (
                <td className="tabular px-4 py-4 text-center font-semibold">
                  {summary.reportedDays ? summary.totalPresent : "—"}
                </td>
              ) : (
                <>
                  <td className="tabular px-4 py-4 text-center">{summary.reportedDays}</td>
                  <td className="tabular px-4 py-4 text-center font-semibold">
                    {summary.totalPresent}
                  </td>
                  <td className="tabular px-4 py-4 text-center">{summary.averagePresent}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
