import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { getControlPlaneDatabase, getCurrentUserRecord, type UserDocument } from "./auth.server";
import { getMongoDb } from "./mongodb.server";

export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Half-day"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type HrEmployee = {
  id: string;
  name: string;
  employeeNumber: string;
  active: boolean;
  createdAt: string;
};

export type HrShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  assignedEmployeeIds: string[];
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  updatedAt: string;
};

export type AttendanceSummary = {
  employeeId: string;
  employeeName: string;
  active: boolean;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
};

export type ManagerHrData = {
  subhubName: string;
  month: string;
  employees: HrEmployee[];
  shifts: HrShift[];
  attendance: AttendanceRecord[];
  summary: AttendanceSummary[];
};

export type AdminHrSummary = AttendanceSummary & {
  subhubId: string;
  subhubName: string;
};

export type AdminHrData = {
  month: string;
  subhubs: string[];
  summaries: AdminHrSummary[];
};

type EmployeeDocument = {
  _id: string;
  name: string;
  normalizedName: string;
  employeeNumber?: string | undefined;
  normalizedEmployeeNumber?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ShiftDocument = {
  _id: string;
  name: string;
  normalizedName: string;
  startTime: string;
  endTime: string;
  createdAt: Date;
  updatedAt: Date;
};

type ShiftAssignmentDocument = {
  _id: string;
  shiftId: string;
  employeeId: string;
  createdAt: Date;
  updatedAt: Date;
};

type AttendanceDocument = {
  _id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  updatedAt: Date;
  createdAt: Date;
};

const indexesByDatabase = new Map<string, Promise<void>>();

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmployeeNumber(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function employeeNumberPrefix(subhubName: string): string {
  const prefix = normalizeEmployeeNumber(subhubName).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return prefix.slice(0, 24) || "SUBHUB";
}

async function generateEmployeeNumber(db: Db, subhubName: string): Promise<string> {
  const prefix = employeeNumberPrefix(subhubName);
  let sequence = (await db.collection<EmployeeDocument>("hr_employees").countDocuments()) + 1;
  let employeeNumber = `${prefix}-${String(sequence).padStart(2, "0")}`;
  while (await db.collection<EmployeeDocument>("hr_employees").findOne({ normalizedEmployeeNumber: employeeNumber })) {
    sequence += 1;
    employeeNumber = `${prefix}-${String(sequence).padStart(2, "0")}`;
  }
  return employeeNumber;
}

function normalizeDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function normalizeMonth(value: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  return value;
}

function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function normalizeTime(value: string): string | null {
  return /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60 ? value : null;
}

function isAdmin(user: UserDocument | null): user is UserDocument {
  return Boolean(
    user &&
      user.panel === "admin" &&
      (user.role === "master_admin" || user.role === "admin") &&
      (user.role === "master_admin" || user.permissions.includes("hr")),
  );
}

function isSubhub(user: UserDocument | null): user is UserDocument {
  return Boolean(user && user.panel === "subhub" && user.role === "subhub" && user.permissions.includes("hr"));
}

function emptyManagerData(): ManagerHrData {
  return { subhubName: "", month: "", employees: [], shifts: [], attendance: [], summary: [] };
}

function emptyAdminData(): AdminHrData {
  return { month: "", subhubs: [], summaries: [] };
}

async function ensureHrIndexes(db: Db): Promise<void> {
  const databaseName = db.databaseName;
  let promise = indexesByDatabase.get(databaseName);
  if (!promise) {
    promise = Promise.all([
      db.collection<EmployeeDocument>("hr_employees").createIndex({ normalizedName: 1 }, { unique: true }),
      db.collection<EmployeeDocument>("hr_employees").createIndex({ normalizedEmployeeNumber: 1 }, { unique: true, sparse: true }),
      db.collection<ShiftDocument>("hr_shifts").createIndex({ normalizedName: 1 }, { unique: true }),
      db.collection<ShiftAssignmentDocument>("hr_shift_assignments").createIndex({ employeeId: 1, shiftId: 1 }, { unique: true }),
      db.collection<AttendanceDocument>("hr_attendance").createIndex({ employeeId: 1, date: 1 }, { unique: true }),
      db.collection<AttendanceDocument>("hr_attendance").createIndex({ date: 1 }),
    ]).then(() => undefined);
    indexesByDatabase.set(databaseName, promise);
  }
  await promise;
}

function serializeEmployee(employee: EmployeeDocument): HrEmployee {
  return {
    id: employee._id,
    name: employee.name,
    employeeNumber: employee.employeeNumber ?? "",
    active: employee.active,
    createdAt: employee.createdAt.toISOString(),
  };
}

function serializeAttendance(record: AttendanceDocument): AttendanceRecord {
  return { id: record._id, employeeId: record.employeeId, date: record.date, status: record.status, updatedAt: record.updatedAt.toISOString() };
}

function buildSummary(employees: EmployeeDocument[], attendance: AttendanceDocument[]): AttendanceSummary[] {
  const byEmployee = new Map<string, AttendanceSummary>();
  employees.forEach((employee) => {
    byEmployee.set(employee._id, {
      employeeId: employee._id,
      employeeName: employee.name,
      active: employee.active,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
    });
  });
  attendance.forEach((record) => {
    const summary = byEmployee.get(record.employeeId);
    if (!summary) return;
    if (record.status === "Present") summary.present += 1;
    if (record.status === "Absent") summary.absent += 1;
    if (record.status === "Late") summary.late += 1;
    if (record.status === "Half-day") summary.halfDay += 1;
  });
  return [...byEmployee.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.employeeName.localeCompare(b.employeeName));
}

async function readWorkspaceHrData(databaseName: string, month: string): Promise<{
  employees: EmployeeDocument[];
  shifts: ShiftDocument[];
  assignments: ShiftAssignmentDocument[];
  attendance: AttendanceDocument[];
}> {
  const db = await getMongoDb(databaseName);
  await ensureHrIndexes(db);
  const bounds = monthBounds(month);
  const [employees, shifts, assignments, attendance] = await Promise.all([
    db.collection<EmployeeDocument>("hr_employees").find().sort({ active: -1, name: 1 }).toArray(),
    db.collection<ShiftDocument>("hr_shifts").find().sort({ name: 1 }).toArray(),
    db.collection<ShiftAssignmentDocument>("hr_shift_assignments").find().toArray(),
    db.collection<AttendanceDocument>("hr_attendance").find({ date: { $gte: bounds.start, $lte: bounds.end } }).sort({ date: -1 }).toArray(),
  ]);
  return { employees, shifts, assignments, attendance };
}

function serializeShifts(shifts: ShiftDocument[], assignments: ShiftAssignmentDocument[]): HrShift[] {
  return shifts.map((shift) => ({
    id: shift._id,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    assignedEmployeeIds: assignments.filter((assignment) => assignment.shiftId === shift._id).map((assignment) => assignment.employeeId),
  }));
}

export async function getManagerHrData(monthInput: string): Promise<
  { ok: true; data: ManagerHrData } | { ok: false; data: ManagerHrData; message: string }
> {
  const current = await getCurrentUserRecord();
  const month = normalizeMonth(monthInput);
  if (!isSubhub(current)) return { ok: false, data: emptyManagerData(), message: "Only SubHub Managers can use HR & Attendance." };
  if (!month) return { ok: false, data: emptyManagerData(), message: "Choose a valid report month." };
  const workspace = await readWorkspaceHrData(current.databaseName, month);
  return {
    ok: true,
    data: {
      subhubName: current.subhubName ?? "SubHub",
      month,
      employees: workspace.employees.map(serializeEmployee),
      shifts: serializeShifts(workspace.shifts, workspace.assignments),
      attendance: workspace.attendance.map(serializeAttendance),
      summary: buildSummary(workspace.employees, workspace.attendance),
    },
  };
}

export async function createEmployee(
  nameInput: string,
  employeeNumberInput = "",
  shiftIds: string[] = [],
): Promise<{ ok: true; employee: HrEmployee } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can add employees." };
  const name = normalizeName(nameInput);
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Employee name must be between 2 and 80 characters." };
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const requestedNumber = normalizeEmployeeNumber(employeeNumberInput);
  if (requestedNumber && !/^[A-Z0-9][A-Z0-9 -]{0,29}$/.test(requestedNumber)) {
    return { ok: false, message: "Employee number may contain letters, numbers, spaces, and hyphens only." };
  }
  const selectedShiftIds = [...new Set(shiftIds)];
  if (selectedShiftIds.length) {
    const matchingShifts = await db.collection<ShiftDocument>("hr_shifts").countDocuments({ _id: { $in: selectedShiftIds } });
    if (matchingShifts !== selectedShiftIds.length) return { ok: false, message: "One or more selected shifts do not belong to this workspace." };
  }
  let employeeNumber = requestedNumber;
  if (!employeeNumber) employeeNumber = await generateEmployeeNumber(db, current.subhubName ?? "SubHub");
  const now = new Date();
  const employee: EmployeeDocument = {
    _id: randomUUID().replace(/-/g, ""),
    name,
    normalizedName: name.toLowerCase(),
    employeeNumber,
    normalizedEmployeeNumber: employeeNumber,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.collection<EmployeeDocument>("hr_employees").insertOne(employee);
    if (selectedShiftIds.length) {
      await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").insertMany(
        selectedShiftIds.map((shiftId) => ({
          _id: randomUUID().replace(/-/g, ""),
          shiftId,
          employeeId: employee._id,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) return { ok: false, message: "That employee name or number already exists in this workspace." };
    throw error;
  }
  return { ok: true, employee: serializeEmployee(employee) };
}

export async function updateEmployee(input: {
  id: string;
  name: string;
  employeeNumber?: string | undefined;
  active: boolean;
}): Promise<{ ok: true; employee: HrEmployee } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can update employees." };
  const name = normalizeName(input.name);
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Employee name must be between 2 and 80 characters." };
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const existing = await db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.id });
  if (!existing) return { ok: false, message: "That employee no longer exists in this workspace." };
  let employeeNumber = normalizeEmployeeNumber(input.employeeNumber ?? existing.employeeNumber ?? "");
  if (!employeeNumber) employeeNumber = await generateEmployeeNumber(db, current.subhubName ?? "SubHub");
  if (!employeeNumber || !/^[A-Z0-9][A-Z0-9 -]{0,29}$/.test(employeeNumber)) {
    return { ok: false, message: "Enter a valid employee number." };
  }
  const now = new Date();
  try {
    const result = await db.collection<EmployeeDocument>("hr_employees").findOneAndUpdate(
      { _id: input.id },
      { $set: { name, normalizedName: name.toLowerCase(), employeeNumber, normalizedEmployeeNumber: employeeNumber, active: input.active, updatedAt: now } },
      { returnDocument: "after" },
    );
    if (!result) return { ok: false, message: "That employee no longer exists in this workspace." };
    return { ok: true, employee: serializeEmployee(result) };
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) return { ok: false, message: "That employee name or number already exists in this workspace." };
    throw error;
  }
}

export async function saveAttendance(input: {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
}): Promise<{ ok: true; attendance: AttendanceRecord } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can record attendance." };
  const date = normalizeDate(input.date);
  if (!date) return { ok: false, message: "Enter a valid attendance date." };
  if (!ATTENDANCE_STATUSES.includes(input.status)) return { ok: false, message: "Choose a valid attendance status." };
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const employee = await db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.employeeId });
  if (!employee) return { ok: false, message: "That employee does not belong to this workspace." };
  const now = new Date();
  const id = `${input.employeeId}_${date}`;
  try {
    await db.collection<AttendanceDocument>("hr_attendance").updateOne(
      { employeeId: input.employeeId, date },
      { $set: { employeeId: input.employeeId, date, status: input.status, updatedAt: now }, $setOnInsert: { _id: id, createdAt: now } },
      { upsert: true },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) return { ok: false, message: "Attendance was updated by another save. Please refresh and try again." };
    throw error;
  }
  const record = await db.collection<AttendanceDocument>("hr_attendance").findOne({ employeeId: input.employeeId, date });
  if (!record) return { ok: false, message: "Attendance could not be saved. Please try again." };
  return { ok: true, attendance: serializeAttendance(record) };
}

export async function createShift(input: {
  name: string;
  startTime: string;
  endTime: string;
}): Promise<{ ok: true; shift: HrShift } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can create shifts." };
  const name = normalizeName(input.name);
  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Shift name must be between 2 and 80 characters." };
  if (!startTime || !endTime || startTime === endTime) {
    return { ok: false, message: "Enter valid times, with different start and end times." };
  }
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const now = new Date();
  const shift: ShiftDocument = { _id: randomUUID().replace(/-/g, ""), name, normalizedName: name.toLowerCase(), startTime, endTime, createdAt: now, updatedAt: now };
  try {
    await db.collection<ShiftDocument>("hr_shifts").insertOne(shift);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) return { ok: false, message: "A shift with that name already exists in this workspace." };
    throw error;
  }
  return { ok: true, shift: { ...serializeShifts([shift], [])[0]!, assignedEmployeeIds: [] } };
}

export async function assignEmployeeToShift(input: {
  employeeId: string;
  shiftId: string;
  assigned: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord();
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can assign shifts." };
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const [employee, shift] = await Promise.all([
    db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.employeeId, active: true }),
    db.collection<ShiftDocument>("hr_shifts").findOne({ _id: input.shiftId }),
  ]);
  if (!employee) return { ok: false, message: "Select an active employee from this workspace." };
  if (!shift) return { ok: false, message: "That shift does not exist in this workspace." };
  if (input.assigned) {
    const now = new Date();
    await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").updateOne(
      { employeeId: input.employeeId, shiftId: input.shiftId },
      { $set: { employeeId: input.employeeId, shiftId: input.shiftId, updatedAt: now }, $setOnInsert: { _id: randomUUID().replace(/-/g, ""), createdAt: now } },
      { upsert: true },
    );
  } else {
    await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").deleteOne({ employeeId: input.employeeId, shiftId: input.shiftId });
  }
  return { ok: true };
}

export async function getAdminHrData(monthInput: string): Promise<
  { ok: true; data: AdminHrData } | { ok: false; data: AdminHrData; message: string }
> {
  const current = await getCurrentUserRecord();
  const month = normalizeMonth(monthInput);
  if (!isAdmin(current)) return { ok: false, data: emptyAdminData(), message: "Only Admin users can view HR reports across SubHubs." };
  if (!month) return { ok: false, data: emptyAdminData(), message: "Choose a valid report month." };
  const controlDb = await getControlPlaneDatabase();
  const users = await controlDb.collection<UserDocument>("users").find({ panel: "subhub", role: "subhub", active: true }).sort({ subhubName: 1 }).toArray();
  const workspaces = await Promise.all(users.map(async (user) => ({ user, data: await readWorkspaceHrData(user.databaseName, month) })));
  const summaries = workspaces.flatMap(({ user, data }) =>
    buildSummary(data.employees, data.attendance).map((summary) => ({
      ...summary,
      subhubId: user._id,
      subhubName: user.subhubName ?? "SubHub",
    })),
  );
  return { ok: true, data: { month, subhubs: users.map((user) => user.subhubName ?? "SubHub"), summaries } };
}