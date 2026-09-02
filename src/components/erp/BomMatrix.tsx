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

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {!variants.length ? (
        <p className="p-12 text-center text-sm text-muted-foreground">No variants are available for the selected BOM products.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="border-b border-border bg-muted/20 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="sticky left-0 z-20 min-w-[250px] bg-muted/20 px-5 py-3 font-medium">Raw subpart</th>
                <th scope="col" className="min-w-[100px] px-4 py-3 font-medium">Source</th>
                <th scope="col" className="min-w-[90px] px-4 py-3 text-right font-medium">₹ / unit</th>
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
                  <th scope="row" className="sticky left-0 z-10 min-w-[250px] bg-card px-5 py-3 text-left">
                    <p className="font-medium">{part?.name ?? code}</p>
                    <p className="tabular mt-0.5 text-xs font-normal text-muted-foreground">
                      {code} · {part?.material ?? "Material details unavailable"}{part?.weight !== undefined ? ` · ${part.weight} kg` : ""}
                    </p>
                  </th>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{part?.source ?? "—"}</td>
                  <td className="tabular px-4 py-3 text-right text-xs text-muted-foreground">{part ? `₹${part.rate}` : "—"}</td>
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