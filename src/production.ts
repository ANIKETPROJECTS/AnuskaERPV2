import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createProductionOrder,
  createProductionOrders,
  getAdminProductionDashboard,
  getAdminHubDetail,
  getManagerProductionData,
  getOrderNotifications,
  getProductionOrderActivity,
  listAssignableSubhubs,
  listProductionOrders,
  reassignProductionOrder,
  saveDailyProduction,
  searchWorkspace,
  setAdminHubCapacity,
  updateProductionOrder,
  deleteProductionOrder,
} from "./production.server";
export type { OrderNotification, WorkspaceSearchResult, WorkspaceSearchScope } from "./production.server";

const orderSchema = z.object({
  subhubUserId: z.string().min(1),
  productCode: z.string().min(1),
  variantCode: z.string().min(1),
  target: z.number().int().positive(),
  dueDate: z.string().min(10),
  notes: z.string().max(500),
});

const assignmentSchema = z.object({
  subhubUserId: z.string().min(1),
  productCode: z.string().min(1),
  variantCode: z.string().min(1),
  target: z.number().int().positive(),
  dueDate: z.string().min(10),
  notes: z.string().max(500),
});

const batchOrderSchema = z.object({
  assignments: z.array(assignmentSchema).min(1).max(100),
});

const reportSchema = z.object({
  orderId: z.string().min(1),
  date: z.string().min(10),
  quantity: z.number().int().min(0),
  notes: z.string().max(500),
});

const capacitySchema = z.object({
  subhubUserId: z.string().min(1),
  capacityUnits: z.number().int().positive().nullable(),
});

const activitySchema = z.object({
  orderId: z.string().min(1),
  panel: z.enum(["admin", "subhub"]),
});

const reassignSchema = z.object({
  orderId: z.string().min(1),
  subhubUserId: z.string().min(1),
  reason: z.string().max(500),
});

const updateOrderSchema = z.object({
  orderId: z.string().min(1),
  subhubUserId: z.string().min(1),
  productCode: z.string().min(1),
  variantCode: z.string().min(1),
  target: z.number().int().positive(),
  dueDate: z.string().min(10),
  notes: z.string().max(500),
});

const deleteOrderSchema = z.object({
  orderId: z.string().min(1),
});

const searchSchema = z.object({
  query: z.string().max(100),
  panel: z.enum(["admin", "subhub"]),
  scope: z.enum(["dashboard", "bom", "raw-materials", "orders", "hubs", "shortages", "procurement", "production", "user-management", "hr"]),
});

const panelSchema = z.enum(["admin", "subhub"]);
const hubDetailSchema = z.object({ hubId: z.string().min(1) });

export const listAssignableSubhubsFn = createServerFn({ method: "GET" }).handler(() => listAssignableSubhubs());
export const listProductionOrdersFn = createServerFn({ method: "GET" }).handler(() => listProductionOrders());
export const getManagerProductionDataFn = createServerFn({ method: "GET" }).handler(() => getManagerProductionData());
export const getAdminProductionDashboardFn = createServerFn({ method: "GET" }).handler(() => getAdminProductionDashboard());
export const getAdminHubDetailFn = createServerFn({ method: "POST" }).validator(hubDetailSchema).handler(({ data }) => getAdminHubDetail(data.hubId));
export const createProductionOrderFn = createServerFn({ method: "POST" }).validator(orderSchema).handler(({ data }) => createProductionOrder(data));
export const createProductionOrdersFn = createServerFn({ method: "POST" }).validator(batchOrderSchema).handler(({ data }) => createProductionOrders(data));
export const saveDailyProductionFn = createServerFn({ method: "POST" }).validator(reportSchema).handler(({ data }) => saveDailyProduction(data));
export const setAdminHubCapacityFn = createServerFn({ method: "POST" }).validator(capacitySchema).handler(({ data }) => setAdminHubCapacity(data));
export const getProductionOrderActivityFn = createServerFn({ method: "POST" }).validator(activitySchema).handler(({ data }) => getProductionOrderActivity(data.orderId, data.panel));
export const reassignProductionOrderFn = createServerFn({ method: "POST" }).validator(reassignSchema).handler(({ data }) => reassignProductionOrder(data));
export const updateProductionOrderFn = createServerFn({ method: "POST" }).validator(updateOrderSchema).handler(({ data }) => updateProductionOrder(data));
export const deleteProductionOrderFn = createServerFn({ method: "POST" }).validator(deleteOrderSchema).handler(({ data }) => deleteProductionOrder(data));
export const searchWorkspaceFn = createServerFn({ method: "POST" }).validator(searchSchema).handler(({ data }) => searchWorkspace(data.query, data.panel, data.scope));
export const getOrderNotificationsFn = createServerFn({ method: "POST" }).validator(panelSchema).handler(({ data }) => getOrderNotifications(data));