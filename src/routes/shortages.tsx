import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { getShortageDataFn } from "@/shortages";
import type { ShortageData } from "@/shortages.server";

export const Route = createFileRoute("/shortages")({
  loader: () => getShortageDataFn(),
  head: () => ({
    meta: [
      { title: "Consolidated Shortages — Float ERP" },
      {
        name: "description",
        content: "Company-wide shortage matrix: requirement minus stock per subpart per hub, with action tracking.",
      },
      { property: "og:title", content: "Consolidated Shortages — Float ERP" },
      { property: "og:description", content: "One grid showing surplus and deficit for every subpart across hubs." },
    ],
  }),
  component: Shortages,
});

function Shortages() {
  const result = Route.useLoaderData();
  const [data, setData] = useState<ShortageData>(result.ok ? result.data : emptyData);
  const [loading, setLoading] = useState(!result.ok);
  const [error, setError] = useState(result.ok ? "" : result.message);
  const [query, setQuery] = useState("");
  const [hubFilter, setHubFilter] = useState("all");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "deficit" | "covered">("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
  }, [result]);

  async function load() {
    setLoading(true);
    const response = await getShortageDataFn();
    if (response.ok) {
      setData(response.data);
      setError("");
    } else {
      setError(response.message);
    }
    setLoading(false);
  }

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.rows.filter((row) => {
      const matchesQuery = !normalized || `${row.code} ${row.name} ${row.material} ${row.source}`.toLowerCase().includes(normalized);
      const selectedCells: ShortageData["rows"][number]["cells"][string][] =
        hubFilter === "all"
          ? Object.values(row.cells)
          : [row.cells[hubFilter]].filter((cell): cell is ShortageData["rows"][number]["cells"][string] => Boolean(cell));
      const matchesCoverage =
        coverageFilter === "all" ||
        (coverageFilter === "deficit" && selectedCells.some((cell) => cell.gap > 0)) ||
        (coverageFilter === "covered" && selectedCells.length > 0 && selectedCells.every((cell) => cell.gap <= 0));
      return matchesQuery && matchesCoverage;
    });
  }, [coverageFilter, data.rows, hubFilter, query]);

  const hasFilters = Boolean(query || hubFilter !== "all" || coverageFilter !== "all");
  const formatNumber = (value: number) => value.toLocaleString("en-IN");
  const formatShortDate = (value: string) => {
    const date = new Date(value);
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()];
    return `${date.getUTCDate().toString().padStart(2, "0")} ${month}`;
  };

  return (
    <Shell
      title="Consolidated Shortages"
      subtitle="Remaining BOM requirement − current workspace stock · negative values are surplus"
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((visible) => !visible)}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${showFilters || hasFilters ? "border-primary/40 bg-primary/5 text-primary" : "border-input bg-card"}`}
          >
            <Filter className="size-4" /> Filters{hasFilters ? ` (${[query, hubFilter !== "all" ? hubFilter : "", coverageFilter !== "all" ? coverageFilter : ""].filter(Boolean).length})` : ""}
          </button>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <Link to="/procurement" className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
            <Send className="size-4" /> Raise procurement
          </Link>
        </div>
      }
    >
      {error ? <p role="alert" className="mb-4 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {showFilters ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <label className="min-w-56 flex-1 text-xs font-medium text-muted-foreground">
            Search parts
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code, material…" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          </label>
          <label className="min-w-48 text-xs font-medium text-muted-foreground">
            SubHub
            <select value={hubFilter} onChange={(event) => setHubFilter(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
              <option value="all">All active SubHubs</option>
              {data.hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
            </select>
          </label>
          <label className="min-w-44 text-xs font-medium text-muted-foreground">
            Coverage
            <select value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value as typeof coverageFilter)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
              <option value="all">All parts</option>
              <option value="deficit">Deficit only</option>
              <option value="covered">Covered only</option>
            </select>
          </label>
          {hasFilters ? <button type="button" onClick={() => { setQuery(""); setHubFilter("all"); setCoverageFilter("all"); }} className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /> Clear</button> : null}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total deficit" value={formatNumber(data.totalDeficit)} tone="bad" hint="open units to arrange" />
        <Kpi label="Parts affected" value={`${data.affectedParts} / ${data.totalParts}`} tone="warn" hint="with at least one deficit" />
        <Kpi label="Hubs in deficit" value={`${data.hubsInDeficit} / ${data.hubs.length}`} tone="warn" hint={`${data.coveredHubs} fully covered`} />
        <Kpi label="Actions logged" value={formatNumber(data.actions.length)} tone="good" hint="linked MongoDB actions" />
      </div>

      <Panel title="Shortage matrix" description={`Requirement − current stock · ${visibleRows.length} of ${data.rows.length} parts · each cell is calculated from live MongoDB data`}>
        {loading && !data.rows.length ? <p className="px-5 py-8 text-sm text-muted-foreground">Loading shortage matrix…</p> : null}
        {!loading && !visibleRows.length ? <p className="px-5 py-8 text-sm text-muted-foreground">No parts match the current filters.</p> : null}
        {visibleRows.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 bg-card px-5 py-3 text-left font-medium">Subpart</th>
                {data.hubs.map((hub) => (
                  <th key={hub.id} title={`${hub.name} · ${hub.managerName}`} className="max-w-28 px-3 py-3 text-center font-medium">
                    {hub.name}
                  </th>
                ))}
                <th className="px-5 py-3 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                return (
                  <tr key={row.code} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                    <td className="sticky left-0 bg-card px-5 py-3">
                      <p className="font-medium">
                        <Link to="/part/$code" params={{ code: row.code }} className="hover:text-primary">
                          {row.name}
                        </Link>
                      </p>
                      <p className="tabular text-xs text-muted-foreground">{row.code} · {row.material}</p>
                    </td>
                    {data.hubs.map((hub) => {
                      const cell = row.cells[hub.id];
                      const gap = cell?.gap ?? 0;
                      return <td key={hub.id} title={`Requirement ${formatNumber(cell?.requirement ?? 0)} · Stock ${formatNumber(cell?.stock ?? 0)}`} className="px-3 py-3 text-center">
                        <span
                          className={`tabular inline-block min-w-16 rounded px-2 py-1 text-xs font-semibold ${
                            gap > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                          }`}
                        >
                          {gap > 0 ? formatNumber(gap) : `−${formatNumber(-gap)}`}
                        </span>
                      </td>;
                    })}
                    <td
                      className={`tabular px-5 py-3 text-right font-semibold ${row.net > 0 ? "text-destructive" : "text-success"}`}
                    >
                      {row.net > 0 ? formatNumber(row.net) : `−${formatNumber(-row.net)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div> : null}
      </Panel>

      <Panel title="Action log" description="MongoDB procurement actions linked to parts currently in deficit">
        {data.actions.length ? <ul className="divide-y divide-border">
          {data.actions.map((action) => (
            <li key={action.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <Tag tone={action.status === "Delivery done" ? "good" : "info"}>{action.hubName}</Tag>
              <span className="font-medium">{action.item}</span>
              {action.quantity !== null ? <span className="tabular text-muted-foreground">{formatNumber(action.quantity)} units</span> : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {action.note} · {action.actor} · {formatShortDate(action.createdAt)}
              </span>
            </li>
          ))}
        </ul> : <p className="px-5 py-8 text-sm text-muted-foreground">No procurement actions are currently linked to an open shortage.</p>}
      </Panel>
    </Shell>
  );
}

const emptyData: ShortageData = {
  hubs: [],
  rows: [],
  totalDeficit: 0,
  affectedParts: 0,
  totalParts: 0,
  hubsInDeficit: 0,
  coveredHubs: 0,
  actions: [],
};
