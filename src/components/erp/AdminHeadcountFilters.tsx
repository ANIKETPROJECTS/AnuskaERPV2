import { CalendarDays, ChevronDown, Filter } from "lucide-react";
import {
  getHeadcountPreset,
  todayInIndia,
  type HeadcountDateRange,
} from "@/lib/admin-headcount-report";

type HeadcountSubhubOption = {
  id: string;
  name: string;
};

export function AdminHeadcountFilters({
  subhubs,
  subhubId,
  range,
  onSubhubChange,
  onRangeChange,
  onApply,
  loading,
}: {
  subhubs: HeadcountSubhubOption[];
  subhubId: string;
  range: HeadcountDateRange;
  onSubhubChange: (id: string) => void;
  onRangeChange: (range: HeadcountDateRange) => void;
  onApply: (range: HeadcountDateRange) => void;
  loading: boolean;
}) {
  const today = todayInIndia();
  const invalidRange = Boolean(range.startDate && range.endDate && range.startDate > range.endDate);

  function applyPreset(preset: "today" | "week" | "month" | "all") {
    const nextRange = getHeadcountPreset(preset);
    onRangeChange(nextRange);
    onApply(nextRange);
  }

  return (
    <section className="panel space-y-3 p-4" aria-label="Attendance filters">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1 text-sm font-medium text-muted-foreground sm:max-w-[280px]">
          SubHub
          <span className="relative mt-1 block">
            <select
              value={subhubId}
              onChange={(event) => onSubhubChange(event.target.value)}
              className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-base font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="all">All SubHubs</option>
              {subhubs.map((subhub) => (
                <option key={subhub.id} value={subhub.id}>
                  {subhub.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </span>
        </label>

        <label className="w-full text-sm font-medium text-muted-foreground sm:w-44">
          From
          <span className="relative mt-1 block">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={range.startDate}
              max={range.endDate || today}
              onChange={(event) => onRangeChange({ ...range, startDate: event.target.value })}
              className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-2 text-sm font-normal text-foreground outline-none focus:border-primary"
            />
          </span>
        </label>

        <label className="w-full text-sm font-medium text-muted-foreground sm:w-44">
          To
          <span className="relative mt-1 block">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={range.endDate}
              min={range.startDate || undefined}
              max={today}
              onChange={(event) => onRangeChange({ ...range, endDate: event.target.value })}
              className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-2 text-sm font-normal text-foreground outline-none focus:border-primary"
            />
          </span>
        </label>

        <button
          type="button"
          onClick={() => onApply(range)}
          disabled={loading || invalidRange}
          className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Filter className="size-4" />
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Quick range</span>
        <PresetButton onClick={() => applyPreset("today")}>Today</PresetButton>
        <PresetButton onClick={() => applyPreset("week")}>Last 7 days</PresetButton>
        <PresetButton onClick={() => applyPreset("month")}>This month</PresetButton>
        <PresetButton onClick={() => applyPreset("all")}>All saved dates</PresetButton>
        <span className="ml-auto text-xs text-muted-foreground">
          Leave dates blank to include all saved attendance.
        </span>
      </div>
      {invalidRange ? (
        <p role="alert" className="text-sm text-destructive">
          The start date must be on or before the end date.
        </p>
      ) : null}
    </section>
  );
}

function PresetButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-8 items-center rounded-md border border-input px-3 text-xs font-medium text-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}
