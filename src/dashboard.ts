import { createServerFn } from "@tanstack/react-start";
import { getOperationsDashboard } from "./dashboard.server";

export type {
  DashboardBomSummary,
  DashboardInventory,
  DashboardInventoryHub,
  OperationsDashboard,
} from "./dashboard.server";

export const getOperationsDashboardFn = createServerFn({ method: "GET" }).handler(() => getOperationsDashboard());