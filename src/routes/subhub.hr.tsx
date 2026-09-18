import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, RefreshCw, Save, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerHeadcountDataFn, saveManagerHeadcountFn } from "@/hr";
import type { ManagerHeadcountData } from "@/hr.server";

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  useEffect(() => {
    void load();
  }, []);

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
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  const today = data.date || currentDate();

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

        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Recent daily entries</h2>
            <p className="mt-1 text-sm text-muted-foreground">These entries are read-only here and are available to Admin HR reports.</p>
          </div>
          {!data.recentRecords.length ? (
            <div className="p-10 text-center text-muted-foreground">
              <CalendarDays className="mx-auto size-8" />
              <p className="mt-3 font-medium text-foreground">No entries this month</p>
              <p className="mt-1 text-sm">Save today’s count above to start the monthly record.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.recentRecords.slice(0, 7).map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{formatDate(record.date)}</p>
                    {record.date === today ? <p className="mt-0.5 text-xs text-success">Today</p> : null}
                  </div>
                  <p className="tabular text-lg font-semibold">{record.presentCount} <span className="text-xs font-normal text-muted-foreground">present</span></p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </SubHubShell>
  );
}