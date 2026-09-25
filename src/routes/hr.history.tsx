import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { TablePagination } from "@/components/erp/TablePagination";
import { getAdminHeadcountReportFn } from "@/hr";
import type { AdminHeadcountReport } from "@/hr.server";

export const Route = createFileRoute("/hr/history")({
  head: () => ({ meta: [{ title: "Headcount history — Admin · Gadsons ERP" }] }),
  component: AdminHrHistoryPage,
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

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function AdminHrHistoryPage() {
  const [view, setView] = useState<ReportView>("week");
  const [date, setDate] = useState(currentDate);
  const [startDate, setStartDate] = useState(currentDate);
  const [endDate, setEndDate] = useState(currentDate);
  const [month, setMonth] = useState(() => currentDate().slice(0, 7));
  const [report, setReport] = useState<AdminHeadcountReport>(emptyReport);
  const [query, setQuery] = useState("");
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [changePage, setChangePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 25;
  const today = currentDate();

  const load = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
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
        setError("History could not be loaded. Please try again.");
      } finally {
        setLoading(false);
        if (showRefresh) setRefreshing(false);
      }
    },
    [date, endDate, month, startDate, view],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setChangePage(1);
  }, [date, endDate, month, query, startDate, subhubFilter, view]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchesSubhub = (id: string) => subhubFilter === "all" || id === subhubFilter;
  const filteredEntries = report.entries.filter(
    (entry) =>
      matchesSubhub(entry.subhubId) &&
      (!normalizedQuery ||
        `${entry.subhubName} ${entry.subhubManagerName}`.toLowerCase().includes(normalizedQuery)),
  );
  const filteredChanges = report.changes.filter(
    (change) =>
      matchesSubhub(change.subhubId) &&
      (!normalizedQuery ||
        `${change.subhubName} ${change.subhubManagerName} ${change.actorName} ${change.action} ${change.presentCount}`
          .toLowerCase()
          .includes(normalizedQuery)),
  );
  const visibleEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);
  const visibleChanges = filteredChanges.slice((changePage - 1) * pageSize, changePage * pageSize);
  const period = report.startDate
    ? report.startDate === report.endDate
      ? formatDate(report.startDate)
      : `${formatDate(report.startDate)} – ${formatDate(report.endDate)}`
    : "the selected dates";

  return (
    <Shell
      title="Headcount history"
      subtitle="Review daily counts and the changes made to them."
      actions={
        <Link
          to="/hr"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-white px-4 text-base font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to HR report
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
            <h2 className="text-lg font-semibold">Daily entries</h2>
            <p className="mt-1 text-base text-muted-foreground">
              The latest count saved for each day.
            </p>
          </header>

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
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-input bg-white px-4 text-base font-medium hover:bg-muted/40 disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh"}
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
                  placeholder="SubHub, manager, or person"
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

          <p className="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-base text-muted-foreground">
            <span>Showing {period}</span>
            <span>
              {filteredEntries.length} daily entries · {filteredChanges.length} changes
            </span>
          </p>

          {loading ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              Loading daily entries…
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              No daily entries for this period.
            </p>
          ) : (
            <>
              <div className="w-full overflow-x-auto border-b border-border">
                <table className="w-full min-w-[980px] text-base">
                  <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Date
                      </th>
                      <th className="px-4 py-3 font-semibold">Day</th>
                      <th className="px-4 py-3 font-semibold">SubHub</th>
                      <th className="px-4 py-3 font-semibold">Manager</th>
                      <th className="px-4 py-3 text-center font-semibold">People present</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Last saved
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((entry) => (
                      <tr
                        key={`${entry.subhubId}:${entry.date}`}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-4 py-4">{formatWeekday(entry.date)}</td>
                        <td className="px-4 py-4 font-medium">{entry.subhubName}</td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {entry.subhubManagerName}
                        </td>
                        <td className="tabular px-4 py-4 text-center font-semibold">
                          {entry.presentCount}
                        </td>
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                          {formatDateTime(entry.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                total={filteredEntries.length}
                page={page}
                pageSize={pageSize}
                showPageSizeSelect={false}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
              />
            </>
          )}
        </section>

        <section className="min-w-0">
          <header className="border-b border-border py-4">
            <h2 className="text-lg font-semibold">Change log</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Every time someone saves a count, it appears here.
            </p>
          </header>
          {loading ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              Loading changes…
            </p>
          ) : filteredChanges.length === 0 ? (
            <p className="border-b border-dashed border-border py-8 text-center text-base text-muted-foreground">
              No saved changes for this period.
            </p>
          ) : (
            <>
              <div className="w-full overflow-x-auto border-b border-border">
                <table className="w-full min-w-[1240px] text-base">
                  <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Date
                      </th>
                      <th className="px-4 py-3 font-semibold">SubHub</th>
                      <th className="px-4 py-3 font-semibold">Change</th>
                      <th className="px-4 py-3 text-center font-semibold">Before</th>
                      <th className="px-4 py-3 text-center font-semibold">After</th>
                      <th className="px-4 py-3 font-semibold">Changed by</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Saved at
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleChanges.map((change) => (
                      <tr key={change.id} className="border-b border-border/70 last:border-0">
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                          {formatDate(change.date)}
                        </td>
                        <td className="px-4 py-4 font-medium">{change.subhubName}</td>
                        <td className="px-4 py-4">
                          {change.action === "Created" ? "First count saved" : "Count changed"}
                        </td>
                        <td className="tabular px-4 py-4 text-center">
                          {change.previousPresentCount ?? "—"}
                        </td>
                        <td className="tabular px-4 py-4 text-center font-semibold">
                          {change.presentCount}
                        </td>
                        <td className="px-4 py-4">{change.actorName}</td>
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                          {formatDateTime(change.changedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                total={filteredChanges.length}
                page={changePage}
                pageSize={pageSize}
                showPageSizeSelect={false}
                onPageChange={setChangePage}
                onPageSizeChange={() => undefined}
              />
            </>
          )}
        </section>
      </main>
    </Shell>
  );
}
