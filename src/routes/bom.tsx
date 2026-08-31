import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ImagePlus, Plus, Upload, X } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { useBomProducts, addBomProduct, rawPartCount, type NewProduct } from "@/lib/bom-store";

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

function Bom() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const products = useBomProducts();
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [productError, setProductError] = useState("");

  if (pathname !== "/bom") {
    return <Outlet />;
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
      <section className="space-y-6 p-6">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
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
                <Link
                  to="/bom/$code"
                  params={{ code: product.code }}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                >
                  Open structure <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

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