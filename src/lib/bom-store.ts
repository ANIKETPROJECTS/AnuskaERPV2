import { useSyncExternalStore } from "react";
import { bomCatalog, type BomCatalogVariant } from "./bom-catalog";
import { subparts } from "./erp-data";

export type BomVariant = Omit<BomCatalogVariant, "skuId"> & {
  id: string;
};

export type BomProduct = {
  code: string;
  name: string;
  description: string;
  image: string;
  variants: BomVariant[];
};

export type NewProduct = {
  name: string;
  code: string;
  description: string;
  image: string;
};

export type NewVariant = Omit<BomVariant, "id">;

const initialProducts: BomProduct[] = bomCatalog.map((definition) => ({
  code: definition.code,
  name: definition.name,
  description: definition.description,
  image: definition.image,
  variants: definition.variants.map(({ skuId, ...variant }) => ({ ...variant, id: `seed-${skuId}` })),
}));

let products = initialProducts;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateProducts(updater: (current: BomProduct[]) => BomProduct[]) {
  products = updater(products);
  notify();
}

export function useBomProducts(): BomProduct[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => products,
    () => initialProducts,
  );
}

export function getBomProduct(code: string): BomProduct | undefined {
  return products.find((product) => product.code === code);
}

export function addBomProduct(input: NewProduct): BomProduct {
  const product: BomProduct = { ...input, variants: [] };
  updateProducts((current) => [...current, product]);
  return product;
}

export function addBomVariant(productCode: string, input: NewVariant): BomVariant | undefined {
  const variant = { ...input, id: createId("variant") };
  updateProducts((current) =>
    current.map((product) =>
      product.code === productCode ? { ...product, variants: [...product.variants, variant] } : product,
    ),
  );
  return variant;
}

export function updateBomVariant(productCode: string, variantId: string, input: NewVariant) {
  updateProducts((current) =>
    current.map((product) =>
      product.code === productCode
        ? {
            ...product,
            variants: product.variants.map((variant) => (variant.id === variantId ? { ...input, id: variantId } : variant)),
          }
        : product,
    ),
  );
}

export function deleteBomVariant(productCode: string, variantId: string) {
  updateProducts((current) =>
    current.map((product) =>
      product.code === productCode
        ? { ...product, variants: product.variants.filter((variant) => variant.id !== variantId) }
        : product,
    ),
  );
}

export function rawPartCount(product: BomProduct): number {
  return new Set(product.variants.flatMap((variant) => Object.keys(variant.parts))).size;
}