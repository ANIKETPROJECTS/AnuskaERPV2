import { RefreshCw, Search, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./_group.css";
import { PreviewShell } from "./_shared/PreviewShell";

type StockStatus = "shortage" | "low" | "surplus" | "no-target";
type ViewMode = "matrix" | "list";

type PreviewRow = {
  name: string;
  code: string;
  hub: string;
  required: number;
  stock: number;
};

const rows: PreviewRow[] = [
  { name: "Washer", code: "GP006-001", hub: "Factory 1 - Thane", required: 218, stock: 0 },
  { name: "Washer", code: "GP006-001", hub: "Unit G10 - Goa", required: 22, stock: 0 },
  { name: "Washer", code: "GP006-001", hub: "Unit G4 - Indore", required: 0, stock: 0 },
  { name: "Washer", code: "GP006-001", hub: "Unit G5 - Bengaluru", required: 0, stock: 16 },
  { name: "Pivot Pin", code: "GP006-002", hub: "Factory 1 - Thane", required: 116, stock: 0 },
  { name: "Pivot Pin", code: "GP006-002", hub: "Unit G10 - Goa", required: 22, stock: 20 },
  { name: "Pivot Pin", code: "GP006-002", hub: "Unit G4 - Indore", required: 0, stock: 0 },
  { name: "Pivot Pin", code: "GP006-002", hub: "Unit G5 - Bengaluru", required: 0, stock: 0 },
  { name: "Screw M3x8", code: "GP006-003", hub: "Factory 1 - Thane", required: 472, stock: 0 },
  { name: "Screw M3x8", code: "GP006-003", hub: "Unit G10 - Goa", required: 44, stock: 0 },
  { name: "Screw M3x8", code: "GP006-003", hub: "Unit G4 - Indore", required: 0, stock: 0 },
  { name: "Screw M3x8", code: "GP006-003", hub: "Unit G5 - Bengaluru", required: 0, stock: 0 },
  {
    name: "Ball Float Body (Reviva NXT)",
    code: "GP006-010",
    hub: "Factory 1 - Thane",
    required: 0,
    stock: 9,
  },
  { name: "Float Arm SM", code: "GP006-012", hub: "Factory 1 - Thane", required: 200, stock: 0 },
  { name: "Float Arm SM", code: "GP006-012", hub: "Unit G10 - Goa", required: 4, stock: 4 },
  { name: "Seal Gasket", code: "GP006-014", hub: "Factory 1 - Thane", required: 236, stock: 0 },
];

const hubs = [...new Set(rows.map((row) => row.hub))];
const parts = [...new Map(rows.map(({ name, code }) => [code, { name, code }])).values()];

function statusFor(row: PreviewRow): StockStatus {
  if (row.required === 0) return "no-target";
  if (row.stock < row.required) return "shortage";
  if (row.stock === row.required) return "low";
  return "surplus";
}

function statusDetails(row: PreviewRow) {
  const status = statusFor(row);
  if (status === "shortage") {
    return {
      label: `Short by ${row.required - row.stock}`,
      className: "bg-red-600 text-white",
    };
  }
  if (status === "low") {
    return {
      label: "Exactly enough",
      className: "bg-amber-700 text-white",
    };
  }
  if (status === "surplus") {
    return {
      label: `Surplus ${row.stock - row.required}`,
      className: "bg-green-700 text-white",
    };
  }
  return { label: "No open target", className: "bg-gray-600 text-white" };
}

export function Requested() {
  const [query, setQuery] = useState("");
  const [hub, setHub] = useState("all");
  const [status, setStatus] = useState<StockStatus | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("matrix");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  useEffect(() => {
    setPage(1);
  }, [hub, query, status]);
  const visibleHubs = useMemo(
    () => (hub === "all" ? hubs : hubs.filter((name) => name === hub)),
    [hub],
  );

  const visibleParts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return parts.filter((part) => {
      const matchesQuery =
        !normalized || `${part.name} ${part.code}`.toLowerCase().includes(normalized);
      if (!matchesQuery) return false;
      if (status === "all") return true;
      return visibleHubs.some((hubName) => {
        const row = rows.find(
          (candidate) => candidate.code === part.code && candidate.hub === hubName,
        );
        return row && statusFor(row) === status;
      });
    });
  }, [query, status, visibleHubs]);
  const visibleListRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !normalized || `${row.name} ${row.code}`.toLowerCase().includes(normalized);
      const matchesHub = hub === "all" || row.hub === hub;
      const matchesStatus = status === "all" || statusFor(row) === status;
      return matchesQuery && matchesHub && matchesStatus;
    });
  }, [hub, query, status]);
  const pageRows = visibleListRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PreviewShell
      title="Consolidated Shortages"
      subtitle="See what each SubHub needs to complete its assigned production targets."
      actions={
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
            <RefreshCw className="size-4" />
            Refresh
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Send className="size-4" />
            Raise procurement
          </button>
        </div>
      }
    >
      <section aria-label="Shortage filters" className="space-y-4 border-b border-border pb-5">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_minmax(145px,0.85fr)_minmax(145px,0.85fr)_auto]">
          <label className="min-w-0 text-sm font-medium text-muted-foreground">
            Search subpart
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
          <label className="min-w-0 text-sm font-medium text-muted-foreground">
            SubHub
            <select
              aria-label="Filter by SubHub"
              value={hub}
              onChange={(event) => setHub(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground outline-none focus:border-primary"
            >
              <option value="all">All active SubHubs</option>
              {[...new Set(rows.map((row) => row.hub))].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-muted-foreground">
            Stock status
            <select
              aria-label="Filter by stock status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground outline-none focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="shortage">Shortage - needs stock</option>
              <option value="low">Low buffer - exactly enough</option>
              <option value="surplus">Surplus</option>
              <option value="no-target">No open target</option>
            </select>
          </label>
          <div className="flex justify-end">
            <div
              role="group"
              aria-label="Shortage view"
              className="inline-flex rounded-md border border-input p-1"
            >
              <button
                type="button"
                aria-pressed={viewMode === "matrix"}
                onClick={() => {
                  setPage(1);
                  setViewMode("matrix");
                }}
                className={`min-h-9 rounded px-3 text-sm font-medium ${
                  viewMode === "matrix"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Matrix
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => {
                  setPage(1);
                  setViewMode("list");
                }}
                className={`min-h-9 rounded px-3 text-sm font-medium ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </section>

      {viewMode === "matrix" && visibleParts.length && visibleHubs.length ? (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="min-w-36 px-3 py-3 font-semibold">
                  Subpart name
                </th>
                <th scope="col" className="min-w-24 px-3 py-3 font-semibold">
                  Code
                </th>
                {visibleHubs.map((hubName) => (
                  <th
                    key={hubName}
                    scope="col"
                    className="min-w-28 border-l border-border px-3 py-3 font-semibold normal-case tracking-normal text-foreground"
                  >
                    {hubName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleParts.map((part) => (
                <tr key={part.code} className="border-t border-border/70 hover:bg-muted/30">
                  <td className="min-w-36 px-3 py-4 text-base font-semibold">{part.name}</td>
                  <td className="tabular min-w-24 whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {part.code}
                  </td>
                  {visibleHubs.map((hubName) => {
                    const row = rows.find(
                      (candidate) => candidate.code === part.code && candidate.hub === hubName,
                    );
                    if (!row) {
                      return (
                        <td
                          key={hubName}
                          className="border-l border-border/70 px-3 py-4 text-sm text-muted-foreground"
                        >
                          —
                        </td>
                      );
                    }
                    const details = statusDetails(row);
                    return (
                      <td key={hubName} className="border-l border-border/70 px-3 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <div className="flex w-full items-baseline justify-between gap-2 whitespace-nowrap text-xs">
                            <span className="text-muted-foreground">Required</span>
                            <span className="tabular text-sm font-semibold">
                              {row.required.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex w-full items-baseline justify-between gap-2 whitespace-nowrap text-xs">
                            <span className="text-muted-foreground">Stock</span>
                            <span className="tabular text-sm font-semibold">
                              {row.stock.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${details.className}`}
                          >
                            {details.label}
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
      ) : viewMode === "list" && visibleListRows.length ? (
        <section className="overflow-hidden border-y border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-base">
              <thead className="bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="min-w-56 px-4 py-3 font-semibold">
                    Subpart name
                  </th>
                  <th scope="col" className="min-w-36 px-4 py-3 font-semibold">
                    Code
                  </th>
                  <th scope="col" className="min-w-44 px-4 py-3 font-semibold">
                    SubHub
                  </th>
                  <th scope="col" className="min-w-40 px-4 py-3 text-right font-semibold">
                    Required quantity
                  </th>
                  <th scope="col" className="min-w-32 px-4 py-3 text-right font-semibold">
                    Current stock
                  </th>
                  <th scope="col" className="min-w-48 px-4 py-3 font-semibold">
                    Stock status
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const details = statusDetails(row);
                  return (
                    <tr
                      key={`${row.code}-${row.hub}`}
                      className="border-t border-border/70 hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-semibold">{row.name}</td>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-sm">{row.code}</td>
                      <td className="whitespace-nowrap px-4 py-4">{row.hub}</td>
                      <td className="tabular px-4 py-4 text-right font-medium">
                        {row.required.toLocaleString("en-IN")}
                      </td>
                      <td className="tabular px-4 py-4 text-right font-semibold">
                        {row.stock.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${details.className}`}
                        >
                          {details.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, visibleListRows.length)} of {visibleListRows.length}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(visibleListRows.length / pageSize)}
              </span>
              <button
                type="button"
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= Math.ceil(visibleListRows.length / pageSize)}
                onClick={() =>
                  setPage((current) =>
                    Math.min(Math.ceil(visibleListRows.length / pageSize), current + 1),
                  )
                }
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : (
        <p className="py-10 text-center text-base text-muted-foreground">
          No subparts match these filters. Try another SubHub or stock status.
        </p>
      )}
    </PreviewShell>
  );
}
