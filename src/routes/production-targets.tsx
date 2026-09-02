import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarRange, Check, ClipboardList, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { Panel } from "@/components/erp/bits";
import { bomCatalog, type BomCatalogProduct } from "@/lib/bom-catalog";
import { createProductionOrdersFn, listAssignableSubhubsFn } from "@/production";
import type { AssignableSubhub } from "@/production.server";

export const Route = createFileRoute("/production-targets")({
  head: () => ({
    meta: [
      { title: "Assign Production Targets — Float ERP" },
      { name: "description", content: "Assign the same production target to one or more active SubHubs." },
    ],
  }),
  component: ProductionTargets,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ProductionTargets() {
  const [subhubs, setSubhubs] = useState<AssignableSubhub[]>([]);
  const [selectedSubhubIds, setSelectedSubhubIds] = useState<string[]>([]);
  const [productCode, setProductCode] = useState(bomCatalog[0]?.code ?? "");
  const [variantCode, setVariantCode] = useState(bomCatalog[0]?.variants[0]?.code ?? "");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void (async () => {
      const result = await listAssignableSubhubsFn();
      if (result.ok) setSubhubs(result.subhubs);
      else setError(result.message);
      setLoading(false);
    })();
  }, []);

  const selectedProduct = bomCatalog.find((product) => product.code === productCode);

  function toggleSubhub(id: string) {
    setSelectedSubhubIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  }

  function selectAllSubhubs() {
    setSelectedSubhubIds((current) => current.length === subhubs.length ? [] : subhubs.map((subhub) => subhub.id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const parsedTarget = Number(target);
    if (!selectedSubhubIds.length) {
      setError("Select at least one SubHub before assigning a target.");
      return;
    }
    if (!Number.isInteger(parsedTarget) || parsedTarget < 1) {
      setError("Enter a whole-number target greater than zero.");
      return;
    }
    if (!selectedProduct || !selectedProduct.variants.some((variant) => variant.code === variantCode)) {
      setError("Select a valid Float type and variant before assigning the target.");
      return;
    }

    setSaving(true);
    const result = await createProductionOrdersFn({
      data: {
        subhubUserIds: selectedSubhubIds,
        productCode,
        variantCode,
        target: parsedTarget,
        dueDate,
        notes,
      },
    });
    if (result.ok) {
      setSuccess(`${result.orders.length} production target${result.orders.length === 1 ? "" : "s"} assigned successfully.`);
      setSelectedSubhubIds([]);
      setTarget("");
      setNotes("");
    } else {
      setError(result.message);
    }
    setSaving(false);
  }

  return (
    <Shell
      title="Assign Production Targets"
      subtitle="Create one production order for each selected SubHub"
      actions={
        <Link to="/orders" className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {success ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{success} <Link to="/orders" className="ml-1 font-medium underline">View assigned orders</Link></p> : null}

        <Panel
          title="1. Choose SubHubs"
          description="Select one or more active SubHub Managers. The target quantity below will be created for every selected SubHub."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <p className="text-sm text-muted-foreground">
              {selectedSubhubIds.length} of {subhubs.length} SubHub{subhubs.length === 1 ? "" : "s"} selected
            </p>
            <button type="button" onClick={selectAllSubhubs} disabled={loading || !subhubs.length} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
              {selectedSubhubIds.length === subhubs.length && subhubs.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Loading active SubHubs…</p> : null}
            {!loading && !subhubs.length ? <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Create an active SubHub Manager before assigning production targets.</p> : null}
            {subhubs.map((subhub) => {
              const selected = selectedSubhubIds.includes(subhub.id);
              return (
                <label key={subhub.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${selected ? "border-primary bg-primary/10" : "border-input hover:border-primary/50 hover:bg-muted/40"}`}>
                  <input type="checkbox" checked={selected} onChange={() => toggleSubhub(subhub.id)} className="mt-0.5 size-4 accent-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{subhub.subhubName}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{subhub.name}</span>
                  </span>
                  {selected ? <Check className="ml-auto size-4 shrink-0 text-primary" /> : null}
                </label>
              );
            })}
          </div>
        </Panel>

        <Panel title="2. Choose the Float variant" description="Every selected SubHub will receive this same product variant and target quantity.">
          <div className="space-y-5 p-5">
            <FloatTypePicker productCode={productCode} onChange={(nextProductCode) => {
              const nextProduct = bomCatalog.find((product) => product.code === nextProductCode);
              setProductCode(nextProductCode);
              setVariantCode(nextProduct?.variants[0]?.code ?? "");
            }} />
            {selectedProduct ? <FloatVariantPicker product={selectedProduct} variantCode={variantCode} onChange={setVariantCode} /> : null}
          </div>
        </Panel>

        <Panel title="3. Set the target details" description="These details are copied to each production order created by this batch assignment.">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Target quantity
              <input required type="number" min="1" step="1" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="1000" className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium">
              Due date
              <span className="relative mt-1.5 block">
                <CalendarRange className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="tabular h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
              </span>
            </label>
            <label className="block text-sm font-medium sm:col-span-2">
              Instructions <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add shift or delivery instructions…" className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
            <p className="text-xs text-muted-foreground">
              {selectedSubhubIds.length ? `${selectedSubhubIds.length} order${selectedSubhubIds.length === 1 ? "" : "s"} will be created.` : "Select SubHubs to continue."}
            </p>
            <button type="submit" disabled={saving || loading || !subhubs.length} className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
              <ClipboardList className="size-4" /> {saving ? "Assigning…" : "Assign targets"}
            </button>
          </div>
        </Panel>
      </form>
    </Shell>
  );
}

function FloatTypePicker({ productCode, onChange }: { productCode: string; onChange: (code: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Float type</span>
        <span className="text-xs text-muted-foreground">{bomCatalog.length} types</span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {bomCatalog.map((product) => {
          const selected = product.code === productCode;
          return (
            <button key={product.code} type="button" onClick={() => onChange(product.code)} aria-pressed={selected} className={`rounded-md border px-3 py-3 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-input hover:border-primary/50 hover:bg-muted/50"}`}>
              <span className="block text-sm font-semibold">{product.name}</span>
              <span className="tabular mt-1 block text-xs text-muted-foreground">{product.code} · {product.variants.length} variants</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FloatVariantPicker({ product, variantCode, onChange }: { product: BomCatalogProduct; variantCode: string; onChange: (code: string) => void }) {
  const [query, setQuery] = useState("");
  const filteredVariants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return product.variants;
    return product.variants.filter((variant) => `${variant.name} ${variant.company} ${variant.code}`.toLowerCase().includes(normalizedQuery));
  }, [product, query]);
  const selectedVariant = product.variants.find((variant) => variant.code === variantCode);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="production-target-variant-search" className="block text-sm font-medium">Variant for {product.name}</label>
        <span className="text-xs text-muted-foreground">{filteredVariants.length} of {product.variants.length} variants</span>
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border border-input bg-background">
        <div className="relative border-b border-border bg-muted/20">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="production-target-variant-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${product.name} variants, companies, or codes…`} className="h-11 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <div role="listbox" aria-label="Float variants" className="grid max-h-72 gap-1 overflow-y-auto p-2 sm:grid-cols-2">
          {filteredVariants.map((variant) => {
            const selected = variant.code === variantCode;
            return (
              <button key={`${product.code}-${variant.code}`} type="button" role="option" aria-selected={selected} onClick={() => onChange(variant.code)} className={`flex min-h-16 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/60"}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{variant.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{variant.company} · {variant.code}</span>
                </span>
                {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
          {!filteredVariants.length ? <p className="col-span-full px-3 py-8 text-center text-sm text-muted-foreground">No {product.name} variants match “{query}”.</p> : null}
        </div>
      </div>
      {selectedVariant ? <p className="mt-2 text-xs text-muted-foreground">Selected: <span className="font-medium text-foreground">{selectedVariant.name}</span> · {selectedVariant.code}</p> : null}
    </div>
  );
}