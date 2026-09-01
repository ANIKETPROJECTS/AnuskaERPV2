import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Panel, Tag } from "@/components/erp/bits";
import {
  addBomVariant,
  deleteBomVariant,
  updateBomVariant,
  useBomProducts,
  type BomVariant,
  type NewVariant,
} from "@/lib/bom-store";
import { subparts } from "@/lib/erp-data";

export const Route = createFileRoute("/bom/$code")({
  head: () => ({
    meta: [
      { title: "BOM Structure — Float ERP" },
      { name: "description", content: "Manage product variants and raw-part quantities in a Float bill of materials." },
    ],
  }),
  component: BomStructure,
});

const emptyVariant: NewVariant = { company: "", name: "", code: "", parts: {} };

function BomStructure() {
  const { code } = Route.useParams();
  return <BomStructurePage code={code} readOnly={false} />;
}

export function BomStructurePage({ code, readOnly }: { code: string; readOnly: boolean }) {
  const products = useBomProducts();
  const product = products.find((item) => item.code === code);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(product?.variants[0]?.id ?? null);
  const [variantSearch, setVariantSearch] = useState("");
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<BomVariant | null>(null);

  useEffect(() => {
    if (!product) return;
    if (!product.variants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(product.variants[0]?.id ?? null);
    }
  }, [product, selectedVariantId]);

  const filteredVariants = useMemo(() => {
    const query = variantSearch.trim().toLowerCase();
    return product?.variants.filter((variant) => {
      if (!query) return true;
      return [variant.name, variant.company, variant.code].some((value) => value.toLowerCase().includes(query));
    }) ?? [];
  }, [product, variantSearch]);
  const selectedVariant = product?.variants.find((variant) => variant.id === selectedVariantId) ?? null;

  if (!product) {
    const notFound = (
        <Panel title="Nothing here">
          <div className="p-5 text-sm">
            <Link to="/bom" className="text-primary underline">Back to Bill of Materials</Link>
          </div>
        </Panel>
    );
    return readOnly ? (
      <SubHubShell title="BOM product not found" subtitle="No such parent assembly">{notFound}</SubHubShell>
    ) : (
      <Shell title="BOM product not found" subtitle="No such parent assembly">{notFound}</Shell>
    );
  }
  const currentProduct = product;

  function openCreateVariant() {
    setEditingVariant(null);
    setShowVariantForm(true);
  }

  function openEditVariant(variant: BomVariant) {
    setEditingVariant(variant);
    setShowVariantForm(true);
  }

  function removeVariant(variant: BomVariant) {
    if (!window.confirm(`Delete ${variant.name}? Its raw-part quantities will be removed from this product.`)) return;
    deleteBomVariant(currentProduct.code, variant.id);
  }

  function saveVariant(input: NewVariant) {
    if (editingVariant) {
      updateBomVariant(currentProduct.code, editingVariant.id, input);
      setSelectedVariantId(editingVariant.id);
    } else {
      const created = addBomVariant(currentProduct.code, input);
      if (created) setSelectedVariantId(created.id);
    }
    setShowVariantForm(false);
    setEditingVariant(null);
  }

  const content = (
      <div className="grid gap-5 p-6 xl:grid-cols-[270px_1fr]">
        <aside className="panel h-fit overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company BOM variants</p>
                <p className="mt-1 text-xs text-muted-foreground">{product.variants.length} variants</p>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={openCreateVariant}
                  aria-label="Add variant"
                  className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                value={variantSearch}
                onChange={(event) => setVariantSearch(event.target.value)}
                placeholder="Search variants"
                aria-label="Search variants"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="space-y-2 p-2">
            {filteredVariants.map((variant) => (
              <div
                key={variant.id}
                className={`rounded-md border p-3 transition ${
                  variant.id === selectedVariantId ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/40"
                }`}
              >
                <button type="button" onClick={() => setSelectedVariantId(variant.id)} className="w-full text-left">
                  <p className="tabular text-[10px] font-medium uppercase text-muted-foreground">{variant.code}</p>
                  <p className="mt-1 text-sm font-semibold">{variant.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{variant.company}</p>
                </button>
                {!readOnly ? (
                  <div className="mt-2 flex justify-end gap-1">
                    <button type="button" onClick={() => openEditVariant(variant)} aria-label={`Edit ${variant.name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => removeVariant(variant)} aria-label={`Delete ${variant.name}`} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {filteredVariants.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching variants.</p>
            ) : null}
          </div>
        </aside>

        <main className="space-y-5">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4">
              <img src={product.image} alt={`${product.name} assembly`} className="size-16 rounded-md border border-border bg-white object-contain p-1" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raw subparts</p>
                <h2 className="mt-1 text-lg font-semibold">{selectedVariant?.name ?? "No variant selected"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedVariant ? `${selectedVariant.company} · ${selectedVariant.code}` : "Create a variant-specific BOM to begin."}
                </p>
              </div>
              {!readOnly ? (
                <button type="button" onClick={openCreateVariant} className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
                  <Plus className="size-4" /> Add variant
                </button>
              ) : null}
            </div>
            {selectedVariant ? <PartsTable variant={selectedVariant} /> : readOnly ? <p className="p-12 text-center text-sm text-muted-foreground">No variant selected.</p> : <EmptyVariantState onAdd={openCreateVariant} />}
          </div>
        </main>
      </div>
  );

  const backLink = readOnly ? (
    <Link to="/subhub/bom" className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
      <ArrowLeft className="size-4" /> Bill of Materials
    </Link>
  ) : (
    <Link to="/bom" className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
      <ArrowLeft className="size-4" /> Bill of Materials
    </Link>
  );

  if (readOnly) {
    return (
      <SubHubShell
        title={`${product.name} structure`}
        subtitle={`${product.code} · ${product.variants.length} product variants · ${new Set(product.variants.flatMap((variant) => Object.keys(variant.parts))).size} raw parts`}
        actions={backLink}
      >
        {content}
      </SubHubShell>
    );
  }

  return (
    <Shell
      title={`${product.name} structure`}
      subtitle={`${product.code} · ${product.variants.length} product variants · ${new Set(product.variants.flatMap((variant) => Object.keys(variant.parts))).size} raw parts`}
      actions={backLink}
    >
      {content}
      {showVariantForm ? (
        <VariantForm
          productName={product.name}
          initial={editingVariant ?? emptyVariant}
          editing={Boolean(editingVariant)}
          onClose={() => {
            setShowVariantForm(false);
            setEditingVariant(null);
          }}
          onSave={saveVariant}
        />
      ) : null}
    </Shell>
  );
}

function PartsTable({ variant }: { variant: BomVariant }) {
  const parts = Object.entries(variant.parts)
    .map(([code, quantity]) => ({ part: subparts.find((item) => item.code === code), quantity }))
    .filter((item): item is { part: (typeof subparts)[number]; quantity: number } => Boolean(item.part));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[580px] text-sm">
        <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-medium">Raw subpart</th>
            <th className="px-5 py-3 font-medium">Material</th>
            <th className="px-5 py-3 font-medium">Source</th>
            <th className="px-5 py-3 text-right font-medium">Qty / parent</th>
          </tr>
        </thead>
        <tbody>
          {parts.map(({ part, quantity }) => (
            <tr key={part.code} className="border-b border-border/70 last:border-0">
              <td className="px-5 py-3">
                <p className="font-medium">{part.name}</p>
                <p className="tabular text-xs text-muted-foreground">{part.code}</p>
              </td>
              <td className="px-5 py-3 text-muted-foreground">{part.material}</td>
              <td className="px-5 py-3"><Tag tone={part.source === "Molded" ? "info" : "neutral"}>{part.source}</Tag></td>
              <td className="tabular px-5 py-3 text-right font-semibold">×{quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyVariantState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="p-12 text-center">
      <p className="font-medium">No BOM variant selected</p>
      <p className="mt-1 text-sm text-muted-foreground">Add a variant and assign its raw parts and quantities.</p>
      <button type="button" onClick={onAdd} className="mt-4 inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
        <Plus className="size-4" /> Create variant
      </button>
    </div>
  );
}

function VariantForm({
  productName,
  initial,
  editing,
  onClose,
  onSave,
}: {
  productName: string;
  initial: NewVariant;
  editing: boolean;
  onClose: () => void;
  onSave: (value: NewVariant) => void;
}) {
  const [form, setForm] = useState<NewVariant>({ ...initial, parts: { ...initial.parts } });
  const [partSearch, setPartSearch] = useState("");
  const [error, setError] = useState("");
  const filteredParts = subparts.filter((part) => {
    const query = partSearch.trim().toLowerCase();
    return !query || [part.name, part.code, part.material].some((value) => value.toLowerCase().includes(query));
  });

  function togglePart(code: string) {
    setForm((current) => {
      const parts = { ...current.parts };
      if (parts[code]) delete parts[code];
      else parts[code] = 1;
      return { ...current, parts };
    });
  }

  function updateQuantity(code: string, value: string) {
    const quantity = Number(value);
    setForm((current) => ({ ...current, parts: { ...current.parts, [code]: Number.isFinite(quantity) ? quantity : 0 } }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const company = form.company.trim();
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    const quantities = Object.values(form.parts);
    if (company.length < 2 || name.length < 2 || code.length < 2) {
      setError("Enter a company, variant name, and variant code.");
      return;
    }
    if (!quantities.length || quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1)) {
      setError("Select at least one raw part and enter whole-number quantities of 1 or more.");
      return;
    }
    onSave({ company, name, code, parts: form.parts });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-labelledby="variant-form-title">
      <form onSubmit={submit} className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">BOM variant</p>
            <h2 id="variant-form-title" className="mt-2 text-xl font-semibold">{editing ? "Edit variant" : "Create variant"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add a company-specific BOM variant for {productName}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Company
            <input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Eureka Forbes" className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block text-sm font-medium">
            Variant name
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Eureka Pro" className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block text-sm font-medium">
            Variant code
            <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="FL-NEW" className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Raw parts and quantities <span className="text-destructive">*</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Select components and set how many are used per parent.</p>
              </div>
              <span className="text-xs text-muted-foreground">{Object.keys(form.parts).length} selected</span>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input value={partSearch} onChange={(event) => setPartSearch(event.target.value)} placeholder="Search raw parts" aria-label="Search raw parts" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
              {filteredParts.map((part) => {
                const selected = Object.prototype.hasOwnProperty.call(form.parts, part.code);
                return (
                  <div key={part.code} className="flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-0">
                    <input type="checkbox" checked={selected} onChange={() => togglePart(part.code)} className="size-4 accent-[var(--color-primary)]" />
                    <button type="button" onClick={() => togglePart(part.code)} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium">{part.name}</p>
                      <p className="tabular text-xs text-muted-foreground">{part.code} · {part.material}</p>
                    </button>
                    {selected ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Qty
                        <input type="number" min={1} step={1} value={form.parts[part.code]} onChange={(event) => updateQuantity(part.code, event.target.value)} aria-label={`Quantity for ${part.name}`} className="h-8 w-16 rounded border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:border-primary" />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-auto flex justify-end gap-3 border-t border-border pt-5">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button type="submit" className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium">
            <Check className="size-4" /> {editing ? "Save variant" : "Create variant"}
          </button>
        </div>
      </form>
    </div>
  );
}