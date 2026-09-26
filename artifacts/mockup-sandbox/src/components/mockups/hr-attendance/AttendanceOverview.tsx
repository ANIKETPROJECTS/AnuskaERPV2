import "./_group.css";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Info,
  LockKeyhole,
  UsersRound,
} from "lucide-react";
import { AppLayout } from "./_shared/AppLayout";

type HubRecord = {
  hubId: string;
  hub: string;
  manager: string;
  date: string;
  count: number;
};

const hubs = [
  { id: "thane", name: "Factory 1 · Thane", manager: "Pratik Kulkarni", code: "TH" },
  { id: "goa", name: "Unit G10 · Goa", manager: "Sara Fernandes", code: "GO" },
  { id: "indore", name: "Unit G4 · Indore", manager: "Meera Joshi", code: "IN" },
  { id: "bengaluru", name: "Unit G5 · Bengaluru", manager: "Rohan Iyer", code: "BL" },
];

const previewRecords: HubRecord[] = [
  { hubId: "thane", hub: "Factory 1 · Thane", manager: "Pratik Kulkarni", date: "2026-09-23", count: 38 },
  { hubId: "goa", hub: "Unit G10 · Goa", manager: "Sara Fernandes", date: "2026-09-23", count: 16 },
  { hubId: "indore", hub: "Unit G4 · Indore", manager: "Meera Joshi", date: "2026-09-23", count: 22 },
  { hubId: "bengaluru", hub: "Unit G5 · Bengaluru", manager: "Rohan Iyer", date: "2026-09-23", count: 31 },
  { hubId: "thane", hub: "Factory 1 · Thane", manager: "Pratik Kulkarni", date: "2026-09-24", count: 39 },
  { hubId: "goa", hub: "Unit G10 · Goa", manager: "Sara Fernandes", date: "2026-09-24", count: 17 },
  { hubId: "indore", hub: "Unit G4 · Indore", manager: "Meera Joshi", date: "2026-09-24", count: 22 },
  { hubId: "bengaluru", hub: "Unit G5 · Bengaluru", manager: "Rohan Iyer", date: "2026-09-24", count: 33 },
  { hubId: "thane", hub: "Factory 1 · Thane", manager: "Pratik Kulkarni", date: "2026-09-25", count: 37 },
  { hubId: "goa", hub: "Unit G10 · Goa", manager: "Sara Fernandes", date: "2026-09-25", count: 16 },
  { hubId: "indore", hub: "Unit G4 · Indore", manager: "Meera Joshi", date: "2026-09-25", count: 23 },
  { hubId: "bengaluru", hub: "Unit G5 · Bengaluru", manager: "Rohan Iyer", date: "2026-09-25", count: 32 },
  { hubId: "thane", hub: "Factory 1 · Thane", manager: "Pratik Kulkarni", date: "2026-09-26", count: 40 },
  { hubId: "indore", hub: "Unit G4 · Indore", manager: "Meera Joshi", date: "2026-09-26", count: 24 },
  { hubId: "bengaluru", hub: "Unit G5 · Bengaluru", manager: "Rohan Iyer", date: "2026-09-26", count: 32 },
  { hubId: "thane", hub: "Factory 1 · Thane", manager: "Pratik Kulkarni", date: "2026-09-27", count: 39 },
  { hubId: "goa", hub: "Unit G10 · Goa", manager: "Sara Fernandes", date: "2026-09-27", count: 17 },
  { hubId: "indore", hub: "Unit G4 · Indore", manager: "Meera Joshi", date: "2026-09-27", count: 23 },
  { hubId: "bengaluru", hub: "Unit G5 · Bengaluru", manager: "Rohan Iyer", date: "2026-09-27", count: 34 },
];

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));

function exportCsv(rows: HubRecord[]) {
  const csvRows = [
    ["Date", "SubHub", "Manager", "People present"],
    ...rows.map((row) => [row.date, row.hub, row.manager, String(row.count)]),
  ];
  const csv = csvRows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "gadsons-headcount-preview.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AttendanceOverview() {
  const [startDate, setStartDate] = useState("2026-09-23");
  const [endDate, setEndDate] = useState("2026-09-27");
  const [selectedHub, setSelectedHub] = useState("all");
  const [page, setPage] = useState<"attendance" | "reports">("attendance");

  const visibleRecords = useMemo(
    () =>
      previewRecords.filter(
        (record) =>
          record.date >= startDate &&
          record.date <= endDate &&
          (selectedHub === "all" || record.hubId === selectedHub),
      ),
    [startDate, endDate, selectedHub],
  );

  const summaries = useMemo(
    () =>
      hubs
        .filter((hub) => selectedHub === "all" || hub.id === selectedHub)
        .map((hub) => {
          const records = visibleRecords.filter((record) => record.hubId === hub.id);
          const total = records.reduce((sum, record) => sum + record.count, 0);
          return {
            ...hub,
            days: records.length,
            total,
            average: records.length ? Math.round((total / records.length) * 10) / 10 : 0,
          };
        }),
    [selectedHub, visibleRecords],
  );

  const totalPeople = visibleRecords.reduce((sum, record) => sum + record.count, 0);
  const averagePeople = visibleRecords.length ? Math.round((totalPeople / visibleRecords.length) * 10) / 10 : 0;
  const validRange = Boolean(startDate && endDate && startDate <= endDate);
  const maxTotal = Math.max(...summaries.map((summary) => summary.total), 1);
  const currentHub = hubs.find((hub) => hub.id === selectedHub);

  return (
    <AppLayout
      title="HR & Attendance"
      subtitle="One daily people count from each SubHub. Simple to review, read-only for Admin."
      activePage={page}
    >
      {page === "reports" ? (
        <section className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => setPage("attendance")}
            className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-primary transition-colors hover:text-primary/75"
          >
            <ArrowLeft className="size-4" /> Back to attendance
          </button>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                <ClipboardList className="size-3.5" /> HR & Attendance
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Headcount reports</h2>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                A dated record of the single total each SubHub saved. Admin can review or download; saved counts cannot be changed here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportCsv(visibleRecords)}
              disabled={!visibleRecords.length}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3.5 text-xs font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Download className="size-4" /> Download CSV
            </button>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
            {visibleRecords.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-[#f4f7f9] text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Date saved</th>
                      <th className="px-5 py-3 font-semibold">SubHub</th>
                      <th className="px-5 py-3 font-semibold">Manager</th>
                      <th className="px-5 py-3 text-right font-semibold">People present</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date) || a.hub.localeCompare(b.hub))
                      .map((record) => (
                        <tr key={`${record.hubId}-${record.date}`} className="border-t border-border/70">
                          <td className="px-5 py-3.5 text-muted-foreground">{dateLabel(record.date)}</td>
                          <td className="px-5 py-3.5 font-medium">{record.hub}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{record.manager}</td>
                          <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">{record.count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-3.5" /> Reports are read-only. Each saved SubHub count is one immutable daily total.
          </p>
        </section>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8e7e2] bg-[#eff7f3] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#3b6c59]">
                  <span className="size-1.5 rounded-full bg-[#4d8a70]" /> Preview data
                </span>
                <span className="text-[11px] text-muted-foreground">Sample records · 23–27 Sep 2026</span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Attendance overview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare daily headcount saved by your active SubHubs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPage("reports")}
              className="group inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Open reports <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          <section className="mb-4 grid overflow-hidden rounded-xl border border-border bg-white sm:grid-cols-[1.05fr_1fr_1fr_1fr]">
            <div className="border-b border-border bg-[#f4f7f9] p-3 sm:border-b-0 sm:border-r">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <CalendarDays className="size-3.5 text-primary" /> Reporting period
              </div>
              <div className="mt-2 font-mono text-sm font-semibold tabular-nums">
                {validRange ? `${dateLabel(startDate)} – ${dateLabel(endDate)}` : "Choose a valid range"}
              </div>
            </div>
            <Metric label="Active SubHubs" value={selectedHub === "all" ? hubs.length : 1} detail="in this view" icon={<UsersRound className="size-4" />} />
            <Metric label="Daily reports" value={visibleRecords.length} detail="saved in period" />
            <Metric label="People counted" value={totalPeople.toLocaleString("en-IN")} detail={`avg. ${averagePeople} per report`} last />
          </section>

          <section className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-white p-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Choose SubHub</div>
              <div className="relative max-w-[330px]">
                <select
                  value={selectedHub}
                  onChange={(event) => setSelectedHub(event.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-input bg-[#fbfcfc] pl-3 pr-9 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:max-w-[330px]"
                  aria-label="Choose a SubHub"
                >
                  <option value="all">All active SubHubs</option>
                  {hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DateField label="From" value={startDate} onChange={setStartDate} />
              <DateField label="To" value={endDate} onChange={setEndDate} />
            </div>
            <button
              type="button"
              onClick={() => exportCsv(visibleRecords)}
              disabled={!visibleRecords.length}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Download className="size-3.5" /> Export
            </button>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(270px,0.8fr)]">
            <section className="overflow-hidden rounded-xl border border-border bg-white">
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">SubHub comparison</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {selectedHub === "all" ? "Totals across the selected dates" : `Daily totals for ${currentHub?.name}`}
                  </p>
                </div>
                <span className="rounded-full bg-[#f1f5f6] px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {summaries.length} {summaries.length === 1 ? "SubHub" : "SubHubs"}
                </span>
              </header>
              {validRange && visibleRecords.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-xs">
                    <thead className="bg-[#f7f9f9] text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">SubHub</th>
                        <th className="px-3 py-2 text-center font-semibold">Days saved</th>
                        <th className="px-3 py-2 text-right font-semibold">Total people</th>
                        <th className="px-4 py-2 text-right font-semibold">Avg. / day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map((summary) => (
                        <tr key={summary.id} className="border-t border-border/70 transition-colors hover:bg-[#f8fbfa]">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#edf4f3] font-mono text-[9px] font-semibold text-[#497568]">{summary.code}</span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-foreground">{summary.name}</span>
                                <span className="mt-0.5 block text-[10px] text-muted-foreground">{summary.manager}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums text-muted-foreground">{summary.days}</td>
                          <td className="px-3 py-2 text-right font-mono text-sm font-semibold tabular-nums">{summary.days ? summary.total : "—"}</td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">{summary.days ? summary.average : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState />
              )}
              {selectedHub !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedHub("all")}
                  className="m-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
                >
                  <ArrowLeft className="size-3" /> Compare all SubHubs
                </button>
              )}
            </section>

            <aside className="flex flex-col overflow-hidden rounded-xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3.5">
                <h3 className="text-sm font-semibold">At a glance</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Reports saved in this date range</p>
              </div>
              {validRange && visibleRecords.length ? (
                <div className="space-y-4 p-4">
                  {summaries.map((summary) => (
                    <button
                      type="button"
                      key={summary.id}
                      onClick={() => setSelectedHub(summary.id)}
                      className="group block w-full text-left"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium group-hover:text-primary">{summary.name}</span>
                        <span className="font-mono font-semibold tabular-nums">{summary.days ? summary.total : "—"}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f1]">
                        <div
                          className="h-full rounded-full bg-[#5f8c7b] transition-all"
                          style={{ width: `${summary.total ? Math.max(4, (summary.total / maxTotal) * 100) : 0}%` }}
                        />
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-border pt-3">
                    <div className="flex items-start gap-2 rounded-lg bg-[#f4f7f6] p-3 text-[10px] leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>Each SubHub saves one total headcount per day. Admin can review the saved number, but cannot edit it.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6">
                  <div className="text-center">
                    <span className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-[#f1f5f4] text-primary"><CalendarDays className="size-4" /></span>
                    <p className="text-xs font-semibold">Nothing to compare yet</p>
                    <p className="mt-1 max-w-48 text-[10px] leading-relaxed text-muted-foreground">Try a different date range to find saved daily totals.</p>
                  </div>
                </div>
              )}
            </aside>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-[#54836f]" /> Read-only view · daily totals only</span>
            <span>Preview records are illustrative and are not live hub data.</span>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Metric({ label, value, detail, icon, last }: { label: string; value: string | number; detail: string; icon?: ReactNode; last?: boolean }) {
  return (
      <div className={`p-3 ${last ? "" : "border-b border-border sm:border-b-0 sm:border-r"}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {icon ? <span className="text-primary">{icon}</span> : null}{label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        <span className="text-[10px] text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {label}
      <span className="relative mt-1 block">
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-[#fbfcfc] px-2.5 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:w-[158px]"
        />
      </span>
    </label>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-9 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#f1f5f4] text-[#5b7d70]">
        <CalendarDays className="size-5" />
      </span>
      <h4 className="text-sm font-semibold">No daily totals for these dates</h4>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        There are no saved headcount records in this range. Choose different dates to review another period.
      </p>
    </div>
  );
}