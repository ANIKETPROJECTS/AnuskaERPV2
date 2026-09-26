import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AdminHeadcountFilters } from "@/components/erp/AdminHeadcountFilters";
import { AdminHeadcountMetrics } from "@/components/erp/AdminHeadcountMetrics";
import { AdminHrNavigation } from "@/components/erp/AdminHrNavigation";
import { Shell } from "@/components/erp/Shell";
import {
  filterHeadcountReport,
  formatHeadcountDate,
  sortHeadcountSummaries,
  useAdminHeadcountReport,
  type HeadcountDateRange,
} from "@/lib/admin-headcount-report";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — Gadsons ERP" }] }),
  component: AdminHr,
});

function AdminHr() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.replace(/\/+$/, "") !== "/hr") return <Outlet />;
  return <AdminHrPage />;
}

function AdminHrPage() {
  const { report, loading, error, appliedRange, applyRange } = useAdminHeadcountReport();
  const [range, setRange] = useState<HeadcountDateRange>({ startDate: "", endDate: "" });
  const [subhubFilter, setSubhubFilter] = useState("all");
  const filtered = filterHeadcountReport(report, subhubFilter);
  const summaries = sortHeadcountSummaries(filtered.summaries);
  const period = describePeriod(appliedRange);

  return (
    <Shell
      title="HR & Attendance"
      subtitle="Review the saved daily headcount for each active SubHub."
    >
      <main className="space-y-5 px-4 pb-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Attendance overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare totals for all SubHubs or focus on one.
            </p>
          </div>
          <AdminHrNavigation active="attendance" subhubId={subhubFilter} />
        </div>

        <AdminHeadcountFilters
          subhubs={report.subhubs}
          subhubId={subhubFilter}
          onSubhubChange={setSubhubFilter}
          range={range}
          onRangeChange={setRange}
          onApply={applyRange}
          loading={loading}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{period}</p>
          <p className="text-xs text-muted-foreground">
            Totals add daily counts together; they do not represent unique people.
          </p>
        </div>

        <AdminHeadcountMetrics entries={filtered.entries} />

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h3 className="font-semibold">SubHub comparison</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                One saved count per SubHub per day. Admin view is read-only.
              </p>
            </div>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {loading ? "Updating…" : `${summaries.length} SubHubs`}
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    SubHub
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Manager
                  </th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">
                    Reports
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Total present
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Average / report
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && summaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No SubHubs match this filter.
                    </td>
                  </tr>
                ) : (
                  summaries.map((summary) => (
                    <tr key={summary.subhubId} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-4 font-semibold">{summary.subhubName}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {summary.subhubManagerName || "—"}
                      </td>
                      <td className="tabular px-4 py-4 text-center">{summary.reportedDays}</td>
                      <td className="tabular px-4 py-4 text-right font-semibold">
                        {summary.reportedDays ? summary.totalPresent : "—"}
                      </td>
                      <td className="tabular px-4 py-4 text-right">
                        {summary.reportedDays ? summary.averagePresent : "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          to="/hr/reports"
                          search={{ subhubId: summary.subhubId }}
                          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary hover:bg-primary/5"
                        >
                          Open report <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function describePeriod(range: HeadcountDateRange) {
  if (!range.startDate && !range.endDate) return "All saved dates";
  const from = range.startDate ? formatHeadcountDate(range.startDate) : "Earliest record";
  const to = range.endDate ? formatHeadcountDate(range.endDate) : "Today";
  return `${from} – ${to}`;
}
