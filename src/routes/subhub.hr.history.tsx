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

function SubhubHrHistoryPage() {
  const [mode, setMode] = useState<"day" | "week">("week");
  const [date, setDate] = useState(currentDate);
  const [history, setHistory] = useState<ManagerHeadcountHistory>(emptyHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const today = currentDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getManagerHeadcountHistoryFn({
        data: { rangeType: mode === "week" ? "week" : "date", date },
      });
      if (!result.ok) {
        setHistory(emptyHistory);
        setError(result.message);
        return;
      }
      setHistory(result.data);
    } catch {
      setHistory(emptyHistory);
      setError("History could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [date, mode]);

  useEffect(() => {
    void load();
    setPage(1);
  }, [load]);

  const visibleChanges = history.changes.slice((page - 1) * pageSize, page * pageSize);
  const period = history.startDate
    ? history.startDate === history.endDate
      ? formatDate(history.startDate)
      : `${formatDate(history.startDate)} – ${formatDate(history.endDate)}`
    : "the selected dates";

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
          <header className="border-b border-border py-4">
            <h2 className="text-lg font-semibold">Daily entries</h2>
            <p className="mt-1 text-base text-muted-foreground">
              The latest count saved for each day.
            </p>
          </header>

          <div className="flex flex-wrap items-end gap-3 border-b border-border py-4">
            <div
              className="flex h-12 rounded-md border border-input bg-white p-1"
              role="group"
              aria-label="Choose history period"
            >
              {(["day", "week"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded px-4 text-base font-medium capitalize ${
                    mode === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="w-full text-base font-medium text-muted-foreground sm:w-48">
              Date
              <input
                type="date"
                aria-label="Choose a date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-12 rounded-md border border-input bg-white px-4 text-base font-medium hover:bg-muted/40 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          <p className="border-b border-border py-3 text-base text-muted-foreground">
            Showing {mode === "week" ? "the week of" : "the date"} {period}
          </p>

          {loading ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              Loading daily entries…
            </p>
          ) : history.entries.length === 0 ? (
            <div className="border-b border-border py-8 text-center">
              <p className="text-base font-semibold">No daily entries for this period</p>
              <p className="mt-1 text-base text-muted-foreground">Choose another date or week.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto border-b border-border">
              <table className="w-full min-w-[760px] text-base">
                <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Day</th>
                    <th className="px-4 py-3 text-center font-semibold">People present</th>
                    <th className="px-4 py-3 font-semibold">Saved by</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      Last saved
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/70 last:border-0">
                      <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-4">{formatWeekday(entry.date)}</td>
                      <td className="tabular px-4 py-4 text-center font-semibold">
                        {entry.presentCount}
                      </td>
                      <td className="px-4 py-4">{entry.recordedByName || "—"}</td>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">
                        {formatDateTime(entry.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          ) : history.changes.length === 0 ? (
            <p className="border-b border-dashed border-border py-8 text-center text-base text-muted-foreground">
              No saved changes for this period.
            </p>
          ) : (
            <>
              <div className="w-full overflow-x-auto border-b border-border">
                <table className="w-full min-w-[940px] text-base">
                  <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                        Date
                      </th>
                      <th className="px-4 py-3 font-semibold">What happened</th>
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
                        <td className="px-4 py-4 font-medium">
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
                total={history.changes.length}
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
