import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Check, Download, Pencil, Plus, RefreshCw, Save, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import {
  assignEmployeeToShiftFn,
  createEmployeeFn,
  createShiftFn,
  getManagerHrDataFn,
  saveAttendanceFn,
  updateEmployeeFn,
} from "@/hr";
import type { AttendanceStatus, HrEmployee, ManagerHrData } from "@/hr.server";

export const Route = createFileRoute("/subhub/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — SubHub · Float ERP" }] }),
  component: SubhubHr,
});

const statuses: AttendanceStatus[] = ["Present", "Absent", "Late", "Half-day"];
const emptyData: ManagerHrData = { subhubName: "", month: "", employees: [], shifts: [], attendance: [], summary: [] };

function currentDate() {
  return new Date().toISOString().slice(0, 10);
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

function SubhubHr() {
  const [data, setData] = useState<ManagerHrData>(emptyData);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [month, setMonth] = useState(currentDate().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await getManagerHrDataFn({ data: { month } });
      if (result.ok) setData(result.data);
      else setError(result.message);
    } catch {
      setError("HR data could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month]);

  const statusFor = (employeeId: string) => data.attendance.find((record) => record.employeeId === employeeId && record.date === selectedDate)?.status;
  const assignedCount = data.shifts.reduce((total, shift) => total + shift.assignedEmployeeIds.length, 0);
  const visibleEmployees = data.employees;

  async function markAttendance(employeeId: string, status: AttendanceStatus) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await saveAttendanceFn({ data: { employeeId, date: selectedDate, status } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice("Attendance saved. Selecting another status updates the same date.");
      await load();
    } catch {
      setError("Attendance could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function addEmployee() {
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
    }
  }

  async function saveEmployee(employee: HrEmployee) {
    setSaving(true);
    setError("");
    try {
      const result = await updateEmployeeFn({ data: { id: employee.id, name: editingName, active: employee.active } });
      if (!result.ok) setError(result.message);
      else {
        setEditingId("");
        setNotice("Employee details saved.");
        await load();
      }
    } catch {
      setError("Employee could not be saved. Please try again.");
    }
    setSaving(false);
  }

  async function toggleEmployee(employee: HrEmployee) {
    setSaving(true);
    setError("");
    try {
      const result = await updateEmployeeFn({ data: { id: employee.id, name: employee.name, active: !employee.active } });
      if (!result.ok) setError(result.message);
      else {
        setNotice(result.employee.active ? "Employee reactivated." : "Employee archived. Historical attendance remains available.");
        await load();
      }
    } catch {
      setError("Employee status could not be saved. Please try again.");
    }
    setSaving(false);
  }

  async function addShift() {
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
    }
    setSaving(false);
  }

  function exportReport() {
    downloadCsv(`attendance-${month}.csv`, [
      ["SubHub", "Employee", "Active", "Present", "Absent", "Late", "Half-day"],
      ...data.summary.map((row) => [data.subhubName, row.employeeName, row.active ? "Yes" : "No", row.present, row.absent, row.late, row.halfDay]),
    ]);
  }

  function changeDate(value: string) {
    setSelectedDate(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setMonth(value.slice(0, 7));
  }

  return (
    <SubHubShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div className="flex items-center gap-3">
          <CalendarCheck className="size-5 text-primary" />
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SubHub / HR & Attendance</p><h1 className="mt-2 text-xl font-semibold">People, attendance, and shifts</h1><p className="mt-1 text-sm text-muted-foreground">{data.subhubName || "Your isolated workspace"} · no time-clock or payroll calculations</p></div>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
      </header>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{notice}</p> : null}
        <div className="grid gap-4 sm:grid-cols-3"><Stat label="Employees" value={String(data.employees.filter((employee) => employee.active).length)} helper={`${data.employees.length} total, including archived`} /><Stat label={`Marked ${selectedDate}`} value={String(data.employees.filter((employee) => statusFor(employee.id)).length)} helper="attendance entries" /><Stat label="Shift assignments" value={String(assignedCount)} helper={`${data.shifts.length} shifts defined`} /></div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-semibold">Daily attendance</h2><p className="mt-1 text-sm text-muted-foreground">Choose one simple status per employee. Saving again updates that date.</p></div><label className="text-xs font-medium">Attendance date<input type="date" value={selectedDate} onChange={(event) => changeDate(event.target.value)} className="mt-1.5 block h-9 rounded-md border border-input bg-white px-3 text-sm font-normal" /></label></div>
            {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading HR records…</p> : visibleEmployees.length === 0 ? <Empty icon={<Users className="mx-auto size-8" />} title="No employees yet" detail="Add your first employee below to start recording attendance." /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Employee</th>{statuses.map((status) => <th key={status} className="px-2 py-3 text-center font-medium">{status}</th>)}</tr></thead><tbody>{visibleEmployees.map((employee) => <tr key={employee.id} className={`border-b border-border/70 last:border-0 ${employee.active ? "" : "opacity-60"}`}><td className="px-5 py-4"><p className="font-medium">{employee.name}</p>{!employee.active ? <span className="text-xs text-muted-foreground">Archived</span> : null}</td>{statuses.map((status) => <td key={status} className="px-2 py-4 text-center"><button type="button" disabled={saving || !employee.active} aria-label={`${status} for ${employee.name}`} onClick={() => void markAttendance(employee.id, status)} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${statusFor(employee.id) === status ? statusClass(status) : "border-input text-muted-foreground hover:bg-muted"} disabled:cursor-not-allowed disabled:opacity-50`}>{statusFor(employee.id) === status ? <Check className="mr-1 inline size-3.5" /> : null}{status}</button></td>)}</tr>)}</tbody></table></div>}
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold">Add employee</h2><p className="mt-1 text-sm text-muted-foreground">Employees belong only to this SubHub workspace.</p>
            <div className="mt-4 flex gap-2"><input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Employee name" aria-label="Employee name" className="h-10 min-w-0 flex-1 rounded-md border border-input px-3 text-sm" /><button type="button" onClick={() => void addEmployee()} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Add</button></div>
            <div className="mt-5 divide-y divide-border border-y border-border">{data.employees.map((employee) => <div key={employee.id} className="flex items-center gap-2 py-3">{editingId === employee.id ? <><input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-input px-2 text-sm" /><button type="button" disabled={saving} onClick={() => void saveEmployee(employee)} className="rounded-md p-1.5 text-success hover:bg-success/10" aria-label="Save employee name"><Save className="size-4" /></button><button type="button" onClick={() => setEditingId("")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Cancel edit"><X className="size-4" /></button></> : <><span className={`min-w-0 flex-1 truncate text-sm ${employee.active ? "font-medium" : "text-muted-foreground line-through"}`}>{employee.name}</span><button type="button" onClick={() => { setEditingId(employee.id); setEditingName(employee.name); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={`Edit ${employee.name}`}><Pencil className="size-4" /></button><button type="button" disabled={saving} onClick={() => void toggleEmployee(employee)} className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">{employee.active ? "Archive" : "Reactivate"}</button></>}</div>)}</div>
          </section>
        </div>

        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Shifts and assignments</h2><p className="mt-1 text-sm text-muted-foreground">Define shift hours for planning only, then assign active employees. This does not track time worked.</p></div><div className="flex items-end gap-2"><label className="text-xs font-medium">Shift name<input value={shiftName} onChange={(event) => setShiftName(event.target.value)} placeholder="Morning shift" className="mt-1.5 h-9 w-36 rounded-md border border-input px-2 text-sm font-normal" /></label><label className="text-xs font-medium">Start<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 h-9 rounded-md border border-input px-2 text-sm font-normal" /></label><label className="text-xs font-medium">End<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1.5 h-9 rounded-md border border-input px-2 text-sm font-normal" /></label><button type="button" onClick={() => void addShift()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Add shift</button></div></div>
          {data.shifts.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-7 text-center text-sm text-muted-foreground">No shifts defined yet.</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">{data.shifts.map((shift) => <div key={shift.id} className="rounded-lg border border-border p-4"><div className="flex items-start justify-between"><div><p className="font-medium">{shift.name}</p><p className="tabular mt-1 text-xs text-muted-foreground">{shift.startTime} – {shift.endTime}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-xs">{shift.assignedEmployeeIds.length} assigned</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{data.employees.filter((employee) => employee.active).map((employee) => <label key={employee.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shift.assignedEmployeeIds.includes(employee.id)} disabled={saving} onChange={(event) => void assign(shift.id, employee.id, event.target.checked)} />{employee.name}</label>)}</div>{data.employees.filter((employee) => employee.active).length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Add an active employee to assign this shift.</p> : null}</div>)}</div>}
        </section>

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-semibold">Monthly attendance summary</h2><p className="mt-1 text-sm text-muted-foreground">Payroll-ready attendance totals for {month}; no pay or deductions are calculated.</p></div><div className="flex items-center gap-2"><label className="text-xs font-medium">Report month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ml-2 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal" /></label><button type="button" onClick={exportReport} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"><Download className="size-4" /> Export CSV</button></div></div>
          {data.summary.length === 0 ? <Empty icon={<CalendarCheck className="mx-auto size-8" />} title="No monthly attendance to summarize" detail="Add employees and mark attendance to build this report." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 text-right font-medium">Present</th><th className="px-5 py-3 text-right font-medium">Absent</th><th className="px-5 py-3 text-right font-medium">Late</th><th className="px-5 py-3 text-right font-medium">Half-day</th></tr></thead><tbody>{data.summary.map((row) => <tr key={row.employeeId} className="border-b border-border/70 last:border-0"><td className="px-5 py-3"><span className="font-medium">{row.employeeName}</span>{!row.active ? <span className="ml-2 text-xs text-muted-foreground">(Archived)</span> : null}</td><td className="tabular px-5 py-3 text-right font-semibold text-success">{row.present}</td><td className="tabular px-5 py-3 text-right">{row.absent}</td><td className="tabular px-5 py-3 text-right text-warning">{row.late}</td><td className="tabular px-5 py-3 text-right text-primary">{row.halfDay}</td></tr>)}</tbody></table></div>}
        </section>
      </section>
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
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="tabular mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="p-10 text-center text-muted-foreground">{icon}<p className="mt-3 font-medium text-foreground">{title}</p><p className="mt-1 text-sm">{detail}</p></div>;
}