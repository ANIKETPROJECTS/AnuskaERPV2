import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createProductionOrder,
  getAdminProductionDashboard,
  getManagerProductionData,
  listAssignableSubhubs,
  listProductionOrders,
  saveDailyProduction,
} from "./production.server";

const orderSchema = z.object({
  subhubUserId: z.string().min(1),
  skuId: z.number().int().positive(),
  target: z.number().int().positive(),
  dueDate: z.string().min(10),
  notes: z.string().max(500),
});

const reportSchema = z.object({
  orderId: z.string().min(1),
  date: z.string().min(10),
  quantity: z.number().int().min(0),
  notes: z.string().max(500),
});

export const listAssignableSubhubsFn = createServerFn({ method: "GET" }).handler(() => listAssignableSubhubs());
export const listProductionOrdersFn = createServerFn({ method: "GET" }).handler(() => listProductionOrders());
export const getManagerProductionDataFn = createServerFn({ method: "GET" }).handler(() => getManagerProductionData());
export const getAdminProductionDashboardFn = createServerFn({ method: "GET" }).handler(() => getAdminProductionDashboard());
export const createProductionOrderFn = createServerFn({ method: "POST" }).validator(orderSchema).handler(({ data }) => createProductionOrder(data));
export const saveDailyProductionFn = createServerFn({ method: "POST" }).validator(reportSchema).handler(({ data }) => saveDailyProduction(data));