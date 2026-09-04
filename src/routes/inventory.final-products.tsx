import { createFileRoute } from "@tanstack/react-router";
import { InventoryFinalProductsPage } from "./inventory";

export const Route = createFileRoute("/inventory/final-products")({
  head: () => ({ meta: [{ title: "Final Product Inventory — Float ERP" }] }),
  component: InventoryFinalProductsPage,
});