import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assignEmployeeToShift, createEmployee, createShift, getAdminHrData, getManagerHrData, saveAttendance, updateEmployee, updateShift } from "./hr.server";
import { ATTENDANCE_STATUSES } from "./hr.server";

const managerSchema = z.object({ month: z.string(), date: z.string().optional() });
const monthSchema = z.object({ month: z.string() });

export const getManagerHrDataFn = createServerFn({ method: "GET" }).validator(managerSchema).handler(({ data }) => getManagerHrData(data.month) as any);
export const getAdminHrDataFn = createServerFn({ method: "GET" }).validator(monthSchema).handler(({ data }) => getAdminHrData(data.month));
export const createEmployeeFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string(), phoneNumber: z.string().optional(), shiftIds: z.array(z.string()).optional() }))
  .handler(({ data }) => createEmployee(data.name, data.phoneNumber ?? "", data.shiftIds ?? []));
export const updateEmployeeFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), name: z.string(), phoneNumber: z.string().optional(), active: z.boolean() }))
  .handler(({ data }) => updateEmployee(data));
export const saveAttendanceFn = createServerFn({ method: "POST" }).validator(z.object({ employeeId: z.string(), date: z.string(), status: z.enum(ATTENDANCE_STATUSES) })).handler(({ data }) => saveAttendance(data));
export const createShiftFn = createServerFn({ method: "POST" }).validator(z.object({ name: z.string(), startTime: z.string(), endTime: z.string() })).handler(({ data }) => createShift(data));
export const updateShiftFn = createServerFn({ method: "POST" }).validator(z.object({ id: z.string(), startTime: z.string(), endTime: z.string() })).handler(({ data }) => updateShift(data));
export const assignEmployeeToShiftFn = createServerFn({ method: "POST" }).validator(z.object({ employeeId: z.string(), shiftId: z.string(), assigned: z.boolean() })).handler(({ data }) => assignEmployeeToShift(data));

// Compatibility adapters keep the main branch's reusable HrWorkspace available
// while the task route uses the more granular attendance controls above.
export const assignEmployeeShiftFn = createServerFn({ method: "POST" })
  .validator(z.object({ employeeId: z.string(), shiftId: z.string().nullable() }))
  .handler(({ data }) => assignEmployeeToShift({ employeeId: data.employeeId, shiftId: data.shiftId ?? "", assigned: data.shiftId !== null }) as any);
export const saveDailyAttendanceFn = createServerFn({ method: "POST" })
  .validator(z.object({ date: z.string(), entries: z.array(z.object({ employeeId: z.string(), status: z.enum(ATTENDANCE_STATUSES) })) }))
  .handler(async ({ data }) => {
    const results = await Promise.all(data.entries.map((entry) => saveAttendance({ employeeId: entry.employeeId, date: data.date, status: entry.status })));
    const failed = results.find((result) => !result.ok);
    return failed ?? { ok: true };
  });
export const getAdminHrReportFn = createServerFn({ method: "GET" }).validator(monthSchema).handler(({ data }) => getAdminHrData(data.month) as any);