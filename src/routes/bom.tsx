import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { Panel } from "@/components/erp/bits";
import { skus, subparts } from "@/lib/erp-data";

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

function Bom() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const selectedProduct = bomProducts.find((product) => product.code === selectedCode);

  return (
    <Shell
      title="Bills of Materials"
      subtitle="Parent assemblies and component structures for the Float product line"
      actions={
        <button type="button" className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
          <Plus className="size-4" /> Add product
        </button>
      }
    >
      <section className="space-y-6 p-6">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {bomProducts.map((product) => (
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
                    <p className="mt-1 font-semibold">{product.variants}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Raw parts</p>
                    <p className="mt-1 font-semibold">{product.rawParts}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCode(product.code)}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                >
                  Open structure <ArrowRight className="size-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {selectedProduct ? (
          <Panel
            title={`${selectedProduct.name} structure`}
            description={`${selectedProduct.code} · ${selectedProduct.variants} product variants · ${selectedProduct.rawParts} raw parts`}
            action={
              <button type="button" onClick={() => setSelectedCode(null)} aria-label="Close structure" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            }
          >
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {subparts
                .filter((part) => part.bom[selectedProduct.skuId])
                .map((part) => (
                  <div key={part.code} className="rounded-md border border-border bg-background px-3 py-2.5">
                    <p className="text-sm font-medium">{part.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{part.code} · {part.material}</p>
                    <p className="mt-2 text-xs font-semibold text-primary">×{part.bom[selectedProduct.skuId]} per unit</p>
                  </div>
                ))}
            </div>
          </Panel>
        ) : null}
      </section>
    </Shell>
  );
}

const bomProducts = [
  {
    code: "P-FLT",
    name: "Float",
    description: "Main parent assembly manufactured for multiple company variants.",
    variants: 6,
    rawParts: 11,
    skuId: 1,
    image: "/float-parent-parts.png",
  },
  {
    code: "P-ARM",
    name: "Float Arm",
    description: "Parent definition for arm and pivot assemblies.",
    variants: 3,
    rawParts: 7,
    skuId: 2,
    image: "/float-arm-parent-parts.png",
  },
  {
    code: "P-VAL",
    name: "Valve",
    description: "Parent definition for valve seat and seal assemblies.",
    variants: 4,
    rawParts: 9,
    skuId: 5,
    image: "/valve-parent-parts.png",
  },
  {
    code: "P-CAP",
    name: "Cover",
    description: "Parent definition for cover and retainer assemblies.",
    variants: 2,
    rawParts: 5,
    skuId: 4,
    image: "/cover-parent-parts.png",
  },
] as const;
