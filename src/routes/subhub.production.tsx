import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ClipboardCheck, RefreshCw, Save } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HubManagerWorkCard } from "@/components/erp/HubManagerWorkCard";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerProductionDataFn, saveDailyProductionFn } from "@/production";
import type { ManagerProductionData } from "@/production.server";

export const Route = createFileRoute("/subhub/production")({
  head: () => ({ meta: [{ title: "Production — Hub Manager · SubHub" }] }),
  component: HubManagerProduction,
});

const emptyData: ManagerProductionData = {
  subhubName: "",
  orders: [],
  reports: [],
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
  const [data, setData] = useState(emptyData);
  const [selectedDate, setSelectedDate] = useState(today());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const hasUnsavedWorkRef = useRef(false);
  const loadInFlightRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    const nextQuantities: Record<string, number> = {};
    reportsForDate.forEach((report) => {
      nextQuantities[report.orderId] = report.quantity;
    });
    setQuantities(nextQuantities);
    setNotes(reportsForDate.find((report) => report.notes)?.notes ?? "");
  }, [reportsForDate]);

  function updateQuantity(orderId: string, value: number) {
    setSaved(false);
    updateUnsavedWork(true);
    setError("");
    const quantity = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
    setQuantities((current) => ({ ...current, [orderId]: quantity }));
  }

  async function saveProduction(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!data.orders.length) return;
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
            },
          }),
        ),
      );
      const failed = results.find((result) => !result.ok);
      if (failed && !failed.ok) {
        setError(
          /insufficient .*stock/i.test(failed.message)
            ? "Production could not be saved because there is not enough stock recorded. Ask Admin to review inventory."
            : failed.message,
        );
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Work assigned</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review each order, then enter the finished units for the selected date.
          </p>
        </div>
        {data.orders.length ? (
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading || hasUnsavedWork}
            title={
              hasUnsavedWork ? "Save your changes before refreshing." : "Refresh assigned work"
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading assigned work…
        </div>
      ) : data.orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <ClipboardCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold">No work assigned yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Orders from Admin will appear here. Ask Admin to assign an order if you expected to see
            work.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="size-4" />
            Check again
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {data.orders.map((order) => (
            <HubManagerWorkCard
              key={order.id}
              order={order}
              quantity={quantities[order.id] ?? 0}
              reports={data.reports}
              selectedDate={selectedDate}
              onQuantityChange={(value) => updateQuantity(order.id, value)}
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
          Production date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSaved(false);
              setSelectedDate(event.target.value);
            }}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          />
        </label>
      }
    >
      <form
        onSubmit={(event) => void saveProduction(event)}
        className="space-y-5 p-4 pb-28 sm:p-6 sm:pb-28"
      >
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {assignedOrdersSection}

        {data.orders.length ? (
          <label className="block rounded-xl border border-border bg-card p-4 text-sm font-semibold shadow-sm sm:p-5">
            Notes for this date{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setSaved(false);
                updateUnsavedWork(true);
              }}
              rows={2}
              placeholder="Add a delay or machine note…"
              className="mt-2 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary"
            />
          </label>
        ) : null}

        {data.orders.length ? (
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div aria-live="polite">
                {saved ? (
                  <p role="status" className="text-sm font-medium text-success">
                    Production saved for {selectedDate}.
                  </p>
                ) : hasUnsavedWork ? (
                  <p className="text-sm font-medium text-warning">You have unsaved changes.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enter the finished units, then save your production.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="size-5" />
                {saving ? "Saving…" : "Save production"}
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </SubHubShell>
  );
}
