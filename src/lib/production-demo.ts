import type { ManagerProductionData, ProductionOrder, ProductionOrderActivity, ProductionReport } from "@/production.server";

export const demoOrder: ProductionOrder = {
  id: "demo-order-001",
  orderNumber: "DEMO-2026-001",
  subhubUserId: "demo-subhub",
  subhubName: "Demo Factory",
  productCode: "P-FLT",
  productName: "Float",
  variantCode: "FL-RVN",
  variantName: "Eureka Revinia NXT",
  target: 60,
  dueDate: "2026-09-09",
  notes: "Demo order shown until live assignments are available.",
  produced: 24,
  remaining: 36,
  lastProductionDate: "2026-09-09",
  status: "In progress",
  createdAt: "2026-09-01T09:00:00.000Z",
};

export const demoReports: ProductionReport[] = [
  { id: "demo-report-001", orderId: demoOrder.id, date: "2026-09-08", quantity: 12, notes: "Morning shift demo entry.", updatedAt: "2026-09-08T12:30:00.000Z" },
  { id: "demo-report-002", orderId: demoOrder.id, date: "2026-09-09", quantity: 12, notes: "Day shift demo entry.", updatedAt: "2026-09-09T15:45:00.000Z" },
];

export const demoActivities: ProductionOrderActivity[] = [
  { id: "demo-activity-001", orderId: demoOrder.id, action: "assigned", actorName: "Master Admin", actorRole: "Admin", summary: "Order assigned to Demo Factory", details: "Target of 60 units assigned for Eureka Revinia NXT.", createdAt: "2026-09-01T09:00:00.000Z" },
  { id: "demo-activity-002", orderId: demoOrder.id, action: "production_updated", actorName: "Hub Manager", actorRole: "Hub Manager", summary: "Production report added for 2026-09-09", details: "12 units reported for Eureka Revinia NXT.", createdAt: "2026-09-09T15:45:00.000Z" },
];

export const demoProductionData: ManagerProductionData = {
  subhubName: "Demo Factory",
  orders: [demoOrder],
  reports: demoReports,
};