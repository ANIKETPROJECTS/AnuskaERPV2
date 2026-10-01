import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { HubModuleNav } from "@/components/erp/HubModuleNav";
import { Shell } from "@/components/erp/Shell";
import { Tag } from "@/components/erp/bits";
import { getAdminProductionDashboardFn } from "@/production";
import type { AdminProductionDashboard, HubSummary } from "@/production.server";
import { num } from "@/lib/erp-data";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

export const Route = createFileRoute("/hubs")({
  head: () => ({
    meta: [
      { title: "Hubs & Stock — Float ERP" },
      { name: "description", content: "Live SubHub targets, daily production reports, completion, and status." },
    ],
  }),
  component: Hubs,
});

const emptyDashboard: AdminProductionDashboard = {
  hubs: [],
  orders: [],
  chartHubs: [],
  dailyProduction: [],
  weeklyProduction: [],
  recentReassignments: [],
  totalTarget: 0,
  totalProduced: 0,
  totalRemaining: 0,
  completion: 0,
  reportsToday: 0,
  latestReportDate: null,
};

function toneFor(status: HubSummary["status"] | "Unstarted"): "good" | "warn" | "bad" | "neutral" {
  if (status === "Complete") return "good";
  if (status === "Over target") return "good";
  if (status === "In progress") return "warn";
  if (status === "Awaiting update") return "bad";
  return "neutral";
}

const hubViews = [
  { id: "hubs", label: "SubHubs" },
  { id: "orders", label: "Assigned output" },
] as const;

type HubView = (typeof hubViews)[number]["id"];

function Hubs() {
  const { pathname } = useLocation();
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<HubView>("hubs");
  const isHubsOverview = pathname === "/hubs" || pathname === "/hubs/";

  async function load(isBackgroundRefresh = false) {
    if (!isBackgroundRefresh) setLoading(true);
    try {
      const result = await getAdminProductionDashboardFn();
      if (result.ok) {
        setDashboard(result.data);
        setError("");
      } else {
        setError(result.message);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SubHub data could not be loaded.");
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  }

  const runRefresh = useAutoRefresh(load, { enabled: isHubsOverview });

  useEffect(() => {
    if (isHubsOverview) void runRefresh(false);
  }, [isHubsOverview, runRefresh]);

  if (pathname !== "/hubs" && pathname !== "/hubs/") {
    return <Outlet />;
  }

  return (
    <Shell
      title="Hubs & Stock"
      subtitle="SubHub production, stock, and assigned output"
      actions={
        <button type="button" onClick={() => void runRefresh(false)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 py-2 text-base font-medium hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      }
      headerNav={
        <HubModuleNav
          active={activeView}
          ariaLabel="Hubs and stock views"
          idPrefix="hub-list"
          items={hubViews}
          onSelect={(view) => setActiveView(view)}
        />
      }
    >
      <div className="space-y-5">
        {error ? <p role="alert" className="border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-base text-destructive">{error}</p> : null}

        <section
          id="hub-list-panel-hubs"
          role="tabpanel"
          aria-labelledby="hub-list-tab-hubs"
          tabIndex={0}
          hidden={activeView !== "hubs"}
          className="space-y-4"
        >
          <div className="border-b border-border pb-3">
            <h2 className="text-lg font-semibold">SubHub overview</h2>
            <p className="mt-1 text-base text-muted-foreground">Live production and stock totals from each SubHub workspace.</p>
          </div>
          {loading && !dashboard.hubs.length ? (
            <p className="py-8 text-center text-base text-muted-foreground">Loading SubHub data…</p>
          ) : dashboard.hubs.length === 0 ? (
            <p className="py-8 text-center text-base text-muted-foreground">No active SubHub Managers are available.</p>
          ) : (
            <div className="overflow-x-auto border-b border-border">
              <table aria-label="SubHub overview" className="w-full min-w-[1050px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Factory / SubHub</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Manager</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Active orders</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Target</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Produced</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Remaining</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Stock</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dashboard.hubs.map((hub) => (
                    <tr key={hub.userId} className="hover:bg-muted/30">
                      <th scope="row" className="px-4 py-4 text-left font-semibold">
                        <Link to="/hubs/$hubId" params={{ hubId: hub.userId }} className="inline-flex items-center gap-1 text-primary hover:underline">
                          {hub.subhubName}<ArrowRight className="size-4" />
                        </Link>
                        <span className="mt-1 block text-sm font-normal text-muted-foreground">
                          Last report: {hub.lastProductionDate ?? "No report submitted"}
                        </span>
                      </th>
                      <td className="px-4 py-4">{hub.name || "—"}</td>
                      <td className="tabular px-4 py-4 text-right">{num(hub.orderCount)}</td>
                      <td className="tabular px-4 py-4 text-right">{num(hub.target)}</td>
                      <td className="tabular px-4 py-4 text-right font-semibold">{num(hub.produced)}</td>
                      <td className="tabular px-4 py-4 text-right">{num(hub.remaining)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-4 text-right">
                        <span className="block font-semibold">{num(hub.stockUnits)} units</span>
                        <span className="text-sm text-muted-foreground">₹{hub.stockValue.toLocaleString("en-IN")}</span>
                      </td>
                      <td className="px-4 py-4"><Tag tone={toneFor(hub.status)}>{hub.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="hub-list-panel-orders"
          role="tabpanel"
          aria-labelledby="hub-list-tab-orders"
          tabIndex={0}
          hidden={activeView !== "orders"}
          className="space-y-4"
        >
          <div className="border-b border-border pb-3">
            <h2 className="text-lg font-semibold">Assigned output</h2>
            <p className="mt-1 text-base text-muted-foreground">Production totals from reports stored in each SubHub workspace.</p>
          </div>
          {dashboard.orders.length === 0 ? (
            <p className="py-8 text-center text-base text-muted-foreground">No assigned orders to report yet.</p>
          ) : (
            <div className="overflow-x-auto border-b border-border">
              <table aria-label="Assigned output by order" className="w-full min-w-[900px] text-base">
                <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">SubHub</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Product / variant</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Target</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Produced</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Remaining</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dashboard.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">{order.subhubName}</td>
                      <td className="tabular px-4 py-4 font-semibold">{order.orderNumber}</td>
                      <td className="px-4 py-4">
                        <span className="block font-semibold">{order.productName}</span>
                        <span className="text-sm text-muted-foreground">{order.variantName} · {order.variantCode}</span>
                      </td>
                      <td className="tabular px-4 py-4 text-right">{num(order.target)}</td>
                      <td className="tabular px-4 py-4 text-right font-semibold">{num(order.produced)}</td>
                      <td className="tabular px-4 py-4 text-right">{num(order.remaining)}</td>
                      <td className="px-4 py-4"><Tag tone={toneFor(order.status)}>{order.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}