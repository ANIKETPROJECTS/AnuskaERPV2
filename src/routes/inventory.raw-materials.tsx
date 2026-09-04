import { createFileRoute } from "@tanstack/react-router";
import { InventoryRawMaterialsPage } from "./inventory";

export const Route = createFileRoute("/inventory/raw-materials")({
  head: () => ({ meta: [{ title: "Raw Materials Inventory — Float ERP" }] }),
  component: InventoryRawMaterialsPage,
});