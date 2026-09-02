import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Check, Download, Eye, Pencil, Plus, RefreshCw, Save, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import {
  assignEmployeeToShiftFn,
  createEmployeeFn,
  getEmployeeAttendanceHistoryFn,
  getManagerAttendanceReportFn,
  getManagerHrDataFn,
  saveDailyAttendanceFn,
  updateShiftFn,
  updateEmployeeFn,
} from "@/hr";
import type { AttendanceStatus, EmployeeAttendanceHistory, HrEmployee, HrShift, ManagerAttendanceReport, ManagerHrData } from "@/hr.server";

export const Route = createFileRoute("/subhub/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — SubHub · Gadsons ERP" }] }),
  component: SubhubHr,
});

type HrTab = "attendance" | "registration" | "report";
type AttendanceDraft = Record<string, AttendanceStatus | undefined>;
type AttendanceChange = {
  employeeId: string;
  employeeName: string;
  previous: AttendanceStatus;
  next: AttendanceStatus;
};
type HistoryPeriod = "all" | "week" | "month";
type ReportRangeType = "month" | "date" | "range";
type ReportStatusFilter = "all" | AttendanceStatus;
type ReportSort = "name-asc" | "name-desc" | "present-desc" | "absent-desc" | "late-desc" | "half-day-desc" | "total-desc";

const statuses: AttendanceStatus[] = ["Present", "Absent", "Late", "Half-day"];
const emptyData: ManagerHrData = {
  subhubName: "",
  subhubManagerName: "",
  month: "",
  employees: [],
  shifts: [],
  attendance: [],
  summary: [],
};
const emptyReportData: ManagerAttendanceReport = {
  subhubName: "",
  subhubManagerName: "",
  startDate: "",
  endDate: "",
  employees: [],
  attendance: [],
  summary: [],
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

function startOfWeek(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
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
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatJoinedDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatTime12(value: string) {
  const [rawHour = Number.NaN, rawMinute = Number.NaN] = value.split(":").map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return value;
  const period = rawHour >= 12 ? "PM" : "AM";
  const hour = rawHour % 12 || 12;
  return `${hour}:${String(rawMinute).padStart(2, "0")} ${period}`;
}

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [rawHour = Number.NaN, rawMinute = Number.NaN] = value.split(":").map(Number);
  const hour24 = Number.isFinite(rawHour) ? rawHour : 9;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? "PM" : "AM";
  const updateTime = (nextHour: number, nextMinute: number, nextPeriod: string) => {
    const hour = nextPeriod === "PM" ? (nextHour % 12) + 12 : nextHour % 12;
    onChange(`${String(hour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`);
  };

  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="mt-1.5 flex gap-1.5">
        <select
          aria-label={`${label} hour`}
          value={String(hour12)}
          onChange={(event) => updateTime(Number(event.target.value), minute, period)}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <span className="flex h-9 items-center text-sm text-muted-foreground">:</span>
        <select
          aria-label={`${label} minute`}
          value={String(minute).padStart(2, "0")}
          onChange={(event) => updateTime(hour12, Number(event.target.value), period)}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-sm"
        >
          {Array.from({ length: 60 }, (_, minuteValue) => (
            <option key={minuteValue} value={String(minuteValue).padStart(2, "0")}>
              {String(minuteValue).padStart(2, "0")}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} AM or PM`}
          value={period}
          onChange={(event) => updateTime(hour12, minute, event.target.value)}
          className="h-9 rounded-md border border-input bg-white px-2 text-sm"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </fieldset>
  );
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SubhubHr() {
  const [tab, setTab] = useState<HrTab>("attendance");
  const [data, setData] = useState<ManagerHrData>(emptyData);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [month, setMonth] = useState(() => currentDate().slice(0, 7));
  const [draft, setDraft] = useState<AttendanceDraft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [editingShiftId, setEditingShiftId] = useState("");
  const [editingShiftTimes, setEditingShiftTimes] = useState({ startTime: "", endTime: "" });
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [pendingChanges, setPendingChanges] = useState<AttendanceChange[]>([]);
  const [futureDateRequest, setFutureDateRequest] = useState("");
  const [viewingEmployeeId, setViewingEmployeeId] = useState("");
  const viewedEmployee = data.employees.find((employee) => employee.id === viewingEmployeeId) ?? null;
  const [reportData, setReportData] = useState<ManagerAttendanceReport>(emptyReportData);
  const [reportRangeType, setReportRangeType] = useState<ReportRangeType>("month");
  const [reportMonth, setReportMonth] = useState(() => currentDate().slice(0, 7));
  const [reportDate, setReportDate] = useState(currentDate);
  const [reportStartDate, setReportStartDate] = useState(currentDate);
  const [reportEndDate, setReportEndDate] = useState(currentDate);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>("all");
  const [reportSort, setReportSort] = useState<ReportSort>("name-asc");

  async function load(showNotice = false) {
    setLoading(true);
    setError("");
    try {
      const result = await getManagerHrDataFn({ data: { month } });
      if (result.ok) {
        setData(result.data);
        setDraft(
          Object.fromEntries(
            result.data.attendance
              .filter((record: { employeeId: string; date: string; status: AttendanceStatus }) => record.date === selectedDate)
              .map((record: { employeeId: string; date: string; status: AttendanceStatus }) => [record.employeeId, record.status]),
          ),
        );
        if (showNotice) setNotice("Workspace data refreshed.");
      } else {
        setError(result.message);
      }
    } catch {
      setError("HR data could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month]);

  useEffect(() => {
    if (tab !== "report") return;
    let cancelled = false;
    setReportLoading(true);
    setReportError("");
    void getManagerAttendanceReportFn({
      data: {
        rangeType: reportRangeType,
        month: reportRangeType === "month" ? reportMonth : undefined,
        date: reportRangeType === "date" ? reportDate : undefined,
        startDate: reportRangeType === "range" ? reportStartDate : undefined,
        endDate: reportRangeType === "range" ? reportEndDate : undefined,
      },
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setReportData(result.data);
        else {
          setReportData(emptyReportData);
          setReportError(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReportData(emptyReportData);
          setReportError("Attendance report could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportDate, reportEndDate, reportMonth, reportRangeType, reportStartDate, tab]);

  async function refreshWorkspace() {
    setRefreshing(true);
    setNotice("");
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function persistAttendance(entries: Array<{ employeeId: string; status: AttendanceStatus }>) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await saveDailyAttendanceFn({ data: { date: selectedDate, entries } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPendingChanges([]);
      await load();
      setNotice(`Attendance saved for ${selectedDate}.`);
    } catch {
      setError("Attendance could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAttendance() {
    setError("");
    setNotice("");
    const activeEmployees = data.employees.filter((employee) => employee.active);
    if (activeEmployees.some((employee) => !draft[employee.id])) {
      setError("Choose a status for every active employee before saving.");
      return;
    }
    const entries = activeEmployees.map((employee) => ({
      employeeId: employee.id,
      status: draft[employee.id]!,
    }));
    const savedStatuses = new Map(
      data.attendance
        .filter((record) => record.date === selectedDate)
        .map((record) => [record.employeeId, record.status]),
    );
    const changes = activeEmployees.flatMap((employee) => {
      const previous = savedStatuses.get(employee.id);
      const next = draft[employee.id];
      return previous && next && previous !== next
        ? [{ employeeId: employee.id, employeeName: employee.name, previous, next }]
        : [];
    });
    if (changes.length) {
      setPendingChanges(changes);
      return;
    }
    await persistAttendance(entries);
  }

  function cancelAttendanceChanges() {
    const restored = { ...draft };
    pendingChanges.forEach((change) => {
      restored[change.employeeId] = change.previous;
    });
    setDraft(restored);
    setPendingChanges([]);
  }

  async function confirmAttendanceChanges() {
    await persistAttendance(
      data.employees
        .filter((employee) => employee.active)
        .map((employee) => ({ employeeId: employee.id, status: draft[employee.id]! })),
    );
  }

  async function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await createEmployeeFn({ data: { name: employeeName, phoneNumber, shiftIds: selectedShiftId ? [selectedShiftId] : [] } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEmployeeName("");
      setPhoneNumber("");
      setSelectedShiftId("");
      setNotice("Employee added to this workspace.");
      await load();
    } catch {
      setError("Employee could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmployee(employee: HrEmployee) {
    setSaving(true);
    setError("");
    try {
      const result = await updateEmployeeFn({
        data: { id: employee.id, name: editingName, phoneNumber: editingPhone, active: employee.active },
      });
      if (!result.ok) setError(result.message);
      else {
        setEditingId("");
        setNotice("Employee details saved.");
        await load();
      }
    } catch {
      setError("Employee could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEmployee(employee: HrEmployee) {
    setSaving(true);
    setError("");
    try {
      const result = await updateEmployeeFn({
        data: { id: employee.id, name: employee.name, phoneNumber: employee.phoneNumber, active: !employee.active },
      });
      if (!result.ok) setError(result.message);
      else {
        setNotice(result.employee.active ? "Employee reactivated." : "Employee archived. Historical attendance remains available.");
        await load();
      }
    } catch {
      setError("Employee status could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function assign(shiftId: string, employeeId: string, assigned: boolean) {
    setSaving(true);
    setError("");
    try {
      const result = await assignEmployeeToShiftFn({ data: { shiftId, employeeId, assigned } });
      if (!result.ok) setError(result.message);
      else {
        setNotice(assigned ? "Employee assigned to shift." : "Employee removed from shift.");
        await load();
      }
    } catch {
      setError("Shift assignment could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeEmployeeShift(employeeId: string, shiftId: string) {
    const currentShift = data.shifts.find((shift) => shift.assignedEmployeeIds.includes(employeeId));
    if (!shiftId) {
      if (currentShift) await assign(currentShift.id, employeeId, false);
      return;
    }
    if (currentShift?.id === shiftId) return;
    await assign(shiftId, employeeId, true);
  }

  function openShiftEditor(shift: { id: string; startTime: string; endTime: string }) {
    setEditingShiftId(shift.id);
    setEditingShiftTimes({ startTime: shift.startTime, endTime: shift.endTime });
    setError("");
    setNotice("");
  }

  async function saveShift(shift: { id: string }) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await updateShiftFn({ data: { id: shift.id, ...editingShiftTimes } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditingShiftId("");
      setNotice("Shift timing saved.");
      await load();
    } catch {
      setError("Shift timing could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function applyDate(value: string) {
    setSelectedDate(value);
    setPendingChanges([]);
    setDraft(
      Object.fromEntries(
        data.attendance
          .filter((record) => record.date === value)
          .map((record) => [record.employeeId, record.status]),
      ),
    );
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setMonth(value.slice(0, 7));
  }

  function changeDate(value: string) {
    if (value > currentDate()) {
      setFutureDateRequest(value);
      return;
    }
    applyDate(value);
  }

  function cancelFutureDateSelection() {
    setFutureDateRequest("");
  }

  function confirmFutureDateSelection() {
    applyDate(futureDateRequest);
    setFutureDateRequest("");
  }

  function exportReport(rows = reportData.summary, filename = `attendance-${month}.csv`) {
    downloadCsv(filename, [
      ["SubHub", "Employee", "Active", "Present", "Absent", "Late", "Half-day"],
      ...rows.map((row) => [
        reportData.subhubName || data.subhubName,
        row.employeeName,
        row.active ? "Yes" : "No",
        row.present,
        row.absent,
        row.late,
        row.halfDay,
      ]),
    ]);
  }

  const filteredReportRows = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    const rows = reportData.summary.filter((row) => {
      const matchesSearch = !query || row.employeeName.toLowerCase().includes(query);
      const matchesStatus =
        reportStatusFilter === "all" ||
        (reportStatusFilter === "Present" && row.present > 0) ||
        (reportStatusFilter === "Absent" && row.absent > 0) ||
        (reportStatusFilter === "Late" && row.late > 0) ||
        (reportStatusFilter === "Half-day" && row.halfDay > 0);
      return matchesSearch && matchesStatus;
    });
    return rows.sort((left, right) => {
      if (reportSort === "name-asc") return left.employeeName.localeCompare(right.employeeName);
      if (reportSort === "name-desc") return right.employeeName.localeCompare(left.employeeName);
      if (reportSort === "present-desc") return right.present - left.present || left.employeeName.localeCompare(right.employeeName);
      if (reportSort === "absent-desc") return right.absent - left.absent || left.employeeName.localeCompare(right.employeeName);
      if (reportSort === "late-desc") return right.late - left.late || left.employeeName.localeCompare(right.employeeName);
      if (reportSort === "half-day-desc") return right.halfDay - left.halfDay || left.employeeName.localeCompare(right.employeeName);
      return (right.present + right.absent + right.late + right.halfDay) - (left.present + left.absent + left.late + left.halfDay) || left.employeeName.localeCompare(right.employeeName);
    });
  }, [reportData.summary, reportSearch, reportSort, reportStatusFilter]);

  return (
    <SubHubShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SubHub Panel</p>
          <h1 className="mt-2 text-xl font-semibold">HR & Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.subhubName || "Your SubHub"} · simple employee, attendance, and shift management
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshWorkspace()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="space-y-6 p-6">
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {[
            ["attendance", "Daily attendance"],
            ["registration", "Registration"],
            ["report", "Monthly report"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as HrTab)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                tab === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-input bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">
            {notice}
          </p>
        ) : null}

        {tab === "attendance" ? (
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold">Employee attendance</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose one status for each active employee.</p>
              </div>
              <label className="text-xs font-medium">
                Attendance date
                <input type="date" value={selectedDate} onChange={(event) => changeDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-white px-3 text-sm font-normal" />
              </label>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading employees…</p>
            ) : data.employees.filter((employee) => employee.active).length === 0 ? (
              <Empty icon={<Users className="mx-auto size-8" />} title="No employees registered" detail="Register employees before recording attendance." />
            ) : (
              <div className="divide-y divide-border">
                {data.employees.filter((employee) => employee.active).map((employee) => (
                  <div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="font-medium">{employee.name}</p>
                      {employee.phoneNumber ? <p className="mt-0.5 font-mono text-xs text-muted-foreground">{employee.phoneNumber}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">SubHub: {data.subhubName || "—"} · Manager: {data.subhubManagerName || "—"}</p>
                    </div>
                     <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          to="/subhub/hr/employee/$employeeId"
                          params={{ employeeId: employee.id }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                         <Eye className="size-3.5" /> View
                        </Link>
                      {statuses.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={saving}
                          onClick={() => setDraft({ ...draft, [employee.id]: status })}
                          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            draft[employee.id] === status ? statusClass(status) : "border-input text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {draft[employee.id] === status ? <Check className="mr-1 inline size-3.5" /> : null}
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
              <p className="text-xs text-muted-foreground">Statuses: Present, Absent, Late, or Half-day.</p>
              <button type="button" onClick={() => void saveAttendance()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                <Save className="size-4" /> {saving ? "Saving…" : "Save attendance"}
              </button>
            </div>
          </section>
        ) : null}

        {tab === "registration" ? (
          <div className="space-y-6">
            <section className="panel">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">Register employee</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add the employee’s name, Indian mobile number, and shift.</p>
              </div>
              <form onSubmit={(event) => void addEmployee(event)} className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                <label className="block text-sm font-medium">Employee name<input required value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Full name" className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm" /></label>
                <label className="block text-sm font-medium">Mobile number<input required type="tel" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit Indian number" className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm" /></label>
                <label className="block text-sm font-medium">Assign shift<select value={selectedShiftId} onChange={(event) => setSelectedShiftId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">No shift selected</option>{data.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {formatTime12(shift.startTime)}–{formatTime12(shift.endTime)}{shift.endTime < shift.startTime ? " · next day" : ""}</option>)}</select></label>
                <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Plus className="size-4" /> {saving ? "Saving…" : "Register"}</button>
              </form>
              <div className="border-t border-border px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Available shift timings</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Edit the timing for Day shift or Night shift. These values are saved to this SubHub.</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Only two shifts are available.</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.shifts.map((shift) => (
                    <div key={shift.id} className="rounded-lg border border-border bg-background p-3">
                      {editingShiftId === shift.id ? (
                        <div className="space-y-3">
                          <p className="text-sm font-medium">{shift.name}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <TimeSelect label="Starts" value={editingShiftTimes.startTime} onChange={(startTime) => setEditingShiftTimes((current) => ({ ...current, startTime }))} />
                            <TimeSelect label="Ends" value={editingShiftTimes.endTime} onChange={(endTime) => setEditingShiftTimes((current) => ({ ...current, endTime }))} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingShiftId("")} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancel</button>
                            <button type="button" disabled={saving} onClick={() => void saveShift(shift)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"><Save className="size-3.5" /> Save timing</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{shift.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatTime12(shift.startTime)}–{formatTime12(shift.endTime)}
                              {shift.endTime < shift.startTime ? " · next day" : ""}
                            </p>
                          </div>
                          <button type="button" onClick={() => openShiftEditor(shift)} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted"><Pencil className="size-3.5" /> Edit timing</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="panel overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">Registered employees</h2>
                <p className="mt-1 text-sm text-muted-foreground">Edit employee details or deactivate an employee. Past attendance remains available.</p>
              </div>
              <div className="divide-y divide-border">
                {data.employees.map((employee) => (
                  <div key={employee.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    {editingId === employee.id ? (
                      <>
                        <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="h-9 min-w-40 flex-1 rounded-md border border-input px-2 text-sm" aria-label="Employee name" />
                        <input value={editingPhone} onChange={(event) => setEditingPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} inputMode="numeric" className="h-9 min-w-36 flex-1 rounded-md border border-input px-2 font-mono text-sm" aria-label="Mobile number" />
                        <button type="button" disabled={saving} onClick={() => void saveEmployee(employee)} className="rounded-md p-1.5 text-success hover:bg-success/10" aria-label="Save employee details"><Save className="size-4" /></button>
                        <button type="button" onClick={() => setEditingId("")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Cancel edit"><X className="size-4" /></button>
                      </>
                    ) : (
                      <>
                        <div className={`min-w-0 flex-1 ${employee.active ? "" : "text-muted-foreground"}`}>
                          <p className={`truncate text-sm ${employee.active ? "font-medium" : "line-through"}`}>{employee.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{employee.phoneNumber || "Mobile number not assigned"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">SubHub: {data.subhubName || "—"} · Manager: {data.subhubManagerName || "—"}</p>
                        </div>
                        <select
                          value={data.shifts.find((shift) => shift.assignedEmployeeIds.includes(employee.id))?.id ?? ""}
                          onChange={(event) => void changeEmployeeShift(employee.id, event.target.value)}
                          disabled={saving || !employee.active}
                          className="h-9 max-w-56 rounded-md border border-input bg-white px-2 text-xs"
                          aria-label={`Shift for ${employee.name}`}
                        >
                          <option value="">No shift</option>
                          {data.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {formatTime12(shift.startTime)}–{formatTime12(shift.endTime)}</option>)}
                        </select>
                          <Link to="/subhub/hr/employee/$employeeId" params={{ employeeId: employee.id }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted" aria-label={`View ${employee.name}`}>
                           <Eye className="size-3.5" /> View
                          </Link>
                        <button type="button" onClick={() => { setEditingId(employee.id); setEditingName(employee.name); setEditingPhone(employee.phoneNumber); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={`Edit ${employee.name}`}><Pencil className="size-4" /></button>
                        <button type="button" disabled={saving} onClick={() => void toggleEmployee(employee)} className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">{employee.active ? "Deactivate" : "Reactivate"}</button>
                      </>
                    )}
                  </div>
                ))}
                {!data.employees.length ? <Empty icon={<Users className="mx-auto size-8" />} title="No employees registered" detail="Register the first employee above." /> : null}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "report" ? (
          <section className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Payroll-ready attendance report</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Counts manually saved statuses; no salary calculations are included.</p>
                </div>
                <button
                  type="button"
                  onClick={() => exportReport(filteredReportRows, `attendance-report-${reportData.startDate || "selected-range"}-to-${reportData.endDate || "today"}.csv`)}
                  disabled={!filteredReportRows.length}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Download className="size-4" /> Export filtered CSV
                </button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[180px_1fr_180px_220px]">
                <label className="text-xs font-medium">
                  Report view
                  <select
                    value={reportRangeType}
                    onChange={(event) => setReportRangeType(event.target.value as ReportRangeType)}
                    className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal"
                  >
                    <option value="month">Month</option>
                    <option value="date">Specific date</option>
                    <option value="range">Date range</option>
                  </select>
                </label>
                {reportRangeType === "month" ? (
                  <label className="text-xs font-medium">
                    Report month
                    <input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal" />
                  </label>
                ) : reportRangeType === "date" ? (
                  <label className="text-xs font-medium">
                    Attendance date
                    <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal" />
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:col-span-1">
                    <label className="text-xs font-medium">
                      From
                      <input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal" />
                    </label>
                    <label className="text-xs font-medium">
                      To
                      <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal" />
                    </label>
                  </div>
                )}
                <label className="text-xs font-medium">
                  Search employee
                  <input value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Search by name" className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-3 text-sm font-normal" />
                </label>
                <label className="text-xs font-medium">
                  Filter by status
                  <select value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value as ReportStatusFilter)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal">
                    <option value="all">All employees</option>
                    <option value="Present">Present recorded</option>
                    <option value="Absent">Absent recorded</option>
                    <option value="Late">Late recorded</option>
                    <option value="Half-day">Half-day recorded</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs font-medium">
                  Sort results
                  <select value={reportSort} onChange={(event) => setReportSort(event.target.value as ReportSort)} className="ml-2 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
                    <option value="name-asc">Employee name A–Z</option>
                    <option value="name-desc">Employee name Z–A</option>
                    <option value="present-desc">Most present days</option>
                    <option value="absent-desc">Most absent days</option>
                    <option value="late-desc">Most late days</option>
                    <option value="half-day-desc">Most half-days</option>
                    <option value="total-desc">Most marked days</option>
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">
                  {reportData.startDate && reportData.endDate ? `Showing ${reportData.startDate} to ${reportData.endDate}` : "Choose a report range"}
                  {" · "}
                  {filteredReportRows.length} of {reportData.summary.length} employees
                </p>
              </div>
            </div>
            {reportError ? <p role="alert" className="m-5 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{reportError}</p> : null}
            {reportLoading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading attendance report…</p>
            ) : !reportData.summary.length ? (
              <Empty icon={<CalendarDays className="mx-auto size-8" />} title="No attendance to summarize" detail="No saved attendance exists in the selected date range." />
            ) : !filteredReportRows.length ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No employees match the current search and status filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Employee</th>
                      <th className="px-5 py-3 font-medium">SubHub</th>
                      <th className="px-5 py-3 font-medium">SubHub manager</th>
                      <th className="px-5 py-3 text-right font-medium">Present</th>
                      <th className="px-5 py-3 text-right font-medium">Absent</th>
                      <th className="px-5 py-3 text-right font-medium">Late</th>
                      <th className="px-5 py-3 text-right font-medium">Half-day</th>
                      <th className="px-5 py-3 text-right font-medium">Total marked</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReportRows.map((row) => (
                      <tr key={row.employeeId} className="border-b border-border/70 last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium">{row.employeeName}</p>
                          {!row.active ? <p className="text-xs text-muted-foreground">(Archived)</p> : null}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{reportData.subhubName || "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{reportData.subhubManagerName || "—"}</td>
                        <td className="tabular px-5 py-3 text-right text-success">{row.present}</td>
                        <td className="tabular px-5 py-3 text-right text-destructive">{row.absent}</td>
                        <td className="tabular px-5 py-3 text-right text-warning">{row.late}</td>
                        <td className="tabular px-5 py-3 text-right text-primary">{row.halfDay}</td>
                        <td className="tabular px-5 py-3 text-right font-semibold">{row.present + row.absent + row.late + row.halfDay}</td>
                        <td className="px-5 py-3 text-right">
                          <Link to="/subhub/hr/employee/$employeeId" params={{ employeeId: row.employeeId }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                            <Eye className="size-3.5" /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </section>

      {pendingChanges.length ? (
        <AttendanceChangeDialog
          changes={pendingChanges}
          saving={saving}
          onCancel={cancelAttendanceChanges}
          onConfirm={() => void confirmAttendanceChanges()}
        />
      ) : null}
      {futureDateRequest ? (
        <FutureAttendanceDialog
          date={futureDateRequest}
          onCancel={cancelFutureDateSelection}
          onConfirm={confirmFutureDateSelection}
        />
      ) : null}
      {viewedEmployee ? (
        <EmployeeDetailsDialog
          employee={viewedEmployee}
          shifts={data.shifts}
          subhubName={data.subhubName}
          subhubManagerName={data.subhubManagerName}
          onClose={() => setViewingEmployeeId("")}
        />
      ) : null}
    </SubHubShell>
  );
}

function EmployeeDetailsDialog({
  employee,
  shifts,
  subhubName,
  subhubManagerName,
  onClose,
}: {
  employee: HrEmployee;
  shifts: HrShift[];
  subhubName: string;
  subhubManagerName: string;
  onClose: () => void;
}) {
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
    void getEmployeeAttendanceHistoryFn({
      data: {
        employeeId: employee.id,
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
  }, [employee.id, month, period, weekStart]);

  const summary = history?.summary;
  const totalMarked = summary ? summary.present + summary.absent + summary.late + summary.halfDay : 0;
  const assignedShift = history?.shift ?? shifts.find((shift) => shift.assignedEmployeeIds.includes(employee.id)) ?? null;
  const rangeLabel = history
    ? history.startDate
      ? `${formatDate(history.startDate)} – ${formatDate(history.endDate)}`
      : `From joining date through ${formatDate(history.endDate)}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="employee-details-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Employee details</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 id="employee-details-title" className="text-xl font-semibold">{employee.name}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${employee.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {employee.active ? "Active" : "Archived"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {employee.phoneNumber || "Mobile number not assigned"} · Joined {formatJoinedDate(employee.createdAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span><strong className="font-medium text-foreground">SubHub:</strong> {subhubName || history?.subhubName || "—"}</span>
              <span><strong className="font-medium text-foreground">SubHub manager:</strong> {subhubManagerName || history?.subhubManagerName || "—"}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close employee details" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          <div className="space-y-6 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee SubHub</p>
                <p className="mt-2 font-semibold">{subhubName || history?.subhubName || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Workspace where attendance and shifts are managed</p>
              </div>
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SubHub manager</p>
                <p className="mt-2 font-semibold">{subhubManagerName || history?.subhubManagerName || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Manager responsible for this employee</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned shift</p>
                <p className="mt-2 font-semibold">{assignedShift?.name ?? "No shift assigned"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {assignedShift ? `${formatTime12(assignedShift.startTime)}–${formatTime12(assignedShift.endTime)}` : "Update this in Registration"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History range</p>
                <p className="mt-2 text-sm font-semibold">{period === "all" ? "All time" : period === "week" ? "Selected week" : "Selected month"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{rangeLabel || "Loading range…"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total marked days</p>
                <p className="tabular mt-2 text-2xl font-semibold">{totalMarked}</p>
                <p className="mt-1 text-xs text-muted-foreground">Attendance records in range</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attendance coverage</p>
                <p className="mt-2 text-sm font-semibold">{summary ? "Status report ready" : "Loading report…"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Present, absent, late, and half-day</p>
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Attendance summary</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Filter this employee’s saved attendance by all time, week, or month.</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex rounded-md border border-input bg-white p-1">
                    {([
                      ["all", "All time"],
                      ["week", "Week"],
                      ["month", "Month"],
                    ] as Array<[HistoryPeriod, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPeriod(value)}
                        className={`rounded px-2.5 py-1.5 text-xs font-medium ${period === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {period === "week" ? (
                    <label className="text-xs font-medium">
                      Week starting
                      <input
                        type="date"
                        value={weekStart}
                        onChange={(event) => setWeekStart(startOfWeek(event.target.value))}
                        className="mt-1 block h-9 rounded-md border border-input bg-white px-2 text-sm font-normal"
                      />
                    </label>
                  ) : null}
                  {period === "month" ? (
                    <label className="text-xs font-medium">
                      Report month
                      <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block h-9 rounded-md border border-input bg-white px-2 text-sm font-normal" />
                    </label>
                  ) : null}
                </div>
              </div>

              {summary ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Stat label="Present" value={String(summary.present)} helper="Days present" />
                  <Stat label="Absent" value={String(summary.absent)} helper="Days absent" />
                  <Stat label="Half-day" value={String(summary.halfDay)} helper="Half-day records" />
                  <Stat label="Late" value={String(summary.late)} helper="Late records" />
                  <Stat label="Total" value={String(totalMarked)} helper="All marked days" />
                </div>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/20 px-5 py-4">
                <h3 className="font-semibold">Attendance history</h3>
                <p className="mt-1 text-xs text-muted-foreground">Every saved attendance entry for {employee.name} in the selected range.</p>
              </div>
              {loading ? (
                <p className="p-10 text-center text-sm text-muted-foreground">Loading attendance history…</p>
              ) : error ? (
                <p role="alert" className="m-5 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
              ) : history?.attendance.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Day</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 text-right font-medium">Last updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.attendance.map((record) => (
                        <tr key={record.id} className="border-b border-border/70 last:border-0">
                          <td className="tabular px-5 py-3 font-medium">{formatDate(record.date)}</td>
                          <td className="px-5 py-3 text-muted-foreground">{formatWeekday(record.date)}</td>
                          <td className="px-5 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClass(record.status)}`}>{record.status}</span></td>
                          <td className="px-5 py-3 text-right text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.updatedAt))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center">
                  <CalendarDays className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">No attendance saved for this range</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choose another week or month, or record attendance from Daily attendance.</p>
                </div>
              )}
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

function Stat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function Empty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="p-10 text-center text-muted-foreground">
      {icon}
      <p className="mt-3 font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}

function formatDateForWarning(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function FutureAttendanceDialog({
  date,
  onCancel,
  onConfirm,
}: {
  date: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="future-attendance-title" className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-foreground">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 id="future-attendance-title" className="text-lg font-semibold">Mark attendance for a future date?</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              You selected <strong>{formatDateForWarning(date)}</strong>. Future attendance can be saved, but please confirm the date before making any changes.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-5 text-muted-foreground">
          Status buttons will remain unchanged until you confirm this date.
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
            Choose another date
          </button>
          <button type="button" onClick={onConfirm} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            Continue to date
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceChangeDialog({
  changes,
  saving,
  onCancel,
  onConfirm,
}: {
  changes: AttendanceChange[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="attendance-change-title" className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-foreground"><AlertTriangle className="size-5" /></div>
          <div>
            <h2 id="attendance-change-title" className="text-lg font-semibold">Change saved attendance?</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">This attendance is already saved. Confirm if you want to replace the existing status.</p>
          </div>
        </div>
        <div className="mt-5 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          {changes.map((change) => (
            <div key={`${change.employeeId}-${change.previous}-${change.next}`} className="flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate font-medium">{change.employeeName}</p>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className={`rounded px-2 py-1 ${statusClass(change.previous)}`}>{change.previous}</span>
                <span className="text-muted-foreground">→</span>
                <span className={`rounded px-2 py-1 ${statusClass(change.next)}`}>{change.next}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">The new status will replace the old status for this date and update the monthly report.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-md border border-input bg-white px-3 py-2 text-sm font-medium disabled:opacity-50">Keep existing status</button>
          <button type="button" onClick={onConfirm} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Check className="size-4" />{saving ? "Saving…" : "Confirm change & save"}</button>
        </div>
      </div>
    </div>
  );
}