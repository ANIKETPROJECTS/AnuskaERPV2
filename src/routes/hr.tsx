import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, CalendarDays, Download, Eye, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { getAdminAttendanceReportFn, getAdminEmployeeAttendanceHistoryFn } from "@/hr";
import type { AdminAttendanceReport, AdminHrSummary, AttendanceStatus, EmployeeAttendanceHistory } from "@/hr.server";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — Admin · Float ERP" }] }),
  component: AdminHr,
});

type AdminTab = "daily" | "monthly";
type DailyView = "date" | "range";
type ReportStatusFilter = "all" | AttendanceStatus;
type ReportSort = "name-asc" | "name-desc" | "present-desc" | "absent-desc" | "late-desc" | "half-day-desc" | "total-desc";
type HistoryPeriod = "all" | "week" | "month";
type EmployeeReference = AdminHrSummary;

const emptyReport: AdminAttendanceReport = { startDate: "", endDate: "", subhubs: [], summaries: [], attendance: [] };
const statuses: AttendanceStatus[] = ["Present", "Absent", "Late", "Half-day"];

function currentDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}

function startOfWeek(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatJoinedDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatTime12(value: string) {
  const [rawHour = Number.NaN, rawMinute = Number.NaN] = value.split(":").map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return value;
  return `${rawHour % 12 || 12}:${String(rawMinute).padStart(2, "0")} ${rawHour >= 12 ? "PM" : "AM"}`;
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AdminHr() {
  const [tab, setTab] = useState<AdminTab>("daily");
  const [dailyView, setDailyView] = useState<DailyView>("date");
  const [dailyDate, setDailyDate] = useState(currentDate);
  const [dailyStartDate, setDailyStartDate] = useState(() => currentDate());
  const [dailyEndDate, setDailyEndDate] = useState(() => currentDate());
  const [reportMonth, setReportMonth] = useState(() => currentDate().slice(0, 7));
  const [report, setReport] = useState<AdminAttendanceReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("all");
  const [sort, setSort] = useState<ReportSort>("name-asc");
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeReference | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    setLoading(true);
    setError("");
    try {
      const result = await getAdminAttendanceReportFn({
        data: tab === "daily"
          ? dailyView === "date"
            ? { rangeType: "date", date: dailyDate }
            : { rangeType: "range", startDate: dailyStartDate, endDate: dailyEndDate }
          : { rangeType: "month", month: reportMonth },
      });
      if (result.ok) setReport(result.data);
      else {
        setReport(emptyReport);
        setError(result.message);
      }
    } catch {
      setReport(emptyReport);
      setError("The attendance report could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [dailyDate, dailyEndDate, dailyStartDate, dailyView, reportMonth, tab]);

  useEffect(() => {
    setSubhubFilter("all");
    setEmployeeFilter("");
    setStatusFilter("all");
  }, [tab]);

  const dailyStatuses = useMemo(
    () => new Map(report.attendance.map((record) => [`${record.subhubId}:${record.employeeId}`, record.status])),
    [report.attendance],
  );

  const filteredRows = useMemo(() => {
    const query = employeeFilter.trim().toLowerCase();
    const rows = report.summaries.filter((row) => {
      const dailyStatus = dailyStatuses.get(`${row.subhubId}:${row.employeeId}`);
      const matchesSubhub = subhubFilter === "all" || row.subhubId === subhubFilter;
      const matchesEmployee = !query || row.employeeName.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all"
        || (tab === "daily" && dailyView === "date" ? dailyStatus === statusFilter : (
          statusFilter === "Present" ? row.present > 0
            : statusFilter === "Absent" ? row.absent > 0
              : statusFilter === "Late" ? row.late > 0
                : row.halfDay > 0
        ));
      return matchesSubhub && matchesEmployee && matchesStatus;
    });
    return rows.sort((left, right) => {
      if (sort === "name-asc") return left.employeeName.localeCompare(right.employeeName) || left.subhubName.localeCompare(right.subhubName);
      if (sort === "name-desc") return right.employeeName.localeCompare(left.employeeName) || left.subhubName.localeCompare(right.subhubName);
      if (sort === "present-desc") return right.present - left.present || left.employeeName.localeCompare(right.employeeName);
      if (sort === "absent-desc") return right.absent - left.absent || left.employeeName.localeCompare(right.employeeName);
      if (sort === "late-desc") return right.late - left.late || left.employeeName.localeCompare(right.employeeName);
      if (sort === "half-day-desc") return right.halfDay - left.halfDay || left.employeeName.localeCompare(right.employeeName);
      return (right.present + right.absent + right.late + right.halfDay) - (left.present + left.absent + left.late + left.halfDay) || left.employeeName.localeCompare(right.employeeName);
    });
  }, [dailyStatuses, dailyView, employeeFilter, report.summaries, sort, statusFilter, subhubFilter, tab]);

  const totals = useMemo(() => report.summaries.reduce((total, row) => ({
    employees: total.employees + 1,
    present: total.present + row.present,
    absent: total.absent + row.absent,
    late: total.late + row.late,
    halfDay: total.halfDay + row.halfDay,
  }), { employees: 0, present: 0, absent: 0, late: 0, halfDay: 0 }), [report.summaries]);

  function exportReport() {
    if (tab === "daily" && dailyView === "date") {
      downloadCsv(`daily-attendance-${dailyDate}.csv`, [
        ["Date", "SubHub", "SubHub manager", "Employee", "Active", "Status"],
        ...filteredRows.map((row) => [dailyDate, row.subhubName, row.subhubManagerName, row.employeeName, row.active ? "Yes" : "No", dailyStatuses.get(`${row.subhubId}:${row.employeeId}`) ?? "Not marked"]),
      ]);
    } else if (tab === "daily") {
      downloadCsv(`attendance-${dailyStartDate}-to-${dailyEndDate}.csv`, [
        ["Start date", "End date", "SubHub", "SubHub manager", "Employee", "Active", "Present", "Absent", "Late", "Half-day", "Total marked"],
        ...filteredRows.map((row) => [dailyStartDate, dailyEndDate, row.subhubName, row.subhubManagerName, row.employeeName, row.active ? "Yes" : "No", row.present, row.absent, row.late, row.halfDay, row.present + row.absent + row.late + row.halfDay]),
      ]);
    } else {
      downloadCsv(`monthly-attendance-${reportMonth}.csv`, [
        ["SubHub", "SubHub manager", "Employee", "Active", "Present", "Absent", "Late", "Half-day", "Total marked"],
        ...filteredRows.map((row) => [row.subhubName, row.subhubManagerName, row.employeeName, row.active ? "Yes" : "No", row.present, row.absent, row.late, row.halfDay, row.present + row.absent + row.late + row.halfDay]),
      ]);
    }
  }

  return (
    <Shell title="HR & Attendance" subtitle="Review daily attendance, monthly reports, and employee history across every active SubHub.">
      <div className="space-y-6">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarCheck className="size-5" /></div>
              <div>
                <h2 className="font-semibold">Master Admin attendance center</h2>
                <p className="mt-1 text-sm text-muted-foreground">Read-only visibility into employee attendance for all active SubHub workspaces.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium">
                {tab === "daily" ? "Daily view" : "Report month"}
                {tab === "daily"
                  ? <select value={dailyView} onChange={(event) => setDailyView(event.target.value as DailyView)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal"><option value="date">Single date</option><option value="range">Date range</option></select>
                  : <input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" />}
              </label>
              {tab === "daily" && dailyView === "date" ? <label className="text-xs font-medium">Attendance date<input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label> : null}
              {tab === "daily" && dailyView === "range" ? <><label className="text-xs font-medium">Start date<input type="date" value={dailyStartDate} onChange={(event) => setDailyStartDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label><label className="text-xs font-medium">End date<input type="date" value={dailyEndDate} onChange={(event) => setDailyEndDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label></> : null}
              <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm disabled:opacity-50"><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
              <button type="button" onClick={exportReport} disabled={!filteredRows.length} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"><Download className="size-4" /> Export CSV</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-4">
            {([["daily", "Daily attendance"], ["monthly", "Monthly report"]] as Array<[AdminTab, string]>).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-md px-3 py-2 text-sm font-medium ${tab === value ? "bg-primary text-primary-foreground" : "border border-input bg-card text-muted-foreground hover:bg-muted"}`}>
                {label}
              </button>
            ))}
          </div>
        </section>

        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label="Active SubHubs" value={String(report.subhubs.length)} />
          <Metric label="Employees" value={String(totals.employees)} />
          <Metric label="Present" value={String(totals.present)} tone="success" />
          <Metric label="Absent" value={String(totals.absent)} tone="destructive" />
          <Metric label="Late" value={String(totals.late)} tone="warning" />
          <Metric label="Half-day" value={String(totals.halfDay)} tone="primary" />
        </div>

        <section className="panel overflow-hidden">
          <div className="filter-toolbar border-b border-border bg-muted/10 px-5 py-4">
            <label className="min-w-56 flex-1 text-xs font-medium">
              Filter by employee
              <input type="search" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} placeholder="Search employee name" className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" />
            </label>
            <label className="text-xs font-medium">
              SubHub
              <select value={subhubFilter} onChange={(event) => setSubhubFilter(event.target.value)} className="mt-1.5 h-9 min-w-52 rounded-md border border-input bg-background px-3 text-sm font-normal">
                <option value="all">All active SubHubs</option>
                {report.subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium">
              {tab === "daily" && dailyView === "date" ? "Daily status" : "Has status"}
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReportStatusFilter)} className="mt-1.5 h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm font-normal">
                <option value="all">All employees</option>
                {statuses.map((status) => <option key={status} value={status}>{tab === "daily" ? status : `Has ${status}`}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium">
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value as ReportSort)} className="mt-1.5 h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm font-normal">
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="total-desc">Total marked</option>
                <option value="present-desc">Most present</option>
                <option value="absent-desc">Most absent</option>
                <option value="late-desc">Most late</option>
                <option value="half-day-desc">Most half-day</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{tab === "daily" ? `Daily report for ${report.startDate ? formatDate(report.startDate) : "selected date"}${dailyView === "range" && report.endDate && report.endDate !== report.startDate ? ` – ${formatDate(report.endDate)}` : ""}` : `Monthly report for ${reportMonth}`}</span>
            <span>{filteredRows.length} of {report.summaries.length} employees visible</span>
          </div>
          {loading ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Loading all active SubHub attendance…</p>
          ) : !report.summaries.length ? (
            <Empty icon={<CalendarDays className="mx-auto size-8" />} title="No employees in the report" detail="Employees will appear here after SubHub Managers register them." />
          ) : !filteredRows.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No employees match the current filters.</p>
          ) : tab === "daily" && dailyView === "date" ? (
            <DailyTable rows={filteredRows} statuses={dailyStatuses} date={dailyDate} />
          ) : (
            <MonthlyTable rows={filteredRows} />
          )}
        </section>
        <p className="text-xs text-muted-foreground">Reports are read-only in Master Admin. Attendance entries and employee records remain managed inside each SubHub workspace.</p>
      </div>

    </Shell>
  );
}

function DailyTable({
  rows,
  statuses,
  date,
}: {
  rows: AdminHrSummary[];
  statuses: Map<string, AttendanceStatus>;
  date: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 font-medium">SubHub manager</th><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Action</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = statuses.get(`${row.subhubId}:${row.employeeId}`);
            return <tr key={`${row.subhubId}:${row.employeeId}`} className="border-b border-border/70 last:border-0">
              <td className="px-5 py-3 font-medium">{row.subhubName}</td>
              <td className="px-5 py-3 text-muted-foreground">{row.subhubManagerName}</td>
              <td className="px-5 py-3">{row.employeeName}{!row.active ? <span className="ml-2 text-xs text-muted-foreground">(Archived)</span> : null}</td>
              <td className="px-5 py-3">{status ? <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>{status}</span> : <span className="text-xs text-muted-foreground">Not marked</span>}</td>
              <td className="px-5 py-3 text-right"><Link to="/hr/employee/$subhubId/$employeeId" params={{ subhubId: row.subhubId, employeeId: row.employeeId }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted"><Eye className="size-3.5" /> View</Link></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyTable({ rows }: { rows: AdminHrSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 font-medium">SubHub manager</th><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 text-right font-medium">Present</th><th className="px-5 py-3 text-right font-medium">Absent</th><th className="px-5 py-3 text-right font-medium">Late</th><th className="px-5 py-3 text-right font-medium">Half-day</th><th className="px-5 py-3 text-right font-medium">Total marked</th><th className="px-5 py-3 text-right font-medium">Action</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => <tr key={`${row.subhubId}:${row.employeeId}`} className="border-b border-border/70 last:border-0">
            <td className="px-5 py-3 font-medium">{row.subhubName}</td>
            <td className="px-5 py-3 text-muted-foreground">{row.subhubManagerName}</td>
            <td className="px-5 py-3">{row.employeeName}{!row.active ? <span className="ml-2 text-xs text-muted-foreground">(Archived)</span> : null}</td>
            <td className="tabular px-5 py-3 text-right text-success">{row.present}</td>
            <td className="tabular px-5 py-3 text-right text-destructive">{row.absent}</td>
            <td className="tabular px-5 py-3 text-right text-warning">{row.late}</td>
            <td className="tabular px-5 py-3 text-right text-primary">{row.halfDay}</td>
            <td className="tabular px-5 py-3 text-right font-semibold">{row.present + row.absent + row.late + row.halfDay}</td>
            <td className="px-5 py-3 text-right"><Link to="/hr/employee/$subhubId/$employeeId" params={{ subhubId: row.subhubId, employeeId: row.employeeId }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted"><Eye className="size-3.5" /> View</Link></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

function AdminEmployeeDetailsDialog({ employee, onClose }: { employee: EmployeeReference; onClose: () => void }) {
  const [period, setPeriod] = useState<HistoryPeriod>("all");
  const [month, setMonth] = useState(() => currentDate().slice(0, 7));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(currentDate()));
  const [history, setHistory] = useState<EmployeeAttendanceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getAdminEmployeeAttendanceHistoryFn({
      data: {
        subhubId: employee.subhubId,
        employeeId: employee.employeeId,
        period,
        month: period === "month" ? month : undefined,
        weekStart: period === "week" ? weekStart : undefined,
      },
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setHistory(result.data);
        else {
          setHistory(null);
          setError(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory(null);
          setError("Employee attendance history could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employee.employeeId, employee.subhubId, month, period, weekStart]);

  const summary = history?.summary;
  const totalMarked = summary ? summary.present + summary.absent + summary.late + summary.halfDay : 0;
  const rangeLabel = history
    ? history.startDate ? `${formatDate(history.startDate)} – ${formatDate(history.endDate)}` : `From joining date through ${formatDate(history.endDate)}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="admin-employee-details-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Employee details · Admin view</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 id="admin-employee-details-title" className="text-xl font-semibold">{employee.employeeName}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${employee.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{employee.active ? "Active" : "Archived"}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{employee.subhubName} · {employee.subhubManagerName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close employee details" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-5" /></button>
        </div>

        <div className="overflow-y-auto">
          <div className="space-y-6 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee SubHub</p><p className="mt-2 font-semibold">{employee.subhubName}</p><p className="mt-1 text-xs text-muted-foreground">Attendance and shift workspace</p></div>
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SubHub manager</p><p className="mt-2 font-semibold">{employee.subhubManagerName}</p><p className="mt-1 text-xs text-muted-foreground">Manager responsible for this employee</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard label="Assigned shift" value={history?.shift?.name ?? "No shift assigned"} helper={history?.shift ? `${formatTime12(history.shift.startTime)}–${formatTime12(history.shift.endTime)}` : "Managed by SubHub"} />
              <InfoCard label="History range" value={period === "all" ? "All time" : period === "week" ? "Selected week" : "Selected month"} helper={rangeLabel || "Loading range…"} />
              <InfoCard label="Total marked days" value={String(totalMarked)} helper="Attendance records in range" />
              <InfoCard label="Attendance coverage" value={summary ? "Status report ready" : "Loading report…"} helper="Present, absent, late, and half-day" />
            </div>

            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="font-semibold">Attendance summary</h3><p className="mt-1 text-sm text-muted-foreground">Filter this employee’s saved attendance by all time, week, or month.</p></div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex rounded-md border border-input bg-card p-1">
                    {([["all", "All time"], ["week", "Week"], ["month", "Month"]] as Array<[HistoryPeriod, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded px-2.5 py-1.5 text-xs font-medium ${period === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{label}</button>)}
                  </div>
                  {period === "week" ? <label className="text-xs font-medium">Week starting<input type="date" value={weekStart} onChange={(event) => setWeekStart(startOfWeek(event.target.value))} className="mt-1 block h-9 rounded-md border border-input bg-card px-2 text-sm font-normal" /></label> : null}
                  {period === "month" ? <label className="text-xs font-medium">Report month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block h-9 rounded-md border border-input bg-card px-2 text-sm font-normal" /></label> : null}
                </div>
              </div>
              {summary ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Present" value={String(summary.present)} helper="Days present" /><Stat label="Absent" value={String(summary.absent)} helper="Days absent" /><Stat label="Half-day" value={String(summary.halfDay)} helper="Half-day records" /><Stat label="Late" value={String(summary.late)} helper="Late records" /><Stat label="Total" value={String(totalMarked)} helper="All marked days" /></div> : null}
            </section>

            <section className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/20 px-5 py-4"><h3 className="font-semibold">Attendance history</h3><p className="mt-1 text-xs text-muted-foreground">Every saved attendance entry for {employee.employeeName} in the selected range.</p></div>
              {loading ? <p className="p-10 text-center text-sm text-muted-foreground">Loading attendance history…</p> : error ? <p role="alert" className="m-5 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : history?.attendance.length ? (
                <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Day</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Last updated</th></tr></thead><tbody>{history.attendance.map((record) => <tr key={record.id} className="border-b border-border/70 last:border-0"><td className="tabular px-5 py-3 font-medium">{formatDate(record.date)}</td><td className="px-5 py-3 text-muted-foreground">{formatWeekday(record.date)}</td><td className="px-5 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClass(record.status)}`}>{record.status}</span></td><td className="px-5 py-3 text-right text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.updatedAt))}</td></tr>)}</tbody></table></div>
              ) : <div className="p-10 text-center"><CalendarDays className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No attendance saved for this range</p><p className="mt-1 text-sm text-muted-foreground">Choose another week or month, or review the daily report.</p></div>}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusClass(status: AttendanceStatus) {
  if (status === "Present") return "border-success/40 bg-success/10 text-success";
  if (status === "Absent") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (status === "Late") return "border-warning/40 bg-warning/10 text-warning";
  return "border-primary/40 bg-primary/10 text-primary";
}

function Metric({ label, value, tone = "foreground" }: { label: string; value: string; tone?: "foreground" | "success" | "destructive" | "warning" | "primary" }) {
  return <div className="panel p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`tabular mt-2 text-2xl font-semibold ${tone === "foreground" ? "" : `text-${tone}`}`}>{value}</p></div>;
}

function InfoCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}

function Stat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="tabular mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="p-10 text-center text-muted-foreground">{icon}<p className="mt-3 font-medium text-foreground">{title}</p><p className="mt-1 text-sm">{detail}</p></div>;
}