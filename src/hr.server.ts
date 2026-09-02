import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { getControlPlaneDatabase, getCurrentUserRecord, type UserDocument } from "./auth.server";
import { getMongoDb } from "./mongodb.server";

export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Half-day"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type HrEmployee = {
  id: string;
  name: string;
  phoneNumber: string;
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
  subhubManagerName: string;
  month: string;
  employees: HrEmployee[];
  shifts: HrShift[];
  attendance: AttendanceRecord[];
  summary: AttendanceSummary[];
};

export type AdminHrSummary = AttendanceSummary & {
  subhubId: string;
  subhubName: string;
  subhubManagerName: string;
};

export type AdminHrData = {
  month: string;
  subhubs: string[];
  summaries: AdminHrSummary[];
};

export type AdminHrSubhub = {
  id: string;
  name: string;
  managerName: string;
};

export type AdminAttendanceRecord = AttendanceRecord & {
  employeeName: string;
  subhubId: string;
  subhubName: string;
  subhubManagerName: string;
};

export type AdminAttendanceReport = {
  startDate: string;
  endDate: string;
  subhubs: AdminHrSubhub[];
  summaries: AdminHrSummary[];
  attendance: AdminAttendanceRecord[];
};

export type EmployeeAttendanceHistory = {
  employee: HrEmployee;
  subhubName: string;
  subhubManagerName: string;
  shift: HrShift | null;
  attendance: AttendanceRecord[];
  summary: AttendanceSummary;
  startDate: string | null;
  endDate: string;
};

export type ManagerAttendanceReport = {
  subhubName: string;
  subhubManagerName: string;
  startDate: string;
  endDate: string;
  employees: HrEmployee[];
  attendance: AttendanceRecord[];
  summary: AttendanceSummary[];
};

type EmployeeDocument = {
  _id: string;
  name: string;
  normalizedName: string;
  phoneNumber?: string;
  normalizedPhoneNumber?: string;
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

function normalizePhoneNumber(value: string): string {
  return value.trim();
}

function isIndianPhoneNumber(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value);
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

function todayInIndia(): string {
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

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function earlierDate(left: string, right: string): string {
  return left < right ? left : right;
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
  return { subhubName: "", subhubManagerName: "", month: "", employees: [], shifts: [], attendance: [], summary: [] };
}

function emptyAdminData(): AdminHrData {
  return { month: "", subhubs: [], summaries: [] };
}

function emptyAdminAttendanceReport(): AdminAttendanceReport {
  return { startDate: "", endDate: "", subhubs: [], summaries: [], attendance: [] };
}

async function ensureHrIndexes(db: Db): Promise<void> {
  const databaseName = db.databaseName;
  let promise = indexesByDatabase.get(databaseName);
  if (!promise) {
    promise = Promise.all([
      db.collection<EmployeeDocument>("hr_employees").createIndex({ normalizedName: 1 }, { unique: true }),
      db.collection<EmployeeDocument>("hr_employees").createIndex({ normalizedPhoneNumber: 1 }, { unique: true, sparse: true }),
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
    phoneNumber: employee.phoneNumber ?? "",
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

async function readWorkspaceHrDataForRange(databaseName: string, startDate: string, endDate: string): Promise<{
  employees: EmployeeDocument[];
  shifts: ShiftDocument[];
  assignments: ShiftAssignmentDocument[];
  attendance: AttendanceDocument[];
}> {
  const db = await getMongoDb(databaseName);
  await ensureHrIndexes(db);
  const [employees, shifts, assignments, attendance] = await Promise.all([
    db.collection<EmployeeDocument>("hr_employees").find().sort({ active: -1, name: 1 }).toArray(),
    db.collection<ShiftDocument>("hr_shifts").find().sort({ name: 1 }).toArray(),
    db.collection<ShiftAssignmentDocument>("hr_shift_assignments").find().toArray(),
    db.collection<AttendanceDocument>("hr_attendance").find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: -1 }).toArray(),
  ]);
  return { employees, shifts, assignments, attendance };
}

async function ensureDefaultShifts(db: Db): Promise<void> {
  const now = new Date();
  const defaults = [
    { names: ["day", "day-shift", "day shift"], name: "Day shift", normalizedName: "day shift", startTime: "09:00", endTime: "17:00" },
    { names: ["night", "night-shift", "night shift"], name: "Night shift", normalizedName: "night shift", startTime: "18:00", endTime: "03:00" },
  ];
  const existing = await db.collection<ShiftDocument>("hr_shifts").find().toArray();
  const canonicalByDefault = new Map<string, string>();
  const obsoleteToCanonical = new Map<string, string>();
  const keepIds = new Set<string>();

  for (const shift of defaults) {
    const matches = existing
      .filter((candidate) => {
        const candidateName = candidate.normalizedName?.toLowerCase() ?? normalizeName(candidate.name).toLowerCase();
        return shift.names.includes(candidateName);
      })
      .sort((left, right) => Number(right.normalizedName === shift.normalizedName) - Number(left.normalizedName === shift.normalizedName));
    const canonical = matches[0];
    if (canonical) {
      canonicalByDefault.set(shift.normalizedName, canonical._id);
      keepIds.add(canonical._id);
      matches.slice(1).forEach((duplicate) => obsoleteToCanonical.set(duplicate._id, canonical._id));
    }
  }

  const obsoleteIds = existing.map((shift) => shift._id).filter((id) => !keepIds.has(id));
  const obsoleteAssignments = obsoleteIds.length
    ? await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").find({ shiftId: { $in: obsoleteIds } }).toArray()
    : [];

  for (const assignment of obsoleteAssignments) {
    const targetShiftId = obsoleteToCanonical.get(assignment.shiftId);
    if (!targetShiftId) {
      await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").deleteOne({ _id: assignment._id });
      continue;
    }
    const duplicateAssignment = await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").findOne({
      employeeId: assignment.employeeId,
      shiftId: targetShiftId,
      _id: { $ne: assignment._id },
    });
    if (duplicateAssignment) {
      await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").deleteOne({ _id: assignment._id });
    } else {
      await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").updateOne(
        { _id: assignment._id },
        { $set: { shiftId: targetShiftId, updatedAt: now } },
      );
    }
  }

  if (obsoleteIds.length) {
    await db.collection<ShiftDocument>("hr_shifts").deleteMany({ _id: { $in: obsoleteIds } });
  }

  for (const shift of defaults) {
    const canonicalId = canonicalByDefault.get(shift.normalizedName);
    if (canonicalId) {
      const canonical = existing.find((shift) => shift._id === canonicalId);
      const canonicalName = canonical?.normalizedName?.toLowerCase() ?? (canonical ? normalizeName(canonical.name).toLowerCase() : "");
      const isLegacyName = canonicalName !== shift.normalizedName;
      await db.collection<ShiftDocument>("hr_shifts").updateOne(
        { _id: canonicalId },
        {
          $set: {
            name: shift.name,
            normalizedName: shift.normalizedName,
            ...(isLegacyName ? { startTime: shift.startTime, endTime: shift.endTime } : {}),
            updatedAt: now,
          },
        },
      );
      continue;
    }

    const id = randomUUID().replace(/-/g, "");
    await db.collection<ShiftDocument>("hr_shifts").insertOne({
      _id: id,
      name: shift.name,
      normalizedName: shift.normalizedName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      createdAt: now,
      updatedAt: now,
    });
  }
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
  const current = await getCurrentUserRecord("subhub");
  const month = normalizeMonth(monthInput);
  if (!isSubhub(current)) return { ok: false, data: emptyManagerData(), message: "Only SubHub Managers can use HR & Attendance." };
  if (!month) return { ok: false, data: emptyManagerData(), message: "Choose a valid report month." };
  const managerDb = await getMongoDb(current.databaseName);
  await ensureHrIndexes(managerDb);
  await ensureDefaultShifts(managerDb);
  const workspace = await readWorkspaceHrData(current.databaseName, month);
  return {
    ok: true,
    data: {
      subhubName: current.subhubName ?? "SubHub",
      subhubManagerName: current.name,
      month,
      employees: workspace.employees.map(serializeEmployee),
      shifts: serializeShifts(workspace.shifts, workspace.assignments),
      attendance: workspace.attendance.map(serializeAttendance),
      summary: buildSummary(workspace.employees, workspace.attendance),
    },
  };
}

export async function getEmployeeAttendanceHistory(input: {
  employeeId: string;
  period: "all" | "week" | "month" | "range";
  weekStart?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}): Promise<
  { ok: true; data: EmployeeAttendanceHistory } | { ok: false; message: string }
> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can view employee attendance history." };
  if (!input.employeeId.trim()) return { ok: false, message: "Choose an employee to view." };

  const today = todayInIndia();
  let startDate: string | null = null;
  let endDate = today;
  if (input.period === "month") {
    const month = normalizeMonth(input.month ?? "");
    if (!month) return { ok: false, message: "Choose a valid report month." };
    const bounds = monthBounds(month);
    startDate = bounds.start;
    endDate = earlierDate(bounds.end, today);
  } else if (input.period === "week") {
    const weekStart = normalizeDate(input.weekStart ?? "");
    if (!weekStart) return { ok: false, message: "Choose a valid week start date." };
    startDate = weekStart;
    endDate = earlierDate(addDays(weekStart, 6), today);
  } else if (input.period === "range") {
    const rangeStart = normalizeDate(input.startDate ?? "");
    const rangeEnd = normalizeDate(input.endDate ?? "");
    if (!rangeStart || !rangeEnd) return { ok: false, message: "Choose a valid start and end date." };
    if (rangeStart > rangeEnd) return { ok: false, message: "The start date must be before the end date." };
    startDate = rangeStart;
    endDate = earlierDate(rangeEnd, today);
  }

  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const employee = await db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.employeeId });
  if (!employee) return { ok: false, message: "That employee does not belong to this workspace." };

  const assignment = await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").findOne({ employeeId: employee._id });
  const shift = assignment
    ? await db.collection<ShiftDocument>("hr_shifts").findOne({ _id: assignment.shiftId })
    : null;
  const dateFilter = startDate && startDate > endDate
    ? { $in: [] as string[] }
    : startDate
      ? { $gte: startDate, $lte: endDate }
      : { $lte: endDate };
  const attendance = await db
    .collection<AttendanceDocument>("hr_attendance")
    .find({ employeeId: employee._id, date: dateFilter })
    .sort({ date: -1 })
    .toArray();
  const summary = buildSummary([employee], attendance)[0]!;

  return {
    ok: true,
    data: {
      employee: serializeEmployee(employee),
      subhubName: current.subhubName ?? "SubHub",
      subhubManagerName: current.name,
      shift: shift
        ? {
            id: shift._id,
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            assignedEmployeeIds: [employee._id],
          }
        : null,
      attendance: attendance.map(serializeAttendance),
      summary,
      startDate,
      endDate,
    },
  };
}

export async function getManagerAttendanceReport(input: {
  rangeType: "month" | "date" | "range";
  month?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<
  { ok: true; data: ManagerAttendanceReport } | { ok: false; message: string }
> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can view attendance reports." };

  let startDate = "";
  let endDate = "";
  if (input.rangeType === "month") {
    const month = normalizeMonth(input.month ?? "");
    if (!month) return { ok: false, message: "Choose a valid report month." };
    const bounds = monthBounds(month);
    startDate = bounds.start;
    endDate = earlierDate(bounds.end, todayInIndia());
  } else if (input.rangeType === "date") {
    const date = normalizeDate(input.date ?? "");
    if (!date) return { ok: false, message: "Choose a valid attendance date." };
    startDate = date;
    endDate = date;
  } else {
    const rangeStart = normalizeDate(input.startDate ?? "");
    const rangeEnd = normalizeDate(input.endDate ?? "");
    if (!rangeStart || !rangeEnd) return { ok: false, message: "Choose a valid start and end date." };
    if (rangeStart > rangeEnd) return { ok: false, message: "The start date must be before the end date." };
    startDate = rangeStart;
    endDate = earlierDate(rangeEnd, todayInIndia());
  }

  const workspace = await readWorkspaceHrDataForRange(current.databaseName, startDate, endDate);
  return {
    ok: true,
    data: {
      subhubName: current.subhubName ?? "SubHub",
      subhubManagerName: current.name,
      startDate,
      endDate,
      employees: workspace.employees.map(serializeEmployee),
      attendance: workspace.attendance.map(serializeAttendance),
      summary: buildSummary(workspace.employees, workspace.attendance),
    },
  };
}

export async function createEmployee(
  nameInput: string,
  phoneNumberInput = "",
  shiftIds: string[] = [],
): Promise<{ ok: true; employee: HrEmployee } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can add employees." };
  const name = normalizeName(nameInput);
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Employee name must be between 2 and 80 characters." };
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const phoneNumber = normalizePhoneNumber(phoneNumberInput);
  if (!isIndianPhoneNumber(phoneNumber)) return { ok: false, message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9." };
  const selectedShiftIds = [...new Set(shiftIds)];
  if (selectedShiftIds.length > 1) return { ok: false, message: "Select one shift for each employee." };
  if (selectedShiftIds.length) {
    const matchingShifts = await db.collection<ShiftDocument>("hr_shifts").countDocuments({ _id: { $in: selectedShiftIds } });
    if (matchingShifts !== selectedShiftIds.length) return { ok: false, message: "One or more selected shifts do not belong to this workspace." };
  }
  const now = new Date();
  const employee: EmployeeDocument = {
    _id: randomUUID().replace(/-/g, ""),
    name,
    normalizedName: name.toLowerCase(),
    phoneNumber,
    normalizedPhoneNumber: phoneNumber,
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
    if (error instanceof Error && error.message.includes("E11000")) return { ok: false, message: "That employee name or mobile number already exists in this workspace." };
    throw error;
  }
  return { ok: true, employee: serializeEmployee(employee) };
}

export async function updateEmployee(input: {
  id: string;
  name: string;
  phoneNumber?: string | undefined;
  active: boolean;
}): Promise<{ ok: true; employee: HrEmployee } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can update employees." };
  const name = normalizeName(input.name);
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Employee name must be between 2 and 80 characters." };
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const existing = await db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.id });
  if (!existing) return { ok: false, message: "That employee no longer exists in this workspace." };
  const phoneNumber = normalizePhoneNumber(input.phoneNumber ?? "");
  if (!isIndianPhoneNumber(phoneNumber)) {
    return { ok: false, message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9." };
  }
  const now = new Date();
  try {
    const set: Partial<EmployeeDocument> = {
      name,
      normalizedName: name.toLowerCase(),
      phoneNumber,
      normalizedPhoneNumber: phoneNumber,
      active: input.active,
      updatedAt: now,
    };
    const result = await db.collection<EmployeeDocument>("hr_employees").findOneAndUpdate(
      { _id: input.id },
      { $set: set },
      { returnDocument: "after" },
    );
    if (!result) return { ok: false, message: "That employee no longer exists in this workspace." };
    return { ok: true, employee: serializeEmployee(result) };
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) return { ok: false, message: "That employee name or mobile number already exists in this workspace." };
    throw error;
  }
}

export async function saveAttendance(input: {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
}): Promise<{ ok: true; attendance: AttendanceRecord } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
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
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can create shifts." };
  return { ok: false, message: "Only the default Day shift and Night shift are available." };
}

export async function updateShift(input: {
  id: string;
  startTime: string;
  endTime: string;
}): Promise<{ ok: true; shift: HrShift } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can edit shifts." };
  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  if (!startTime || !endTime || startTime === endTime) {
    return { ok: false, message: "Enter valid times, with different start and end times." };
  }

  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const shift = await db.collection<ShiftDocument>("hr_shifts").findOne({
    _id: input.id,
    normalizedName: { $in: ["day shift", "night shift"] },
  });
  if (!shift) return { ok: false, message: "Only the Day shift and Night shift timings can be edited." };

  const now = new Date();
  const result = await db.collection<ShiftDocument>("hr_shifts").findOneAndUpdate(
    { _id: shift._id },
    { $set: { startTime, endTime, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!result) return { ok: false, message: "Shift timing could not be saved." };
  return {
    ok: true,
    shift: {
      id: result._id,
      name: result.name,
      startTime: result.startTime,
      endTime: result.endTime,
      assignedEmployeeIds: [],
    },
  };
}

export async function assignEmployeeToShift(input: {
  employeeId: string;
  shiftId: string;
  assigned: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can assign shifts." };
  const db = await getMongoDb(current.databaseName);
  await ensureHrIndexes(db);
  const employee = await db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.employeeId, active: true });
  if (!employee) return { ok: false, message: "Select an active employee from this workspace." };
  if (input.assigned) {
    const shift = await db.collection<ShiftDocument>("hr_shifts").findOne({ _id: input.shiftId });
    if (!shift) return { ok: false, message: "That shift does not exist in this workspace." };
    const now = new Date();
    await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").deleteMany({ employeeId: input.employeeId, shiftId: { $ne: input.shiftId } });
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
  const current = await getCurrentUserRecord("admin");
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
      subhubManagerName: user.name,
    })),
  );
  return { ok: true, data: { month, subhubs: users.map((user) => user.subhubName ?? "SubHub"), summaries } };
}

function adminReportBounds(input: {
  rangeType: "month" | "date" | "range";
  month?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): { ok: true; startDate: string; endDate: string } | { ok: false; message: string } {
  if (input.rangeType === "month") {
    const month = normalizeMonth(input.month ?? "");
    if (!month) return { ok: false, message: "Choose a valid report month." };
    const bounds = monthBounds(month);
    return { ok: true, startDate: bounds.start, endDate: earlierDate(bounds.end, todayInIndia()) };
  }
  if (input.rangeType === "date") {
    const date = normalizeDate(input.date ?? "");
    if (!date) return { ok: false, message: "Choose a valid attendance date." };
    return { ok: true, startDate: date, endDate: date };
  }
  const startDate = normalizeDate(input.startDate ?? "");
  const requestedEndDate = normalizeDate(input.endDate ?? "");
  if (!startDate || !requestedEndDate) return { ok: false, message: "Choose a valid start and end date." };
  if (startDate > requestedEndDate) return { ok: false, message: "The start date must be before the end date." };
  return { ok: true, startDate, endDate: earlierDate(requestedEndDate, todayInIndia()) };
}

export async function getAdminAttendanceReport(input: {
  rangeType: "month" | "date" | "range";
  month?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<
  { ok: true; data: AdminAttendanceReport } | { ok: false; data: AdminAttendanceReport; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, data: emptyAdminAttendanceReport(), message: "Only Admin users can view HR reports across SubHubs." };
  const bounds = adminReportBounds(input);
  if (!bounds.ok) return { ok: false, data: emptyAdminAttendanceReport(), message: bounds.message };

  const controlDb = await getControlPlaneDatabase();
  const users = await controlDb.collection<UserDocument>("users")
    .find({ panel: "subhub", role: "subhub", active: true })
    .sort({ subhubName: 1, name: 1 })
    .toArray();
  const workspaces = await Promise.all(users.map(async (user) => ({
    user,
    data: await readWorkspaceHrDataForRange(user.databaseName, bounds.startDate, bounds.endDate),
  })));
  const subhubs = users.map((user) => ({ id: user._id, name: user.subhubName ?? "SubHub", managerName: user.name }));
  const summaries = workspaces.flatMap(({ user, data }) =>
    buildSummary(data.employees, data.attendance).map((summary) => ({
      ...summary,
      subhubId: user._id,
      subhubName: user.subhubName ?? "SubHub",
      subhubManagerName: user.name,
    })),
  );
  const attendance = workspaces.flatMap(({ user, data }) => {
    const employeesById = new Map(data.employees.map((employee) => [employee._id, employee.name]));
    return data.attendance.map((record) => ({
      ...serializeAttendance(record),
      employeeName: employeesById.get(record.employeeId) ?? "Employee",
      subhubId: user._id,
      subhubName: user.subhubName ?? "SubHub",
      subhubManagerName: user.name,
    }));
  });

  return {
    ok: true,
    data: { startDate: bounds.startDate, endDate: bounds.endDate, subhubs, summaries, attendance },
  };
}

export async function getAdminEmployeeAttendanceHistory(input: {
  subhubId: string;
  employeeId: string;
  period: "all" | "week" | "month" | "range";
  weekStart?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}): Promise<
  { ok: true; data: EmployeeAttendanceHistory } | { ok: false; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, message: "Only Admin users can view employee attendance history." };
  if (!input.subhubId.trim() || !input.employeeId.trim()) return { ok: false, message: "Choose an employee to view." };

  const today = todayInIndia();
  let startDate: string | null = null;
  let endDate = today;
  if (input.period === "month") {
    const month = normalizeMonth(input.month ?? "");
    if (!month) return { ok: false, message: "Choose a valid report month." };
    const bounds = monthBounds(month);
    startDate = bounds.start;
    endDate = earlierDate(bounds.end, today);
  } else if (input.period === "week") {
    const weekStart = normalizeDate(input.weekStart ?? "");
    if (!weekStart) return { ok: false, message: "Choose a valid week start date." };
    startDate = weekStart;
    endDate = earlierDate(addDays(weekStart, 6), today);
  } else if (input.period === "range") {
    const rangeStart = normalizeDate(input.startDate ?? "");
    const rangeEnd = normalizeDate(input.endDate ?? "");
    if (!rangeStart || !rangeEnd) return { ok: false, message: "Choose a valid start and end date." };
    if (rangeStart > rangeEnd) return { ok: false, message: "The start date must be before the end date." };
    startDate = rangeStart;
    endDate = earlierDate(rangeEnd, today);
  }

  const controlDb = await getControlPlaneDatabase();
  const subhub = await controlDb.collection<UserDocument>("users").findOne({
    _id: input.subhubId,
    panel: "subhub",
    role: "subhub",
    active: true,
  });
  if (!subhub) return { ok: false, message: "That SubHub is not available." };

  const db = await getMongoDb(subhub.databaseName);
  await ensureHrIndexes(db);
  const employee = await db.collection<EmployeeDocument>("hr_employees").findOne({ _id: input.employeeId });
  if (!employee) return { ok: false, message: "That employee does not belong to this SubHub." };

  const assignment = await db.collection<ShiftAssignmentDocument>("hr_shift_assignments").findOne({ employeeId: employee._id });
  const shift = assignment ? await db.collection<ShiftDocument>("hr_shifts").findOne({ _id: assignment.shiftId }) : null;
  const dateFilter = startDate && startDate > endDate
    ? { $in: [] as string[] }
    : startDate
      ? { $gte: startDate, $lte: endDate }
      : { $lte: endDate };
  const attendance = await db.collection<AttendanceDocument>("hr_attendance")
    .find({ employeeId: employee._id, date: dateFilter })
    .sort({ date: -1 })
    .toArray();
  const summary = buildSummary([employee], attendance)[0]!;

  return {
    ok: true,
    data: {
      employee: serializeEmployee(employee),
      subhubName: subhub.subhubName ?? "SubHub",
      subhubManagerName: subhub.name,
      shift: shift
        ? { id: shift._id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime, assignedEmployeeIds: [employee._id] }
        : null,
      attendance: attendance.map(serializeAttendance),
      summary,
      startDate,
      endDate,
    },
  };
}