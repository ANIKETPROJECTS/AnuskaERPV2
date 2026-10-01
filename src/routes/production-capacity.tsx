import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HubCapacityRow } from "@/components/erp/HubCapacityRow";
import { ProductionTargetsNav } from "@/components/erp/ProductionTargetsNav";
import { Shell } from "@/components/erp/Shell";
import { getAdminProductionDashboardFn, setAdminHubCapacityFn } from "@/production";
import type { AdminProductionDashboard } from "@/production.server";

export const Route = createFileRoute("/production-capacity")({
  head: () => ({
    meta: [
      { title: "SubHub capacity & workload — Float ERP" },
      { name: "description", content: "Review SubHub open work and manage declared production capacity." },
    ],
  }),
  component: ProductionCapacity,
});

function ProductionCapacity() {
  const [dashboard, setDashboard] = useState<AdminProductionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingCapacityId, setSavingCapacityId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminProductionDashboardFn();
      if (result.ok) setDashboard(result.data);
      else setError(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SubHub capacity data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveHubCapacity(subhubUserId: string, capacityUnits: number | null) {
    setSavingCapacityId(subhubUserId);
    setSuccess("");
    setError("");
    try {
      const result = await setAdminHubCapacityFn({ data: { subhubUserId, capacityUnits } });
      if (!result.ok) {
        setError(result.message);
      } else {
        setDashboard((current) =>
          current
            ? {
                ...current,
                hubs: current.hubs.map((hub) =>
                  hub.userId === subhubUserId ? { ...hub, capacityUnits } : hub,
                ),
              }
            : current,
        );
        setSuccess(
          `Hub capacity updated${result.reassignments.length
            ? ` · ${result.reassignments.length} order${result.reassignments.length === 1 ? "" : "s"} automatically reassigned`
            : ""}.`,
        );
        await load();
      }
      return result;
    } finally {
      setSavingCapacityId("");
    }
  }

  return (
    <Shell
      title="SubHub capacity & workload"
      subtitle="Advanced settings · Review open work and manage declared production capacity."
      actions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      }
    >
      <div className="space-y-5">
        <ProductionTargetsNav active="capacity" />
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {success ? <p role="status" className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}
        <section aria-labelledby="subhub-capacity-heading">
          <div className="border-b border-border py-4">
            <h2 id="subhub-capacity-heading" className="text-lg font-semibold">Declared capacity by SubHub</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Capacity is compared with active open target units. Leave a value blank for no limit.
            </p>
          </div>
          <div className="overflow-x-auto border-b border-border">
            <table aria-label="SubHub declared capacity and workload" className="w-full min-w-[1000px] table-fixed text-base">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[9%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead className="border-b border-border bg-muted/30 text-left text-sm uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="border-r border-border/60 px-3 py-3 font-semibold">Factory / SubHub</th>
                  <th scope="col" className="border-r border-border/60 px-3 py-3 font-semibold">Manager</th>
                  <th scope="col" className="border-r border-border/60 px-3 py-3 text-center font-semibold">Active orders</th>
                  <th scope="col" className="border-r border-border/60 px-3 py-3 text-right font-semibold">Current load</th>
                  <th scope="col" className="border-r border-border/60 px-3 py-3 font-semibold">Declared capacity</th>
                  <th scope="col" className="border-r border-border/60 px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Set capacity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && !dashboard ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-base text-muted-foreground">Loading SubHub capacity…</td>
                  </tr>
                ) : dashboard?.hubs.length ? (
                  dashboard.hubs.map((hub) => (
                    <HubCapacityRow
                      key={hub.userId}
                      hub={hub}
                      saving={savingCapacityId === hub.userId}
                      onSave={saveHubCapacity}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-base text-muted-foreground">No active SubHub Managers are available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}