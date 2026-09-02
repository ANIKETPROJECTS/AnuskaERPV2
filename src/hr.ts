import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assignEmployeeToShift, createEmployee, createShift, getAdminAttendanceReport, getAdminEmployeeAttendanceHistory, getAdminHrData, getAdminSubhubDetails, getEmployeeAttendanceHistory, getManagerAttendanceReport, getManagerHrData, saveAttendance, updateEmployee, updateShift } from "./hr.server";
import { ATTENDANCE_STATUSES } from "./hr.server";

const managerSchema = z.object({ month: z.string(), date: z.string().optional() });
const monthSchema = z.object({ month: z.string() });
const employeeHistorySchema = z.object({
  employeeId: z.string().min(1),
  period: z.enum(["all", "week", "month", "range"]),
  weekStart: z.string().optional(),
  month: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
const managerReportSchema = z.object({
  rangeType: z.enum(["month", "date", "range"]),
  month: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
const adminEmployeeHistorySchema = employeeHistorySchema.extend({ subhubId: z.string().min(1) });
const subhubDetailsSchema = z.object({ userId: z.string().min(1) });

export const getManagerHrDataFn = createServerFn({ method: "GET" }).validator(managerSchema).handler(({ data }) => getManagerHrData(data.month) as any);
export const getEmployeeAttendanceHistoryFn = createServerFn({ method: "GET" }).validator(employeeHistorySchema).handler(({ data }) =>
  getEmployeeAttendanceHistory({
    employeeId: data.employeeId,
    period: data.period,
    ...(data.month ? { month: data.month } : {}),
    ...(data.weekStart ? { weekStart: data.weekStart } : {}),
            ...(data.startDate ? { startDate: data.startDate } : {}),
            ...(data.endDate ? { endDate: data.endDate } : {}),
  }),
);
export const getManagerAttendanceReportFn = createServerFn({ method: "GET" }).validator(managerReportSchema).handler(({ data }) =>
  getManagerAttendanceReport({
    rangeType: data.rangeType,
    ...(data.month ? { month: data.month } : {}),
    ...(data.date ? { date: data.date } : {}),
    ...(data.startDate ? { startDate: data.startDate } : {}),
    ...(data.endDate ? { endDate: data.endDate } : {}),
  }),
);
export const getAdminHrDataFn = createServerFn({ method: "GET" }).validator(monthSchema).handler(({ data }) => getAdminHrData(data.month));
export const getAdminSubhubDetailsFn = createServerFn({ method: "GET" }).validator(subhubDetailsSchema).handler(({ data }) => getAdminSubhubDetails(data.userId));
export const getAdminAttendanceReportFn = createServerFn({ method: "GET" }).validator(managerReportSchema).handler(({ data }) =>
  getAdminAttendanceReport({
    rangeType: data.rangeType,
    ...(data.month ? { month: data.month } : {}),
    ...(data.date ? { date: data.date } : {}),
    ...(data.startDate ? { startDate: data.startDate } : {}),
    ...(data.endDate ? { endDate: data.endDate } : {}),
  }),
);
export const getAdminEmployeeAttendanceHistoryFn = createServerFn({ method: "GET" }).validator(adminEmployeeHistorySchema).handler(({ data }) =>
  getAdminEmployeeAttendanceHistory({
    subhubId: data.subhubId,
    employeeId: data.employeeId,
    period: data.period,
    ...(data.month ? { month: data.month } : {}),
    ...(data.weekStart ? { weekStart: data.weekStart } : {}),
    ...(data.startDate ? { startDate: data.startDate } : {}),
    ...(data.endDate ? { endDate: data.endDate } : {}),
  }),
);
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