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
    <div
      aria-label="Kolkata date and time"
      className="mx-3 mb-3 rounded-lg border border-sidebar-primary bg-sidebar-primary px-3 py-3"
    >
      <p className="text-lg font-semibold tabular-nums text-sidebar-primary-foreground" aria-live="off">
        {now ? timeFormatter.format(now) : "—"}
      </p>
      <p className="text-sm leading-snug text-sidebar-primary-foreground/80">
        {now ? dateFormatter.format(now) : "Loading date…"}
      </p>
    </div>
  );
}