import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { getAdminHeadcountReportFn } from "@/hr";
import type { AdminHeadcountReport } from "@/hr.server";

export const Route = createFileRoute("/hr/history")({
  head: () => ({ meta: [{ title: "Headcount history — Admin · Gadsons ERP" }] }),
  component: AdminHrHistoryPage,
});

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
  const [date, setDate] = useState(currentDate);
  const [report, setReport] = useState<AdminHeadcountReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = currentDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminHeadcountReportFn({ data: { rangeType: "date", date } });
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
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Shell
      title="Headcount history"
      subtitle="Choose a date to see attendance recorded by each SubHub."
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
            <h2 className="text-lg font-semibold">Daily attendance</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Select one date to see the recorded total for each SubHub.
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
          ) : report.entries.length === 0 ? (
            <p className="border-b border-border py-8 text-center text-base text-muted-foreground">
              No attendance counts were recorded for this date.
            </p>
          ) : (
            <div className="w-full overflow-x-auto border-b border-border">
              <table className="w-full min-w-[940px] text-base">
                <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
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
                  {report.entries.map((entry) => (
                    <tr
                      key={`${entry.subhubId}:${entry.date}`}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="px-4 py-4 font-medium">{entry.subhubName}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {entry.subhubManagerName || "—"}
                      </td>
                      <td className="tabular px-4 py-4 text-center font-semibold">
                        {entry.presentCount}
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
          )}
        </section>
      </main>
    </Shell>
  );
}
