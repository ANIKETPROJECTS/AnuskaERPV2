import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { createProcurementItemRequestFn, getSubhubItemRequestHistoryFn } from "@/procurement";
import type { ProcurementItemRequest } from "@/procurement.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/subhub/request-items")({
  loader: () => getSubhubItemRequestHistoryFn(),
  head: () => ({ meta: [{ title: "Request items — SubHub" }] }),
  component: RequestItemsRoute,
});

const commonItems = [
  "Pair of scissors",
  "Packing tape",
  "Measuring tape",
  "Utility knife",
  "Permanent marker",
  "Work gloves",
];

function RequestItemsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.replace(/\/+$/, "") === "/subhub/request-items" ? (
    <RequestItemsPage />
  ) : (
    <Outlet />
  );
}

function RequestItemsPage() {
  const result = Route.useLoaderData();
  const router = useRouter();
  const [requests, setRequests] = useState<ProcurementItemRequest[]>(() =>
    result.ok ? result.requests : [],
  );
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(result.ok ? "" : result.message);
  const [notice, setNotice] = useState("");
  const sortedRequests = useMemo(
    () => [...requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [requests],
  );
  const pendingCount = sortedRequests.filter((request) => request.status === "Pending").length;
  const resolvedCount = sortedRequests.length - pendingCount;

  useEffect(() => {
    if (result.ok) {
      setRequests(result.requests);
      setError("");
    } else {
      setError(result.message);
    }
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await createProcurementItemRequestFn({
        data: { itemName: itemName.trim(), quantity: Number(quantity), notes: notes.trim() },
      });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setRequests((current) => [response.request, ...current]);
      setItemName("");
      setQuantity("1");
      setNotes("");
      setNotice("Your request was sent to Procurement Management.");
      try {
        await router.invalidate();
      } catch {
        setNotice("Your request was sent. Refresh the history page to see the latest records.");
      }
    } catch {
      setError("Your request could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function adjustQuantity(amount: number) {
    const current = Number(quantity) || 1;
    setQuantity(String(Math.max(1, Math.floor(current) + amount)));
  }

  return (
    <SubHubShell
      headerTitle="Request items"
      actions={
        <Link
          to="/subhub/request-items/history"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-white px-4 text-base font-semibold hover:bg-muted"
        >
          View request history <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      }
    >
      <section className="space-y-4 px-6 pb-6">
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-success/25 bg-success/5 px-4 py-3 text-base text-success"
          >
            <Check className="size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        ) : null}

        <section className="min-w-0">
          <header className="border-b border-border py-4">
            <h2 className="text-lg font-semibold">Request an item</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Choose a suggested item or enter another one. Procurement Management will review it.
            </p>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border py-3">
            <h3 className="text-base font-semibold">My item requests</h3>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-base">
              <span>
                <strong className="tabular">{num(sortedRequests.length)}</strong> submitted
              </span>
              <span className="text-warning">
                <strong className="tabular">{num(pendingCount)}</strong> awaiting review
              </span>
              <span className="text-success">
                <strong className="tabular">{num(resolvedCount)}</strong> resolved
              </span>
            </div>
          </div>

          <form
            id="subhub-item-request-form"
            onSubmit={(event) => void submit(event)}
            className="space-y-5 py-5"
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="block text-base font-medium">
                Item
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  list="common-request-items"
                  value={itemName}
                  disabled={busy}
                  onChange={(event) => setItemName(event.target.value)}
                  placeholder="e.g. pair of scissors or packing tape"
                  className="mt-1.5 h-12 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary"
                />
                <datalist id="common-request-items">
                  {commonItems.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>

              <div>
                <label htmlFor="request-item-quantity" className="block text-base font-medium">
                  Quantity
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={busy || Number(quantity) <= 1}
                    onClick={() => adjustQuantity(-1)}
                    className="flex size-12 shrink-0 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Minus className="size-5" />
                  </button>
                  <input
                    id="request-item-quantity"
                    required
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={quantity}
                    disabled={busy}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="tabular h-12 w-28 rounded-md border border-input bg-background px-2 text-center text-lg font-semibold outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={busy}
                    onClick={() => adjustQuantity(1)}
                    className="flex size-12 shrink-0 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
              </div>
            </div>

            <label className="block text-base font-medium">
              Details <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea
                maxLength={500}
                rows={3}
                value={notes}
                disabled={busy}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Purpose, preferred size, or when it is needed…"
                className="mt-1.5 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary"
              />
            </label>

            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="submit"
                form="subhub-item-request-form"
                disabled={busy}
                className="inline-flex min-h-12 items-center rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send item request"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </SubHubShell>
  );
}
