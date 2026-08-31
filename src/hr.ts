import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assignEmployeeShift,
  createEmployee,
  createShift,
  getAdminHrReport,
  getManagerHrData,
  saveDailyAttendance,
  updateEmployee,
} from "./hr.server";

const dateMonthSchema = z.object({ date: z.string().length(10), month: z.string().length(7) });
const monthSchema = z.object({ month: z.string().length(7) });
const employeeSchema = z.object({ name: z.string().min(2).max(120) });
const updateEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(120),
  active: z.boolean(),
});
const shiftSchema = z.object({
  name: z.string().min(2).max(80),
  startTime: z.string().length(5),
  endTime: z.string().length(5),
});
const assignShiftSchema = z.object({
  employeeId: z.string().min(1),
  shiftId: z.string().min(1).nullable(),
});
const attendanceSchema = z.object({
  date: z.string().length(10),
  entries: z.array(
    z.object({
      employeeId: z.string().min(1),
      status: z.enum(["Present", "Absent", "Late", "Half-day"]),
    }),
  ),
});

export const getManagerHrDataFn = createServerFn({ method: "POST" })
  .validator(dateMonthSchema)
  .handler(({ data }) => getManagerHrData(data));
export const createEmployeeFn = createServerFn({ method: "POST" })
  .validator(employeeSchema)
  .handler(({ data }) => createEmployee(data));
export const updateEmployeeFn = createServerFn({ method: "POST" })
  .validator(updateEmployeeSchema)
  .handler(({ data }) => updateEmployee(data));
export const createShiftFn = createServerFn({ method: "POST" })
  .validator(shiftSchema)
  .handler(({ data }) => createShift(data));
export const assignEmployeeShiftFn = createServerFn({ method: "POST" })
  .validator(assignShiftSchema)
  .handler(({ data }) => assignEmployeeShift(data));
export const saveDailyAttendanceFn = createServerFn({ method: "POST" })
  .validator(attendanceSchema)
  .handler(({ data }) => saveDailyAttendance(data));
export const getAdminHrReportFn = createServerFn({ method: "POST" })
  .validator(monthSchema)
  .handler(({ data }) => getAdminHrReport(data));
