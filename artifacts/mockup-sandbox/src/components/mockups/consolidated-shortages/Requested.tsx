import { CircleAlert, CircleCheck, Filter, RefreshCw, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import "./_group.css";
import { PreviewShell } from "./_shared/PreviewShell";

type StockStatus = "shortage" | "low" | "surplus" | "no-target";

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
      className: "bg-destructive/10 text-destructive",
    };
  }
  if (status === "low") {
    return {
      label: "Low buffer · just enough",
      className: "bg-warning/25 text-warning-foreground",
    };
  }
  if (status === "surplus") {
    return {
      label: `Surplus ${row.stock - row.required}`,
      className: "bg-success/10 text-success",
    };
  }
  return { label: "No open target", className: "bg-secondary text-secondary-foreground" };
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
        Red: needs stock
      </span>
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <CircleAlert className="size-4 text-warning" aria-hidden="true" />
        Yellow: exactly enough, no spare
      </span>
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <CircleCheck className="size-4 text-success" aria-hidden="true" />
        Green: stock above requirement
      </span>
      <span className="text-muted-foreground">Gray: no open target</span>
    </div>
  );
}

export function Requested() {
  const [query, setQuery] = useState("");
  const [hub, setHub] = useState("all");
  const [status, setStatus] = useState<StockStatus | "all">("all");

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !normalized || `${row.name} ${row.code}`.toLowerCase().includes(normalized);
      const matchesHub = hub === "all" || row.hub === hub;
      const matchesStatus = status === "all" || statusFor(row) === status;
      return matchesQuery && matchesHub && matchesStatus;
    });
  }, [hub, query, status]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Filter className="size-4" aria-hidden="true" />
          Find a part or SubHub
        </h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Preview data
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[240px] flex-1 text-sm font-medium text-muted-foreground">
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
        <label className="w-full text-sm font-medium text-muted-foreground sm:w-64">
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
        <label className="w-full text-sm font-medium text-muted-foreground sm:w-56">
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-relaxed text-muted-foreground">
          Required quantity is calculated from remaining assigned targets and the Bill of Materials.
          Current stock is shown separately for each SubHub.
        </p>
        <StatusLegend />
      </div>

      <section className="panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Parts and stock by SubHub</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {visibleRows.length} {visibleRows.length === 1 ? "row" : "rows"} match the selected
              filters
            </p>
          </div>
        </header>
        {visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-base">
              <thead className="bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Subpart name
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    SubHub
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="block">Required quantity</span>
                    <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal">
                      open targets
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Current stock
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Stock status
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const details = statusDetails(row);
                  return (
                    <tr
                      key={`${row.code}-${row.hub}-${index}`}
                      className="border-t border-border/70 hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold">{row.name}</td>
                      <td className="tabular whitespace-nowrap px-4 py-3.5 text-sm text-muted-foreground">
                        {row.code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">{row.hub}</td>
                      <td className="tabular px-4 py-3.5 text-right font-medium">
                        {row.required.toLocaleString("en-IN")}
                      </td>
                      <td className="tabular px-4 py-3.5 text-right font-semibold">
                        {row.stock.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5">
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
        ) : (
          <p className="px-5 py-10 text-center text-base text-muted-foreground">
            No subparts match these filters. Try another SubHub or stock status.
          </p>
        )}
      </section>
    </PreviewShell>
  );
}
