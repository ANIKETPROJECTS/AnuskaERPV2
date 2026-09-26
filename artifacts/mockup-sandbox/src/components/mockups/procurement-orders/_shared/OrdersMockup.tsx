import { PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";

type Status = "Order placed" | "Payment done" | "Dispatch done" | "Delivery done";

const orders: Array<{
  order: string;
  hub: string;
  vendor: string;
  material: string;
  code: string;
  quantity: number;
  amount: string;
  ordered: string;
  expected: string;
  status: Status;
}> = [
  {
    order: "PO-25092601",
    hub: "Bengaluru · Kavya Rao",
    vendor: "Aqua Parts Supply",
    material: "RO Membrane Housing",
    code: "RM-014",
    quantity: 240,
    amount: "₹48,000",
    ordered: "26 Sep 2026",
    expected: "03 Oct 2026",
    status: "Payment done",
  },
  {
    order: "PO-25092518",
    hub: "Pune · Rohan Shah",
    vendor: "PureFlow Components",
    material: "Sediment Filter 10″",
    code: "RM-008",
    quantity: 500,
    amount: "₹22,500",
    ordered: "25 Sep 2026",
    expected: "01 Oct 2026",
    status: "Dispatch done",
  },
  {
    order: "PO-25092412",
    hub: "Hyderabad · Ananya Das",
    vendor: "Aqua Parts Supply",
    material: "Carbon Block Filter",
    code: "RM-021",
    quantity: 320,
    amount: "₹35,200",
    ordered: "24 Sep 2026",
    expected: "02 Oct 2026",
    status: "Order placed",
  },
];

const statuses: Status[] = ["Order placed", "Payment done", "Dispatch done", "Delivery done"];

function statusClass(status: Status) {
  if (status === "Delivery done") return "bg-emerald-700";
  if (status === "Dispatch done") return "bg-blue-700";
  if (status === "Payment done") return "bg-amber-700";
  return "bg-slate-700";
}

export function OrdersMockup({ refreshed }: { refreshed: boolean }) {
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("all");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const matchesQuery =
          !query ||
          `${order.order} ${order.hub} ${order.vendor} ${order.material} ${order.code}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return (
          matchesQuery &&
          (vendor === "all" || order.vendor === vendor) &&
          (status === "all" || order.status === status)
        );
      }),
    [query, status, vendor],
  );

  const metrics = refreshed
    ? [
        { label: "Total orders", value: "248", hint: "All procurement orders" },
        { label: "Open orders", value: "36", hint: "1,420 units in progress" },
        { label: "Delivered orders", value: "212", hint: "Orders marked delivery done" },
      ]
    : [
        { label: "Active vendors", value: "18", hint: "24 total records" },
        { label: "Open orders", value: "36", hint: "1,420 units in progress" },
        { label: "Committed spend", value: "₹8,42,500", hint: "Open procurement orders" },
        { label: "On-time delivery", value: "94%", hint: "212 completed orders" },
      ];

  return (
    <div className="procurement-mockup min-h-screen bg-background font-sans text-sm text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Procurement
          </p>
          <h1 className="mt-1 text-xl font-semibold">Order Management</h1>
        </div>
        {refreshed ? (
          <button className="rule-header inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold">
            <PackagePlus className="size-4" /> New procurement order
          </button>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 p-6">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <nav className="flex items-center gap-6 text-sm font-semibold text-primary">
            <span className="border-b-2 border-primary pb-2">Order Management</span>
            <span className="pb-2 text-muted-foreground">Vendor Management</span>
            {!refreshed ? (
              <span className="pb-2 text-muted-foreground">Hub stock &amp; targets</span>
            ) : null}
          </nav>
          {!refreshed ? (
            <div className="flex gap-2">
              <button className="rule-header inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold">
                <PackagePlus className="size-4" /> New procurement order
              </button>
              <button className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold">
                Refresh
              </button>
            </div>
          ) : null}
        </div>

        <section
          aria-label="Procurement summary"
          className={`grid gap-x-8 border-y border-border sm:grid-cols-2 ${
            refreshed ? "xl:grid-cols-3" : "xl:grid-cols-4"
          }`}
        >
          {metrics.map((metric) => (
            <div key={metric.label} className="py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </p>
              <p className="tabular mt-1 text-2xl font-bold leading-tight">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.hint}</p>
            </div>
          ))}
        </section>

        {!refreshed ? (
          <div className="border-y border-border">
            <div className="flex items-center gap-3 py-3">
              <Search className="size-4 text-primary" />
              <div>
                <h2 className="text-base font-semibold">Search and filter orders</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use an exact date or a date range; filters can be combined.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2 border-y border-border py-3">
          <label className="min-w-[220px] flex-1 text-sm font-medium">
            Search
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PO, vendor, material, SubHub…"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </span>
          </label>
          <label className="min-w-36 text-sm font-medium">
            Vendor
            <select
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All vendors</option>
              <option>Aqua Parts Supply</option>
              <option>PureFlow Components</option>
            </select>
          </label>
          <label className="min-w-36 text-sm font-medium">
            SubHub
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option>All SubHubs</option>
              <option>Bengaluru</option>
              <option>Pune</option>
              <option>Hyderabad</option>
            </select>
          </label>
          <label className="min-w-36 text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {!refreshed ? (
            <label className="min-w-36 text-sm font-medium">
              Sort
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option>Newest order date</option>
                <option>Expected delivery</option>
              </select>
            </label>
          ) : null}
          {!refreshed ? (
            <label className="min-w-36 text-sm font-medium">
              Exact order date
              <input
                type="date"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          ) : null}
          <label className="min-w-36 text-sm font-medium">
            From
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="min-w-36 text-sm font-medium">
            To
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Procurement orders</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {orders.length} orders
            </p>
          </div>
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">SubHub</th>
                  <th className="px-3 py-3 font-semibold">Vendor</th>
                  <th className="px-3 py-3 font-semibold">Materials</th>
                  <th className="px-3 py-3 text-right font-semibold">Qty</th>
                  {!refreshed ? (
                    <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  ) : null}
                  <th className="px-3 py-3 font-semibold">Ordered</th>
                  <th className="px-3 py-3 font-semibold">Expected</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.order}
                    className="border-b border-border/70 last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-3 py-3">
                      <a className="font-semibold text-primary">{order.order}</a>
                      {!refreshed ? (
                        <p className="mt-1 text-xs text-muted-foreground">Quarterly filter restock</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{order.hub}</td>
                    <td className="px-3 py-3 font-semibold">{order.vendor}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{order.material}</p>
                      <p className="tabular text-xs text-muted-foreground">{order.code}</p>
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {order.quantity.toLocaleString("en-IN")}
                    </td>
                    {!refreshed ? (
                      <td className="tabular px-3 py-3 text-right">{order.amount}</td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-3">{order.ordered}</td>
                    <td className="whitespace-nowrap px-3 py-3">{order.expected}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                          refreshed
                            ? `text-white ${statusClass(order.status)}`
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <select
                        aria-label={`Change status for ${order.order}`}
                        defaultValue={order.status}
                        className={`h-9 min-w-36 rounded-md border border-input px-2 text-xs font-semibold ${
                          refreshed
                            ? `border-0 text-white ${statusClass(order.status)}`
                            : "bg-background text-foreground"
                        }`}
                      >
                        {statuses.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {!refreshed ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="border-t border-border pt-4">
              <h2 className="text-base font-semibold">SubHub procurement report</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Spend, quantities, and order status across every active SubHub.
              </p>
            </section>
            <section className="border-t border-border pt-4">
              <h2 className="text-base font-semibold">Vendor performance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Order volume, spend and completed-delivery reliability.
              </p>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}