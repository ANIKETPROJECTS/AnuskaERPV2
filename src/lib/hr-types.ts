export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Half-day"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type HrEmployee = {
  id: string;
  name: string;
  employeeCode: string;
  active: boolean;
  shiftId: string | null;
  shiftName: string | null;
  createdAt: string;
};

export type HrShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  createdAt: string;
};

export type DailyAttendance = {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  updatedAt: string;
};

export type PayrollSummary = {
  subhubUserId: string | null;
  subhubName: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  totalMarked: number;
  active: boolean;
};

export type ManagerHrData = {
  subhubName: string;
  employees: HrEmployee[];
  shifts: HrShift[];
  attendance: DailyAttendance[];
  monthlySummary: PayrollSummary[];
};

export type AdminHrData = {
  month: string;
  summaries: PayrollSummary[];
};
