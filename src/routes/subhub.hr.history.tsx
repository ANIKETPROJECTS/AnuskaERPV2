import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
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
  const [date, setDate] = useState(currentDate);
  const [history, setHistory] = useState<ManagerHeadcountHistory>(emptyHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = currentDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getManagerHeadcountHistoryFn({ data: { rangeType: "date", date } });
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
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const record = history.entries.find((entry) => entry.date === date);

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
            <h2 className="text-lg font-semibold">Attendance by date</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Choose a date to see the count recorded for that day.
            </p>
          </header>

          <div className="border-b border-border py-4">
            <label className="block w-full max-w-xs text-base font-medium text-muted-foreground">
              Choose date
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 h-12 w-full rounded-md border border-input bg-white px-3 text-base font-normal text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>

          <p className="border-b border-border py-3 text-base text-muted-foreground">
            Attendance on {formatDate(date)}
          </p>

          {loading ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              Loading attendance…
            </p>
          ) : !record ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              No attendance count was recorded for this date.
            </p>
          ) : (
            <dl className="grid gap-4 border-b border-border py-5 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">People present</dt>
                <dd className="mt-1 text-lg font-semibold tabular">{record.presentCount} people</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Registered by</dt>
                <dd className="mt-1 text-base font-medium">{record.recordedByName}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Recorded at</dt>
                <dd className="mt-1 text-base font-medium">{formatDateTime(record.updatedAt)}</dd>
              </div>
            </dl>
          )}
        </section>
      </section>
    </SubHubShell>
  );
}
