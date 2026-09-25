import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Pencil, Plus, Search, Table2, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BomMatrix } from "@/components/erp/BomMatrix";
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
import { addRawMaterial, useRawMaterials, type NewRawMaterial, type RawMaterial } from "@/lib/raw-material-store";

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
  const materials = useRawMaterials();
  const product = products.find((item) => item.code === code);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(product?.variants[0]?.id ?? null);
  const [variantSearch, setVariantSearch] = useState("");
  const [structureView, setStructureView] = useState<"detail" | "matrix">("detail");
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<BomVariant | null>(null);
  const [variantToDelete, setVariantToDelete] = useState<BomVariant | null>(null);
  const [variantNotice, setVariantNotice] = useState("");

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
    setVariantNotice("");
    setShowVariantForm(true);
  }

  function openEditVariant(variant: BomVariant) {
    setEditingVariant(variant);
    setVariantNotice("");
    setShowVariantForm(true);
  }

  function confirmDeleteVariant() {
    if (!variantToDelete) return;
    deleteBomVariant(currentProduct.code, variantToDelete.id);
    setVariantNotice(`${variantToDelete.name} was deleted.`);
    setVariantToDelete(null);
  }

  function saveVariant(input: NewVariant) {
    if (editingVariant) {
      updateBomVariant(currentProduct.code, editingVariant.id, input);
      setSelectedVariantId(editingVariant.id);
      setVariantNotice(`${input.name} was updated.`);
    } else {
      const created = addBomVariant(currentProduct.code, input);
      if (created) setSelectedVariantId(created.id);
      setVariantNotice(`${input.name} was created.`);
    }
    setShowVariantForm(false);
    setEditingVariant(null);
  }

  const content = (
      <div className="grid gap-6 p-6 xl:grid-cols-[300px_1fr]">
        <aside className="panel h-fit overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company BOM variants</p>
                <p className="mt-1 text-sm text-muted-foreground">{product.variants.length} variants</p>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={openCreateVariant}
                  aria-label="Add variant"
                  className="inline-flex size-10 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground"
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
                className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="space-y-2 p-3">
            {filteredVariants.map((variant) => (
              <div
                key={variant.id}
                className={`rounded-md border p-3 transition ${
                  variant.id === selectedVariantId ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/40"
                }`}
              >
                <button type="button" onClick={() => setSelectedVariantId(variant.id)} className="w-full text-left">
                  <p className="tabular text-xs font-medium uppercase text-muted-foreground">{variant.code}</p>
                  <p className="mt-1 text-base font-semibold">{variant.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{variant.company}</p>
                </button>
                {!readOnly ? (
                  <div className="mt-3 flex justify-end gap-2 border-t border-border/70 pt-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditVariant(variant);
                      }}
                      aria-label={`Edit ${variant.name}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Pencil className="size-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setVariantToDelete(variant);
                      }}
                      aria-label={`Delete ${variant.name}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {filteredVariants.length === 0 ? (
              <p className="px-3 py-8 text-center text-base text-muted-foreground">No matching variants.</p>
            ) : null}
          </div>
        </aside>

        <main className="space-y-5">
          {variantNotice ? (
            <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">
              {variantNotice}
            </p>
          ) : null}
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-5">
              <img src={product.image} alt={`${product.name} assembly`} className="size-16 rounded-md border border-border bg-white object-contain p-1" />
              <div className="min-w-0 flex-1">
                 <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{structureView === "matrix" ? "BOM matrix" : "Raw subparts"}</p>
                 <h2 className="mt-1 text-xl font-semibold">{structureView === "matrix" ? `${product.name} variants` : selectedVariant?.name ?? "No variant selected"}</h2>
                <p className="mt-1 text-base text-muted-foreground">
                   {structureView === "matrix"
                     ? "Compare every variant against its required raw materials."
                     : selectedVariant
                       ? `${selectedVariant.company} · ${selectedVariant.code}`
                       : "Create a variant-specific BOM to begin."}
                </p>
              </div>
               <div className="flex flex-wrap items-center gap-3">
                 <div className="flex rounded-md border border-input bg-white p-1" aria-label="Structure view">
                   <button
                     type="button"
                     onClick={() => setStructureView("detail")}
                     aria-pressed={structureView === "detail"}
                      className={`min-h-9 rounded px-3 py-1.5 text-sm font-medium ${structureView === "detail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                   >
                     Detail
                   </button>
                   <button
                     type="button"
                     onClick={() => setStructureView("matrix")}
                     aria-pressed={structureView === "matrix"}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium ${structureView === "matrix" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                   >
                     <Table2 className="size-3.5" /> Matrix
                   </button>
                 </div>
                 {!readOnly ? (
                    <button type="button" onClick={openCreateVariant} className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-base font-medium">
                     <Plus className="size-4" /> Add variant
                   </button>
                 ) : null}
               </div>
            </div>
             {structureView === "matrix" ? (
               <BomMatrix products={[currentProduct]} title={`${product.name} BOM matrix`} />
             ) : selectedVariant ? (
                <PartsTable variant={selectedVariant} materials={materials} />
             ) : readOnly ? (
                <p className="p-12 text-center text-base text-muted-foreground">No variant selected.</p>
             ) : (
               <EmptyVariantState onAdd={openCreateVariant} />
             )}
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
          materials={materials}
          onAddRawPart={(input) => addRawMaterial(input)}
          onClose={() => {
            setShowVariantForm(false);
            setEditingVariant(null);
          }}
          onSave={saveVariant}
        />
      ) : null}
      {variantToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-variant-title">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive">Delete BOM variant</p>
            <h2 id="delete-variant-title" className="mt-2 text-xl font-semibold">Delete {variantToDelete.name}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes the variant and its raw-part quantities from {product.name}. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={() => setVariantToDelete(null)} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">
                Cancel
              </button>
              <button type="button" onClick={confirmDeleteVariant} className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90">
                <Trash2 className="size-4" /> Delete variant
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function PartsTable({ variant, materials }: { variant: BomVariant; materials: RawMaterial[] }) {
  const parts = Object.entries(variant.parts)
    .map(([code, quantity]) => ({ part: materials.find((item) => item.code === code), quantity }))
    .filter((item): item is { part: RawMaterial; quantity: number } => Boolean(item.part));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-base">
        <caption className="sr-only">Raw parts for {variant.name}</caption>
        <thead className="border-b border-border bg-muted/20 text-left text-sm uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-6 py-4 font-medium">Raw subpart</th>
            <th scope="col" className="px-6 py-4 font-medium">Material</th>
            <th scope="col" className="px-6 py-4 font-medium">Source</th>
            <th scope="col" className="px-6 py-4 text-right font-medium">Qty / parent</th>
          </tr>
        </thead>
        <tbody>
          {parts.map(({ part, quantity }) => (
            <tr key={part.code} className="border-b border-border/70 last:border-0">
              <td className="px-6 py-4">
                <p className="font-semibold">{part.name}</p>
                <p className="tabular mt-0.5 text-sm text-muted-foreground">{part.code}</p>
              </td>
              <td className="px-6 py-4 text-muted-foreground">{part.material}</td>
              <td className="px-6 py-4"><Tag tone={part.source === "Molded" ? "info" : "neutral"} size="md">{part.source}</Tag></td>
              <td className="tabular px-6 py-4 text-right font-semibold">×{quantity}</td>
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
      <p className="text-lg font-semibold">No BOM variant selected</p>
      <p className="mt-1 text-base text-muted-foreground">Add a variant and assign its raw parts and quantities.</p>
      <button type="button" onClick={onAdd} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-4 py-2 text-base font-medium hover:bg-muted">
        <Plus className="size-4" /> Create variant
      </button>
    </div>
  );
}

function VariantForm({
  productName,
  initial,
  editing,
  materials,
  onAddRawPart,
  onClose,
  onSave,
}: {
  productName: string;
  initial: NewVariant;
  editing: boolean;
  materials: RawMaterial[];
  onAddRawPart: (input: NewRawMaterial) => RawMaterial | undefined;
  onClose: () => void;
  onSave: (value: NewVariant) => void;
}) {
  const [form, setForm] = useState<NewVariant>({ ...initial, parts: { ...initial.parts } });
  const [partSearch, setPartSearch] = useState("");
  const [error, setError] = useState("");
  const [showRawPartCreator, setShowRawPartCreator] = useState(false);
  const filteredParts = materials.filter((part) => {
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
          <label className="block text-base font-medium">
            Company
            <input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Eureka Forbes" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary" />
          </label>
          <label className="block text-base font-medium">
            Variant name
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Eureka Pro" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary" />
          </label>
          <label className="block text-base font-medium">
            Variant code
            <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="FL-NEW" className="tabular mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary" />
          </label>
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-base font-medium">Raw parts and quantities <span className="text-destructive">*</span></p>
                <p className="mt-1 text-sm text-muted-foreground">Select components and set how many are used per parent.</p>
              </div>
              <span className="text-sm text-muted-foreground">{Object.keys(form.parts).length} selected</span>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input value={partSearch} onChange={(event) => setPartSearch(event.target.value)} placeholder="Search raw parts" aria-label="Search raw parts" className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base outline-none focus:border-primary" />
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowRawPartCreator(true);
              }}
              className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-md border border-dashed border-primary/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <Plus className="size-3.5" /> Add a raw part not listed
            </button>
            <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-border">
              {filteredParts.map((part) => {
                const selected = Object.prototype.hasOwnProperty.call(form.parts, part.code);
                return (
                  <div key={part.code} className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0">
                    <input type="checkbox" checked={selected} onChange={() => togglePart(part.code)} className="size-4 accent-[var(--color-primary)]" />
                    <button type="button" onClick={() => togglePart(part.code)} className="min-w-0 flex-1 text-left">
                      <p className="text-base font-medium">{part.name}</p>
                      <p className="tabular mt-0.5 text-sm text-muted-foreground">{part.code} · {part.material}</p>
                    </button>
                    {selected ? (
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        Qty
                        <input type="number" min={1} step={1} value={form.parts[part.code]} onChange={(event) => updateQuantity(part.code, event.target.value)} aria-label={`Quantity for ${part.name}`} className="h-10 w-20 rounded border border-input bg-background px-2 text-right text-base text-foreground outline-none focus:border-primary" />
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
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-md border border-input px-4 py-2 text-base font-medium hover:bg-muted">Cancel</button>
          <button type="submit" className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-base font-medium">
            <Check className="size-4" /> {editing ? "Save variant" : "Create variant"}
          </button>
        </div>
      </form>
      {showRawPartCreator ? (
        <RawPartCreator
          onClose={() => setShowRawPartCreator(false)}
          onSave={(input) => {
            const created = onAddRawPart(input);
            if (!created) return "A raw part with that code already exists.";
            setForm((current) => ({
              ...current,
              parts: { ...current.parts, [created.code]: current.parts[created.code] ?? 1 },
            }));
            setPartSearch("");
            setShowRawPartCreator(false);
            setError("");
            return undefined;
          }}
        />
      ) : null}
    </div>
  );
}

function RawPartCreator({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: NewRawMaterial) => string | undefined;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [source, setSource] = useState<NewRawMaterial["source"]>("Other");
  const [error, setError] = useState("");

  function save() {
    const input: NewRawMaterial = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      material: material.trim(),
      source,
    };
    if (input.code.length < 2 || input.name.length < 2 || input.description.length < 5 || input.material.length < 2) {
      setError("Enter a code, name, description, and material.");
      return;
    }
    const message = onSave(input);
    if (message) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="raw-part-creator-title">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Raw material catalog</p>
            <h2 id="raw-part-creator-title" className="mt-2 text-xl font-semibold">Add raw part</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create the missing component and add it to this variant.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close add raw part" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-6 space-y-3">
          <label className="block text-base font-medium">Raw-part code<input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="GP006-050" className="tabular mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary" /></label>
          <label className="block text-base font-medium">Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Float bracket" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary" /></label>
          <label className="block text-base font-medium">Material<input required value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Nylon 66" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary" /></label>
          <label className="block text-base font-medium">Description<textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the raw part" rows={3} className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary" /></label>
          <label className="block text-base font-medium">Source<select value={source} onChange={(event) => setSource(event.target.value as NewRawMaterial["source"])} className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary"><option value="Molded">Molded</option><option value="Purchased">Purchased</option><option value="Other">Other</option></select></label>
          {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-md border border-input px-4 py-2 text-base font-medium hover:bg-muted">Cancel</button>
          <button type="button" onClick={save} className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-base font-medium"><Plus className="size-4" /> Add and select</button>
        </div>
      </div>
    </div>
  );
}