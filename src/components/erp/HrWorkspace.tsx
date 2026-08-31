import {
  AlertTriangle,
  CalendarDays,
  Check,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Kpi, Panel } from "@/components/erp/bits";
import {
  assignEmployeeShiftFn,
  createEmployeeFn,
  createShiftFn,
  getAdminHrReportFn,
  getManagerHrDataFn,
  saveDailyAttendanceFn,
  updateEmployeeFn,
} from "@/hr";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
  type HrEmployee,
  type ManagerHrData,
  type PayrollSummary,
  type AdminHrData,
} from "@/lib/hr-types";

type HrTab = "attendance" | "shifts" | "report";
type AttendanceDraft = Record<string, AttendanceStatus | undefined>;
type AttendanceEntry = { employeeId: string; status: AttendanceStatus };
type AttendanceChange = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  previous: AttendanceStatus;
  next: AttendanceStatus;
};
type PendingAttendanceSave = {
  date: string;
  entries: AttendanceEntry[];
  changes: AttendanceChange[];
};

const emptyManagerData: ManagerHrData = {
  subhubName: "",
  employees: [],
  shifts: [],
  attendance: [],
  monthlySummary: [],
};
const emptyAdminData: AdminHrData = { month: "", summaries: [] };

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return isoToday().slice(0, 7);
}

function csvCell(value: string | number | boolean | null) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null>>,
) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function HrWorkspace({ mode }: { mode: "manager" | "admin" }) {
  const [tab, setTab] = useState<HrTab>(mode === "admin" ? "report" : "attendance");
  const [month, setMonth] = useState(currentMonth());
  const [date, setDate] = useState(isoToday());
  const [managerData, setManagerData] = useState(emptyManagerData);
  const [adminData, setAdminData] = useState(emptyAdminData);
  const [draft, setDraft] = useState<AttendanceDraft>({});
  const [loading, setLoading] = useState(true);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAttendance, setPendingAttendance] = useState<PendingAttendanceSave | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadManager = useCallback(async () => {
    setLoading(true);
    const result = await getManagerHrDataFn({ data: { date, month } });
    if (result.ok) {
      setManagerData(result.data);
      setDraft(
        Object.fromEntries(result.data.attendance.map((entry) => [entry.employeeId, entry.status])),
      );
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, [date, month]);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    const result = await getAdminHrReportFn({ data: { month } });
    if (result.ok) {
      setAdminData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, [month]);

  const refreshManager = useCallback(async () => {
    setRefreshing(true);
    setMessage("");
    try {
      await loadManager();
      setMessage("Workspace data refreshed.");
    } finally {
      setRefreshing(false);
    }
  }, [loadManager]);

  useEffect(() => {
    if (mode === "manager") void loadManager();
    else void loadAdmin();
  }, [loadAdmin, loadManager, mode]);

  async function persistAttendance(dateToSave: string, entries: AttendanceEntry[]) {
    setSavingAttendance(true);
    setMessage("");
    setError("");
    try {
      const result = await saveDailyAttendanceFn({
        data: {
          date: dateToSave,
          entries,
        },
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPendingAttendance(null);
      setMessage(`Attendance saved for ${dateToSave}.`);
      await loadManager();
    } finally {
      setSavingAttendance(false);
    }
  }

  async function saveAttendance() {
    setMessage("");
    setError("");
    const activeEmployees = managerData.employees.filter((employee) => employee.active);
    if (activeEmployees.some((employee) => !draft[employee.id])) {
      setError("Choose a status for every active employee before saving.");
      return;
    }
    const entries = activeEmployees.map((employee) => ({
      employeeId: employee.id,
      status: draft[employee.id]!,
    }));
    const savedStatuses = new Map(
      managerData.attendance.map((entry) => [entry.employeeId, entry.status]),
    );
    const changes = activeEmployees.flatMap((employee) => {
      const previous = savedStatuses.get(employee.id);
      const next = draft[employee.id];
      return previous && next && previous !== next
        ? [
            {
              employeeId: employee.id,
              employeeName: employee.name,
              employeeCode: employee.employeeCode,
              previous,
              next,
            },
          ]
        : [];
    });
    if (changes.length) {
      setPendingAttendance({ date, entries, changes });
      return;
    }
    await persistAttendance(date, entries);
  }

  async function confirmAttendanceChange() {
    if (!pendingAttendance) return;
    await persistAttendance(pendingAttendance.date, pendingAttendance.entries);
  }

  function cancelAttendanceChange() {
    if (!pendingAttendance) return;
    const restoredDraft = { ...draft };
    pendingAttendance.changes.forEach((change) => {
      restoredDraft[change.employeeId] = change.previous;
    });
    setDraft(restoredDraft);
    setPendingAttendance(null);
  }

  const frame =
    mode === "manager" ? (
      <SubHubShell>
        <HrHeader
          title="HR & Attendance"
          subtitle={`${managerData.subhubName || "Your SubHub"} · simple employee, attendance, and shift management`}
          onRefresh={refreshManager}
          refreshing={refreshing}
        />
        <ManagerHrView
          tab={tab}
          setTab={setTab}
          data={managerData}
          date={date}
          setDate={setDate}
          month={month}
          setMonth={setMonth}
          draft={draft}
          setDraft={setDraft}
          loading={loading}
          error={error}
          message={message}
          onSaveAttendance={saveAttendance}
          onReload={loadManager}
          onError={setError}
          onMessage={setMessage}
        />
        {pendingAttendance ? (
          <AttendanceChangeDialog
            changes={pendingAttendance.changes}
            saving={savingAttendance}
            onCancel={cancelAttendanceChange}
            onConfirm={() => void confirmAttendanceChange()}
          />
        ) : null}
      </SubHubShell>
    ) : (
      <Shell
        title="HR & Attendance"
        subtitle="Payroll-ready attendance reports across every active SubHub"
        actions={
          <button
            type="button"
            onClick={() => void loadAdmin()}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        }
      >
        <AdminHrView
          data={adminData}
          month={month}
          setMonth={setMonth}
          loading={loading}
          error={error}
        />
      </Shell>
    );

  return frame;
}

function HrHeader({
  title,
  subtitle,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle: string;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          SubHub Panel
        </p>
        <h1 className="mt-2 text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={refreshing}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-70"
      >
        <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </header>
  );
}

function HrTabs({ tab, setTab }: { tab: HrTab; setTab: (tab: HrTab) => void }) {
  const tabs: Array<{ value: HrTab; label: string }> = [
    { value: "attendance", label: "Daily attendance" },
    { value: "shifts", label: "Shifts" },
    { value: "report", label: "Monthly report" },
  ];
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-4">
      {tabs.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => setTab(item.value)}
          className={`rounded-md px-3 py-2 text-sm font-medium ${tab === item.value ? "bg-primary text-primary-foreground" : "border border-input bg-white text-muted-foreground hover:bg-muted"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ManagerHrView({
  tab,
  setTab,
  data,
  date,
  setDate,
  month,
  setMonth,
  draft,
  setDraft,
  loading,
  error,
  message,
  onSaveAttendance,
  onReload,
  onError,
  onMessage,
}: {
  tab: HrTab;
  setTab: (tab: HrTab) => void;
  data: ManagerHrData;
  date: string;
  setDate: (date: string) => void;
  month: string;
  setMonth: (month: string) => void;
  draft: AttendanceDraft;
  setDraft: (draft: AttendanceDraft) => void;
  loading: boolean;
  error: string;
  message: string;
  onSaveAttendance: () => Promise<void>;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  return (
    <section className="space-y-6 p-6">
      <HrTabs tab={tab} setTab={setTab} />
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success"
        >
          {message}
        </p>
      ) : null}
      {tab === "attendance" ? (
        <DailyAttendance
          data={data}
          date={date}
          setDate={setDate}
          draft={draft}
          setDraft={setDraft}
          loading={loading}
          onSave={onSaveAttendance}
          onReload={onReload}
        />
      ) : null}
      {tab === "shifts" ? (
        <ShiftManagement data={data} onReload={onReload} onError={onError} onMessage={onMessage} />
      ) : null}
      {tab === "report" ? (
        <MonthlyReport
          summaries={data.monthlySummary}
          month={month}
          setMonth={setMonth}
          loading={loading}
          filenamePrefix="subhub"
        />
      ) : null}
    </section>
  );
}

function DailyAttendance({
  data,
  date,
  setDate,
  draft,
  setDraft,
  loading,
  onSave,
  onReload,
}: {
  data: ManagerHrData;
  date: string;
  setDate: (date: string) => void;
  draft: AttendanceDraft;
  setDraft: (draft: AttendanceDraft) => void;
  loading: boolean;
  onSave: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const activeEmployees = data.employees.filter((employee) => employee.active);
  return (
    <Panel
      title="Employee attendance"
      description="Choose one simple status for each employee. There is no time tracking."
      action={
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="tabular h-9 rounded-md border border-input bg-white px-2 text-sm"
          />
        </div>
      }
    >
      {loading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Loading employees…</p>
      ) : activeEmployees.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No employees added yet"
          description="Add your first employee below to start marking attendance."
        />
      ) : (
        <div className="divide-y divide-border">
          {activeEmployees.map((employee) => (
            <AttendanceRow
              key={employee.id}
              employee={employee}
              status={draft[employee.id]}
              onChange={(status) => setDraft({ ...draft, [employee.id]: status })}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        <p className="text-xs text-muted-foreground">
          Statuses: Present, Absent, Late, or Half-day.
        </p>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={loading || !activeEmployees.length}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="size-4" /> Save attendance
        </button>
      </div>
      <EmployeeManager employees={data.employees} onReload={onReload} />
    </Panel>
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-change-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-foreground">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 id="attendance-change-title" className="text-lg font-semibold">
              Change saved attendance?
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              This attendance is already saved. Confirm if you want to replace the existing status.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          {changes.map((change) => (
            <div
              key={`${change.employeeCode}-${change.previous}-${change.next}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{change.employeeName}</p>
                <p className="tabular text-xs text-muted-foreground">{change.employeeCode}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className={`rounded px-2 py-1 ${optionTone(change.previous)}`}>
                  {change.previous}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className={`rounded px-2 py-1 ${optionTone(change.next)}`}>
                  {change.next}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          The new status will replace the old status for this date and update the monthly report.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-input bg-white px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
          >
            Keep existing status
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Check className="size-4" />
            {saving ? "Saving…" : "Confirm change & save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceRow({
  employee,
  status,
  onChange,
}: {
  employee: HrEmployee;
  status: AttendanceStatus | undefined;
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-44">
        <p className="font-medium">{employee.name}</p>
        <p className="tabular mt-1 text-xs text-muted-foreground">
          {employee.employeeCode}
          {employee.shiftName ? ` · ${employee.shiftName}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ATTENDANCE_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${status === option ? optionTone(option) : "border-input bg-white text-muted-foreground hover:bg-muted"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function optionTone(status: AttendanceStatus) {
  if (status === "Present") return "border-success/40 bg-success/10 text-success";
  if (status === "Absent") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (status === "Late") return "border-warning/40 bg-warning/15 text-warning-foreground";
  return "border-primary/40 bg-primary/10 text-primary";
}

function EmployeeManager({
  employees,
  onReload,
}: {
  employees: HrEmployee[];
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await createEmployeeFn({ data: { name } });
    if (!result.ok) setError(result.message);
    else {
      setName("");
      await onReload();
    }
    setSaving(false);
  }

  async function updateEmployee(employee: HrEmployee, active: boolean, nextName = employee.name) {
    setSaving(true);
    setError("");
    const result = await updateEmployeeFn({ data: { id: employee.id, name: nextName, active } });
    if (!result.ok) setError(result.message);
    else {
      setEditingId(null);
      await onReload();
    }
    setSaving(false);
  }

  return (
    <div className="border-t border-border bg-muted/10 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Employees</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add employees who belong to this SubHub. Deactivated employees remain in past reports.
          </p>
        </div>
        <form onSubmit={(event) => void addEmployee(event)} className="flex gap-2">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Employee name"
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </form>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="flex items-center gap-2 rounded-md border border-border bg-white p-3"
          >
            {editingId === employee.id ? (
              <>
                <input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded border border-input px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void updateEmployee(employee, employee.active, editingName)}
                  aria-label="Save employee name"
                  className="rounded p-1 text-success hover:bg-success/10"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancel edit"
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${employee.active ? "" : "text-muted-foreground line-through"}`}
                  >
                    {employee.name}
                  </p>
                  <p className="tabular text-[11px] text-muted-foreground">
                    {employee.employeeCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(employee.id);
                    setEditingName(employee.name);
                  }}
                  aria-label={`Edit ${employee.name}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void updateEmployee(employee, !employee.active)}
                  className="text-[11px] font-medium text-primary"
                >
                  {employee.active ? "Deactivate" : "Activate"}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftManagement({
  data,
  onReload,
  onError,
  onMessage,
}: {
  data: ManagerHrData;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [saving, setSaving] = useState(false);

  async function addShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await createShiftFn({ data: { name, startTime, endTime } });
    if (!result.ok) onError(result.message);
    else {
      setName("");
      onMessage("Shift created.");
      await onReload();
    }
    setSaving(false);
  }

  async function assign(employeeId: string, shiftId: string) {
    const result = await assignEmployeeShiftFn({ data: { employeeId, shiftId: shiftId || null } });
    if (!result.ok) onError(result.message);
    else {
      onMessage("Shift assignment saved.");
      await onReload();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Panel title="Define a shift" description="Use simple start and end times.">
        <form onSubmit={(event) => void addShift(event)} className="space-y-4 p-5">
          <label className="block text-sm font-medium">
            Shift name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="General shift"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Starts
              <input
                required
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Ends
              <input
                required
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="size-4" /> {saving ? "Saving…" : "Add shift"}
          </button>
        </form>
      </Panel>
      <Panel title="Assign employees" description="Each employee can have one shift.">
        <div className="divide-y divide-border">
          {data.employees
            .filter((employee) => employee.active)
            .map((employee) => (
              <div
                key={employee.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{employee.name}</p>
                  <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
                </div>
                <select
                  value={employee.shiftId ?? ""}
                  onChange={(event) => void assign(employee.id, event.target.value)}
                  className="h-9 min-w-44 rounded-md border border-input bg-white px-2 text-sm"
                >
                  <option value="">No shift</option>
                  {data.shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} · {shift.startTime}–{shift.endTime}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          {!data.employees.some((employee) => employee.active) ? (
            <EmptyState
              icon={<Users className="size-8" />}
              title="Add employees first"
              description="Employees will appear here when you add them."
            />
          ) : null}
        </div>
        <div className="border-t border-border px-5 py-4">
          {data.shifts.length ? (
            data.shifts.map((shift) => (
              <div
                key={shift.id}
                className="mr-2 mb-2 inline-flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium">{shift.name}</span>
                <span className="text-muted-foreground">
                  {shift.startTime}–{shift.endTime}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No shifts defined yet.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function MonthlyReport({
  summaries,
  month,
  setMonth,
  loading,
  filenamePrefix,
}: {
  summaries: PayrollSummary[];
  month: string;
  setMonth: (month: string) => void;
  loading: boolean;
  filenamePrefix: string;
}) {
  const exportReport = () =>
    downloadCsv(
      `${filenamePrefix}-attendance-${month}.csv`,
      [
        "SubHub",
        "Employee code",
        "Employee",
        "Present",
        "Absent",
        "Late",
        "Half-day",
        "Total marked",
      ],
      summaries.map((summary) => [
        summary.subhubName,
        summary.employeeCode,
        summary.employeeName,
        summary.present,
        summary.absent,
        summary.late,
        summary.halfDay,
        summary.totalMarked,
      ]),
    );
  return (
    <Panel
      title="Payroll-ready monthly report"
      description="Counts only manually saved attendance statuses; no time or salary calculations are included."
      action={
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="tabular h-9 rounded-md border border-input bg-white px-2 text-sm"
          />
          <button
            type="button"
            onClick={exportReport}
            disabled={!summaries.length}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-xs font-medium disabled:opacity-50"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Loading monthly report…</p>
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title="No employees in this report"
          description="Add employees and save daily attendance to build the monthly summary."
        />
      ) : (
        <SummaryTable summaries={summaries} />
      )}
    </Panel>
  );
}

function SummaryTable({
  summaries,
  admin = false,
}: {
  summaries: PayrollSummary[];
  admin?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {admin ? <th className="px-5 py-3 font-medium">SubHub</th> : null}
            <th className="px-5 py-3 font-medium">Employee</th>
            <th className="px-5 py-3 text-right font-medium">Present</th>
            <th className="px-5 py-3 text-right font-medium">Absent</th>
            <th className="px-5 py-3 text-right font-medium">Late</th>
            <th className="px-5 py-3 text-right font-medium">Half-day</th>
            <th className="px-5 py-3 text-right font-medium">Total marked</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr
              key={`${summary.subhubUserId ?? "manager"}-${summary.employeeId}`}
              className="border-b border-border/70 last:border-0"
            >
              {admin ? <td className="px-5 py-3 font-medium">{summary.subhubName}</td> : null}
              <td className="px-5 py-3">
                <p className="font-medium">{summary.employeeName}</p>
                <p className="tabular text-xs text-muted-foreground">{summary.employeeCode}</p>
              </td>
              <td className="tabular px-5 py-3 text-right text-success">{summary.present}</td>
              <td className="tabular px-5 py-3 text-right text-destructive">{summary.absent}</td>
              <td className="tabular px-5 py-3 text-right text-warning-foreground">
                {summary.late}
              </td>
              <td className="tabular px-5 py-3 text-right text-primary">{summary.halfDay}</td>
              <td className="tabular px-5 py-3 text-right font-semibold">{summary.totalMarked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminHrView({
  data,
  month,
  setMonth,
  loading,
  error,
}: {
  data: AdminHrData;
  month: string;
  setMonth: (month: string) => void;
  loading: boolean;
  error: string;
}) {
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      data.summaries.filter(
        (summary) =>
          (subhubFilter === "all" || summary.subhubName === subhubFilter) &&
          `${summary.subhubName} ${summary.employeeName} ${summary.employeeCode}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.summaries, query, subhubFilter],
  );
  const subhubs = [...new Set(data.summaries.map((summary) => summary.subhubName))];
  const totalMarked = filtered.reduce((sum, summary) => sum + summary.totalMarked, 0);
  const totalEmployees = filtered.length;
  return (
    <section className="space-y-6 p-6">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Employees" value={String(totalEmployees)} hint="in selected report" />
        <Kpi
          label="SubHubs"
          value={String(new Set(filtered.map((summary) => summary.subhubName)).size)}
          hint="with employees"
        />
        <Kpi label="Days marked" value={String(totalMarked)} hint="all statuses combined" />
      </div>
      <Panel
        title="Monthly attendance report"
        description="Admin view across active SubHub workspaces. Filter the table, then export the visible rows."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="tabular h-9 rounded-md border border-input bg-white px-2 text-sm"
            />
            <select
              value={subhubFilter}
              onChange={(event) => setSubhubFilter(event.target.value)}
              className="h-9 rounded-md border border-input bg-white px-2 text-sm"
            >
              <option value="all">All SubHubs</option>
              {subhubs.map((subhub) => (
                <option key={subhub} value={subhub}>
                  {subhub}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employee"
              className="h-9 w-40 rounded-md border border-input bg-white px-3 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `all-subhubs-attendance-${month}.csv`,
                  [
                    "SubHub",
                    "Employee code",
                    "Employee",
                    "Present",
                    "Absent",
                    "Late",
                    "Half-day",
                    "Total marked",
                  ],
                  filtered.map((summary) => [
                    summary.subhubName,
                    summary.employeeCode,
                    summary.employeeName,
                    summary.present,
                    summary.absent,
                    summary.late,
                    summary.halfDay,
                    summary.totalMarked,
                  ]),
                )
              }
              disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              <Download className="size-3.5" /> Export CSV
            </button>
          </div>
        }
      >
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Loading all SubHub reports…
          </p>
        ) : filtered.length ? (
          <SummaryTable summaries={filtered} admin />
        ) : (
          <EmptyState
            icon={<CalendarDays className="size-8" />}
            title="No attendance records yet"
            description="Once SubHub Managers save attendance, their payroll-ready totals will appear here."
          />
        )}
      </Panel>
    </section>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-10 text-center text-muted-foreground">
      {icon}
      <p className="mt-3 font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}
