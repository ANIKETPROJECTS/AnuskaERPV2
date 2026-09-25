import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adjustSubhubInventory, adjustSubhubInventoryBatch, getBatchDetail, getBatchOptions, getInventoryItemDetail, getManagedHubBatchDetail, getManagedHubBatches, getManagedHubItemDetail, getMasterQualityManagement, getSubhubInventory, recordQualityIssues } from "./inventory.server";

const adjustmentSchema = z.object({
  code: z.string().min(1),
  targetQuantity: z.number().int().nonnegative(),
  reason: z.string().min(2).max(120),
  notes: z.string().max(500),
  batchId: z.string().min(1).optional(),
});
const adjustmentBatchSchema = z.object({
  adjustments: z.array(adjustmentSchema).min(1).max(500),
});
const qualitySchema = z.object({
  code: z.string().min(1),
  issue: z.enum(["Faulty", "Damaged", "Rejected", "Expired", "Other"]),
  quantity: z.number().int().positive(),
  notes: z.string().max(500),
  batchId: z.string().min(1).optional(),
});
const qualityBatchSchema = z.object({
  issues: z.array(qualitySchema).min(1).max(50),
});
const batchIdSchema = z.object({ batchId: z.string().min(1) });
const batchOptionsSchema = z.object({ code: z.string().min(1) });
const itemCodeSchema = z.object({ itemCode: z.string().min(1) });
const managedHubSchema = z.object({ panel: z.enum(["admin", "procurement"]), hubId: z.string().min(1) });
const managedBatchSchema = managedHubSchema.extend({ batchId: z.string().min(1) });
const managedItemSchema = managedHubSchema.extend({ itemCode: z.string().min(1) });
const inventoryViewSchema = z.object({ view: z.enum(["inventory", "history", "quality", "adjustment", "batches", "all"]) }).optional();

export const getSubhubInventoryFn = createServerFn({ method: "GET" }).validator(inventoryViewSchema).handler(({ data }) => getSubhubInventory(data?.view));
export const adjustSubhubInventoryFn = createServerFn({ method: "POST" }).validator(adjustmentSchema).handler(({ data }) => adjustSubhubInventory(data));
export const adjustSubhubInventoryBatchFn = createServerFn({ method: "POST" }).validator(adjustmentBatchSchema).handler(({ data }) => adjustSubhubInventoryBatch(data.adjustments));
export const recordQualityIssuesFn = createServerFn({ method: "POST" }).validator(qualityBatchSchema).handler(({ data }) => recordQualityIssues(data.issues));
export const getMasterQualityManagementFn = createServerFn({ method: "GET" }).handler(() => getMasterQualityManagement());
export const getBatchDetailFn = createServerFn({ method: "POST" }).validator(batchIdSchema).handler(({ data }) => getBatchDetail(data.batchId));
export const getBatchOptionsFn = createServerFn({ method: "POST" }).validator(batchOptionsSchema).handler(({ data }) => getBatchOptions(data.code));
export const getInventoryItemDetailFn = createServerFn({ method: "POST" }).validator(itemCodeSchema).handler(({ data }) => getInventoryItemDetail(data.itemCode));
export const getManagedHubBatchesFn = createServerFn({ method: "POST" }).validator(managedHubSchema).handler(({ data }) => getManagedHubBatches(data.panel, data.hubId));
export const getManagedHubBatchDetailFn = createServerFn({ method: "POST" }).validator(managedBatchSchema).handler(({ data }) => getManagedHubBatchDetail(data.panel, data.hubId, data.batchId));
export const getManagedHubItemDetailFn = createServerFn({ method: "POST" }).validator(managedItemSchema).handler(({ data }) => getManagedHubItemDetail(data.panel, data.hubId, data.itemCode));