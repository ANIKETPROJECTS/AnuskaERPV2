import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { getAdminEmployeeAttendanceHistoryFn, getEmployeeAttendanceHistoryFn } from "@/hr";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Shell } from "@/components/erp/Shell";
import type { AttendanceStatus, EmployeeAttendanceHistory } from "@/hr.server";

type HistoryPeriod = "all" | "week" | "month";

type EmployeeAttendanceDetailsProps =
  | { mode: "admin"; employeeId: string; subhubId: string }
  | { mode: "subhub"; employeeId: string };

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

export function EmployeeAttendanceDetails(props: EmployeeAttendanceDetailsProps) {
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
    const request = props.mode === "admin"
      ? getAdminEmployeeAttendanceHistoryFn({
          data: {
            subhubId: props.subhubId,
            employeeId: props.employeeId,
            period,
            month: period === "month" ? month : undefined,
            weekStart: period === "week" ? weekStart : undefined,
          },
        })
      : getEmployeeAttendanceHistoryFn({
          data: {
            employeeId: props.employeeId,
            period,
            month: period === "month" ? month : undefined,
            weekStart: period === "week" ? weekStart : undefined,
          },
        });
    void request
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
  }, [month, period, props.employeeId, props.mode, props.mode === "admin" ? props.subhubId : "", weekStart]);

  const employee = history?.employee;
  const summary = history?.summary;
  const totalMarked = summary ? summary.present + summary.absent + summary.late + summary.halfDay : 0;
  const rangeLabel = history
    ? history.startDate ? `${formatDate(history.startDate)} – ${formatDate(history.endDate)}` : `From joining date through ${formatDate(history.endDate)}`
    : "";

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{props.mode === "admin" ? "Master Admin" : "SubHub"} · Employee details</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{employee?.name ?? (loading ? "Loading employee…" : "Employee details")}</h1>
            {employee ? <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${employee.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{employee.active ? "Active" : "Archived"}</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {employee ? `${employee.phoneNumber || "Mobile number not assigned"} · Joined ${formatJoinedDate(employee.createdAt)}` : "Attendance history and status summary"}
          </p>
          {history ? <p className="mt-2 text-xs text-muted-foreground"><strong className="font-medium text-foreground">SubHub:</strong> {history.subhubName} · <strong className="font-medium text-foreground">Manager:</strong> {history.subhubManagerName}</p> : null}
        </div>
        {props.mode === "admin" ? (
          <Link to="/hr" className="rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Back to HR & Attendance</Link>
        ) : (
          <Link to="/subhub/hr" className="rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Back to HR & Attendance</Link>
        )}
      </div>

      <div className="space-y-6 px-6 pb-8">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label="Employee SubHub" value={history?.subhubName ?? "Loading…"} helper="Workspace where attendance and shifts are managed" />
          <InfoCard label="SubHub manager" value={history?.subhubManagerName ?? "Loading…"} helper="Manager responsible for this employee" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Assigned shift" value={history?.shift?.name ?? "No shift assigned"} helper={history?.shift ? `${formatTime12(history.shift.startTime)}–${formatTime12(history.shift.endTime)}` : "Managed by SubHub"} />
          <InfoCard label="History range" value={period === "all" ? "All time" : period === "week" ? "Selected week" : "Selected month"} helper={rangeLabel || "Loading range…"} />
          <InfoCard label="Total marked days" value={String(totalMarked)} helper="Attendance records in range" />
          <InfoCard label="Attendance coverage" value={summary ? "Status report ready" : "Loading report…"} helper="Present, absent, late, and half-day" />
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-semibold">Attendance summary</h2><p className="mt-1 text-sm text-muted-foreground">Filter this employee’s saved attendance by all time, week, or month.</p></div>
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
          <div className="border-b border-border bg-muted/20 px-5 py-4"><h2 className="font-semibold">Attendance history</h2><p className="mt-1 text-xs text-muted-foreground">Every saved attendance entry for {employee?.name ?? "this employee"} in the selected range.</p></div>
          {loading ? <p className="p-10 text-center text-sm text-muted-foreground">Loading attendance history…</p> : error ? null : history?.attendance.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Day</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Last updated</th></tr></thead><tbody>{history.attendance.map((record) => <tr key={record.id} className="border-b border-border/70 last:border-0"><td className="tabular px-5 py-3 font-medium">{formatDate(record.date)}</td><td className="px-5 py-3 text-muted-foreground">{formatWeekday(record.date)}</td><td className="px-5 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClass(record.status)}`}>{record.status}</span></td><td className="px-5 py-3 text-right text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.updatedAt))}</td></tr>)}</tbody></table></div>
          ) : <div className="p-10 text-center"><CalendarDays className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No attendance saved for this range</p><p className="mt-1 text-sm text-muted-foreground">Choose another week or month, or return to the attendance report.</p></div>}
        </section>
      </div>
    </div>
  );

  return props.mode === "admin"
    ? <Shell title="Employee details" subtitle="Review employee attendance history across the selected SubHub.">{content}</Shell>
    : <SubHubShell title="Employee details" subtitle="Review this employee’s attendance history and summary.">{content}</SubHubShell>;
}

function statusClass(status: AttendanceStatus) {
  if (status === "Present") return "border-success/40 bg-success/10 text-success";
  if (status === "Absent") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (status === "Late") return "border-warning/40 bg-warning/10 text-warning";
  return "border-primary/40 bg-primary/10 text-primary";
}

function InfoCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}

function Stat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="tabular mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}