import { createFileRoute } from "@tanstack/react-router";
import { InventoryBatchesPage } from "./inventory";

export const Route = createFileRoute("/inventory/batches")({
  head: () => ({ meta: [{ title: "Batch Register — Float ERP" }] }),
  component: InventoryBatchesPage,
});