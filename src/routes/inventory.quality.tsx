import { createFileRoute } from "@tanstack/react-router";
import { InventoryQualityPage } from "./inventory";

export const Route = createFileRoute("/inventory/quality")({
  head: () => ({ meta: [{ title: "Quality Management — SubHub · Float ERP" }] }),
  component: InventoryQualityPage,
});