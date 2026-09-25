import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

export function Kpi({
  label,
  value,
  delta,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const bar =
    tone === "good"
      ? "bg-success"
      : tone === "bad"
        ? "bg-destructive"
        : tone === "warn"
          ? "bg-warning"
          : "bg-primary";
  return (
    <div className="panel relative overflow-hidden p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="tabular mt-2 text-3xl font-semibold">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {typeof delta === "number" ? (
          <span
            className={`tabular inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
              delta >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
        {hint}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Tag({
  children,
  tone = "neutral",
  size = "sm",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "info";
  size?: "sm" | "md";
}) {
  const map = {
    neutral: "bg-secondary text-secondary-foreground",
    good: "bg-success/12 text-success",
    bad: "bg-destructive/12 text-destructive",
    warn: "bg-warning/20 text-warning-foreground",
    info: "bg-primary/10 text-primary",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded ${
        size === "md" ? "px-2.5 py-1 text-sm font-semibold" : "px-2 py-0.5 text-[11px] font-medium"
      } ${map[tone]}`}
    >
      {children}
    </span>
  );
}
