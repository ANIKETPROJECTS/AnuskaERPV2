import { skus, subparts } from "./erp-data";

export type BomCatalogVariant = {
  skuId: number;
  company: string;
  name: string;
  code: string;
  parts: Record<string, number>;
};

export type BomCatalogProduct = {
  code: string;
  name: string;
  description: string;
  image: string;
  variants: BomCatalogVariant[];
};

const productDefinitions = [
  {
    code: "P-FLT",
    name: "Float",
    description: "Main parent assembly manufactured for multiple company variants.",
    skuIds: [1, 2, 3, 4, 5, 6],
    image: "/float-parent-parts.png",
  },
  {
    code: "P-ARM",
    name: "Float Arm",
    description: "Parent definition for arm and pivot assemblies.",
    skuIds: [2, 3, 5],
    image: "/float-arm-parent-parts.png",
  },
  {
    code: "P-VAL",
    name: "Valve",
    description: "Parent definition for valve seat and seal assemblies.",
    skuIds: [1, 2, 5, 6],
    image: "/valve-parent-parts.png",
  },
  {
    code: "P-CAP",
    name: "Cover",
    description: "Parent definition for cover and retainer assemblies.",
    skuIds: [3, 4],
    image: "/cover-parent-parts.png",
  },
] as const;

function variantFromSku(skuId: number): BomCatalogVariant | undefined {
  const sku = skus.find((item) => item.id === skuId);
  if (!sku) return undefined;
  return {
    skuId,
    company: sku.company,
    name: sku.name,
    code: sku.code,
    parts: Object.fromEntries(
      subparts.filter((part) => part.bom[sku.id]).map((part) => [part.code, part.bom[sku.id]!]),
    ),
  };
}

export const bomCatalog: BomCatalogProduct[] = productDefinitions.map((definition) => ({
  code: definition.code,
  name: definition.name,
  description: definition.description,
  image: definition.image,
  variants: definition.skuIds.flatMap((skuId) => {
    const variant = variantFromSku(skuId);
    return variant ? [variant] : [];
  }),
}));