import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type BomProduct } from "@/lib/bom-store";
import { useRawMaterials } from "@/lib/raw-material-store";

type BomMatrixProps = {
  products: BomProduct[];
  title?: string;
  description?: string;
  largeText?: boolean;
};

export function BomMatrix({
  products,
  title = "BOM matrix",
  description = "Quantity of each raw subpart required per finished unit.",
  largeText = false,
}: BomMatrixProps) {
  const materials = useRawMaterials();
  const variants = products.flatMap((product) =>
    product.variants.map((variant) => ({
      key: `${product.code}-${variant.id}`,
      productCode: product.code,
      productName: product.name,
      variant,
    })),
  );
  const partCodes = Array.from(new Set(products.flatMap((product) => product.variants.flatMap((variant) => Object.keys(variant.parts)))));
  const partByCode = new Map(materials.map((part) => [part.code, part]));
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
    <div className={largeText ? "w-full" : "overflow-hidden rounded-lg border border-border bg-card"}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className={largeText ? "text-lg font-semibold" : "text-base font-semibold"}>{title}</p>
          <p className={`mt-1 text-muted-foreground ${largeText ? "text-base" : "text-sm"}`}>{description}</p>
        </div>
        {variants.length ? (
          <div className="flex items-center gap-2">
            <p className={`text-muted-foreground ${largeText ? "text-base" : "text-sm"}`}>
              {scrollState.canScrollLeft || scrollState.canScrollRight ? "Scroll horizontally to view all variants" : "All variants visible"}
            </p>
            <div className="flex rounded-md border border-input bg-white">
              <button
                type="button"
                onClick={() => scrollMatrix("left")}
                disabled={!scrollState.canScrollLeft}
                aria-label="Scroll BOM matrix left"
                className={`inline-flex items-center justify-center border-r border-input text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${largeText ? "size-11" : "size-10"}`}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollMatrix("right")}
                disabled={!scrollState.canScrollRight}
                aria-label="Scroll BOM matrix right"
                className={`inline-flex items-center justify-center text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${largeText ? "size-11" : "size-10"}`}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {!variants.length ? (
        <p className="p-12 text-center text-base text-muted-foreground">No variants are available for the selected BOM products.</p>
      ) : (
        <div ref={matrixRef} tabIndex={0} aria-label="BOM matrix table. Scroll horizontally to view more variants." className="overflow-x-auto outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30">
          <table className="w-full min-w-max text-base">
            <caption className="sr-only">{title}</caption>
            <thead className={`border-b border-border bg-muted/20 text-left uppercase tracking-wide text-muted-foreground ${largeText ? "text-sm" : "text-xs"}`}>
              <tr>
                {largeText ? (
                  <>
                    <th scope="col" className="w-[145px] min-w-[145px] px-4 py-4 font-medium">Raw material code</th>
                    <th scope="col" className="w-[170px] min-w-[170px] px-4 py-4 font-medium">Name</th>
                    <th scope="col" className="w-[130px] min-w-[130px] px-4 py-4 font-medium">Material</th>
                    <th scope="col" className="w-[100px] min-w-[100px] px-4 py-4 text-right font-medium">Weight (kg)</th>
                    <th scope="col" className="w-[110px] min-w-[110px] px-4 py-4 font-medium">Source</th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="sticky left-0 z-40 w-[280px] min-w-[280px] bg-card px-6 py-4 font-medium shadow-[6px_0_8px_-8px_rgba(15,23,42,0.45)]">Raw subpart</th>
                    <th scope="col" className="sticky left-[280px] z-40 w-[110px] min-w-[110px] bg-card px-4 py-4 font-medium">Source</th>
                    <th scope="col" className="sticky left-[390px] z-40 w-[100px] min-w-[100px] bg-card px-4 py-4 text-right font-medium">₹ / unit</th>
                  </>
                )}
                {variants.map(({ key, productCode, productName, variant }) => (
                  <th scope="col" key={key} className="min-w-[150px] px-4 py-4 text-center font-medium">
                    {largeText ? <span className="block text-xs font-medium normal-case tracking-normal text-muted-foreground">Variant</span> : null}
                    <span className={`tabular block text-foreground ${largeText ? "mt-1" : ""}`}>{variant.code}</span>
                    <span className={`mt-1 block normal-case tracking-normal text-muted-foreground ${largeText ? "text-base" : "text-sm"}`}>{productCode} · {productName}</span>
                    <span className={`mt-0.5 block normal-case tracking-normal text-muted-foreground ${largeText ? "text-base" : "text-sm"}`}>{variant.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ code, part }) => (
                <tr key={code} className="border-b border-border/70 last:border-0">
                  {largeText ? (
                    <>
                      <td className="tabular px-4 py-4 text-muted-foreground">{code}</td>
                      <th scope="row" className="px-4 py-4 text-left font-semibold">{part?.name ?? "—"}</th>
                      <td className="px-4 py-4 text-muted-foreground">{part?.material ?? "—"}</td>
                      <td className="tabular px-4 py-4 text-right text-muted-foreground">{part?.weight ?? "—"}</td>
                      <td className="px-4 py-4 text-muted-foreground">{part?.source ?? "—"}</td>
                    </>
                  ) : (
                    <>
                      <th scope="row" className="sticky left-0 z-30 w-[280px] min-w-[280px] bg-card px-6 py-4 text-left shadow-[6px_0_8px_-8px_rgba(15,23,42,0.45)]">
                        <p className="font-semibold">{part?.name ?? code}</p>
                        <p className="tabular mt-0.5 text-sm font-normal text-muted-foreground">
                          {code} · {part?.material ?? "Material details unavailable"}{part?.weight !== undefined ? ` · ${part.weight} kg` : ""}
                        </p>
                      </th>
                      <td className="sticky left-[280px] z-30 w-[110px] min-w-[110px] bg-card px-4 py-4 text-sm text-muted-foreground">{part?.source ?? "—"}</td>
                      <td className="tabular sticky left-[390px] z-30 w-[100px] min-w-[100px] bg-card px-4 py-4 text-right text-sm text-muted-foreground">{part ? `₹${part.rate}` : "—"}</td>
                    </>
                  )}
                  {variants.map(({ key, variant }) => {
                    const quantity = variant.parts[code];
                    return (
                      <td key={`${key}-${code}`} className="tabular px-4 py-4 text-center font-medium">
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