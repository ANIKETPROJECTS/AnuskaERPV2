import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { TablePagination } from "@/components/erp/TablePagination";
import { getAdminHeadcountReportFn } from "@/hr";
import type { AdminHeadcountReport } from "@/hr.server";

export const Route = createFileRoute("/hr/history")({
  head: () => ({ meta: [{ title: "Headcount history — Admin · Gadsons ERP" }] }),
  component: AdminHrHistoryPage,
});

type ReportRequest =
  | { rangeType: "all" }
  | { rangeType: "range"; startDate?: string; endDate?: string };

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
  if (!value) return "Select a date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [report, setReport] = useState<AdminHeadcountReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const today = currentDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const request: ReportRequest =
      fromDate || toDate
        ? {
            rangeType: "range",
            ...(fromDate ? { startDate: fromDate } : {}),
            ...(toDate ? { endDate: toDate } : {}),
          }
        : { rangeType: "all" };
    try {
      const result = await getAdminHeadcountReportFn({ data: request });
      if (!result.ok) {
        setReport(emptyReport);
        setError(result.message);
        return;
      }
      setReport(result.data);
    } catch {
      setReport(emptyReport);
      setError("Attendance could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
    setPage(1);
  }, [load]);

  const orderedEntries = [...report.entries].sort(
    (left, right) =>
      right.date.localeCompare(left.date) || left.subhubName.localeCompare(right.subhubName),
  );
  const visibleEntries = orderedEntries.slice((page - 1) * pageSize, page * pageSize);
  const period =
    !fromDate && !toDate
      ? "All previous dates"
      : `${fromDate ? formatDate(fromDate) : "Earliest"} – ${
          toDate ? formatDate(toDate) : "Today"
        }`;

  return (
    <Shell
      title="Headcount history"
      subtitle="Leave both dates blank to see all history, or choose a date range."
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
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Attendance by date</h2>
              <p className="mt-1 text-base text-muted-foreground">
                Leave both dates blank to see all history, or choose a date range.
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2">
              <label className="w-full text-base font-medium text-muted-foreground sm:w-40">
                From
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || today}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="w-full text-base font-medium text-muted-foreground sm:w-40">
                To
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  max={today}
                  onChange={(event) => setToDate(event.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>
          </header>

          <p className="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-base text-muted-foreground">
            <span>{period}</span>
            <span>{orderedEntries.length} attendance records</span>
          </p>

          {loading ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              Loading attendance…
            </p>
          ) : report.entries.length === 0 ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              No attendance counts were recorded for these dates.
            </p>
          ) : (
            <>
              <div className="w-full overflow-x-auto border-b border-border">
                <table className="w-full min-w-[1100px] text-base">
                  <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Date
                      </th>
                      <th className="px-4 py-3 font-semibold">SubHub</th>
                      <th className="px-4 py-3 font-semibold">Manager</th>
                      <th className="px-4 py-3 text-center font-semibold">People present</th>
                      <th className="px-4 py-3 font-semibold">Registered by</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Recorded at
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
                        <td className="px-4 py-4 font-medium">{entry.subhubName}</td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {entry.subhubManagerName || "—"}
                        </td>
                        <td className="tabular px-4 py-4 text-center font-semibold">
                          {entry.presentCount} people
                        </td>
                        <td className="px-4 py-4">{entry.recordedByName}</td>
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                          {formatDateTime(entry.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                total={orderedEntries.length}
                page={page}
                pageSize={pageSize}
                showPageSizeSelect={false}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
              />
            </>
          )}
        </section>
      </main>
    </Shell>
  );
}