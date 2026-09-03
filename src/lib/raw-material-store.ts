import { useSyncExternalStore } from "react";
import { subparts } from "./erp-data";

export type RawMaterial = {
  code: string;
  name: string;
  description: string;
  material: string;
  source: "Molded" | "Purchased" | "Other";
  weight?: number;
  rate?: number;
};

export type NewRawMaterial = Omit<RawMaterial, "weight" | "rate"> & {
  weight?: number;
  rate?: number;
};

const initialMaterials: RawMaterial[] = subparts.map((part) => ({
  code: part.code,
  name: part.name,
  description: `${part.source} raw part used in parent-product BOM assemblies.`,
  material: part.material,
  source: part.source,
  weight: part.weight,
  rate: part.rate,
}));

let materials = initialMaterials;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function updateMaterials(updater: (current: RawMaterial[]) => RawMaterial[]) {
  materials = updater(materials);
  notify();
}

export function useRawMaterials(): RawMaterial[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => materials,
    () => initialMaterials,
  );
}

export function addRawMaterial(input: NewRawMaterial): RawMaterial | undefined {
  if (materials.some((material) => material.code.toLowerCase() === input.code.toLowerCase())) return undefined;
  const material = { ...input };
  updateMaterials((current) => [...current, material]);
  return material;
}

export function updateRawMaterial(previousCode: string, input: NewRawMaterial) {
  updateMaterials((current) =>
    current.map((material) => (material.code === previousCode ? { ...input } : material)),
  );
}

export function deleteRawMaterial(code: string) {
  updateMaterials((current) => current.filter((material) => material.code !== code));
}