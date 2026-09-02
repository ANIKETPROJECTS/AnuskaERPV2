import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ImagePlus, LayoutGrid, List, Plus, Search, Upload, X } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { useAuth } from "@/components/auth/AuthContext";
import { useBomProducts, addBomProduct, rawPartCount, type BomVariant, type NewProduct } from "@/lib/bom-store";
import { subparts } from "@/lib/erp-data";

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
type BomSort = "name-asc" | "name-desc" | "variants-desc" | "variants-asc" | "raw-parts-desc" | "raw-parts-asc";
type CountFilter = "all" | "none" | "1-2" | "3-4" | "5-plus";
type BomView = "grid" | "list";

function requiredMaterialsForVariant(variant: BomVariant) {
  return Object.entries(variant.parts).map(([code, quantity]) => {
    const part = subparts.find((item) => item.code === code);
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

function matchesCountFilter(value: number, filter: CountFilter, middleStart: number, middleEnd: number) {
  if (filter === "all") return true;
  if (filter === "none") return value === 0;
  if (filter === "5-plus") return value >= 5;
  return value >= middleStart && value <= middleEnd;
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
  const [productSearch, setProductSearch] = useState("");
  const [sortBy, setSortBy] = useState<BomSort>("name-asc");
  const [variantFilter, setVariantFilter] = useState<CountFilter>("all");
  const [rawPartsFilter, setRawPartsFilter] = useState<CountFilter>("all");
  const [view, setView] = useState<BomView>("grid");
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<string, string>>({});
  const [selectedMaterialByProduct, setSelectedMaterialByProduct] = useState<Record<string, string>>({});
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [productError, setProductError] = useState("");
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch =
        !query ||
        [product.code, product.name, product.description, ...product.variants.flatMap((variant) => [variant.code, variant.name, variant.company])]
          .some((value) => value.toLowerCase().includes(query));
      const variantCount = product.variants.length;
      const productRawPartCount = rawPartCount(product);
      return (
        matchesSearch &&
        matchesCountFilter(variantCount, variantFilter, 1, 2) &&
        matchesCountFilter(productRawPartCount, rawPartsFilter, 1, 5)
      );
    });
    return filtered.sort((left, right) => {
      const leftRawParts = rawPartCount(left);
      const rightRawParts = rawPartCount(right);
      if (sortBy === "name-asc") return left.name.localeCompare(right.name);
      if (sortBy === "name-desc") return right.name.localeCompare(left.name);
      if (sortBy === "variants-desc") return right.variants.length - left.variants.length || left.name.localeCompare(right.name);
      if (sortBy === "variants-asc") return left.variants.length - right.variants.length || left.name.localeCompare(right.name);
      if (sortBy === "raw-parts-desc") return rightRawParts - leftRawParts || left.name.localeCompare(right.name);
      return leftRawParts - rightRawParts || left.name.localeCompare(right.name);
    });
  }, [productSearch, products, rawPartsFilter, sortBy, variantFilter]);

  function clearCatalogFilters() {
    setProductSearch("");
    setSortBy("name-asc");
    setVariantFilter("all");
    setRawPartsFilter("all");
  }

  function selectVariant(productCode: string, variantId: string) {
    setSelectedVariantByProduct((current) => ({ ...current, [productCode]: variantId }));
    setSelectedMaterialByProduct((current) => ({ ...current, [productCode]: "" }));
  }

  function openProductForm() {
    setProductForm(emptyProduct);
    setProductError("");
    setShowProductForm(true);
  }

  function closeProductForm() {
    setShowProductForm(false);
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
    if (products.some((product) => product.code.toLowerCase() === code.toLowerCase())) {
      setProductError("That product code is already in use.");
      return;
    }
    addBomProduct({ name, code, description, image: productForm.image });
    closeProductForm();
  }

  const content = (
      <section className="space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Parent assemblies</p>
              <p className="mt-1 text-xs text-muted-foreground">Search product names, product codes, companies, or variant codes.</p>
            </div>
            <label className="relative block w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search BOM products"
                aria-label="Search BOM products"
                className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
            <label className="text-xs font-medium">
              Sort by
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as BomSort)} className="mt-1.5 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="variants-desc">Most variants</option>
                <option value="variants-asc">Fewest variants</option>
                <option value="raw-parts-desc">Most raw parts</option>
                <option value="raw-parts-asc">Fewest raw parts</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Filter variants
              <select value={variantFilter} onChange={(event) => setVariantFilter(event.target.value as CountFilter)} className="mt-1.5 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
                <option value="all">Any variant count</option>
                <option value="none">No variants</option>
                <option value="1-2">1–2 variants</option>
                <option value="3-4">3–4 variants</option>
                <option value="5-plus">5+ variants</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Filter raw parts
              <select value={rawPartsFilter} onChange={(event) => setRawPartsFilter(event.target.value as CountFilter)} className="mt-1.5 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
                <option value="all">Any raw-part count</option>
                <option value="none">No raw parts</option>
                <option value="1-2">1–2 raw parts</option>
                <option value="3-4">3–4 raw parts</option>
                <option value="5-plus">5+ raw parts</option>
              </select>
            </label>
            <button type="button" onClick={clearCatalogFilters} className="h-9 rounded-md border border-input px-3 text-xs font-medium text-muted-foreground hover:bg-muted">
              Clear filters
            </button>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex rounded-md border border-input bg-white p-1" aria-label="BOM layout">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <LayoutGrid className="size-3.5" /> Grid
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <List className="size-3.5" /> List
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{filteredProducts.length} of {products.length} parent assemblies</p>
            </div>
          </div>
        </div>
        {view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <article key={product.code} className="panel overflow-hidden">
                <div className="flex h-36 items-center justify-center bg-white p-3">
                  <img src={product.image} alt={`${product.name} component assembly`} className="h-full w-full object-contain" />
                </div>
                <div className="p-4">
                  <p className="tabular text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{product.code}</p>
                  <h2 className="mt-1 text-base font-semibold">{product.name}</h2>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{product.description}</p>
                  <div className="mt-4 grid grid-cols-2 border-t border-border pt-3 text-xs">
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">Variants</p>
                      <p className="mt-1 font-semibold">{product.variants.length}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">Raw parts</p>
                      <p className="mt-1 font-semibold">{rawPartCount(product)}</p>
                    </div>
                  </div>
                  {readOnly ? (
                    <Link to="/subhub/bom/$code" params={{ code: product.code }} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                      Open structure <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <Link to="/bom/$code" params={{ code: product.code }} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                      Open structure <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const selectedVariant =
                product.variants.find((variant) => variant.id === selectedVariantByProduct[product.code]) ??
                product.variants[0] ??
                null;
              const requiredMaterials = selectedVariant ? requiredMaterialsForVariant(selectedVariant) : [];
              const selectedMaterial =
                requiredMaterials.find((material) => material.code === selectedMaterialByProduct[product.code]) ??
                requiredMaterials[0] ??
                null;

              return (
                <article key={product.code} className="panel overflow-hidden">
                  <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start">
                    <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-md bg-white p-2 lg:w-36">
                      <img src={product.image} alt={`${product.name} component assembly`} className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="tabular text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{product.code}</p>
                      <h2 className="mt-1 text-lg font-semibold">{product.name}</h2>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{product.description}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
                        <span><span className="uppercase tracking-wide text-muted-foreground">Variants</span> <strong className="ml-1">{product.variants.length}</strong></span>
                        <span><span className="uppercase tracking-wide text-muted-foreground">Raw parts</span> <strong className="ml-1">{rawPartCount(product)}</strong></span>
                        {readOnly ? (
                          <Link to="/subhub/bom/$code" params={{ code: product.code }} className="font-semibold text-primary hover:underline">Open structure →</Link>
                        ) : (
                          <Link to="/bom/$code" params={{ code: product.code }} className="font-semibold text-primary hover:underline">Open structure →</Link>
                        )}
                      </div>
                    </div>
                    <div className="w-full rounded-lg border border-border bg-muted/20 p-3 lg:max-w-sm">
                      <label className="block text-xs font-medium">
                        Select variant
                        <select
                          value={selectedVariant?.id ?? ""}
                          onChange={(event) => selectVariant(product.code, event.target.value)}
                          disabled={!product.variants.length}
                          className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal disabled:opacity-60"
                        >
                          {!product.variants.length ? <option value="">No variants available</option> : null}
                          {product.variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>{variant.name} · {variant.code} · {variant.company}</option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-medium">
                        Required material
                        <select
                          value={selectedMaterial?.code ?? ""}
                          onChange={(event) => setSelectedMaterialByProduct((current) => ({ ...current, [product.code]: event.target.value }))}
                          disabled={!requiredMaterials.length}
                          className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-2 text-sm font-normal disabled:opacity-60"
                        >
                          {!requiredMaterials.length ? <option value="">No required materials</option> : null}
                          {requiredMaterials.map((material) => (
                            <option key={material.code} value={material.code}>{material.name} · {material.code} · Qty {material.quantity}</option>
                          ))}
                        </select>
                      </label>
                      {selectedMaterial ? (
                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
                          <span className="text-muted-foreground">Material</span><strong className="text-right">{selectedMaterial.material}</strong>
                          <span className="text-muted-foreground">Quantity</span><strong className="text-right">{selectedMaterial.quantity} per assembly</strong>
                          <span className="text-muted-foreground">Source</span><strong className="text-right">{selectedMaterial.source ?? "—"}</strong>
                          <span className="text-muted-foreground">Unit weight</span><strong className="text-right">{selectedMaterial.weight !== undefined ? `${selectedMaterial.weight} kg` : "—"}</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!filteredProducts.length ? <p className="rounded-md border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">No BOM products match the current search and filters.</p> : null}
      </section>
  );

  if (readOnly) {
    return <SubHubShell title="Bills of Materials" subtitle="View-only parent assemblies and component structures">{content}</SubHubShell>;
  }

  return (
    <Shell
      title="Bills of Materials"
      subtitle="Parent assemblies and component structures for the Float product line"
      actions={
        <button
          type="button"
          onClick={openProductForm}
          className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
        >
          <Plus className="size-4" /> Add product
        </button>
      }
    >
      {content}

      {showProductForm ? (
        <ProductForm
          form={productForm}
          error={productError}
          onChange={setProductForm}
          onImage={handleImage}
          onSubmit={submitProduct}
          onClose={closeProductForm}
        />
      ) : null}
    </Shell>
  );
}

function ProductForm({
  form,
  error,
  onChange,
  onImage,
  onSubmit,
  onClose,
}: {
  form: NewProduct;
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
            <h2 id="add-product-title" className="mt-2 text-xl font-semibold">Add product</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add an image and product details to create a new BOM product.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
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
          <label className="block text-sm font-medium">
            Product name
            <input
              required
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder="Pump"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            Product code
            <input
              required
              value={form.code}
              onChange={(event) => onChange({ ...form, code: event.target.value })}
              placeholder="P-PMP"
              className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            Description
            <textarea
              required
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder="Pump assembly definition"
              rows={3}
              className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button type="submit" className="rule-header rounded-md px-4 py-2 text-sm font-medium">
            Add product
          </button>
        </div>
      </form>
    </div>
  );
}