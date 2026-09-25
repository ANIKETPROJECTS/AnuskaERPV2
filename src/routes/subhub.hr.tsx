import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, RefreshCw, Save, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { TablePagination } from "@/components/erp/TablePagination";
import { getManagerHeadcountDataFn, getManagerHeadcountHistoryFn, saveManagerHeadcountFn } from "@/hr";
import type { ManagerHeadcountData, ManagerHeadcountHistory } from "@/hr.server";

export const Route = createFileRoute("/subhub/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — SubHub · Gadsons ERP" }] }),
  component: SubhubHr,
});

const emptyData: ManagerHeadcountData = {
  subhubName: "",
  subhubManagerName: "",
  date: "",
  presentCount: null,
  recentRecords: [],
};

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

function SubhubHr() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/subhub/hr") return <Outlet />;
  return <SubhubHrPage />;
}

function SubhubHrPage() {
  const [data, setData] = useState<ManagerHeadcountData>(emptyData);
  const [countInput, setCountInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyMode, setHistoryMode] = useState<"day" | "week">("week");
  const [historyDate, setHistoryDate] = useState(currentDate);
  const [history, setHistory] = useState<ManagerHeadcountHistory>(emptyHistory);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const today = data.date || currentDate();
  const historyPageSize = 25;

  async function load(showNotice = false) {
    setLoading(true);
    setError("");
    try {
      const result = await getManagerHeadcountDataFn();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setData(result.data);
      setCountInput(result.data.presentCount === null ? "" : String(result.data.presentCount));
      if (showNotice) setNotice("Headcount data refreshed.");
    } catch {
      setError("Today's headcount could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const loadHistory = useCallback(async (date = historyDate, mode = historyMode) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await getManagerHeadcountHistoryFn({
        data: { rangeType: mode === "week" ? "week" : "date", date },
      });
      if (!result.ok) {
        setHistory(emptyHistory);
        setHistoryError(result.message);
        return;
      }
      setHistory(result.data);
    } catch {
      setHistory(emptyHistory);
      setHistoryError("The headcount history could not be loaded. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDate, historyMode]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadHistory();
    setHistoryPage(1);
  }, [loadHistory]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const presentCount = Number(countInput);
    if (!/^[1-9]\d*$/.test(countInput) || !Number.isSafeInteger(presentCount)) {
      setError("Enter a positive whole number of people present today.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveManagerHeadcountFn({ data: { presentCount } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setData((current) => ({
        ...current,
        presentCount: result.record.presentCount,
        recentRecords: [result.record, ...current.recentRecords.filter((record) => record.date !== result.record.date)],
      }));
      void loadHistory();
      setNotice("Today's present headcount was saved.");
    } catch {
      setError("Today's headcount could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setNotice("");
    try {
      await Promise.all([load(true), loadHistory()]);
    } finally {
      setRefreshing(false);
    }
  }
  const historyPeriodLabel = history.startDate
    ? history.startDate === history.endDate
      ? formatDate(history.startDate)
      : `${formatDate(history.startDate)} – ${formatDate(history.endDate)}`
    : "the selected period";
  const visibleChanges = history.changes.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize,
  );

  return (
    <SubHubShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SubHub Panel</p>
          <h1 className="mt-2 text-xl font-semibold">HR & Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record only the total number of people present in {data.subhubName || "your SubHub"} today.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <main className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{notice}</p> : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Users className="size-5" /></div>
                <div>
                  <h2 className="font-semibold">Today’s present headcount</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Enter one positive whole number. You can update it if the count changes during the day.</p>
                </div>
              </div>
            </div>
            <form onSubmit={(event) => void save(event)} className="space-y-5 p-5">
              <label className="block max-w-sm text-sm font-medium">
                People present today
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={countInput}
                  onChange={(event) => setCountInput(event.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 24"
                  className="mt-2 h-12 w-full rounded-md border border-input bg-white px-4 text-lg font-semibold tabular outline-none ring-primary/20 focus:ring-4"
                  aria-describedby="headcount-help"
                />
              </label>
              <p id="headcount-help" className="text-xs text-muted-foreground">
                Only today’s total is recorded. No employee names, shifts, or individual statuses are required.
              </p>
              <button type="submit" disabled={loading || saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                <Save className="size-4" /> {saving ? "Saving…" : data.presentCount === null ? "Save today’s count" : "Update today’s count"}
              </button>
            </form>
          </div>

          <div className="panel p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected reporting date</p>
            <p className="mt-2 text-lg font-semibold">{formatDate(today)}</p>
            <div className="mt-6 rounded-lg border border-primary/15 bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved for today</p>
              <p className="tabular mt-2 text-4xl font-semibold text-primary">{data.presentCount ?? "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{data.presentCount === null ? "No count recorded yet" : "people present"}</p>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">Manager: {data.subhubManagerName || "—"}</p>
          </div>
        </section>

        <section className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-4">
            <div>
              <h2 className="text-lg font-semibold">Headcount history</h2>
              <p className="mt-1 text-base text-muted-foreground">
                Browse daily entries and every saved change for {data.subhubName || "your SubHub"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-base">
              <span><strong className="tabular">{history.entries.length}</strong> daily entries</span>
              <span><strong className="tabular">{history.changes.length}</strong> changes</span>
            </div>
          </header>

          <div className="flex flex-wrap items-end gap-3 border-b border-border py-4">
            <div className="flex h-12 rounded-md border border-input bg-white p-1" role="group" aria-label="Headcount history period">
              {(["day", "week"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={historyMode === mode}
                  onClick={() => setHistoryMode(mode)}
                  className={`rounded px-3 text-sm font-medium capitalize ${historyMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <label className="w-full text-base font-medium text-muted-foreground sm:w-48">
              Calendar date
              <input
                aria-label="Choose a date for headcount history"
                type="date"
                value={historyDate}
                max={today}
                onChange={(event) => setHistoryDate(event.target.value)}
                className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              className="h-12 rounded-md border border-input bg-white px-4 text-base font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
            >
              {historyLoading ? "Loading…" : "Refresh history"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 text-sm text-muted-foreground">
            <span>{historyMode === "week" ? "Week of " : "Selected date: "}{historyPeriodLabel}</span>
            <span>{history.entries.length} entries · {history.changes.length} changes</span>
          </div>

          {historyError ? (
            <p role="alert" className="my-4 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {historyError}
            </p>
          ) : null}

          <div className="border-b border-border">
            <div className="py-4">
              <h3 className="font-semibold">Daily entries</h3>
              <p className="mt-1 text-sm text-muted-foreground">The latest saved count for each selected date.</p>
            </div>
            {historyLoading ? (
              <p className="border-t border-border py-8 text-center text-base text-muted-foreground">Loading daily entries…</p>
            ) : !history.entries.length ? (
              <div className="border-t border-border py-10 text-center">
                <CalendarDays className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-lg font-semibold">No headcount entries for this period</p>
                <p className="mt-2 text-base text-muted-foreground">Choose another calendar date or week.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[760px] text-base">
                  <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Day</th>
                      <th className="px-4 py-3 text-center font-semibold">People present</th>
                      <th className="px-4 py-3 font-semibold">Recorded by</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/70 last:border-0">
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">{formatDate(entry.date)}</td>
                        <td className="px-4 py-4">{formatWeekday(entry.date)}</td>
                        <td className="tabular px-4 py-4 text-center font-semibold">{entry.presentCount}</td>
                        <td className="px-4 py-4 text-muted-foreground">{entry.recordedByName || "—"}</td>
                        <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">{formatDateTime(entry.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="py-4">
              <h3 className="font-semibold">Change log</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Each save is recorded with the previous count, new count, person, and time. Existing entries remain visible above; earlier revisions cannot be reconstructed.
              </p>
            </div>
            {historyLoading ? (
              <p className="border-t border-border py-8 text-center text-base text-muted-foreground">Loading change log…</p>
            ) : !history.changes.length ? (
              <p className="border-t border-dashed border-border py-8 text-center text-base text-muted-foreground">
                No change log entries for this period.
              </p>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[980px] text-base">
                    <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">Date &amp; time</th>
                        <th className="px-4 py-3 font-semibold">Change</th>
                        <th className="px-4 py-3 text-center font-semibold">Previous count</th>
                        <th className="px-4 py-3 text-center font-semibold">New count</th>
                        <th className="px-4 py-3 font-semibold">Changed by</th>
                        <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">Logged at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleChanges.map((change) => (
                        <tr key={change.id} className="border-b border-border/70 last:border-0">
                          <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">{formatDate(change.date)}</td>
                          <td className="px-4 py-4 font-medium">{change.action}</td>
                          <td className="tabular px-4 py-4 text-center">{change.previousPresentCount ?? "—"}</td>
                          <td className="tabular px-4 py-4 text-center font-semibold">{change.presentCount}</td>
                          <td className="px-4 py-4">{change.actorName}</td>
                          <td className="tabular whitespace-nowrap px-4 py-4 text-center text-sm text-muted-foreground">{formatDateTime(change.changedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  total={history.changes.length}
                  page={historyPage}
                  pageSize={historyPageSize}
                  showPageSizeSelect={false}
                  onPageChange={setHistoryPage}
                  onPageSizeChange={() => undefined}
                />
              </>
            )}
          </div>
        </section>
      </main>
    </SubHubShell>
  );
}