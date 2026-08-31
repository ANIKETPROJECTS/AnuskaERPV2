import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Check, Download, Pencil, Plus, RefreshCw, Save, Users, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import {
  assignEmployeeToShiftFn,
  createEmployeeFn,
  createShiftFn,
  getManagerHrDataFn,
  saveDailyAttendanceFn,
  updateEmployeeFn,
} from "@/hr";
import type { AttendanceStatus, HrEmployee, ManagerHrData } from "@/hr.server";

export const Route = createFileRoute("/subhub/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — SubHub · Gadsons ERP" }] }),
  component: SubhubHr,
});

type HrTab = "attendance" | "shifts" | "report";
type AttendanceDraft = Record<string, AttendanceStatus | undefined>;
type AttendanceChange = {
  employeeId: string;
  employeeName: string;
  previous: AttendanceStatus;
  next: AttendanceStatus;
};

const statuses: AttendanceStatus[] = ["Present", "Absent", "Late", "Half-day"];
const emptyData: ManagerHrData = {
  subhubName: "",
  month: "",
  employees: [],
  shifts: [],
  attendance: [],
  summary: [],
};

function currentDate() {
  return new Date().toISOString().slice(0, 10);
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
  const [shiftName, setShiftName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [pendingChanges, setPendingChanges] = useState<AttendanceChange[]>([]);

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
      const result = await createEmployeeFn({ data: { name: employeeName } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEmployeeName("");
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
        data: { id: employee.id, name: editingName, active: employee.active },
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
        data: { id: employee.id, name: employee.name, active: !employee.active },
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

  async function addShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await createShiftFn({ data: { name: shiftName, startTime, endTime } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setShiftName("");
      setNotice("Shift created. Assign active employees below.");
      await load();
    } catch {
      setError("Shift could not be saved. Please try again.");
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

  function changeDate(value: string) {
    setSelectedDate(value);
    setDraft(
      Object.fromEntries(
        data.attendance
          .filter((record) => record.date === value)
          .map((record) => [record.employeeId, record.status]),
      ),
    );
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setMonth(value.slice(0, 7));
  }

  function exportReport() {
    downloadCsv(`attendance-${month}.csv`, [
      ["SubHub", "Employee", "Active", "Present", "Absent", "Late", "Half-day"],
      ...data.summary.map((row) => [
        data.subhubName,
        row.employeeName,
        row.active ? "Yes" : "No",
        row.present,
        row.absent,
        row.late,
        row.halfDay,
      ]),
    ]);
  }

  const markedToday = data.employees.filter((employee) =>
    data.attendance.some((record) => record.employeeId === employee.id && record.date === selectedDate),
  ).length;
  const assignedCount = data.shifts.reduce((total, shift) => total + shift.assignedEmployeeIds.length, 0);

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
            ["shifts", "Shifts"],
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
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Employees" value={String(data.employees.filter((employee) => employee.active).length)} helper={`${data.employees.length} total, including archived`} />
              <Stat label={`Marked ${selectedDate}`} value={String(markedToday)} helper="attendance entries" />
              <Stat label="Shift assignments" value={String(assignedCount)} helper={`${data.shifts.length} shifts defined`} />
            </div>
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-semibold">Employee attendance</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose one simple status for each active employee.</p>
                </div>
                <label className="text-xs font-medium">
                  Attendance date
                  <input type="date" value={selectedDate} onChange={(event) => changeDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-white px-3 text-sm font-normal" />
                </label>
              </div>
              {loading ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Loading employees…</p>
              ) : data.employees.filter((employee) => employee.active).length === 0 ? (
                <Empty icon={<Users className="mx-auto size-8" />} title="No employees yet" detail="Add your first employee below to start recording attendance." />
              ) : (
                <div className="divide-y divide-border">
                  {data.employees.filter((employee) => employee.active).map((employee) => (
                    <div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <p className="font-medium">{employee.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {statuses.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setDraft({ ...draft, [employee.id]: status })}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
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
            <section className="panel p-5">
              <h2 className="font-semibold">Employees</h2>
              <p className="mt-1 text-sm text-muted-foreground">Add employees who belong to this SubHub. Deactivated employees remain in past reports.</p>
              <form onSubmit={(event) => void addEmployee(event)} className="mt-4 flex gap-2">
                <input required value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Employee name" className="h-10 min-w-0 flex-1 rounded-md border border-input px-3 text-sm" />
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  <Plus className="size-4" /> Add
                </button>
              </form>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.employees.map((employee) => (
                  <div key={employee.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                    {editingId === employee.id ? (
                      <>
                        <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-input px-2 text-sm" />
                        <button type="button" disabled={saving} onClick={() => void saveEmployee(employee)} className="rounded-md p-1.5 text-success hover:bg-success/10" aria-label="Save employee name"><Save className="size-4" /></button>
                        <button type="button" onClick={() => setEditingId("")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Cancel edit"><X className="size-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className={`min-w-0 flex-1 truncate text-sm ${employee.active ? "font-medium" : "text-muted-foreground line-through"}`}>{employee.name}</span>
                        <button type="button" onClick={() => { setEditingId(employee.id); setEditingName(employee.name); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={`Edit ${employee.name}`}><Pencil className="size-4" /></button>
                        <button type="button" disabled={saving} onClick={() => void toggleEmployee(employee)} className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">{employee.active ? "Deactivate" : "Reactivate"}</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {tab === "shifts" ? (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <section className="panel">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">Define a shift</h2>
                <p className="mt-1 text-sm text-muted-foreground">Use simple start and end times.</p>
              </div>
              <form onSubmit={(event) => void addShift(event)} className="space-y-4 p-5">
                <label className="block text-sm font-medium">Shift name<input required value={shiftName} onChange={(event) => setShiftName(event.target.value)} placeholder="Morning shift" className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm" /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">Starts<input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-2 text-sm" /></label>
                  <label className="block text-sm font-medium">Ends<input required type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-2 text-sm" /></label>
                </div>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Plus className="size-4" /> {saving ? "Saving…" : "Add shift"}</button>
              </form>
            </section>
            <section className="panel">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">Assign employees</h2>
                <p className="mt-1 text-sm text-muted-foreground">Each employee can have one or more shifts.</p>
              </div>
              <div className="divide-y divide-border">
                {data.employees.filter((employee) => employee.active).map((employee) => (
                  <div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <p className="text-sm font-medium">{employee.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {data.shifts.map((shift) => (
                        <label key={shift.id} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2 py-1.5 text-xs">
                          <input type="checkbox" checked={shift.assignedEmployeeIds.includes(employee.id)} disabled={saving} onChange={(event) => void assign(shift.id, employee.id, event.target.checked)} />
                          {shift.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {!data.employees.some((employee) => employee.active) ? <Empty icon={<Users className="mx-auto size-8" />} title="Add employees first" detail="Employees will appear here when you add them." /> : null}
              </div>
              {!data.shifts.length ? <p className="border-t border-border p-6 text-center text-sm text-muted-foreground">No shifts defined yet.</p> : null}
            </section>
          </div>
        ) : null}

        {tab === "report" ? (
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold">Payroll-ready monthly report</h2>
                <p className="mt-1 text-sm text-muted-foreground">Counts manually saved statuses; no salary calculations are included.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">Report month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ml-2 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal" /></label>
                <button type="button" onClick={exportReport} disabled={!data.summary.length} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><Download className="size-4" /> Export CSV</button>
              </div>
            </div>
            {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading monthly report…</p> : data.summary.length === 0 ? <Empty icon={<CalendarDays className="mx-auto size-8" />} title="No monthly attendance to summarize" detail="Add employees and save daily attendance to build this report." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 text-right font-medium">Present</th><th className="px-5 py-3 text-right font-medium">Absent</th><th className="px-5 py-3 text-right font-medium">Late</th><th className="px-5 py-3 text-right font-medium">Half-day</th></tr></thead><tbody>{data.summary.map((row) => <tr key={row.employeeId} className="border-b border-border/70 last:border-0"><td className="px-5 py-3"><span className="font-medium">{row.employeeName}</span>{!row.active ? <span className="ml-2 text-xs text-muted-foreground">(Archived)</span> : null}</td><td className="tabular px-5 py-3 text-right text-success">{row.present}</td><td className="tabular px-5 py-3 text-right text-destructive">{row.absent}</td><td className="tabular px-5 py-3 text-right text-warning">{row.late}</td><td className="tabular px-5 py-3 text-right text-primary">{row.halfDay}</td></tr>)}</tbody></table></div>}
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
    </SubHubShell>
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