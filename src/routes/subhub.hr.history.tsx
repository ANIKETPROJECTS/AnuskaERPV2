import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { TablePagination } from "@/components/erp/TablePagination";
import { getManagerHeadcountHistoryFn } from "@/hr";
import type { ManagerHeadcountHistory } from "@/hr.server";

export const Route = createFileRoute("/subhub/hr/history")({
  head: () => ({ meta: [{ title: "Headcount history — SubHub · Gadsons ERP" }] }),
  component: SubhubHrHistoryPage,
});

type HistoryRequest =
  { rangeType: "all" } | { rangeType: "range"; startDate?: string; endDate?: string };

const emptyHistory: ManagerHeadcountHistory = {
  startDate: "",
  endDate: "",
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

function SubhubHrHistoryPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [history, setHistory] = useState<ManagerHeadcountHistory>(emptyHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const today = currentDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const request: HistoryRequest =
      fromDate || toDate
        ? {
            rangeType: "range",
            ...(fromDate ? { startDate: fromDate } : {}),
            ...(toDate ? { endDate: toDate } : {}),
          }
        : { rangeType: "all" };
    try {
      const result = await getManagerHeadcountHistoryFn({ data: request });
      if (!result.ok) {
        setHistory(emptyHistory);
        setError(result.message);
        return;
      }
      setHistory(result.data);
    } catch {
      setHistory(emptyHistory);
      setError("Attendance could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
    setPage(1);
  }, [load]);

  const orderedEntries = [...history.entries].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const visibleEntries = orderedEntries.slice((page - 1) * pageSize, page * pageSize);
  const period =
    !fromDate && !toDate
      ? "All previous dates"
      : `${fromDate ? formatDate(fromDate) : "Earliest"} – ${
          toDate ? formatDate(toDate) : "Today"
        }`;

  return (
    <SubHubShell
      headerTitle="Headcount history"
      actions={
        <Link
          to="/subhub/hr"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-white px-4 text-base font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to today’s count
        </Link>
      }
    >
      <section className="space-y-4 px-6 pb-6">
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
                Leave both blank for all history. Use the same date twice for one day.
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
            <span>{orderedEntries.length} recorded dates</span>
          </p>

          {loading ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              Loading attendance…
            </p>
          ) : history.entries.length === 0 ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              No attendance counts were recorded for these dates.
            </p>
          ) : (
            <>
              <div className="w-full overflow-x-auto border-b border-border">
                <table className="w-full min-w-[780px] text-base">
                  <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Date
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">People present</th>
                      <th className="px-4 py-3 font-semibold">Registered by</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Recorded at
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/70 last:border-0">
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                          {formatDate(entry.date)}
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
      </section>
    </SubHubShell>
  );
}
