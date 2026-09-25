import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

export function SidebarDateTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock3 className="size-4 shrink-0" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em]">Kolkata time</p>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-sidebar-foreground" aria-live="off">
        {now ? timeFormatter.format(now) : "—"}
      </p>
      <p className="text-sm leading-snug text-muted-foreground">
        {now ? dateFormatter.format(now) : "Loading date…"}
      </p>
    </div>
  );
}