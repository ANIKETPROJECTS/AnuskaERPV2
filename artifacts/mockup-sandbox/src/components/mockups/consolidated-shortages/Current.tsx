import { Bell, Filter, RefreshCw, Send } from "lucide-react";
import "./_group.css";
import { PreviewShell } from "./_shared/PreviewShell";

const hubs = ["Factory 1 - Thane", "Unit G10 - Goa", "Unit G4 - Indore", "Unit G5 - Bengaluru"];

const parts = [
  { name: "Washer", code: "GP006-001", material: "Nylon 66", gaps: [218, 22, 0, 0], net: 240 },
  { name: "Pivot Pin", code: "GP006-002", material: "SS 304", gaps: [116, 2, 0, 0], net: 118 },
  { name: "Screw M3x8", code: "GP006-003", material: "MS Zinc", gaps: [472, 44, 0, 0], net: 516 },
  {
    name: "Ball Float Body (Reviva NXT)",
    code: "GP006-010",
    material: "PP Copo",
    gaps: [-9, 0, 0, 0],
    net: -9,
  },
  {
    name: "Float Split Arm Enhance",
    code: "GP006-011",
    material: "POM",
    gaps: [0, 0, 0, 0],
    net: 0,
  },
  { name: "Float Arm SM", code: "GP006-012", material: "POM", gaps: [200, 4, 0, 0], net: 204 },
  { name: "Float Body TM", code: "GP006-013", material: "PP Copo", gaps: [0, 0, 0, 0], net: 0 },
  { name: "Seal Gasket", code: "GP006-014", material: "Silicone", gaps: [236, 22, 0, 0], net: 258 },
];

function CurrentKpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "bad" | "warn" | "good";
}) {
  const bar = tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-success";
  return (
    <div className="panel relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="tabular mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function Current() {
  return (
    <PreviewShell
      title="Consolidated Shortages"
      subtitle="Remaining BOM requirement − current workspace stock · negative values are surplus"
      actions={
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
            <Bell className="size-4" />
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
            <Filter className="size-4" />
            Filters
          </button>
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Current page preview</p>
        <p className="text-xs text-muted-foreground">Sample values for layout review</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CurrentKpi label="Total deficit" value="1,876" hint="open units to arrange" tone="bad" />
        <CurrentKpi
          label="Parts affected"
          value="8 / 12"
          hint="with at least one deficit"
          tone="warn"
        />
        <CurrentKpi label="Hubs in deficit" value="2 / 4" hint="2 fully covered" tone="warn" />
        <CurrentKpi label="Actions logged" value="3" hint="linked MongoDB actions" tone="good" />
      </div>

      <section className="panel overflow-hidden">
        <header className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">Shortage matrix</h2>
          <p className="text-xs text-muted-foreground">
            Requirement − current stock · 8 of 12 parts · each cell uses live workspace data
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-card px-5 py-3 text-left font-medium">Subpart</th>
                {hubs.map((hub) => (
                  <th key={hub} className="px-3 py-3 text-center font-medium">
                    {hub}
                  </th>
                ))}
                <th className="px-5 py-3 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr key={part.code} className="border-b border-border/70 last:border-0">
                  <td className="sticky left-0 bg-card px-5 py-3">
                    <p className="font-medium">{part.name}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {part.code} · {part.material}
                    </p>
                  </td>
                  {part.gaps.map((gap, index) => (
                    <td key={hubs[index]} className="px-3 py-3 text-center">
                      <span
                        className={`tabular inline-block min-w-16 rounded px-2 py-1 text-xs font-semibold ${
                          gap > 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {gap > 0 ? gap : `−${Math.abs(gap)}`}
                      </span>
                    </td>
                  ))}
                  <td
                    className={`tabular px-5 py-3 text-right font-semibold ${part.net > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {part.net > 0 ? part.net : `−${Math.abs(part.net)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">Action log</h2>
          <p className="text-xs text-muted-foreground">
            Procurement actions linked to parts currently in deficit
          </p>
        </header>
        <ul className="divide-y divide-border text-sm">
          <li className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Factory 1 - Thane
            </span>
            <span className="font-medium">Washer</span>
            <span className="tabular text-muted-foreground">120 units</span>
            <span className="ml-auto text-xs text-muted-foreground">PO-1042 · Vendor · 28 Sep</span>
          </li>
          <li className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Unit G10 - Goa
            </span>
            <span className="font-medium">Pivot Pin</span>
            <span className="tabular text-muted-foreground">40 units</span>
            <span className="ml-auto text-xs text-muted-foreground">PO-1041 · Vendor · 30 Sep</span>
          </li>
        </ul>
      </section>
    </PreviewShell>
  );
}
