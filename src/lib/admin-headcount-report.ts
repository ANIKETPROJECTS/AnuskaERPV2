import { useCallback, useEffect, useState } from "react";
import { getAdminHeadcountReportFn } from "@/hr";
import type { AdminHeadcountEntry, AdminHeadcountReport, AdminHeadcountSummary } from "@/hr.server";

export type HeadcountDateRange = {
  startDate: string;
  endDate: string;
};

export type HeadcountDateTotal = {
  date: string;
  totalPresent: number;
  subhubCount: number;
  entries: AdminHeadcountEntry[];
};

export const emptyAdminHeadcountReport: AdminHeadcountReport = {
  startDate: "",
  endDate: "",
  subhubs: [],
  summaries: [],
  entries: [],
  changes: [],
};

export function todayInIndia() {
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

export function formatHeadcountDate(value: string) {
  if (!value) return "Select a date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function getHeadcountPreset(preset: "today" | "week" | "month" | "all"): HeadcountDateRange {
  if (preset === "all") return { startDate: "", endDate: "" };
  const endDate = todayInIndia();
  if (preset === "today") return { startDate: endDate, endDate };

  if (preset === "month") {
    return { startDate: `${endDate.slice(0, 7)}-01`, endDate };
  }

  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    startDate: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`,
    endDate,
  };
}

export function filterHeadcountReport(report: AdminHeadcountReport, subhubId: string) {
  return {
    summaries: report.summaries.filter(
      (summary) => subhubId === "all" || summary.subhubId === subhubId,
    ),
    entries: report.entries.filter((entry) => subhubId === "all" || entry.subhubId === subhubId),
  };
}

export function summarizeHeadcount(entries: AdminHeadcountEntry[]) {
  const totalPresent = entries.reduce((total, entry) => total + entry.presentCount, 0);
  const daysReported = entries.length;
  const hubsReporting = new Set(entries.map((entry) => entry.subhubId)).size;
  const dailyTotals = groupHeadcountByDate(entries);
  const peakDay = dailyTotals.reduce<HeadcountDateTotal | null>(
    (peak, current) => (!peak || current.totalPresent > peak.totalPresent ? current : peak),
    null,
  );

  return {
    totalPresent,
    daysReported,
    hubsReporting,
    averagePerHubDay: daysReported ? Math.round((totalPresent / daysReported) * 10) / 10 : 0,
    peakDay,
    dailyTotals,
  };
}

export function groupHeadcountByDate(entries: AdminHeadcountEntry[]): HeadcountDateTotal[] {
  const grouped = new Map<string, AdminHeadcountEntry[]>();
  entries.forEach((entry) => {
    const items = grouped.get(entry.date) ?? [];
    items.push(entry);
    grouped.set(entry.date, items);
  });

  return [...grouped.entries()]
    .map(([date, dateEntries]) => ({
      date,
      totalPresent: dateEntries.reduce((total, entry) => total + entry.presentCount, 0),
      subhubCount: new Set(dateEntries.map((entry) => entry.subhubId)).size,
      entries: dateEntries.sort((left, right) => left.subhubName.localeCompare(right.subhubName)),
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function sortHeadcountSummaries(summaries: AdminHeadcountSummary[]) {
  return [...summaries].sort((left, right) => left.subhubName.localeCompare(right.subhubName));
}

export function useAdminHeadcountReport(initialRange: HeadcountDateRange = { startDate: "", endDate: "" }) {
  const [report, setReport] = useState<AdminHeadcountReport>(emptyAdminHeadcountReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appliedRange, setAppliedRange] = useState<HeadcountDateRange>(() => ({ ...initialRange }));

  const applyRange = useCallback((range: HeadcountDateRange) => {
    setAppliedRange({ ...range });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const request =
      appliedRange.startDate || appliedRange.endDate
        ? {
            rangeType: "range" as const,
            ...(appliedRange.startDate ? { startDate: appliedRange.startDate } : {}),
            ...(appliedRange.endDate ? { endDate: appliedRange.endDate } : {}),
          }
        : { rangeType: "all" as const };

    void getAdminHeadcountReportFn({ data: request })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setReport(result.data);
        } else {
          setReport(emptyAdminHeadcountReport);
          setError(result.message);
        }
      })
      .catch(() => {
        if (!active) return;
        setReport(emptyAdminHeadcountReport);
        setError("Attendance could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedRange]);

  return { report, loading, error, appliedRange, applyRange };
}
