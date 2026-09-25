import { AlertTriangle, Check, ChevronDown, Minus, Plus } from "lucide-react";
import type { ProductionAllocationPreview, ProductionManualAllocation } from "@/inventory.server";
import { num } from "@/lib/erp-data";
import type { ProductionOrder, ProductionReport } from "@/production.server";

export function HubManagerOrderCard({
  order,
  quantity,
  reports,
  preview,
  previewQuantity,
  allocationLoading,
  manualMode,
  manualRows,
  onQuantityChange,
  onManualModeChange,
  onManualRowsChange,
}: {
  order: ProductionOrder;
  quantity: number;
  reports: ProductionReport[];
  preview?: ProductionAllocationPreview | undefined;
  previewQuantity?: number | undefined;
  allocationLoading: boolean;
  manualMode: boolean;
  manualRows: ProductionManualAllocation[];
  onQuantityChange: (value: number) => void;
  onManualModeChange: (value: boolean) => void;
  onManualRowsChange: (rows: ProductionManualAllocation[]) => void;
}) {
  const currentPreview = previewQuantity === quantity ? preview : undefined;
  const orderReports = reports
    .filter((report) => report.orderId === order.id)
    .sort((left, right) => right.date.localeCompare(left.date));
  const manualAllocationValid = currentPreview
    ? currentPreview.requirements.every(
        (requirement) =>
          manualRows
            .filter((row) => row.itemCode === requirement.itemCode)
            .reduce((sum, row) => sum + row.quantity, 0) === requirement.requiredQuantity,
      )
    : false;

  function updateBatchQuantity(itemCode: string, batchId: string, nextQuantity: number) {
    const nextRows = manualRows.filter(
      (row) => !(row.itemCode === itemCode && row.batchId === batchId),
    );
    if (nextQuantity > 0) nextRows.push({ itemCode, batchId, quantity: nextQuantity });
    onManualRowsChange(nextRows);
  }

  const materialMessage =
    quantity < 1
      ? "Enter today's output to check materials"
      : allocationLoading
        ? "Checking materials…"
        : !currentPreview
          ? "Material check pending"
          : currentPreview.sufficient
            ? "Materials ready"
            : "Material shortage";

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {order.productName}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{order.variantName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.orderNumber} · {order.variantCode} · Due {order.dueDate}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            order.status === "Complete" || order.status === "Over target"
              ? "bg-success/10 text-success"
              : order.status === "In progress"
                ? "bg-warning/10 text-warning"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {order.status}
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Metric label="Target" value={order.target} />
          <Metric label="Made so far" value={order.produced} />
          <Metric label="Left to make" value={order.remaining} />
        </div>
        <div className="rounded-lg bg-muted/40 p-3 sm:min-w-56">
          <p className="mb-2 text-sm font-semibold">Made today</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={`Decrease today's output for ${order.variantName}`}
              onClick={() => onQuantityChange(quantity - 1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-md border border-input bg-white text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Minus className="size-5" />
            </button>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              aria-label={`Units made today for ${order.variantName}`}
              value={quantity}
              onChange={(event) => onQuantityChange(Number(event.target.value))}
              className="tabular h-11 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-center text-xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              aria-label={`Increase today's output for ${order.variantName}`}
              onClick={() => onQuantityChange(quantity + 1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-md border border-input bg-white text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-muted/20 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
              currentPreview?.sufficient
                ? "bg-success/10 text-success"
                : currentPreview
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
            }`}
            role="status"
          >
            {currentPreview?.sufficient ? <Check className="size-4" /> : null}
            {currentPreview && !currentPreview.sufficient ? (
              <AlertTriangle className="size-4" />
            ) : null}
            {materialMessage}
          </span>
        </div>

        <details className="group mt-3 rounded-lg border border-border bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span>Materials and past entries (optional)</span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-border p-3 sm:p-4">
            <section aria-label={`Materials for ${order.variantName}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-semibold">Materials</h4>
                <p className="text-sm text-muted-foreground">
                  Oldest batches are used first automatically.
                </p>
              </div>
              {quantity < 1 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter the number made today to see materials needed.
                </p>
              ) : allocationLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Checking available materials…</p>
              ) : currentPreview ? (
                <>
                  <div className="mt-3 space-y-2">
                    {currentPreview.requirements.map((requirement) => {
                      const batches = currentPreview.batches.filter(
                        (batch) => batch.itemCode === requirement.itemCode,
                      );
                      const available = batches.reduce(
                        (sum, batch) => sum + batch.availableQuantity,
                        0,
                      );
                      return (
                        <div
                          key={requirement.itemCode}
                          className="rounded-md border border-border bg-muted/20 p-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-medium">{requirement.itemName}</p>
                            <p
                              className={`tabular text-sm font-semibold ${available >= requirement.requiredQuantity ? "text-success" : "text-destructive"}`}
                            >
                              {num(available)} available · {num(requirement.requiredQuantity)}{" "}
                              needed
                            </p>
                          </div>
                          {available < requirement.requiredQuantity ? (
                            <p className="mt-1 text-sm font-medium text-destructive">
                              There may not be enough stock to save this output.
                            </p>
                          ) : null}
                          {manualMode ? (
                            <div className="mt-3 space-y-2 border-t border-border pt-3">
                              {batches.length ? (
                                batches.map((batch) => (
                                  <label
                                    key={batch.id}
                                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                  >
                                    <span>
                                      <span className="font-medium">{batch.batchCode}</span>
                                      <span className="ml-2 text-muted-foreground">
                                        Available: {num(batch.availableQuantity)}
                                      </span>
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      max={batch.availableQuantity}
                                      step="1"
                                      inputMode="numeric"
                                      aria-label={`Units from batch ${batch.batchCode}`}
                                      value={
                                        manualRows.find(
                                          (row) =>
                                            row.itemCode === requirement.itemCode &&
                                            row.batchId === batch.id,
                                        )?.quantity ?? ""
                                      }
                                      onChange={(event) =>
                                        updateBatchQuantity(
                                          requirement.itemCode,
                                          batch.id,
                                          Math.max(0, Math.floor(Number(event.target.value) || 0)),
                                        )
                                      }
                                      className="tabular h-10 w-28 rounded-md border border-input px-2 text-right"
                                    />
                                  </label>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No batches are available for this material.
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Enter exactly {num(requirement.requiredQuantity)} units across the
                                batches.
                              </p>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {batches.length
                                ? `${batches.length} material batch${batches.length === 1 ? "" : "es"} will be used automatically.`
                                : "No batches are available."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {!currentPreview.requirements.length ? (
                      <p className="text-sm text-muted-foreground">
                        No material requirements are listed for this product.
                      </p>
                    ) : null}
                  </div>
                  <label className="mt-3 flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={manualMode}
                      onChange={(event) => onManualModeChange(event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Choose batches by hand (advanced)
                  </label>
                  {manualMode ? (
                    <p
                      className={`mt-2 text-sm font-medium ${manualAllocationValid ? "text-success" : "text-warning"}`}
                    >
                      {manualAllocationValid
                        ? "Batch amounts match the required total."
                        : "Check the batch amounts before saving."}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Material details are not available yet.
                </p>
              )}
            </section>

            <section
              aria-label={`Past production entries for ${order.variantName}`}
              className="border-t border-border pt-4"
            >
              <h4 className="font-semibold">Past entries</h4>
              {orderReports.length ? (
                <ul className="mt-2 divide-y divide-border">
                  {orderReports.slice(0, 5).map((report) => (
                    <li
                      key={report.id}
                      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {report.date}
                        {report.notes ? ` · ${report.notes}` : ""}
                      </span>
                      <span className="tabular font-semibold">{num(report.quantity)} units</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No production has been saved for this order yet.
                </p>
              )}
            </section>
          </div>
        </details>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/30 p-2.5 sm:p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 tabular text-lg font-semibold">{num(value)}</p>
      <p className="text-xs text-muted-foreground">units</p>
    </div>
  );
}
