import { randomUUID } from "node:crypto";
import { getControlPlaneDatabase, getCurrentUserRecord, type UserDocument } from "./auth.server";
import {
  ATTENDANCE_STATUSES,
  type AdminHrData,
  type AttendanceStatus,
  type DailyAttendance,
  type HrEmployee,
  type HrShift,
  type ManagerHrData,
  type PayrollSummary,
} from "./lib/hr-types";
import { getMongoDb } from "./mongodb.server";

type EmployeeDocument = {
  _id: string;
  name: string;
  employeeCode: string;
  active: boolean;
  shiftId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ShiftDocument = {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  createdAt: Date;
  updatedAt: Date;
};

type AttendanceDocument = {
  _id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  updatedAt: Date;
  updatedBy: string;
};

type HrCounterDocument = {
  _id: "employee-code";
  value: number;
  createdAt: Date;
  updatedAt: Date;
};

function emptyManagerData(): ManagerHrData {
  return { subhubName: "", employees: [], shifts: [], attendance: [], monthlySummary: [] };
}

function emptyAdminData(month: string): AdminHrData {
  return { month, summaries: [] };
}

function isManager(user: UserDocument | null): user is UserDocument {
  return (
    user?.panel === "subhub" &&
    user.role === "subhub" &&
    user.active &&
    user.permissions.includes("hr")
  );
}

function isAdmin(user: UserDocument | null): user is UserDocument {
  return Boolean(
    user?.active &&
    user.panel === "admin" &&
    (user.role === "master_admin" || (user.role === "admin" && user.permissions.includes("hr"))),
  );
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

function validTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours! >= 0 && hours! <= 23 && minutes! >= 0 && minutes! <= 59;
}

function employeeCodePrefix(subhubName: string | undefined): string {
  const prefix = (subhubName ?? "SubHub")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
  return prefix || "SUBHUB";
}

function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year!, monthNumber!, 1));
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start: `${month}-01`, end: next.toISOString().slice(0, 10) };
}

async function ensureHrIndexes(databaseName: string, subhubName?: string) {
  const db = await getMongoDb(databaseName);
  await Promise.all([
    db
      .collection<EmployeeDocument>("hr_employees")
      .createIndex({ employeeCode: 1 }, { unique: true }),
    db.collection<ShiftDocument>("hr_shifts").createIndex({ name: 1 }, { unique: true }),
    db
      .collection<AttendanceDocument>("hr_attendance")
      .createIndex({ employeeId: 1, date: 1 }, { unique: true }),
    db.collection<AttendanceDocument>("hr_attendance").createIndex({ date: 1 }),
  ]);
  const legacyEmployees = await db
    .collection<EmployeeDocument>("hr_employees")
    .find({ employeeCode: /^EMP-/ })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  if (legacyEmployees.length) {
    const prefix = employeeCodePrefix(subhubName);
    await Promise.all(
      legacyEmployees.map((employee, index) =>
        db.collection<EmployeeDocument>("hr_employees").updateOne(
          { _id: employee._id, employeeCode: /^EMP-/ },
          {
            $set: {
              employeeCode: `${prefix}-${String(index + 1).padStart(2, "0")}`,
              updatedAt: new Date(),
            },
          },
        ),
      ),
    );
    await db.collection<HrCounterDocument>("hr_counters").updateOne(
      { _id: "employee-code" },
      {
        $max: { value: legacyEmployees.length },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  if (subhubName) {
    const prefix = employeeCodePrefix(subhubName);
    const readableEmployees = await db
      .collection<EmployeeDocument>("hr_employees")
      .find({ employeeCode: new RegExp(`^${prefix}-\\d+$`) })
      .project({ employeeCode: 1 })
      .toArray();
    const highestSequence = readableEmployees.reduce((highest, employee) => {
      const sequence = Number(employee["employeeCode"].slice(prefix.length + 1));
      return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
    }, 0);
    if (highestSequence > 0) {
      await db.collection<HrCounterDocument>("hr_counters").updateOne(
        { _id: "employee-code" },
        {
          $max: { value: highestSequence },
          $set: { updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
    }
  }
  return db;
}

async function workspaceCollections(databaseName: string, subhubName?: string) {
  const db = await ensureHrIndexes(databaseName, subhubName);
  const [employees, shifts] = await Promise.all([
    db.collection<EmployeeDocument>("hr_employees").find().sort({ active: -1, name: 1 }).toArray(),
    db.collection<ShiftDocument>("hr_shifts").find().sort({ startTime: 1, name: 1 }).toArray(),
  ]);
  return { db, employees, shifts };
}

function serializeShift(shift: ShiftDocument): HrShift {
  return {
    id: shift._id,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    createdAt: shift.createdAt.toISOString(),
  };
}

function serializeEmployee(employee: EmployeeDocument, shifts: ShiftDocument[]): HrEmployee {
  return {
    id: employee._id,
    name: employee.name,
    employeeCode: employee.employeeCode,
    active: employee.active,
    shiftId: employee.shiftId,
    shiftName: shifts.find((shift) => shift._id === employee.shiftId)?.name ?? null,
    createdAt: employee.createdAt.toISOString(),
  };
}

function serializeAttendance(attendance: AttendanceDocument): DailyAttendance {
  return {
    id: attendance._id,
    employeeId: attendance.employeeId,
    date: attendance.date,
    status: attendance.status,
    updatedAt: attendance.updatedAt.toISOString(),
  };
}

function summarize(
  employees: EmployeeDocument[],
  attendance: AttendanceDocument[],
  subhubName: string,
  subhubUserId: string | null,
): PayrollSummary[] {
  const byEmployee = new Map<string, PayrollSummary>();
  employees.forEach((employee) => {
    byEmployee.set(employee._id, {
      subhubUserId,
      subhubName,
      employeeId: employee._id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      totalMarked: 0,
      active: employee.active,
    });
  });
  attendance.forEach((entry) => {
    const summary = byEmployee.get(entry.employeeId);
    if (!summary) return;
    if (entry.status === "Present") summary.present += 1;
    if (entry.status === "Absent") summary.absent += 1;
    if (entry.status === "Late") summary.late += 1;
    if (entry.status === "Half-day") summary.halfDay += 1;
    summary.totalMarked += 1;
  });
  return [...byEmployee.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export async function getManagerHrData(input: {
  date: string;
  month: string;
}): Promise<
  { ok: true; data: ManagerHrData } | { ok: false; data: ManagerHrData; message: string }
> {
  const current = await getCurrentUserRecord();
  const empty = emptyManagerData();
  if (!isManager(current))
    return { ok: false, data: empty, message: "Only SubHub Managers can access HR & Attendance." };
  if (!validDate(input.date) || !validMonth(input.month))
    return { ok: false, data: empty, message: "Choose a valid attendance date and report month." };

  const { db, employees, shifts } = await workspaceCollections(
    current.databaseName,
    current.subhubName,
  );
  const bounds = monthBounds(input.month);
  const [daily, monthly] = await Promise.all([
    db.collection<AttendanceDocument>("hr_attendance").find({ date: input.date }).toArray(),
    db
      .collection<AttendanceDocument>("hr_attendance")
      .find({ date: { $gte: bounds.start, $lt: bounds.end } })
      .toArray(),
  ]);
  return {
    ok: true,
    data: {
      subhubName: current.subhubName ?? "",
      employees: employees.map((employee) => serializeEmployee(employee, shifts)),
      shifts: shifts.map(serializeShift),
      attendance: daily.map(serializeAttendance),
      monthlySummary: summarize(employees, monthly, current.subhubName ?? "", current._id),
    },
  };
}

export async function createEmployee(input: {
  name: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isManager(current)) return { ok: false, message: "Only SubHub Managers can add employees." };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, message: "Enter an employee name." };
  const db = await ensureHrIndexes(current.databaseName, current.subhubName);
  const duplicate = await db.collection<EmployeeDocument>("hr_employees").findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) return { ok: false, message: "That employee is already in this SubHub." };
  const now = new Date();
  const counter = await db
    .collection<HrCounterDocument>("hr_counters")
    .findOneAndUpdate(
      { _id: "employee-code" },
      { $inc: { value: 1 }, $set: { updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
  const sequence =
    counter?.value ?? (await db.collection<EmployeeDocument>("hr_employees").countDocuments()) + 1;
  await db.collection<EmployeeDocument>("hr_employees").insertOne({
    _id: randomUUID().replace(/-/g, ""),
    name,
    employeeCode: `${employeeCodePrefix(current.subhubName)}-${String(sequence).padStart(2, "0")}`,
    active: true,
    shiftId: null,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true };
}

export async function updateEmployee(input: {
  id: string;
  name: string;
  active: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isManager(current))
    return { ok: false, message: "Only SubHub Managers can update employees." };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, message: "Enter an employee name." };
  const db = await ensureHrIndexes(current.databaseName, current.subhubName);
  const employee = await db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.id });
  if (!employee) return { ok: false, message: "Employee not found in this workspace." };
  const duplicate = await db.collection<EmployeeDocument>("hr_employees").findOne({
    _id: { $ne: input.id },
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) return { ok: false, message: "That employee name is already in this SubHub." };
  await db
    .collection<EmployeeDocument>("hr_employees")
    .updateOne({ _id: input.id }, { $set: { name, active: input.active, updatedAt: new Date() } });
  return { ok: true };
}

export async function createShift(input: {
  name: string;
  startTime: string;
  endTime: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isManager(current)) return { ok: false, message: "Only SubHub Managers can create shifts." };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || !validTime(input.startTime) || !validTime(input.endTime))
    return { ok: false, message: "Enter a shift name, start time, and end time." };
  const db = await ensureHrIndexes(current.databaseName, current.subhubName);
  const duplicate = await db.collection<ShiftDocument>("hr_shifts").findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) return { ok: false, message: "That shift already exists in this SubHub." };
  const now = new Date();
  await db.collection<ShiftDocument>("hr_shifts").insertOne({
    _id: randomUUID().replace(/-/g, ""),
    name,
    startTime: input.startTime,
    endTime: input.endTime,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true };
}

export async function assignEmployeeShift(input: {
  employeeId: string;
  shiftId: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isManager(current)) return { ok: false, message: "Only SubHub Managers can assign shifts." };
  const db = await ensureHrIndexes(current.databaseName, current.subhubName);
  const employee = await db
    .collection<EmployeeDocument>("hr_employees")
    .findOne({ _id: input.employeeId });
  if (!employee) return { ok: false, message: "Employee not found in this workspace." };
  if (
    input.shiftId &&
    !(await db.collection<ShiftDocument>("hr_shifts").findOne({ _id: input.shiftId }))
  )
    return { ok: false, message: "Shift not found in this workspace." };
  await db
    .collection<EmployeeDocument>("hr_employees")
    .updateOne(
      { _id: input.employeeId },
      { $set: { shiftId: input.shiftId, updatedAt: new Date() } },
    );
  return { ok: true };
}

export async function saveDailyAttendance(input: {
  date: string;
  entries: Array<{ employeeId: string; status: AttendanceStatus }>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isManager(current))
    return { ok: false, message: "Only SubHub Managers can save attendance." };
  if (!validDate(input.date)) return { ok: false, message: "Choose a valid attendance date." };
  const db = await ensureHrIndexes(current.databaseName, current.subhubName);
  const employees = await db
    .collection<EmployeeDocument>("hr_employees")
    .find({ _id: { $in: input.entries.map((entry) => entry.employeeId) }, active: true })
    .toArray();
  const employeeIds = new Set(employees.map((employee) => employee._id));
  if (
    input.entries.some(
      (entry) => !employeeIds.has(entry.employeeId) || !ATTENDANCE_STATUSES.includes(entry.status),
    )
  )
    return { ok: false, message: "Attendance includes an invalid or inactive employee." };
  const now = new Date();
  if (input.entries.length) {
    await db.collection<AttendanceDocument>("hr_attendance").bulkWrite(
      input.entries.map((entry) => ({
        updateOne: {
          filter: { employeeId: entry.employeeId, date: input.date },
          update: {
            $set: {
              _id: `${entry.employeeId}_${input.date}`,
              employeeId: entry.employeeId,
              date: input.date,
              status: entry.status,
              updatedAt: now,
              updatedBy: current._id,
            },
          },
          upsert: true,
        },
      })),
    );
  }
  return { ok: true };
}

export async function getAdminHrReport(input: {
  month: string;
}): Promise<{ ok: true; data: AdminHrData } | { ok: false; data: AdminHrData; message: string }> {
  const current = await getCurrentUserRecord();
  const empty = emptyAdminData(input.month);
  if (!isAdmin(current))
    return {
      ok: false,
      data: empty,
      message: "Only Admin users can view HR reports across SubHubs.",
    };
  if (!validMonth(input.month))
    return { ok: false, data: empty, message: "Choose a valid report month." };
  const controlDb = await getControlPlaneDatabase();
  const users = await controlDb
    .collection<UserDocument>("users")
    .find({ panel: "subhub", role: "subhub", active: true, subhubName: { $exists: true, $ne: "" } })
    .sort({ subhubName: 1, name: 1 })
    .toArray();
  const bounds = monthBounds(input.month);
  const summaries = await Promise.all(
    users.map(async (user) => {
      const db = await ensureHrIndexes(user.databaseName, user.subhubName);
      const [employees, attendance] = await Promise.all([
        db.collection<EmployeeDocument>("hr_employees").find().sort({ name: 1 }).toArray(),
        db
          .collection<AttendanceDocument>("hr_attendance")
          .find({ date: { $gte: bounds.start, $lt: bounds.end } })
          .toArray(),
      ]);
      return summarize(employees, attendance, user.subhubName!, user._id);
    }),
  );
  return { ok: true, data: { month: input.month, summaries: summaries.flat() } };
}
