import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMasterQualityManagementFn } from "@/inventory";
import type { MasterQualityData } from "@/inventory.server";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { Shell } from "@/components/erp/Shell";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/quality-management")({
  head: () => ({
    meta: [
      { title: "Quality Management — Gadsons ERP" },
      { name: "description", content: "Cross-SubHub quality deductions and inventory loss reporting." },
    ],
  }),
  component: QualityManagement,
});

const emptyData: MasterQualityData = {
  logs: [],
  bySubhub: [],
  byReason: [],
  summary: { records: 0, rejectedUnits: 0, subhubsWithIssues: 0 },
};

function QualityManagement() {
  const [data, setData] = useState(emptyData);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const result = await getMasterQualityManagementFn();
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.logs;
    return data.logs.filter((log) => `${log.subhubName} ${log.product} ${log.code} ${log.issue} ${log.recordedByName} ${log.notes}`.toLowerCase().includes(normalized));
  }, [data.logs, query]);

  return (
    <Shell
      title="Quality Management"
      subtitle="Cross-SubHub quality deductions from live workspace inventory"
      actions={<button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh report</button>}
    >
      <div className="space-y-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Quality records" value={num(data.summary.records)} hint="all SubHub deductions" />
          <Kpi label="Rejected units" value={num(data.summary.rejectedUnits)} tone={data.summary.rejectedUnits ? "warn" : "good"} hint="removed from live stock" />
          <Kpi label="SubHubs with issues" value={num(data.summary.subhubsWithIssues)} tone={data.summary.subhubsWithIssues ? "warn" : "good"} hint={`of ${data.bySubhub.length} SubHubs`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Quality by SubHub" description="Inventory quantities removed through quality management, grouped by workspace.">
            {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading quality report…</p> : data.bySubhub.length === 0 ? <EmptyQualityState /> : <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 text-right font-medium">Records</th><th className="px-5 py-3 text-right font-medium">Rejected units</th></tr></thead><tbody>{data.bySubhub.map((subhub) => <tr key={subhub.subhubUserId} className="border-b border-border/70 last:border-0"><td className="px-5 py-3 font-medium">{subhub.subhubName}</td><td className="tabular px-5 py-3 text-right">{num(subhub.records)}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(subhub.rejectedUnits)}</td></tr>)}</tbody></table></div>}
          </Panel>
          <Panel title="Quality by reason" description="Issue categories reported by SubHub Managers.">
            {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading quality report…</p> : data.byReason.length === 0 ? <EmptyQualityState /> : <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Issue</th><th className="px-5 py-3 text-right font-medium">Records</th><th className="px-5 py-3 text-right font-medium">Rejected units</th></tr></thead><tbody>{data.byReason.map((reason) => <tr key={reason.issue} className="border-b border-border/70 last:border-0"><td className="px-5 py-3"><Tag tone="bad">{reason.issue}</Tag></td><td className="tabular px-5 py-3 text-right">{num(reason.records)}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(reason.rejectedUnits)}</td></tr>)}</tbody></table></div>}
          </Panel>
        </div>

        <Panel title="All quality management logs" description="Every quality deduction recorded across all SubHub workspaces.">
          <div className="border-b border-border p-4"><label className="relative block max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SubHub, item, issue, or notes" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm outline-none focus:border-primary" /></label></div>
          {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading quality logs…</p> : filteredLogs.length === 0 ? <EmptyQualityState /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">SubHub</th><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Issue</th><th className="px-5 py-3 text-right font-medium">Rejected</th><th className="px-5 py-3 text-right font-medium">Balance</th><th className="px-5 py-3 font-medium">Recorded by</th><th className="px-5 py-3 font-medium">Notes</th></tr></thead><tbody>{filteredLogs.map((log) => <tr key={`${log.subhubUserId}-${log.id}`} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{log.date.slice(0, 16).replace("T", " ")}</td><td className="px-5 py-3 font-medium">{log.subhubName}</td><td className="px-5 py-3"><p className="font-medium">{log.product}</p><p className="tabular text-xs text-muted-foreground">{log.code} · {log.category}</p></td><td className="px-5 py-3"><Tag tone="bad">{log.issue}</Tag></td><td className="tabular px-5 py-3 text-right font-semibold text-destructive">-{num(log.quantity)}</td><td className="tabular px-5 py-3 text-right">{num(log.afterQuantity)}</td><td className="px-5 py-3 text-xs">{log.recordedByName}</td><td className="max-w-[220px] truncate px-5 py-3 text-muted-foreground">{log.notes || "—"}</td></tr>)}</tbody></table></div>}
        </Panel>
      </div>
    </Shell>
  );
}

function EmptyQualityState() {
  return <div className="p-10 text-center"><AlertTriangle className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No quality issues recorded</p><p className="mt-1 text-sm text-muted-foreground">Quality deductions from SubHub workspaces will appear here.</p></div>;
}