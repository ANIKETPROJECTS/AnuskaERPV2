import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Check, ClipboardCheck, RefreshCw, Save, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HubManagerOrderCard } from "@/components/erp/HubManagerOrderCard";
import { SubHubShell } from "@/components/erp/SubHubShell";
import {
  getManagerProductionDataFn,
  previewProductionBatchAllocationFn,
  saveDailyProductionFn,
  setHubCapacityFn,
} from "@/production";
import type { ManagerProductionData, ProductionOrder } from "@/production.server";
import type { ProductionAllocationPreview, ProductionManualAllocation } from "@/inventory.server";
import { num } from "@/lib/erp-data";
import { useAuth } from "@/components/auth/AuthContext";

export const Route = createFileRoute("/subhub/production")({
  head: () => ({ meta: [{ title: "Production — Hub Manager · SubHub" }] }),
  component: HubManagerProduction,
});

const emptyData: ManagerProductionData = {
  subhubName: "",
  orders: [],
  reports: [],
  capacityUnits: null,
  openUnits: 0,
  availableUnits: null,
  overloaded: false,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function HubManagerProduction() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.replace(/\/+$/, "") === "/subhub/production" ? (
    <DailyProductionManager />
  ) : (
    <Outlet />
  );
}

function DailyProductionManager() {
  const { user } = useAuth();
  const [data, setData] = useState(emptyData);
  const [selectedDate, setSelectedDate] = useState(today());
  const selectedDateRef = useRef(selectedDate);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [capacityInput, setCapacityInput] = useState("");
  const [notes, setNotes] = useState("");
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const hasUnsavedWorkRef = useRef(false);
  const loadInFlightRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [saved, setSaved] = useState(false);
  const [capacitySaved, setCapacitySaved] = useState(false);
  const [error, setError] = useState("");
  const [allocationPreviews, setAllocationPreviews] = useState<
    Record<string, ProductionAllocationPreview>
  >({});
  const [allocationQuantities, setAllocationQuantities] = useState<Record<string, number>>({});
  const [allocationLoading, setAllocationLoading] = useState<Record<string, boolean>>({});
  const [manualModes, setManualModes] = useState<Record<string, boolean>>({});
  const [manualRows, setManualRows] = useState<Record<string, ProductionManualAllocation[]>>({});

  function updateUnsavedWork(value: boolean) {
    hasUnsavedWorkRef.current = value;
    setHasUnsavedWork(value);
  }

  const load = useCallback(async (showLoading = true) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const result = await getManagerProductionDataFn();
      if (result.ok) {
        setData(result.data);
        setCapacityInput(result.data.capacityUnits?.toString() ?? "");
        setError("");
      } else {
        setData(emptyData);
        setError(result.message);
      }
    } catch {
      setData(emptyData);
      setError("Work could not be loaded. Check your connection and try again.");
    } finally {
      loadInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible" && !hasUnsavedWorkRef.current) {
        void load(false);
      }
    };
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    const interval = window.setInterval(refreshWhenActive, 30_000);
    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.clearInterval(interval);
    };
  }, [load]);

  const reportsForDate = useMemo(
    () => data.reports.filter((report) => report.date === selectedDate),
    [data.reports, selectedDate],
  );

  const loadAllocation = useCallback(
    async (order: ProductionOrder, quantity: number, applyEditableState = true) => {
      setAllocationLoading((current) => ({ ...current, [order.id]: true }));
      try {
        const result = await previewProductionBatchAllocationFn({
          data: { orderId: order.id, date: selectedDate, quantity },
        });
        if (selectedDateRef.current !== selectedDate) return;
        if (result.ok) {
          setAllocationPreviews((current) => ({ ...current, [order.id]: result.preview }));
          setAllocationQuantities((current) => ({ ...current, [order.id]: quantity }));
          if (applyEditableState) {
            const manual = result.preview.allocationMode === "hybrid";
            const rows = result.preview.manualAllocations;
            setManualRows((current) => ({
              ...current,
              [order.id]: rows,
            }));
            setManualModes((current) => ({
              ...current,
              [order.id]: manual,
            }));
            try {
              window.sessionStorage.setItem(
                allocationStorageKey(order.id, selectedDate),
                JSON.stringify({ manual, rows }),
              );
            } catch {
              // The allocation remains usable for this page even if storage is unavailable.
            }
          }
          setError("");
        } else setError(result.message);
      } catch {
        if (selectedDateRef.current === selectedDate) {
          setError(
            `Materials for ${order.variantName} could not be checked. Try again before saving.`,
          );
        }
      } finally {
        if (selectedDateRef.current === selectedDate) {
          setAllocationLoading((current) => ({ ...current, [order.id]: false }));
        }
      }
    },
    [selectedDate],
  );

  useEffect(() => {
    setAllocationPreviews({});
    setAllocationQuantities({});
    setAllocationLoading({});
    setManualModes({});
    setManualRows({});
  }, [selectedDate]);

  useEffect(() => {
    const nextQuantities: Record<string, number> = {};
    reportsForDate.forEach((report) => {
      nextQuantities[report.orderId] = report.quantity;
    });
    setQuantities(nextQuantities);
    setNotes(reportsForDate.find((report) => report.notes)?.notes ?? "");
    data.orders.forEach((order) => {
      const quantity = nextQuantities[order.id] ?? 0;
      if (quantity > 0) void loadAllocation(order, quantity, false);
    });
  }, [reportsForDate, data.orders, loadAllocation]);

  async function saveCapacity() {
    if (!user?.id) return;
    const rawValue = capacityInput.trim();
    const capacityUnits = rawValue ? Number(rawValue) : null;
    if (capacityUnits !== null && (!Number.isInteger(capacityUnits) || capacityUnits < 1)) {
      setError("Capacity must be a whole number greater than zero, or left blank for no limit.");
      return;
    }
    setSavingCapacity(true);
    setCapacitySaved(false);
    setError("");
    try {
      const result = await setHubCapacityFn({ data: { subhubUserId: user.id, capacityUnits } });
      if (!result.ok) {
        setError(result.message);
      } else {
        setCapacitySaved(true);
        setData((current) => {
          const availableUnits =
            result.capacityUnits === null ? null : result.capacityUnits - current.openUnits;
          return {
            ...current,
            capacityUnits: result.capacityUnits,
            availableUnits,
            overloaded: availableUnits !== null && availableUnits < 0,
          };
        });
      }
    } catch {
      setError("Hub work limit could not be saved. Check your connection and try again.");
    } finally {
      setSavingCapacity(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    data.orders.forEach((order) => {
      try {
        const stored = window.sessionStorage.getItem(allocationStorageKey(order.id, selectedDate));
        if (!stored) {
          setManualModes((current) => ({ ...current, [order.id]: false }));
          setManualRows((current) => ({ ...current, [order.id]: [] }));
          return;
        }
        const value = JSON.parse(stored) as {
          manual?: boolean;
          rows?: ProductionManualAllocation[];
        };
        setManualModes((current) => ({
          ...current,
          [order.id]: typeof value.manual === "boolean" ? value.manual : false,
        }));
        setManualRows((current) => ({
          ...current,
          [order.id]: Array.isArray(value.rows) ? value.rows : [],
        }));
      } catch {
        window.sessionStorage.removeItem(allocationStorageKey(order.id, selectedDate));
        setManualModes((current) => ({ ...current, [order.id]: false }));
        setManualRows((current) => ({ ...current, [order.id]: [] }));
      }
    });
  }, [data.orders, selectedDate]);

  const unitsLeft = data.orders.reduce((sum, order) => sum + order.remaining, 0);
  const todayProduced = data.orders.reduce((sum, order) => sum + (quantities[order.id] ?? 0), 0);
  const allocationBusy = Object.values(allocationLoading).some(Boolean);

  function updateQuantity(orderId: string, value: number) {
    setSaved(false);
    updateUnsavedWork(true);
    setError("");
    const quantity = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
    setQuantities((current) => ({ ...current, [orderId]: quantity }));
    const order = data.orders.find((item) => item.id === orderId);
    if (order && quantity > 0) void loadAllocation(order, quantity);
  }

  async function saveProduction() {
    if (!data.orders.length || allocationBusy) return;
    const invalid = data.orders.find(
      (order) =>
        (quantities[order.id] ?? 0) > 0 &&
        manualModes[order.id] &&
        !isManualValid(allocationPreviews[order.id], manualRows[order.id] ?? []),
    );
    if (invalid) {
      setError(
        `Manual material allocation for ${invalid.variantName} must exactly match every BOM requirement.`,
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const results = await Promise.all(
        data.orders.map((order) =>
          saveDailyProductionFn({
            data: {
              orderId: order.id,
              date: selectedDate,
              quantity: quantities[order.id] ?? 0,
              notes,
              ...(manualModes[order.id] ? { manualAllocations: manualRows[order.id] ?? [] } : {}),
            },
          }),
        ),
      );
      const failed = results.find((result) => !result.ok);
      if (failed && !failed.ok) {
        setError(failed.message);
      } else {
        setSaved(true);
        updateUnsavedWork(false);
        await load(false);
      }
    } catch {
      setError("Production could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const assignedOrdersSection = (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Work assigned to your hub</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the finished units for each order, then save once.
          </p>
        </div>
        {data.orders.length ? (
          <div className="flex items-center gap-2">
            <p className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              {data.orders.length} {data.orders.length === 1 ? "order" : "orders"}
            </p>
            <button
              type="button"
              onClick={() => void load(false)}
              disabled={loading || hasUnsavedWork}
              title={hasUnsavedWork ? "Save today’s work before refreshing targets." : "Refresh assigned targets"}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        ) : null}
      </div>
      {loading ? (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted-foreground">
          Loading today’s work…
        </div>
      ) : data.orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
          <ClipboardCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold">No work assigned yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Your assigned orders will appear here. Ask your Admin to assign work before entering
            production.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-white px-4 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="size-4" /> Check again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.orders.map((order) => (
            <HubManagerOrderCard
              key={order.id}
              order={order}
              quantity={quantities[order.id] ?? 0}
              reports={data.reports}
              preview={allocationPreviews[order.id]}
              previewQuantity={allocationQuantities[order.id]}
              allocationLoading={Boolean(allocationLoading[order.id])}
              manualMode={Boolean(manualModes[order.id])}
              manualRows={manualRows[order.id] ?? []}
              onQuantityChange={(value) => updateQuantity(order.id, value)}
              onManualModeChange={(value) => {
                setSaved(false);
                setManualModes((current) => ({ ...current, [order.id]: value }));
                try {
                  window.sessionStorage.setItem(
                    allocationStorageKey(order.id, selectedDate),
                    JSON.stringify({ manual: value, rows: manualRows[order.id] ?? [] }),
                  );
                } catch {
                  // The allocation remains usable for this page even if storage is unavailable.
                }
              }}
              onManualRowsChange={(rows) => {
                setSaved(false);
                setManualRows((current) => ({ ...current, [order.id]: rows }));
                try {
                  window.sessionStorage.setItem(
                    allocationStorageKey(order.id, selectedDate),
                    JSON.stringify({ manual: Boolean(manualModes[order.id]), rows }),
                  );
                } catch {
                  // The allocation remains usable for this page even if storage is unavailable.
                }
              }}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <SubHubShell
      headerTitle="Daily production"
      actions={
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground">
          Date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSaved(false);
              selectedDateRef.current = event.target.value;
              setSelectedDate(event.target.value);
            }}
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          />
        </label>
      }
    >
      <section className="space-y-4 p-4 pb-28 sm:space-y-5 sm:p-6 sm:pb-28">
        <p className="text-sm text-muted-foreground">
          Enter the finished units for each order. Check materials if needed, then save once.
        </p>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {!loading && data.orders.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Orders assigned"
              value={num(data.orders.length)}
              helper="work items for this hub"
              tone="text-foreground"
            />
            <Stat
              label="Units still needed"
              value={num(unitsLeft)}
              helper="across all assigned orders"
              tone="text-primary"
            />
            <Stat
              label="Made today"
              value={num(todayProduced)}
              helper="units entered on this screen"
              tone="text-success"
            />
          </div>
        ) : null}

        {assignedOrdersSection}

        {data.orders.length ? (
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <label className="block text-sm font-semibold">
              Notes for today <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setSaved(false);
                  updateUnsavedWork(true);
                }}
                rows={2}
                placeholder="Report a delay, material shortage, or machine problem."
                className="mt-2 w-full resize-y rounded-md border border-input px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        ) : null}

        {user?.id ? (
          <details className="rounded-xl border border-border bg-white shadow-sm">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              <Settings2 className="size-4 text-primary" aria-hidden="true" />
              Hub work limit (optional)
            </summary>
            <div className="space-y-4 border-t border-border p-4">
              <p className="text-sm text-muted-foreground">
                Set how many open units your hub can handle. Admin uses this when assigning work.
                Leave blank for no limit.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-medium">
                  Maximum open units
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={capacityInput}
                    onChange={(event) => {
                      setCapacityInput(event.target.value);
                      setCapacitySaved(false);
                    }}
                    placeholder="No limit"
                    aria-label="Maximum open units for this hub"
                    className="tabular mt-1.5 block h-11 w-48 rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="button"
                  disabled={savingCapacity}
                  onClick={() => void saveCapacity()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Save className="size-4" /> {savingCapacity ? "Saving…" : "Save work limit"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
                <span>
                  Open units: <strong className="tabular">{num(data.openUnits)}</strong>
                </span>
                <span>
                  Limit:{" "}
                  <strong>
                    {data.capacityUnits === null ? "No limit" : num(data.capacityUnits)}
                  </strong>
                </span>
                {data.availableUnits !== null ? (
                  <span
                    className={
                      data.overloaded ? "font-medium text-destructive" : "font-medium text-success"
                    }
                  >
                    {data.overloaded
                      ? `${num(Math.abs(data.availableUnits))} units over limit`
                      : `${num(data.availableUnits)} units available`}
                  </span>
                ) : null}
                {data.overloaded ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-destructive">
                    <AlertTriangle className="size-4" /> Ask Admin to review assignments.
                  </span>
                ) : null}
                {capacitySaved ? (
                  <span role="status" className="inline-flex items-center gap-1 text-success">
                    <Check className="size-4" /> Work limit saved.
                  </span>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}

        {data.orders.length ? (
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Made today</p>
                <p className="tabular text-lg font-bold">{num(todayProduced)} units</p>
                {saved ? (
                  <p role="status" className="text-sm font-medium text-success">
                    Today’s production is saved.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={saving || loading || allocationBusy}
                onClick={() => void saveProduction()}
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="size-5" /> {saving ? "Saving…" : "Save today’s work"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </SubHubShell>
  );
}

function isManualValid(
  preview: ProductionAllocationPreview | undefined,
  rows: ProductionManualAllocation[],
) {
  if (!preview) return false;
  return preview.requirements.every(
    (requirement) =>
      rows
        .filter((row) => row.itemCode === requirement.itemCode)
        .reduce((sum, row) => sum + row.quantity, 0) === requirement.requiredQuantity,
  );
}

function allocationStorageKey(orderId: string, date: string) {
  return `subhub:production-allocation:${orderId}:${date}`;
}

function Stat({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}
