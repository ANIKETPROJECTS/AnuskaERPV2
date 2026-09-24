import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createProcurementOrder,
  createProcurementItemRequest,
  createVendor,
  deleteOrArchiveVendor,
  getProcurementData,
  getProcurementOrder,
  updateProcurementOrderStatus,
  updateVendor,
  updateProcurementItemRequest,
} from "./procurement.server";
import type { Panel } from "./auth.server";

const vendorFields = {
  name: z.string().min(2).max(120),
  contactName: z.string().max(120),
  phone: z.string().max(40),
  email: z.string().max(160),
  address: z.string().max(240),
  city: z.string().max(80),
  state: z.string().max(80),
  pincode: z.string().max(20),
  paymentTerms: z.string().max(120),
  categories: z.array(z.string().max(80)).max(20),
  notes: z.string().max(500),
};

const vendorSchema = z.object(vendorFields);
const vendorUpdateSchema = vendorSchema.extend({ id: z.string().min(1), panel: z.enum(["admin", "subhub", "procurement"]) });
const panelSchema = z.object({ panel: z.enum(["admin", "subhub", "procurement"]) });
const orderSchema = z.object({
  vendorId: z.string().optional(),
  newVendor: z.object({
    name: z.string().min(2).max(120),
    contactName: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    email: z.string().max(160).optional(),
    address: z.string().max(240).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    pincode: z.string().max(20).optional(),
    paymentTerms: z.string().max(120).optional(),
    categories: z.array(z.string().max(80)).max(20).optional(),
    notes: z.string().max(500).optional(),
  }).optional(),
  materialCode: z.string().min(1).optional(),
  materialName: z.string().max(160).optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().finite().nonnegative().optional(),
  items: z.array(z.object({
    materialCode: z.string().min(1),
    materialName: z.string().max(160).optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().finite().nonnegative().optional(),
  })).min(1).max(40).optional(),
  orderDate: z.string().min(10),
  expectedDelivery: z.string().min(10),
  notes: z.string().max(500),
  subhubUserId: z.string().optional(),
  panel: z.enum(["admin", "subhub", "procurement"]),
});
const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["Order placed", "Payment done", "Dispatch done", "Delivery done"]),
  panel: z.enum(["admin", "subhub", "procurement"]),
});
const idSchema = z.object({ id: z.string().min(1) });
const itemRequestSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  quantity: z.number().int().positive(),
  notes: z.string().max(500),
});
const requestStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["Approved", "Declined"]),
  response: z.string().max(500),
  panel: z.enum(["admin", "procurement"]),
});

export const getProcurementDataFn = createServerFn({ method: "GET" })
  .validator(z.object({ panel: z.enum(["admin", "subhub", "procurement"]).optional() }))
  .handler(({ data }) => getProcurementData(data.panel));
export const getProcurementManagementDataFn = createServerFn({ method: "GET" })
  .handler(() => getProcurementData("procurement"));
export const createVendorFn = createServerFn({ method: "POST" })
  .validator(vendorSchema.extend({ panel: z.enum(["admin", "procurement"]) }))
  .handler(({ data }) => createVendor(data, data.panel));
export const updateVendorFn = createServerFn({ method: "POST" }).validator(vendorUpdateSchema).handler(({ data }) => updateVendor(data, data.panel));
export const deleteOrArchiveVendorFn = createServerFn({ method: "POST" })
  .validator(idSchema.extend({ panel: z.enum(["admin", "procurement"]) }))
  .handler(({ data }) => deleteOrArchiveVendor(data.id, data.panel));
export const createProcurementOrderFn = createServerFn({ method: "POST" }).validator(orderSchema).handler(({ data }) => createProcurementOrder(data, data.panel));
export const updateProcurementOrderStatusFn = createServerFn({ method: "POST" }).validator(statusSchema).handler(({ data }) => updateProcurementOrderStatus(data, data.panel));
export const getProcurementOrderFn = createServerFn({ method: "POST" })
  .validator(idSchema.extend({ panel: z.enum(["admin", "subhub", "procurement"]) }))
  .handler(({ data }) => getProcurementOrder(data.id, data.panel));
export const createProcurementItemRequestFn = createServerFn({ method: "POST" })
  .validator(itemRequestSchema)
  .handler(({ data }) => createProcurementItemRequest(data));
export const updateProcurementItemRequestFn = createServerFn({ method: "POST" })
  .validator(requestStatusSchema)
  .handler(({ data }) => updateProcurementItemRequest(data, data.panel as Panel));