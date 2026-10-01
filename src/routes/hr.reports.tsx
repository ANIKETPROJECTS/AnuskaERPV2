import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminHeadcountFilters } from "@/components/erp/AdminHeadcountFilters";
import { AdminHeadcountMetrics } from "@/components/erp/AdminHeadcountMetrics";
import { AdminHrNavigation } from "@/components/erp/AdminHrNavigation";
import { Shell } from "@/components/erp/Shell";
import { TablePagination } from "@/components/erp/TablePagination";
import type { AdminHeadcountEntry } from "@/hr.server";
import {
  filterHeadcountReport,
  formatHeadcountDate,
  groupHeadcountByDate,
  sortHeadcountSummaries,
  useAdminHeadcountReport,
  type HeadcountDateRange,
} from "@/lib/admin-headcount-report";

export const Route = createFileRoute("/hr/reports")({
  validateSearch: (search: Record<string, unknown>) => ({
    subhubId: typeof search.subhubId === "string" ? search.subhubId : "all",
  }),
  head: () => ({ meta: [{ title: "Attendance reports — Gadsons ERP" }] }),
  component: AdminHeadcountReportsPage,
});

type Breakdown = "date" | "subhub";

function AdminHeadcountReportsPage() {
  const search = Route.useSearch();
  const { report, loading, error, appliedRange, applyRange } = useAdminHeadcountReport();
  const [range, setRange] = useState<HeadcountDateRange>({ startDate: "", endDate: "" });
  const [subhubFilter, setSubhubFilter] = useState(search.subhubId);
  const [breakdown, setBreakdown] = useState<Breakdown>("date");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setSubhubFilter(search.subhubId);
  }, [search.subhubId]);

  useEffect(() => {
    setPage(1);
  }, [appliedRange.endDate, appliedRange.startDate, breakdown, subhubFilter]);

  const filtered = filterHeadcountReport(report, subhubFilter);
  const dailyTotals = groupHeadcountByDate(filtered.entries);
  const summaries = sortHeadcountSummaries(filtered.summaries);
  const visibleDates = dailyTotals.slice((page - 1) * pageSize, page * pageSize);
  const period = describePeriod(appliedRange);

  return (
    <Shell title="HR & Attendance" subtitle="Attendance reports across selected SubHubs and dates.">
      <main className="space-y-5 px-4 pb-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Attendance reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare saved daily totals by date or by SubHub.
            </p>
          </div>
          <AdminHrNavigation active="reports" subhubId={subhubFilter} />
        </div>

        <AdminHeadcountFilters
          subhubs={report.subhubs}
          subhubId={subhubFilter}
          onSubhubChange={setSubhubFilter}
          range={range}
          onRangeChange={setRange}
          onApply={applyRange}
          loading={loading}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{period}</p>
          <p className="text-xs text-muted-foreground">
            Headcount is a daily total, not a list of individual people.
          </p>
        </div>

        <AdminHeadcountMetrics entries={filtered.entries} />

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h3 className="font-semibold">Breakdown</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {breakdown === "date"
                  ? "One count per SubHub and date. The final column adds selected hubs together."
                  : "Totals and averages for each selected SubHub."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Report breakdown"
                className="inline-flex rounded-md border border-border p-1"
              >
                <BreakdownButton active={breakdown === "date"} onClick={() => setBreakdown("date")}>
                  By date
                </BreakdownButton>
                <BreakdownButton
                  active={breakdown === "subhub"}
                  onClick={() => setBreakdown("subhub")}
                >
                  By SubHub
                </BreakdownButton>
              </div>
              <button
                type="button"
                onClick={() => downloadCsv(filtered.entries)}
                disabled={filtered.entries.length === 0}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-4" aria-hidden="true" />
                Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground" aria-live="polite">
              Loading attendance…
            </p>
          ) : breakdown === "date" ? (
            dailyTotals.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No attendance counts were recorded for these filters.
              </p>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Date
                        </th>
                        {summaries.map((summary) => (
                          <th
                            key={summary.subhubId}
                            scope="col"
                            className="whitespace-nowrap px-4 py-3 text-right font-semibold"
                          >
                            {summary.subhubName}
                          </th>
                        ))}
                        <th scope="col" className="px-4 py-3 text-right font-semibold">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDates.map((day) => {
                        const presentBySubhub = new Map(
                          day.entries.map((entry) => [entry.subhubId, entry.presentCount]),
                        );
                        return (
                          <tr key={day.date} className="border-b border-border/70 last:border-0">
                            <td className="whitespace-nowrap px-4 py-3 font-medium">
                              {formatHeadcountDate(day.date)}
                            </td>
                            {summaries.map((summary) => (
                              <td key={summary.subhubId} className="tabular px-4 py-3 text-right">
                                {presentBySubhub.get(summary.subhubId) ?? "—"}
                              </td>
                            ))}
                            <td className="tabular bg-muted/30 px-4 py-3 text-right font-semibold">
                              {day.totalPresent}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  total={dailyTotals.length}
                  page={page}
                  pageSize={pageSize}
                  showPageSizeSelect={false}
                  onPageChange={setPage}
                  onPageSizeChange={() => undefined}
                />
              </>
            )
          ) : summaries.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No SubHubs match the selected filter.
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      SubHub
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Manager
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Reports
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      People across days
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Average / report
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((summary) => (
                    <tr key={summary.subhubId} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 font-semibold">{summary.subhubName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {summary.subhubManagerName || "—"}
                      </td>
                      <td className="tabular px-4 py-3 text-right">{summary.reportedDays}</td>
                      <td className="tabular px-4 py-3 text-right font-semibold">
                        {summary.reportedDays ? summary.totalPresent : "—"}
                      </td>
                      <td className="tabular px-4 py-3 text-right">
                        {summary.reportedDays ? summary.averagePresent : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Daily counts are summed; they do not represent unique people across the period.
          </p>
          <Link
            to="/hr/history"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All saved entries
          </Link>
        </div>
      </main>
    </Shell>
  );
}

function BreakdownButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-8 rounded px-3 text-xs font-semibold ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function describePeriod(range: HeadcountDateRange) {
  if (!range.startDate && !range.endDate) return "All saved dates";
  const from = range.startDate ? formatHeadcountDate(range.startDate) : "Earliest record";
  const to = range.endDate ? formatHeadcountDate(range.endDate) : "Today";
  return `${from} – ${to}`;
}

function downloadCsv(entries: AdminHeadcountEntry[]) {
  if (entries.length === 0) return;
  const rows: Array<Array<string | number>> = [
    ["Date", "SubHub", "Manager", "Present", "Entered By", "Updated (IST)"],
    ...entries.map((entry) => [
      formatHeadcountDate(entry.date),
      entry.subhubName,
      entry.subhubManagerName || "",
      entry.presentCount,
      entry.recordedByName,
      formatRecordedAt(entry.updatedAt),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "attendance-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatRecordedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const formatted = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
  return `${formatted} IST`;
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
