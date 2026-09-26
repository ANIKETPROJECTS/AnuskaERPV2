import type { AdminHeadcountEntry } from "@/hr.server";
import { summarizeHeadcount } from "@/lib/admin-headcount-report";

export function AdminHeadcountMetrics({ entries }: { entries: AdminHeadcountEntry[] }) {
  const metrics = summarizeHeadcount(entries);
  const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

  return (
    <section aria-label="Attendance summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="People across saved days" value={number.format(metrics.totalPresent)} />
      <MetricCard label="Average per hub-day" value={number.format(metrics.averagePerHubDay)} />
      <MetricCard label="Submitted hub-days" value={number.format(metrics.daysReported)} />
      <MetricCard label="SubHubs reporting" value={number.format(metrics.hubsReporting)} />
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="panel min-w-0 px-4 py-3">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}
