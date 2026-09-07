import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createProcurementOrder,
  createVendor,
  deleteOrArchiveVendor,
  getProcurementData,
  getProcurementOrder,
  updateProcurementOrderStatus,
  updateVendor,
} from "./procurement.server";

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
const vendorUpdateSchema = vendorSchema.extend({ id: z.string().min(1) });
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
  materialCode: z.string().min(1),
  materialName: z.string().max(160).optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().finite().nonnegative().optional(),
  orderDate: z.string().min(10),
  expectedDelivery: z.string().min(10),
  notes: z.string().max(500),
  subhubUserId: z.string().optional(),
});
const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["Order placed", "Payment done", "Dispatch done", "Delivery done"]),
});
const idSchema = z.object({ id: z.string().min(1) });

export const getProcurementDataFn = createServerFn({ method: "GET" }).handler(() => getProcurementData());
export const createVendorFn = createServerFn({ method: "POST" }).validator(vendorSchema).handler(({ data }) => createVendor(data));
export const updateVendorFn = createServerFn({ method: "POST" }).validator(vendorUpdateSchema).handler(({ data }) => updateVendor(data));
export const deleteOrArchiveVendorFn = createServerFn({ method: "POST" }).validator(idSchema).handler(({ data }) => deleteOrArchiveVendor(data.id));
export const createProcurementOrderFn = createServerFn({ method: "POST" }).validator(orderSchema).handler(({ data }) => createProcurementOrder(data));
export const updateProcurementOrderStatusFn = createServerFn({ method: "POST" }).validator(statusSchema).handler(({ data }) => updateProcurementOrderStatus(data));
export const getProcurementOrderFn = createServerFn({ method: "POST" }).validator(idSchema).handler(({ data }) => getProcurementOrder(data.id));