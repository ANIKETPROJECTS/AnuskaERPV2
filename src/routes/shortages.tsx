import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { getShortageDataFn } from "@/shortages";
import type { ShortageData } from "@/shortages.server";

export const Route = createFileRoute("/shortages")({
  loader: () => getShortageDataFn(),
  head: () => ({
    meta: [
      { title: "Consolidated Shortages — Float ERP" },
      {
        name: "description",
        content: "Compare open production requirements with current stock across active SubHubs.",
      },
      { property: "og:title", content: "Consolidated Shortages — Float ERP" },
      {
        property: "og:description",
        content: "See what each SubHub needs to complete its assigned production targets.",
      },
    ],
  }),
  component: Shortages,
});

type StockStatus = "shortage" | "low" | "surplus" | "no-target";

function getStockStatus(requirement: number, stock: number): StockStatus {
  if (requirement <= 0) return "no-target";
  if (stock < requirement) return "shortage";
  if (stock === requirement) return "low";
  return "surplus";
}

function getStatusLabel(
  status: StockStatus,
  requirement: number,
  stock: number,
  formatNumber: (value: number) => string,
) {
  if (status === "shortage") return `Short by ${formatNumber(requirement - stock)}`;
  if (status === "low") return "Exactly enough";
  if (status === "surplus") return `Surplus ${formatNumber(stock - requirement)}`;
  return "No open target";
}

const statusStyles: Record<StockStatus, string> = {
  shortage: "bg-red-600 text-white",
  low: "bg-amber-700 text-white",
  surplus: "bg-green-700 text-white",
  "no-target": "bg-gray-600 text-white",
};

function Shortages() {
  const result = Route.useLoaderData();
  const [data, setData] = useState<ShortageData>(result.ok ? result.data : emptyData);
  const [loading, setLoading] = useState(!result.ok);
  const [error, setError] = useState(result.ok ? "" : result.message);
  const [query, setQuery] = useState("");
  const [hubFilter, setHubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");

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

  const visibleHubs = useMemo(
    () => (hubFilter === "all" ? data.hubs : data.hubs.filter((hub) => hub.id === hubFilter)),
    [data.hubs, hubFilter],
  );

  const visibleParts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.rows.filter((part) => {
      const matchesQuery =
        !normalized || `${part.name} ${part.code}`.toLowerCase().includes(normalized);
      if (!matchesQuery) return false;
      if (statusFilter === "all") return true;
      return visibleHubs.some((hub) => {
        const cell = part.cells[hub.id];
        return cell && getStockStatus(cell.requirement, cell.stock) === statusFilter;
      });
    });
  }, [data.rows, query, statusFilter, visibleHubs]);

  const hasFilters = Boolean(query.trim() || hubFilter !== "all" || statusFilter !== "all");
  const formatNumber = (value: number) => value.toLocaleString("en-IN");

  return (
    <Shell
      title="Consolidated Shortages"
      subtitle="See what each SubHub needs to complete its assigned production targets."
      mainClassName="flex-1 space-y-5 p-6"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-base font-medium hover:bg-muted disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
          <Link
            to="/procurement"
            className="rule-header inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-base font-semibold"
          >
            <Send className="size-4" aria-hidden="true" />
            Raise procurement
          </Link>
        </div>
      }
    >
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive"
        >
          {error}
        </p>
      ) : null}
      <section aria-label="Shortage filters" className="space-y-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[240px] flex-1 text-sm font-medium text-muted-foreground">
            Search subpart name or code
            <span className="relative mt-1 block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                aria-label="Search by subpart name or code"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter a name or code"
                className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base font-normal text-foreground outline-none focus:border-primary"
              />
            </span>
          </label>
          <label className="w-full text-sm font-medium text-muted-foreground sm:w-64">
            SubHub
            <select
              aria-label="Filter by SubHub"
              value={hubFilter}
              onChange={(event) => setHubFilter(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground outline-none focus:border-primary"
            >
              <option value="all">All active SubHubs</option>
              {data.hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name}
                </option>
              ))}
            </select>
          </label>
          <label className="w-full text-sm font-medium text-muted-foreground sm:w-64">
            Stock status
            <select
              aria-label="Filter by stock status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground outline-none focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="shortage">Shortage — needs stock</option>
              <option value="low">Low buffer — exactly enough</option>
              <option value="surplus">Surplus</option>
              <option value="no-target">No open target</option>
            </select>
          </label>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setHubFilter("all");
                setStatusFilter("all");
              }}
              className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
              Clear filters
            </button>
          ) : null}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {formatNumber(visibleParts.length)} subparts across {formatNumber(visibleHubs.length)}{" "}
          SubHubs
        </p>
        {loading ? <p aria-live="polite">Refreshing…</p> : null}
      </div>

      <section aria-label="Shortage matrix" className="min-w-0">
        {loading && !data.rows.length ? (
          <p className="py-10 text-center text-base text-muted-foreground" aria-live="polite">
            Loading shortage details…
          </p>
        ) : visibleParts.length && visibleHubs.length ? (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="min-w-32 px-2 py-3 font-semibold">
                    Subpart name
                  </th>
                  <th scope="col" className="min-w-20 px-2 py-3 font-semibold">
                    Code
                  </th>
                  {visibleHubs.map((hub) => (
                    <th
                      key={hub.id}
                      scope="col"
                      aria-label={`${hub.name}: required quantity, current stock, and status`}
                      className="min-w-24 border-l border-border px-2 py-3 font-semibold normal-case tracking-normal text-foreground"
                    >
                      {hub.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleParts.map((part) => (
                  <tr key={part.code} className="border-t border-border/70 hover:bg-muted/30">
                    <td className="min-w-32 px-2 py-3.5 font-semibold">{part.name}</td>
                    <td className="tabular min-w-20 whitespace-nowrap px-2 py-3.5 text-sm">
                      <Link
                        to="/part/$code"
                        params={{ code: part.code }}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {part.code}
                      </Link>
                    </td>
                    {visibleHubs.map((hub) => {
                      const cell = part.cells[hub.id];
                      if (!cell) {
                        return (
                          <td
                            key={hub.id}
                            className="border-l border-border/70 px-2 py-3.5 text-muted-foreground"
                          >
                            —
                          </td>
                        );
                      }

                      const status = getStockStatus(cell.requirement, cell.stock);
                      return (
                        <td key={hub.id} className="border-l border-border/70 px-2 py-3.5">
                          <div className="flex flex-col items-start gap-1.5">
                            <div className="flex w-full items-baseline justify-between gap-1 whitespace-nowrap text-[11px]">
                              <span className="text-muted-foreground">Required</span>
                              <span className="tabular font-medium">
                                {formatNumber(cell.requirement)}
                              </span>
                            </div>
                            <div className="flex w-full items-baseline justify-between gap-1 whitespace-nowrap text-[11px]">
                              <span className="text-muted-foreground">Stock</span>
                              <span className="tabular font-semibold">
                                {formatNumber(cell.stock)}
                              </span>
                            </div>
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-1.5 py-1 text-[11px] font-semibold ${statusStyles[status]}`}
                              title={`Required ${formatNumber(cell.requirement)} · current stock ${formatNumber(cell.stock)}`}
                            >
                              {getStatusLabel(status, cell.requirement, cell.stock, formatNumber)}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-base text-muted-foreground">
            {data.hubs.length === 0
              ? "No active SubHubs are available to compare yet."
              : hasFilters
                ? "No subparts match these filters. Try another SubHub or stock status."
                : "No shortage details are available yet."}
          </p>
        )}
      </section>
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
