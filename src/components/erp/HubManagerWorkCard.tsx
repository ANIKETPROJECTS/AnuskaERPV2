import type { ProductionOrder, ProductionReport } from "@/production.server";
import { num } from "@/lib/erp-data";

type HubManagerWorkCardProps = {
  order: ProductionOrder;
  quantity: number;
  reports: ProductionReport[];
  selectedDate: string;
  onQuantityChange: (value: number) => void;
};

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function hubToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysUntilDue(dueDate: string) {
  const [dueYear, dueMonth, dueDay] = dueDate.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = hubToday().split("-").map(Number);
  if (![dueYear, dueMonth, dueDay, todayYear, todayMonth, todayDay].every(Number.isFinite)) {
    return null;
  }
  const due = Date.UTC(dueYear, dueMonth - 1, dueDay);
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((due - today) / 86_400_000);
}

function statusClass(status: ProductionOrder["status"]) {
  if (status === "Complete") return "bg-success/10 text-success";
  if (status === "Over target") return "bg-warning/10 text-warning";
  if (status === "In progress") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

function dueLabel(days: number | null) {
  if (days === null) return "Due date unavailable";
  if (days < 0) return `${num(Math.abs(days))} ${Math.abs(days) === 1 ? "day" : "days"} overdue`;
  if (days === 0) return "Due today";
  return `${num(days)} ${days === 1 ? "day" : "days"} left`;
}

export function HubManagerWorkCard({
  order,
  quantity,
  reports,
  selectedDate,
  onQuantityChange,
}: HubManagerWorkCardProps) {
  const daysLeft = daysUntilDue(order.dueDate);
  const progress =
    order.target > 0 ? Math.min(100, Math.max(0, (order.produced / order.target) * 100)) : 0;
  const recentReports = reports
    .filter((report) => report.orderId === order.id && report.date !== selectedDate)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 3);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Order {order.orderNumber}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{order.variantName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.productName} · {order.variantCode}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClass(order.status)}`}
        >
          {order.status}
        </span>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OrderDetail label="Order date" value={formatDate(order.createdAt)} />
          <OrderDetail label="Due date" value={formatDate(order.dueDate)} />
          <OrderDetail
            label="Days remaining"
            value={dueLabel(daysLeft)}
            emphasis={daysLeft !== null && daysLeft < 0 ? "warning" : "normal"}
          />
          <OrderDetail label="Target" value={`${num(order.target)} units`} />
        </dl>

        <section aria-label={`Progress for order ${order.orderNumber}`} className="space-y-2">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <p>
              Made so far: <strong className="tabular">{num(order.produced)} units</strong>
            </p>
            <p>
              Still to make: <strong className="tabular">{num(order.remaining)} units</strong>
            </p>
          </div>
          <div
            role="progressbar"
            aria-label={`Production progress for order ${order.orderNumber}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <label className="block max-w-sm text-sm font-semibold">
          Finished units for {formatDate(selectedDate)}
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => onQuantityChange(Number(event.target.value))}
            aria-label={`Finished units for order ${order.orderNumber} on ${formatDate(selectedDate)}`}
            className="tabular mt-1.5 h-12 w-full rounded-md border border-input bg-background px-3 text-lg font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Enter the number of units completed on the selected date.
          </span>
        </label>

        {recentReports.length ? (
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer text-sm font-medium text-primary">
              Recent production entries
            </summary>
            <ul className="mt-2 divide-y divide-border">
              {recentReports.map((report) => (
                <li key={report.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span className="text-muted-foreground">{formatDate(report.date)}</span>
                  <span className="tabular font-medium">{num(report.quantity)} units</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function OrderDetail({
  label,
  value,
  emphasis = "normal",
}: {
  label: string;
  value: string;
  emphasis?: "normal" | "warning";
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/30 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 break-words text-sm font-semibold ${emphasis === "warning" ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}
