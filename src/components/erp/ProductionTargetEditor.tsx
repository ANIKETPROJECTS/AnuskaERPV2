import { useState, type FormEvent } from "react";
import { Save, X } from "lucide-react";
import { bomCatalog } from "@/lib/bom-catalog";
import type { AssignableSubhub, ProductionOrder } from "@/production.server";

export type ProductionTargetUpdate = {
  orderId: string;
  subhubUserId: string;
  productCode: string;
  variantCode: string;
  target: number;
  dueDate: string;
  notes: string;
};

export function ProductionTargetEditor({
  order,
  subhubs,
  busy,
  onClose,
  onSave,
}: {
  order: ProductionOrder;
  subhubs: AssignableSubhub[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: ProductionTargetUpdate) => Promise<void>;
}) {
  const [subhubUserId, setSubhubUserId] = useState(order.subhubUserId);
  const [productCode, setProductCode] = useState(order.productCode);
  const [variantCode, setVariantCode] = useState(order.variantCode);
  const [target, setTarget] = useState(String(order.target));
  const [dueDate, setDueDate] = useState(order.dueDate);
  const [notes, setNotes] = useState(order.notes);
  const product = bomCatalog.find((item) => item.code === productCode) ?? bomCatalog[0];

  function changeProduct(nextProductCode: string) {
    const nextProduct = bomCatalog.find((item) => item.code === nextProductCode);
    setProductCode(nextProductCode);
    setVariantCode(nextProduct?.variants[0]?.code ?? "");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave({
      orderId: order.id,
      subhubUserId,
      productCode,
      variantCode,
      target: Number(target),
      dueDate,
      notes,
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/25"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-production-target-title"
    >
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Admin controls</p>
            <h2 id="edit-production-target-title" className="mt-2 text-xl font-semibold">Edit production target</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.orderNumber} · update the assigned SubHub, variant, quantity, date, or notes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit target"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            Destination SubHub
            <select
              required
              value={subhubUserId}
              onChange={(event) => setSubhubUserId(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">Select SubHub</option>
              {subhubs.map((subhub) => (
                <option key={subhub.id} value={subhub.id}>{subhub.subhubName} · {subhub.name}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Float type
              <select
                required
                value={productCode}
                onChange={(event) => changeProduct(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {bomCatalog.map((item) => (
                  <option key={item.code} value={item.code}>{item.name} · {item.code}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Variant
              <select
                required
                value={variantCode}
                onChange={(event) => setVariantCode(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {(product?.variants ?? []).map((variant) => (
                  <option key={variant.code} value={variant.code}>{variant.name} · {variant.code}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Target quantity
              <input
                required
                type="number"
                min="1"
                step="1"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block text-sm font-medium">
              Due date
              <input
                required
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Instructions <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Save className="size-4" /> {busy ? "Saving…" : "Save target"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}