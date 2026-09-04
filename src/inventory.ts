import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adjustSubhubInventory, getBatchDetail, getBatchOptions, getInventoryItemDetail, getMasterQualityManagement, getSubhubInventory, recordQualityIssues } from "./inventory.server";

const adjustmentSchema = z.object({
  code: z.string().min(1),
  action: z.enum(["add", "remove"]),
  quantity: z.number().int().positive(),
  reason: z.string().min(2).max(120),
  notes: z.string().max(500),
  batchId: z.string().min(1).optional(),
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

export const getSubhubInventoryFn = createServerFn({ method: "GET" }).handler(() => getSubhubInventory());
export const adjustSubhubInventoryFn = createServerFn({ method: "POST" }).validator(adjustmentSchema).handler(({ data }) => adjustSubhubInventory(data));
export const recordQualityIssuesFn = createServerFn({ method: "POST" }).validator(qualityBatchSchema).handler(({ data }) => recordQualityIssues(data.issues));
export const getMasterQualityManagementFn = createServerFn({ method: "GET" }).handler(() => getMasterQualityManagement());
export const getBatchDetailFn = createServerFn({ method: "POST" }).validator(batchIdSchema).handler(({ data }) => getBatchDetail(data.batchId));
export const getBatchOptionsFn = createServerFn({ method: "POST" }).validator(batchOptionsSchema).handler(({ data }) => getBatchOptions(data.code));
export const getInventoryItemDetailFn = createServerFn({ method: "POST" }).validator(itemCodeSchema).handler(({ data }) => getInventoryItemDetail(data.itemCode));