import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type BomProduct } from "@/lib/bom-store";
import { subparts } from "@/lib/erp-data";

type BomMatrixProps = {
  products: BomProduct[];
  title?: string;
  description?: string;
};

export function BomMatrix({
  products,
  title = "BOM matrix",
  description = "Quantity of each raw subpart required per finished unit.",
}: BomMatrixProps) {
  const variants = products.flatMap((product) =>
    product.variants.map((variant) => ({
      key: `${product.code}-${variant.id}`,
      productCode: product.code,
      productName: product.name,
      variant,
    })),
  );
  const partCodes = Array.from(new Set(products.flatMap((product) => product.variants.flatMap((variant) => Object.keys(variant.parts)))));
  const partByCode = new Map(subparts.map((part) => [part.code, part]));
  const rows = partCodes.map((code) => ({ code, part: partByCode.get(code) }));
  const matrixRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

  useEffect(() => {
    const element = matrixRef.current;
    if (!element) return;

    const updateScrollState = () => {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      setScrollState({
        canScrollLeft: element.scrollLeft > 2,
        canScrollRight: maxScrollLeft - element.scrollLeft > 2,
      });
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(element);
    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [products.length, variants.length, rows.length]);

  function scrollMatrix(direction: "left" | "right") {
    matrixRef.current?.scrollBy({
      left: direction === "left" ? -520 : 520,
      behavior: "smooth",
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {variants.length ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {scrollState.canScrollLeft || scrollState.canScrollRight ? "Scroll horizontally to view all variants" : "All variants visible"}
            </p>
            <div className="flex rounded-md border border-input bg-white">
              <button
                type="button"
                onClick={() => scrollMatrix("left")}
                disabled={!scrollState.canScrollLeft}
                aria-label="Scroll BOM matrix left"
                className="inline-flex size-8 items-center justify-center border-r border-input text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollMatrix("right")}
                disabled={!scrollState.canScrollRight}
                aria-label="Scroll BOM matrix right"
                className="inline-flex size-8 items-center justify-center text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {!variants.length ? (
        <p className="p-12 text-center text-sm text-muted-foreground">No variants are available for the selected BOM products.</p>
      ) : (
        <div ref={matrixRef} tabIndex={0} aria-label="BOM matrix table. Scroll horizontally to view more variants." className="overflow-x-auto outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="border-b border-border bg-muted/20 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="sticky left-0 z-40 w-[250px] min-w-[250px] bg-card px-5 py-3 font-medium shadow-[6px_0_8px_-8px_rgba(15,23,42,0.45)]">Raw subpart</th>
                <th scope="col" className="sticky left-[250px] z-40 w-[100px] min-w-[100px] bg-card px-4 py-3 font-medium">Source</th>
                <th scope="col" className="sticky left-[350px] z-40 w-[90px] min-w-[90px] bg-card px-4 py-3 text-right font-medium shadow-[6px_0_8px_-8px_rgba(15,23,42,0.45)]">₹ / unit</th>
                {variants.map(({ key, productCode, productName, variant }) => (
                  <th scope="col" key={key} className="min-w-[125px] px-4 py-3 text-center font-medium">
                    <span className="tabular block text-foreground">{variant.code}</span>
                    <span className="mt-1 block normal-case tracking-normal text-muted-foreground">{productCode} · {productName}</span>
                    <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground">{variant.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ code, part }) => (
                <tr key={code} className="border-b border-border/70 last:border-0">
                  <th scope="row" className="sticky left-0 z-30 w-[250px] min-w-[250px] bg-card px-5 py-3 text-left shadow-[6px_0_8px_-8px_rgba(15,23,42,0.45)]">
                    <p className="font-medium">{part?.name ?? code}</p>
                    <p className="tabular mt-0.5 text-xs font-normal text-muted-foreground">
                      {code} · {part?.material ?? "Material details unavailable"}{part?.weight !== undefined ? ` · ${part.weight} kg` : ""}
                    </p>
                  </th>
                  <td className="sticky left-[250px] z-30 w-[100px] min-w-[100px] bg-card px-4 py-3 text-xs text-muted-foreground">{part?.source ?? "—"}</td>
                  <td className="tabular sticky left-[350px] z-30 w-[90px] min-w-[90px] bg-card px-4 py-3 text-right text-xs text-muted-foreground shadow-[6px_0_8px_-8px_rgba(15,23,42,0.45)]">{part ? `₹${part.rate}` : "—"}</td>
                  {variants.map(({ key, variant }) => {
                    const quantity = variant.parts[code];
                    return (
                      <td key={`${key}-${code}`} className="tabular px-4 py-3 text-center font-medium">
                        {quantity !== undefined ? quantity : <span className="font-normal text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}