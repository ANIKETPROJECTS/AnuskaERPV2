import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ImagePlus, LayoutGrid, List, Pencil, Plus, Search, Table2, Trash2, Upload, X } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { BomMatrix } from "@/components/erp/BomMatrix";
import { useAuth } from "@/components/auth/AuthContext";
import {
  useBomProducts,
  addBomProduct,
  deleteBomProduct,
  updateBomProduct,
  rawPartCount,
  type BomProduct,
  type BomVariant,
  type NewProduct,
} from "@/lib/bom-store";
import { useRawMaterials, type RawMaterial } from "@/lib/raw-material-store";

export const Route = createFileRoute("/bom")({
  head: () => ({
    meta: [
      { title: "Bill of Materials — Float ERP" },
      {
        name: "description",
        content: "Component master and per-SKU bill of materials for every Float model, with material cost and source.",
      },
      { property: "og:title", content: "Bill of Materials — Float ERP" },
      { property: "og:description", content: "Subpart master, BOM matrix and costing for the Float product line." },
    ],
  }),
  component: Bom,
});

const emptyProduct: NewProduct = { name: "", code: "", description: "", image: "" };
type BomView = "grid" | "list" | "matrix";

function requiredMaterialsForVariant(variant: BomVariant, materials: RawMaterial[]) {
  return Object.entries(variant.parts).map(([code, quantity]) => {
    const part = materials.find((item) => item.code === code);
    return {
      code,
      name: part?.name ?? code,
      material: part?.material ?? "Material details unavailable",
      quantity,
      weight: part?.weight,
      source: part?.source,
    };
  });
}

function BomViewSwitcher({
  view,
  onChange,
  large = false,
}: {
  view: BomView;
  onChange: (view: BomView) => void;
  large?: boolean;
}) {
  const buttonSize = large
    ? "inline-flex min-h-11 items-center gap-2 rounded px-4 py-2 text-base font-medium"
    : "inline-flex min-h-9 items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium";

  return (
    <div className="flex rounded-md border border-input bg-white p-1" role="group" aria-label="BOM layout">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={view === "grid"}
        className={`${buttonSize} ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        <LayoutGrid className={large ? "size-4" : "size-3.5"} /> Grid
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        className={`${buttonSize} ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        <List className={large ? "size-4" : "size-3.5"} /> List
      </button>
      <button
        type="button"
        onClick={() => onChange("matrix")}
        aria-pressed={view === "matrix"}
        className={`${buttonSize} ${view === "matrix" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        <Table2 className={large ? "size-4" : "size-3.5"} /> Matrix
      </button>
    </div>
  );
}

function Bom() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();

  if (pathname !== "/bom") {
    return <Outlet />;
  }
  return <BomPage readOnly={user?.panel === "subhub"} />;
}

export function BomPage({ readOnly }: { readOnly: boolean }) {
  const products = useBomProducts();
  const materials = useRawMaterials();
  const [productSearch, setProductSearch] = useState("");
  const [view, setView] = useState<BomView>("grid");
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BomProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<BomProduct | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [productError, setProductError] = useState("");
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) =>
      !query ||
      [product.code, product.name, product.description, ...product.variants.flatMap((variant) => [variant.code, variant.name, variant.company])]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [productSearch, products]);

  function toggleProduct(productCode: string) {
    setExpandedProducts((current) => ({ ...current, [productCode]: !current[productCode] }));
  }

  function openProductForm() {
    setEditingProduct(null);
    setProductForm(emptyProduct);
    setProductError("");
    setShowProductForm(true);
  }

  function openEditProduct(product: BomProduct) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      code: product.code,
      description: product.description,
      image: product.image,
    });
    setProductError("");
    setShowProductForm(true);
  }

  function closeProductForm() {
    setShowProductForm(false);
    setEditingProduct(null);
    setProductError("");
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProductError("Choose an image file for the product.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProductForm((current) => ({ ...current, image: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = productForm.name.trim();
    const code = productForm.code.trim().toUpperCase();
    const description = productForm.description.trim();
    if (!productForm.image) {
      setProductError("Add a product image before saving.");
      return;
    }
    if (name.length < 2 || code.length < 2 || description.length < 5) {
      setProductError("Enter a product name, code, and description.");
      return;
    }
    if (products.some((product) => product.code.toLowerCase() === code.toLowerCase() && product.code !== editingProduct?.code)) {
      setProductError("That product code is already in use.");
      return;
    }
    const input = { name, code, description, image: productForm.image };
    if (editingProduct) {
      updateBomProduct(editingProduct.code, input);
    } else {
      addBomProduct(input);
    }
    closeProductForm();
  }

  const content = (
    <section className="space-y-5 px-6 py-5">
      <div className="flex flex-wrap items-end gap-4 border-b border-border pb-4">
        <label className="min-w-[240px] flex-1 text-base font-medium text-muted-foreground">
          Search
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Search BOM products"
              aria-label="Search BOM products"
              className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-base font-normal text-foreground outline-none focus:border-primary"
            />
          </span>
        </label>
        <BomViewSwitcher view={view} onChange={setView} large />
      </div>
        {view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <article key={product.code} className="panel overflow-hidden">
                <div className="flex h-36 items-center justify-center bg-white p-3">
                  <img src={product.image} alt={`${product.name} component assembly`} className="h-full w-full object-contain" />
                </div>
                <div className="p-4">
                  <p className="tabular text-base font-medium uppercase tracking-wide text-muted-foreground">{product.code}</p>
                  <h2 className="mt-1 text-xl font-semibold">{product.name}</h2>
                  <div className="mt-4 grid grid-cols-2 border-t border-border pt-3 text-base">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Variants</p>
                      <p className="mt-1 text-lg font-semibold">{product.variants.length}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Raw parts</p>
                      <p className="mt-1 text-lg font-semibold">{rawPartCount(product)}</p>
                    </div>
                  </div>
                  {!readOnly ? (
                    <ProductAdminActions
                      product={product}
                      onEdit={openEditProduct}
                      onDelete={setProductToDelete}
                    />
                  ) : null}
                  {readOnly ? (
                    <Link to="/subhub/bom/$code" params={{ code: product.code }} className="mt-4 inline-flex items-center gap-2 text-base font-semibold text-primary hover:underline">
                      Open structure <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <Link to="/bom/$code" params={{ code: product.code }} className="mt-4 inline-flex items-center gap-2 text-base font-semibold text-primary hover:underline">
                      Open structure <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : view === "list" ? (
          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const expanded = Boolean(expandedProducts[product.code]);

              return (
                <article key={product.code} className="panel overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <button type="button" onClick={() => toggleProduct(product.code)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="tabular block text-base font-medium uppercase tracking-wide text-muted-foreground">{product.code}</span>
                        <span className="mt-1 block text-lg font-semibold">{product.name}</span>
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-4 text-base">
                      <span><span className="text-muted-foreground">Variants</span> <strong className="ml-1">{product.variants.length}</strong></span>
                      <span><span className="text-muted-foreground">Raw parts</span> <strong className="ml-1">{rawPartCount(product)}</strong></span>
                      <span className="font-medium text-primary">{expanded ? "Hide variants" : "View variants"}</span>
                      {readOnly ? (
                        <Link to="/subhub/bom/$code" params={{ code: product.code }} className="font-semibold text-primary hover:underline">Open structure →</Link>
                      ) : (
                        <Link to="/bom/$code" params={{ code: product.code }} className="font-semibold text-primary hover:underline">Open structure →</Link>
                      )}
                    </div>
                  </div>
                  {!readOnly ? (
                    <div className="px-4 pb-4">
                      <ProductAdminActions
                        product={product}
                        onEdit={openEditProduct}
                        onDelete={setProductToDelete}
                      />
                    </div>
                  ) : null}
                  {expanded ? (
                    <div className="border-t border-border bg-muted/10 px-4 py-4 sm:px-6">
                      <div className="space-y-3 border-l-2 border-primary/20 pl-4">
                        <p className="text-base font-semibold uppercase tracking-[0.1em] text-muted-foreground">Variants and required materials</p>
                        {!product.variants.length ? (
                          <p className="rounded-md border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">No variants have been added to this assembly.</p>
                        ) : (
                          product.variants.map((variant) => {
                             const requiredMaterials = requiredMaterialsForVariant(variant, materials);
                            return (
                              <details key={variant.id} className="group rounded-lg border border-border bg-card">
                                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                    <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="tabular block text-sm font-medium uppercase tracking-wide text-muted-foreground">{variant.code}</span>
                                    <span className="mt-1 block text-base font-semibold">{variant.name}</span>
                                    <span className="mt-1 block text-base text-muted-foreground">{variant.company}</span>
                                  </span>
                                  <span className="rounded-full bg-primary/10 px-3 py-1.5 text-base font-medium text-primary">{requiredMaterials.length} required materials</span>
                                </summary>
                                <div className="mb-4 ml-4 border-l-2 border-border pl-4">
                                  <p className="text-base font-medium text-muted-foreground">Required materials</p>
                                  {requiredMaterials.length ? (
                                    <div className="mt-2 space-y-2">
                                      {requiredMaterials.map((material) => (
                                        <div key={material.code} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3 text-base">
                                          <div className="min-w-0">
                                            <p className="font-semibold">{material.name}</p>
                                            <p className="tabular mt-0.5 text-base text-muted-foreground">{material.code} · {material.material}</p>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                                            <span>Qty <strong className="text-foreground">{material.quantity}</strong></span>
                                            <span>{material.source ?? "—"}</span>
                                            <span>{material.weight !== undefined ? `${material.weight} kg` : "—"}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-base text-muted-foreground">No required materials are defined for this variant.</p>
                                  )}
                                </div>
                              </details>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <BomMatrix
            products={filteredProducts}
            title="All Float types BOM matrix"
            description="Compare every matching Float type and variant against its required raw materials."
            largeText
          />
        )}
        {!filteredProducts.length ? (
          <p className="rounded-md border border-dashed border-border px-5 py-12 text-center text-base text-muted-foreground">
            No BOM products match your search.
          </p>
        ) : null}
      </section>
  );

  if (readOnly) {
    return <SubHubShell headerTitle="Bills of Materials">{content}</SubHubShell>;
  }

  return (
    <Shell
      title="Bills of Materials"
      mainClassName="flex-1 space-y-0 p-0"
      actions={
        <button
          type="button"
          onClick={openProductForm}
          className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-base font-medium"
        >
          <Plus className="size-4" /> Add product
        </button>
      }
    >
      {content}

      {showProductForm ? (
        <ProductForm
          form={productForm}
          editing={Boolean(editingProduct)}
          error={productError}
          onChange={setProductForm}
          onImage={handleImage}
          onSubmit={submitProduct}
          onClose={closeProductForm}
        />
      ) : null}
      {productToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive">Delete BOM product</p>
            <h2 id="delete-product-title" className="mt-2 text-xl font-semibold">Delete {productToDelete.name}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">This also removes its variants and raw-part quantities. This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={() => setProductToDelete(null)} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => { deleteBomProduct(productToDelete.code); setProductToDelete(null); }} className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90">
                <Trash2 className="size-4" /> Delete product
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function ProductAdminActions({
  product,
  onEdit,
  onDelete,
}: {
  product: BomProduct;
  onEdit: (product: BomProduct) => void;
  onDelete: (product: BomProduct) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
      <button type="button" onClick={() => onEdit(product)} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted">
        <Pencil className="size-4" /> Edit
      </button>
      <button type="button" onClick={() => onDelete(product)} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive hover:bg-destructive/10">
        <Trash2 className="size-4" /> Delete
      </button>
    </div>
  );
}

function ProductForm({
  form,
  editing,
  error,
  onChange,
  onImage,
  onSubmit,
  onClose,
}: {
  form: NewProduct;
  editing: boolean;
  error: string;
  onChange: (value: NewProduct) => void;
  onImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Product master</p>
            <h2 id="add-product-title" className="mt-2 text-xl font-semibold">{editing ? "Edit product" : "Add product"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{editing ? "Update this BOM product." : "Add an image and product details to create a new BOM product."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-base font-medium">
            Product image
            <span className="mt-1.5 flex min-h-24 cursor-pointer items-center gap-3 rounded-md border border-dashed border-input bg-muted/20 px-3 py-3 text-sm font-normal hover:bg-muted/40">
              {form.image ? (
                <img src={form.image} alt="Product preview" className="size-16 rounded border border-border bg-white object-contain" />
              ) : (
                <span className="flex size-16 items-center justify-center rounded border border-border bg-background text-muted-foreground">
                  <ImagePlus className="size-5" />
                </span>
              )}
              <span className="flex-1 text-muted-foreground">{form.image ? "Replace product image" : "Choose a product image"}</span>
              <Upload className="size-4 text-muted-foreground" />
              <input type="file" accept="image/*" onChange={onImage} className="sr-only" />
            </span>
          </label>
          <label className="block text-base font-medium">
            Product name
            <input
              required
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder="Pump"
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary"
            />
          </label>
          <label className="block text-base font-medium">
            Product code
            <input
              required
              disabled={editing}
              value={form.code}
              onChange={(event) => onChange({ ...form, code: event.target.value })}
              placeholder="P-PMP"
              className="tabular mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
            />
          </label>
          {editing ? <p className="-mt-3 text-sm text-muted-foreground">Product code is locked to preserve BOM references.</p> : null}
          <label className="block text-base font-medium">
            Description
            <textarea
              required
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder="Pump assembly definition"
              rows={3}
              className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-primary"
            />
          </label>
          {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-md border border-input px-4 py-2 text-base font-medium hover:bg-muted">
            Cancel
          </button>
          <button type="submit" className="rule-header inline-flex min-h-11 items-center rounded-md px-4 py-2 text-base font-medium">
            {editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}