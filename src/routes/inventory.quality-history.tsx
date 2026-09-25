import { createFileRoute } from "@tanstack/react-router";
import { InventoryQualityHistoryPage } from "./inventory";

export const Route = createFileRoute("/inventory/quality-history")({
  head: () => ({ meta: [{ title: "Quality Management History — SubHub · Float ERP" }] }),
  component: InventoryQualityHistoryPage,
});