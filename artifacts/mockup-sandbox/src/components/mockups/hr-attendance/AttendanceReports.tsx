import "./_group.css";
import { AppLayout } from "./_shared/AppLayout";
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  FileSpreadsheet,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

type HeadcountRecord = {
  date: string;
  hub: string;
  count: number;
};

const hubs = [
  "Factory 1 · Thane",
  "Unit G10 · Goa",
  "Unit G4 · Indore",
  "Unit G5 · Bengaluru",
];

// Each row is the immutable, once-daily total submitted by a SubHub.
const previewRecords: HeadcountRecord[] = [
  { date: "2026-09-21", hub: hubs[0], count: 26 },
  { date: "2026-09-21", hub: hubs[1], count: 18 },
  { date: "2026-09-21", hub: hubs[2], count: 23 },
  { date: "2026-09-21", hub: hubs[3], count: 31 },
  { date: "2026-09-22", hub: hubs[0], count: 27 },
  { date: "2026-09-22", hub: hubs[1], count: 19 },
  { date: "2026-09-22", hub: hubs[2], count: 22 },
  { date: "2026-09-22", hub: hubs[3], count: 30 },
  { date: "2026-09-23", hub: hubs[0], count: 25 },
  { date: "2026-09-23", hub: hubs[1], count: 19 },
  { date: "2026-09-23", hub: hubs[2], count: 24 },
  { date: "2026-09-23", hub: hubs[3], count: 32 },
  { date: "2026-09-24", hub: hubs[0], count: 28 },
  { date: "2026-09-24", hub: hubs[1], count: 17 },
  { date: "2026-09-24", hub: hubs[2], count: 23 },
  { date: "2026-09-24", hub: hubs[3], count: 31 },
  { date: "2026-09-25", hub: hubs[0], count: 27 },
  { date: "2026-09-25", hub: hubs[1], count: 20 },
  { date: "2026-09-25", hub: hubs[2], count: 25 },
  { date: "2026-09-25", hub: hubs[3], count: 33 },
  { date: "2026-09-26", hub: hubs[0], count: 24 },
  { date: "2026-09-26", hub: hubs[1], count: 18 },
  { date: "2026-09-26", hub: hubs[2], count: 22 },
  { date: "2026-09-26", hub: hubs[3], count: 29 },
  { date: "2026-09-27", hub: hubs[0], count: 28 },
  { date: "2026-09-27", hub: hubs[1], count: 21 },
  { date: "2026-09-27", hub: hubs[2], count: 24 },
  { date: "2026-09-27", hub: hubs[3], count: 34 },
];

const dateLabels = (isoDate: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof UsersRound;
}) {
  return (
    <article className="min-w-0 border-l-2 border-primary/20 py-1 pl-4 first:border-primary">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 font-['IBM_Plex_Mono'] text-[1.65rem] font-medium leading-none tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{detail}</p>
    </article>
  );
}

export function AttendanceReports() {
  const [fromDate, setFromDate] = useState("2026-09-21");
  const [toDate, setToDate] = useState("2026-09-27");
  const [selectedHub, setSelectedHub] = useState("All SubHubs");
  const [exported, setExported] = useState(false);

  const filteredRecords = useMemo(
    () =>
      previewRecords.filter(
        (record) =>
          record.date >= fromDate &&
          record.date <= toDate &&
          (selectedHub === "All SubHubs" || record.hub === selectedHub),
      ),
    [fromDate, toDate, selectedHub],
  );

  const reportDates = useMemo(
    () => [...new Set(filteredRecords.map((record) => record.date))].sort(),
    [filteredRecords],
  );
  const reportHubs = selectedHub === "All SubHubs" ? hubs : [selectedHub];
  const totalPeopleDays = filteredRecords.reduce((sum, record) => sum + record.count, 0);
  const averagePerReport = filteredRecords.length
    ? (totalPeopleDays / filteredRecords.length).toFixed(1)
    : "0.0";
  const averageDaily = reportDates.length
    ? (
        totalPeopleDays /
        reportDates.length /
        (selectedHub === "All SubHubs" ? hubs.length : 1)
      ).toFixed(1)
    : "0.0";
  const hubTotals = reportHubs.map((hub) => {
    const rows = filteredRecords.filter((record) => record.hub === hub);
    const total = rows.reduce((sum, record) => sum + record.count, 0);
    return { hub, total, average: rows.length ? total / rows.length : 0, days: rows.length };
  });
  const largestHubTotal = Math.max(...hubTotals.map((summary) => summary.total), 1);

  const exportCsv = () => {
    const csv = [
      ["Date", "SubHub", "People present"],
      ...filteredRecords.map((record) => [record.date, record.hub, String(record.count)]),
    ]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gadsons-headcount-${fromDate}-to-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 2200);
  };

  return (
    <AppLayout
      title="HR & Attendance"
      subtitle="A clear view of daily headcount submitted across your active SubHubs."
      activePage="reports"
    >
      <div className="mx-auto max-w-[1440px] space-y-5">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">Attendance reports</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-foreground">
                <span className="size-1.5 rounded-full bg-accent" />
                Preview data
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">
              Daily submitted totals, combined across active SubHubs or narrowed to one location.
              Read-only for Master Admin.
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredRecords.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
          >
            {exported ? <Check className="size-3.5 text-emerald-700" /> : <ArrowDownToLine className="size-3.5" />}
            {exported ? "CSV downloaded" : "Export CSV"}
          </button>
        </section>

        <section className="flex flex-wrap items-end gap-x-4 gap-y-3 border-y border-border bg-card/70 px-4 py-3">
          <div className="mr-auto flex items-center gap-2 self-center text-xs font-semibold text-foreground">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            Report period
          </div>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            From
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium normal-case tracking-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <span className="mb-3 text-xs text-muted-foreground">to</span>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Through
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium normal-case tracking-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <label className="grid min-w-[185px] gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            SubHub
            <span className="relative">
              <select
                value={selectedHub}
                onChange={(event) => setSelectedHub(event.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-xs font-medium normal-case tracking-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option>All SubHubs</option>
                {hubs.map((hub) => <option key={hub}>{hub}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" />
            </span>
          </label>
          <button
            type="button"
            onClick={() => {
              setFromDate("2026-09-21");
              setToDate("2026-09-27");
              setSelectedHub("All SubHubs");
            }}
            className="h-9 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
          >
            Reset
          </button>
        </section>

        {filteredRecords.length === 0 ? (
          <section className="flex min-h-[390px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/8 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">No headcount for this period</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              There are no preview submissions for the selected dates and SubHub. Try another
              period or choose All SubHubs.
            </p>
            <button
              type="button"
              onClick={() => {
                setFromDate("2026-09-21");
                setToDate("2026-09-27");
                setSelectedHub("All SubHubs");
              }}
              className="mt-4 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              View preview period
            </button>
          </section>
        ) : (
          <>
            <section aria-label="Period summary" className="grid grid-cols-2 gap-y-5 border-b border-border pb-5 sm:grid-cols-4 sm:gap-0">
              <Metric
                label="People-days"
                value={totalPeopleDays.toLocaleString("en-IN")}
                detail="Sum of all submitted daily counts"
                icon={UsersRound}
              />
              <Metric
                label="Daily average"
                value={averageDaily}
                detail={selectedHub === "All SubHubs" ? "People per hub, per reported day" : "People per reported day"}
                icon={CalendarDays}
              />
              <Metric
                label="Avg. per submission"
                value={averagePerReport}
                detail="Mean of one count per hub-day"
                icon={FileSpreadsheet}
              />
              <Metric
                label="Reports received"
                value={String(filteredRecords.length)}
                detail={`${reportDates.length} reported days · ${reportHubs.length} ${reportHubs.length === 1 ? "SubHub" : "SubHubs"}`}
                icon={Check}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.72fr)_minmax(580px,1.65fr)]">
              <article className="min-w-0">
                <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h3 className="text-sm font-semibold">SubHub comparison</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">Total people-days in selected period</p>
                  </div>
                  <span className="rounded bg-muted px-2 py-1 font-['IBM_Plex_Mono'] text-[10px] text-muted-foreground">
                    {hubTotals.length} locations
                  </span>
                </div>
                <div className="space-y-4 pt-4">
                  {hubTotals.map((summary, index) => (
                    <div key={summary.hub} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium">{summary.hub}</span>
                        <span className="shrink-0 font-['IBM_Plex_Mono'] font-medium tabular-nums">{summary.total.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${index === 0 ? "bg-primary" : index === 1 ? "bg-primary/75" : index === 2 ? "bg-primary/55" : "bg-primary/35"}`}
                          style={{ width: `${(summary.total / largestHubTotal) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {summary.average.toFixed(1)} avg / report <span className="px-1 text-border">·</span> {summary.days} reports
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-2.5 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground">
                  <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <p>People-days add each recorded daily total. A person reported on two days contributes two people-days.</p>
                </div>
              </article>

              <article className="min-w-0">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h3 className="text-sm font-semibold">Daily breakdown</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">One saved total per SubHub, per calendar day</p>
                  </div>
                  <span className="font-['IBM_Plex_Mono'] text-[10px] text-muted-foreground">{dateLabels(fromDate)} – {dateLabels(toDate)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[570px] border-separate border-spacing-0 text-xs">
                    <thead>
                      <tr className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                        <th className="sticky left-0 z-[1] bg-background py-2.5 pr-3 text-left">Date</th>
                        {reportHubs.map((hub) => (
                          <th key={hub} className="max-w-[112px] px-2 py-2.5 text-right">
                            <span className="block truncate" title={hub}>{hub.split(" · ")[1]}</span>
                          </th>
                        ))}
                        {selectedHub === "All SubHubs" && <th className="bg-primary/[0.045] pl-3 pr-2 text-right text-primary">Total</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {reportDates.map((date, rowIndex) => {
                        const daily = reportHubs.map((hub) =>
                          filteredRecords.find((record) => record.date === date && record.hub === hub),
                        );
                        const dayTotal = daily.reduce((sum, record) => sum + (record?.count ?? 0), 0);
                        return (
                          <tr key={date} className="group">
                            <td className="sticky left-0 z-[1] border-t border-border/75 bg-background py-3 pr-3">
                              <span className="block font-medium">{dateLabels(date)}</span>
                              <span className="mt-0.5 block font-['IBM_Plex_Mono'] text-[9px] text-muted-foreground">{date.slice(0, 4)}</span>
                            </td>
                            {daily.map((record, index) => (
                              <td key={reportHubs[index]} className="border-t border-border/75 px-2 py-3 text-right font-['IBM_Plex_Mono'] tabular-nums text-muted-foreground">
                                {record ? record.count : <span className="text-border">—</span>}
                              </td>
                            ))}
                            {selectedHub === "All SubHubs" && (
                              <td className={`border-t border-border/75 bg-primary/[0.045] pl-3 pr-2 text-right font-['IBM_Plex_Mono'] font-semibold tabular-nums text-foreground ${rowIndex === reportDates.length - 1 ? "rounded-b-sm" : ""}`}>
                                {dayTotal}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    {selectedHub === "All SubHubs" && (
                      <tfoot>
                        <tr>
                          <td className="border-t-2 border-primary/20 py-3 pr-3 text-[10px] font-semibold uppercase tracking-wide">Period total</td>
                          {reportHubs.map((hub) => (
                            <td key={hub} className="border-t-2 border-primary/20 px-2 py-3 text-right font-['IBM_Plex_Mono'] font-semibold tabular-nums">
                              {hubTotals.find((summary) => summary.hub === hub)?.total ?? 0}
                            </td>
                          ))}
                          <td className="border-t-2 border-primary/20 bg-primary/[0.08] pl-3 pr-2 text-right font-['IBM_Plex_Mono'] font-semibold tabular-nums text-primary">{totalPeopleDays}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="mt-2 flex items-start gap-2 border-t border-border/70 pt-2 text-[10px] leading-4 text-muted-foreground">
                  <CircleHelp className="mt-0.5 size-3 shrink-0" />
                  <p>A dash means no daily submission was saved. Counts are preserved as submitted and cannot be edited here.</p>
                </div>
              </article>
            </section>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[10px] text-muted-foreground">
          <span>Sample preview records · Active SubHubs only</span>
          <span>All figures are submitted headcount totals, not individual attendance.</span>
        </div>
      </div>
    </AppLayout>
  );
}