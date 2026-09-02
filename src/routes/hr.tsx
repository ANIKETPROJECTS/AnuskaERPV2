import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { getAdminHrDataFn } from "@/hr";
import type { AdminHrData } from "@/hr.server";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — Admin · Float ERP" }] }),
  component: AdminHr,
});

const emptyData: AdminHrData = { month: "", subhubs: [], summaries: [] };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
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

function AdminHr() {
  const [data, setData] = useState<AdminHrData>(emptyData);
  const [month, setMonth] = useState(currentMonth);
  const [subhubFilter, setSubhubFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminHrDataFn({ data: { month } });
      if (result.ok) setData(result.data);
      else setError(result.message);
    } catch {
      setError("The HR roll-up could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month]);

  const subhubs = useMemo(() => [...data.subhubs].sort(), [data.subhubs]);
  const filtered = useMemo(() => {
    const query = employeeFilter.trim().toLowerCase();
    return data.summaries.filter((row) => (subhubFilter === "all" || row.subhubName === subhubFilter) && (!query || row.employeeName.toLowerCase().includes(query)));
  }, [data.summaries, employeeFilter, subhubFilter]);

  function exportReport() {
    downloadCsv(`all-subhubs-attendance-${month}.csv`, [
      ["SubHub", "Employee", "Active", "Present", "Absent", "Late", "Half-day"],
      ...filtered.map((row) => [row.subhubName, row.employeeName, row.active ? "Yes" : "No", row.present, row.absent, row.late, row.halfDay]),
    ]);
  }

  return (
    <Shell title="HR & Attendance" subtitle="Review monthly attendance totals across every active SubHub workspace.">
      <div className="space-y-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-end justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarCheck className="size-5" /></div><div><p className="font-semibold">Monthly attendance roll-up</p><p className="text-sm text-muted-foreground">Read-only admin view; employee records stay inside their SubHub.</p></div></div><div className="flex flex-wrap items-end gap-2"><label className="text-xs font-medium">Report month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1.5 h-9 rounded-md border border-input bg-card px-3 text-sm font-normal" /></label><button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm"><RefreshCw className="size-4" /> Refresh</button><button type="button" onClick={exportReport} disabled={!filtered.length} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"><Download className="size-4" /> Export CSV</button></div></div>
        <div className="grid gap-4 sm:grid-cols-3"><Metric label="Active SubHubs" value={String(data.subhubs.length)} /><Metric label="Employees in report" value={String(data.summaries.length)} /><Metric label="Visible rows" value={String(filtered.length)} /></div>
        <section className="panel overflow-hidden">
         <div className="filter-toolbar border-b border-border bg-muted/10 px-5 py-4"><label className="min-w-56 flex-1 text-xs font-medium">Filter by employee<input type="search" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} placeholder="Search employee name" className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" /></label><label className="text-xs font-medium">SubHub<select value={subhubFilter} onChange={(event) => setSubhubFilter(event.target.value)} className="mt-1.5 h-9 min-w-48 rounded-md border border-input bg-background px-3 text-sm font-normal"><option value="all">All active SubHubs</option>{subhubs.map((subhub) => <option key={subhub} value={subhub}>{subhub}</option>)}</select></label></div>
          {loading ? <p className="p-10 text-center text-sm text-muted-foreground">Loading all active SubHub reports…</p> : filtered.length === 0 ? <div className="p-12 text-center"><CalendarCheck className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">{data.summaries.length === 0 ? "No active SubHub attendance records yet" : "No rows match these filters"}</p><p className="mt-1 text-sm text-muted-foreground">{data.summaries.length === 0 ? "Managers will appear here after they add employees." : "Try another employee name or SubHub."}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 text-right font-medium">Present</th><th className="px-5 py-3 text-right font-medium">Absent</th><th className="px-5 py-3 text-right font-medium">Late</th><th className="px-5 py-3 text-right font-medium">Half-day</th></tr></thead><tbody>{filtered.map((row) => <tr key={`${row.subhubId}-${row.employeeId}`} className="border-b border-border/70 last:border-0"><td className="px-5 py-3 font-medium">{row.subhubName}</td><td className="px-5 py-3">{row.employeeName}{!row.active ? <span className="ml-2 text-xs text-muted-foreground">(Archived)</span> : null}</td><td className="tabular px-5 py-3 text-right font-semibold text-success">{row.present}</td><td className="tabular px-5 py-3 text-right">{row.absent}</td><td className="tabular px-5 py-3 text-right text-warning">{row.late}</td><td className="tabular px-5 py-3 text-right text-primary">{row.halfDay}</td></tr>)}</tbody></table></div>}
        </section>
        <p className="text-xs text-muted-foreground">Totals count daily status records for the selected month. This report does not calculate salary, overtime, deductions, tax, payslips, or payments.</p>
      </div>
    </Shell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="panel p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="tabular mt-2 text-2xl font-semibold">{value}</p></div>;
}