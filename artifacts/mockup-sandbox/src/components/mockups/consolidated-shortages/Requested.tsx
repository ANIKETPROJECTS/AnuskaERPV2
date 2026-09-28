import { RefreshCw, Search, Send } from "lucide-react";
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

      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {visibleParts.length} subparts across {visibleHubs.length} SubHubs
        </p>
      </div>

      {visibleParts.length && visibleHubs.length ? (
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
                {visibleHubs.map((hubName) => (
                  <th
                    key={hubName}
                    scope="col"
                    className="min-w-24 border-l border-border px-2 py-3 font-semibold normal-case tracking-normal text-foreground"
                  >
                    {hubName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleParts.map((part) => (
                <tr key={part.code} className="border-t border-border/70 hover:bg-muted/30">
                  <td className="min-w-32 px-2 py-3.5 font-semibold">{part.name}</td>
                  <td className="tabular min-w-20 whitespace-nowrap px-2 py-3.5 text-sm text-muted-foreground">
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
                          className="border-l border-border/70 px-2 py-3.5 text-muted-foreground"
                        >
                          —
                        </td>
                      );
                    }
                    const details = statusDetails(row);
                    return (
                      <td key={hubName} className="border-l border-border/70 px-2 py-3.5">
                        <div className="flex flex-col items-start gap-1.5">
                          <div className="flex w-full items-baseline justify-between gap-1 whitespace-nowrap text-[11px]">
                            <span className="text-muted-foreground">Required</span>
                            <span className="tabular font-medium">
                              {row.required.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex w-full items-baseline justify-between gap-1 whitespace-nowrap text-[11px]">
                            <span className="text-muted-foreground">Stock</span>
                            <span className="tabular font-semibold">
                              {row.stock.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-1.5 py-1 text-[11px] font-semibold ${details.className}`}
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
      ) : (
        <p className="py-10 text-center text-base text-muted-foreground">
          No subparts match these filters. Try another SubHub or stock status.
        </p>
      )}
    </PreviewShell>
  );
}
