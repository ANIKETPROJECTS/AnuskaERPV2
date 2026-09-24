import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { getCurrentUserRecord, getControlPlaneDatabase, type Panel, type UserDocument } from "./auth.server";
import { bomCatalog } from "./lib/bom-catalog";
import { subparts } from "./lib/erp-data";
import { MISCELLANEOUS_VENDOR_ID, ONE_OFF_MATERIAL_CODE, PROCUREMENT_STATUSES, type ProcurementStatus } from "./lib/procurement-types";
import { getMongoDb } from "./mongodb.server";

export { PROCUREMENT_STATUSES };
export type { ProcurementStatus };

type VendorDocument = {
  _id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentTerms: string;
  categories: string[];
  status: "active" | "archived";
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

type StatusHistoryDocument = {
  status: ProcurementStatus;
  changedAt: Date;
  changedBy: string;
  changedByName: string;
};

type ProcurementLineDocument = {
  lineId?: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

type ProcurementOrderDocument = {
  _id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  subhubUserId: string;
  subhubName: string;
  materialCode: string;
  materialName: string;
  items?: ProcurementLineDocument[];
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  orderDate: Date;
  expectedDelivery: Date;
  notes: string;
  status: ProcurementStatus;
  statusHistory: StatusHistoryDocument[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

type ItemRequestDocument = {
  _id: string;
  subhubUserId: string;
  subhubName: string;
  itemName: string;
  quantity: number;
  notes: string;
  status: "Pending" | "Approved" | "Declined";
  response: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProcurementVendor = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentTerms: string;
  categories: string[];
  status: "active" | "archived";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ProcurementOrder = {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  subhubUserId: string;
  subhubName: string;
  materialCode: string;
  materialName: string;
  items: ProcurementLineDocument[];
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  orderDate: string;
  expectedDelivery: string;
  notes: string;
  status: ProcurementStatus;
  statusHistory: Array<{
    status: ProcurementStatus;
    changedAt: string;
    changedBy: string;
    changedByName: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type HubMaterialNeed = {
  subhubUserId: string;
  subhubName: string;
  itemCode: string;
  itemName: string;
  remainingTargetUnits: number;
  requiredQuantity: number;
  stockQuantity: number;
  onOrderQuantity: number;
  shortageQuantity: number;
};

export type ProcurementItemRequest = {
  id: string;
  subhubUserId: string;
  subhubName: string;
  itemName: string;
  quantity: number;
  notes: string;
  status: "Pending" | "Approved" | "Declined";
  response: string;
  createdAt: string;
  updatedAt: string;
};

export type VendorPerformance = {
  vendorId: string;
  vendorName: string;
  orders: number;
  totalQuantity: number;
  spend: number;
  pendingOrders: number;
  completedOrders: number;
  onTimeRate: number | null;
};

export type SubhubProcurementSummary = {
  subhubName: string;
  orders: number;
  quantity: number;
  spend: number;
  pendingOrders: number;
  completedOrders: number;
};

export type ProcurementData = {
  vendors: ProcurementVendor[];
  orders: ProcurementOrder[];
  subhubs: Array<{ id: string; name: string }>;
  vendorPerformance: VendorPerformance[];
  subhubSummary: SubhubProcurementSummary[];
  materialNeeds: HubMaterialNeed[];
  itemRequests: ProcurementItemRequest[];
  summary: {
    vendorCount: number;
    openOrders: number;
    unitsOnOrder: number;
    committedSpend: number;
    completedOrders: number;
    pendingOrders: number;
    onTimeRate: number | null;
  };
};

type VendorInput = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentTerms: string;
  categories: string[];
  notes: string;
};

type NewVendorInput = {
  name: string;
  contactName?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
  paymentTerms?: string | undefined;
  categories?: string[] | undefined;
  notes?: string | undefined;
};

let indexesPromise: Promise<void> | undefined;

async function getProcurementDb(): Promise<Db> {
  const db = await getControlPlaneDatabase();
  indexesPromise ??= Promise.all([
    db.collection<VendorDocument>("procurement_vendors").createIndex({ name: 1 }),
    db.collection<VendorDocument>("procurement_vendors").createIndex({ status: 1, updatedAt: -1 }),
    db.collection<ProcurementOrderDocument>("procurement_orders").createIndex({ subhubUserId: 1, orderDate: -1 }),
    db.collection<ProcurementOrderDocument>("procurement_orders").createIndex({ vendorId: 1, orderDate: -1 }),
    db.collection<ProcurementOrderDocument>("procurement_orders").createIndex({ status: 1, expectedDelivery: 1 }),
    db.collection<ItemRequestDocument>("procurement_item_requests").createIndex({ subhubUserId: 1, createdAt: -1 }),
    db.collection<ItemRequestDocument>("procurement_item_requests").createIndex({ status: 1, createdAt: -1 }),
  ]).then(() => undefined);
  await indexesPromise;
  return db;
}

function clean(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeEmail(value: string | undefined): string {
  return clean(value).toLowerCase();
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toVendor(document: VendorDocument): ProcurementVendor {
  return {
    id: document._id,
    name: document.name,
    contactName: document.contactName,
    phone: document.phone,
    email: document.email,
    address: document.address,
    city: document.city,
    state: document.state,
    pincode: document.pincode,
    paymentTerms: document.paymentTerms,
    categories: document.categories,
    status: document.status,
    notes: document.notes,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toOrder(document: ProcurementOrderDocument): ProcurementOrder {
  const items = document.items?.length
    ? document.items
    : [{ materialCode: document.materialCode, materialName: document.materialName, quantity: document.quantity, unitPrice: document.unitPrice, totalAmount: document.totalAmount }];
  return {
    id: document._id,
    orderNumber: document.orderNumber,
    vendorId: document.vendorId,
    vendorName: document.vendorName,
    subhubUserId: document.subhubUserId,
    subhubName: document.subhubName,
    materialCode: document.materialCode,
    materialName: document.materialName,
    items,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    unitPrice: document.unitPrice,
    totalAmount: document.totalAmount,
    orderDate: dateOnly(document.orderDate),
    expectedDelivery: dateOnly(document.expectedDelivery),
    notes: document.notes,
    status: document.status,
    statusHistory: document.statusHistory.map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt.toISOString(),
      changedBy: entry.changedBy,
      changedByName: entry.changedByName,
    })),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toItemRequest(document: ItemRequestDocument): ProcurementItemRequest {
  return {
    id: document._id,
    subhubUserId: document.subhubUserId,
    subhubName: document.subhubName,
    itemName: document.itemName,
    quantity: document.quantity,
    notes: document.notes,
    status: document.status,
    response: document.response,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function emptyData(): ProcurementData {
  return {
    vendors: [],
    orders: [],
    subhubs: [],
    vendorPerformance: [],
    subhubSummary: [],
    materialNeeds: [],
    itemRequests: [],
    summary: {
      vendorCount: 0,
      openOrders: 0,
      unitsOnOrder: 0,
      committedSpend: 0,
      completedOrders: 0,
      pendingOrders: 0,
      onTimeRate: null,
    },
  };
}

function currentUserRequired(user: Awaited<ReturnType<typeof getCurrentUserRecord>>, panel: Panel) {
  if (!user || user.panel !== panel || !user.active) {
    throw new Error(panel === "admin" ? "Only Admin Panel users can access Procurement." : panel === "subhub" ? "Only SubHub Managers can access Procurement." : "Only Procurement Management users can access this workspace.");
  }
  return user;
}

function calculatePerformance(orders: ProcurementOrder[]): VendorPerformance[] {
  const byVendor = new Map<string, VendorPerformance>();
  for (const order of orders) {
    const row = byVendor.get(order.vendorId) ?? {
      vendorId: order.vendorId,
      vendorName: order.vendorName,
      orders: 0,
      totalQuantity: 0,
      spend: 0,
      pendingOrders: 0,
      completedOrders: 0,
      onTimeRate: null,
    };
    row.orders += 1;
    row.totalQuantity += order.items.reduce((sum, item) => sum + item.quantity, 0);
    row.spend += order.totalAmount;
    if (order.status === "Delivery done") row.completedOrders += 1;
    else row.pendingOrders += 1;
    byVendor.set(order.vendorId, row);
  }

  return [...byVendor.values()].map((row) => {
    const vendorOrders = orders.filter((order) => order.vendorId === row.vendorId && order.status === "Delivery done");
    const onTime = vendorOrders.filter((order) => {
      const delivered = order.statusHistory.find((entry) => entry.status === "Delivery done");
      return delivered ? dateOnly(new Date(delivered.changedAt)) <= order.expectedDelivery : false;
    }).length;
    return { ...row, onTimeRate: vendorOrders.length ? Math.round((onTime / vendorOrders.length) * 100) : null };
  }).sort((a, b) => b.spend - a.spend);
}

function orderItems(order: ProcurementOrderDocument): ProcurementLineDocument[] {
  return order.items?.length
    ? order.items
    : [{ materialCode: order.materialCode, materialName: order.materialName, quantity: order.quantity, unitPrice: order.unitPrice, totalAmount: order.totalAmount }];
}

async function calculateHubMaterialNeeds(
  db: Db,
  subhubs: UserDocument[],
  procurementOrders: ProcurementOrderDocument[],
): Promise<HubMaterialNeed[]> {
  if (!subhubs.length) return [];
  const productionOrders = await db.collection<{
    _id: string;
    subhubUserId: string;
    productCode: string;
    variantCode: string;
    target: number;
  }>("production_orders").find({ subhubUserId: { $in: subhubs.map((hub) => hub._id) } }).toArray();
  const needs = new Map<string, HubMaterialNeed>();
  const onOrder = new Map<string, number>();

  for (const order of procurementOrders) {
    if (order.status === "Delivery done") continue;
    for (const item of orderItems(order)) {
      const key = `${order.subhubUserId}:${item.materialCode}`;
      onOrder.set(key, (onOrder.get(key) ?? 0) + item.quantity);
    }
  }

  await Promise.all(subhubs.map(async (hub) => {
    const hubOrders = productionOrders.filter((order) => order.subhubUserId === hub._id);
    if (!hubOrders.length) return;
    const workspace = await getMongoDb(hub.databaseName);
    const orderIds = hubOrders.map((order) => order._id);
    const [reports, inventory] = await Promise.all([
      workspace.collection<{ orderId: string; quantity: number }>("production_reports")
        .find({ orderId: { $in: orderIds } }).toArray(),
      workspace.collection<{ _id: string; quantity: number }>("inventory_items").find().toArray(),
    ]);
    const producedByOrder = new Map<string, number>();
    for (const report of reports) producedByOrder.set(report.orderId, (producedByOrder.get(report.orderId) ?? 0) + report.quantity);
    const stockByCode = new Map(inventory.map((item) => [item._id, item.quantity]));

    for (const order of hubOrders) {
      const remaining = Math.max(0, order.target - (producedByOrder.get(order._id) ?? 0));
      if (!remaining) continue;
      const variant = bomCatalog.find((product) => product.code === order.productCode)?.variants.find((item) => item.code === order.variantCode);
      if (!variant) continue;
      for (const [itemCode, unitsPerProduct] of Object.entries(variant.parts)) {
        const key = `${hub._id}:${itemCode}`;
        const existing = needs.get(key);
        const item = subparts.find((part) => part.code === itemCode);
        needs.set(key, {
          subhubUserId: hub._id,
          subhubName: hub.subhubName ? `${hub.subhubName} · ${hub.name}` : hub.name,
          itemCode,
          itemName: item?.name ?? itemCode,
          remainingTargetUnits: (existing?.remainingTargetUnits ?? 0) + remaining,
          requiredQuantity: (existing?.requiredQuantity ?? 0) + remaining * unitsPerProduct,
          stockQuantity: stockByCode.get(itemCode) ?? 0,
          onOrderQuantity: onOrder.get(key) ?? 0,
          shortageQuantity: 0,
        });
      }
    }
  }));

  return [...needs.values()]
    .map((need) => ({
      ...need,
      shortageQuantity: Math.max(0, need.requiredQuantity - need.stockQuantity - need.onOrderQuantity),
    }))
    .sort((left, right) => left.subhubName.localeCompare(right.subhubName) || right.shortageQuantity - left.shortageQuantity || left.itemName.localeCompare(right.itemName));
}

export async function getProcurementData(requestedPanel?: Panel): Promise<
  { ok: true; data: ProcurementData } | { ok: false; data: ProcurementData; message: string }
> {
  try {
    const admin = requestedPanel ? null : await getCurrentUserRecord("admin");
    const subhub = requestedPanel ? null : admin ? null : await getCurrentUserRecord("subhub");
    const procurementManager = requestedPanel ? null : admin || subhub ? null : await getCurrentUserRecord("procurement");
    const panel: Panel = requestedPanel ?? (admin ? "admin" : subhub ? "subhub" : "procurement");
    const user = requestedPanel ? await getCurrentUserRecord(requestedPanel) : admin ?? subhub ?? procurementManager;
    if (!user) return { ok: false, data: emptyData(), message: "Sign in to view Procurement." };
    currentUserRequired(user, panel);
    const db = await getProcurementDb();
    const [vendorDocuments, orderDocuments, subhubDocuments] = await Promise.all([
      db.collection<VendorDocument>("procurement_vendors").find(panel === "subhub" ? { status: "active" } : {}).sort({ name: 1 }).toArray(),
      db.collection<ProcurementOrderDocument>("procurement_orders")
        .find(panel === "subhub" ? { subhubUserId: user._id } : {})
        .sort({ orderDate: -1, createdAt: -1 })
        .toArray(),
      panel !== "subhub"
        ? db.collection<UserDocument>("users")
            .find({ panel: "subhub", role: "subhub", active: true })
            .sort({ subhubName: 1, name: 1 })
            .toArray()
        : Promise.resolve([]),
    ]);
    const itemRequestDocuments = await db.collection<ItemRequestDocument>("procurement_item_requests")
      .find(panel === "subhub" ? { subhubUserId: user._id } : {})
      .sort({ createdAt: -1 })
      .toArray();
    const vendors = panel === "subhub" ? [] : vendorDocuments.map(toVendor);
    const orders = orderDocuments.map(toOrder);
    const completedOrders = orders.filter((order) => order.status === "Delivery done");
    const pendingOrders = orders.length - completedOrders.length;
    const deliveredOnTime = completedOrders.filter((order) => {
      const delivered = order.statusHistory.find((entry) => entry.status === "Delivery done");
      return delivered ? dateOnly(new Date(delivered.changedAt)) <= order.expectedDelivery : false;
    }).length;
    const subhubMap = new Map<string, SubhubProcurementSummary>();
      for (const order of orders) {
      const row = subhubMap.get(order.subhubUserId) ?? {
        subhubName: order.subhubName,
        orders: 0,
        quantity: 0,
        spend: 0,
        pendingOrders: 0,
        completedOrders: 0,
      };
      row.orders += 1;
      row.quantity += order.quantity;
      row.spend += order.totalAmount;
      if (order.status === "Delivery done") row.completedOrders += 1;
      else row.pendingOrders += 1;
      subhubMap.set(order.subhubUserId, row);
    }
    return {
      ok: true,
      data: {
        vendors,
        orders,
        subhubs: subhubDocuments.map((subhub) => ({ id: subhub._id, name: subhub.subhubName ? `${subhub.subhubName} · ${subhub.name}` : subhub.name })),
        vendorPerformance: calculatePerformance(orders),
        subhubSummary: [...subhubMap.values()].sort((a, b) => b.spend - a.spend),
        materialNeeds: panel === "subhub" ? [] : await calculateHubMaterialNeeds(db, subhubDocuments as UserDocument[], orderDocuments),
        itemRequests: itemRequestDocuments.map(toItemRequest),
        summary: {
          vendorCount: vendors.filter((vendor) => vendor.status === "active").length,
          openOrders: pendingOrders,
          unitsOnOrder: orders.filter((order) => order.status !== "Delivery done").reduce((sum, order) => sum + order.quantity, 0),
          committedSpend: orders.filter((order) => order.status !== "Delivery done").reduce((sum, order) => sum + order.totalAmount, 0),
          completedOrders: completedOrders.length,
          pendingOrders,
          onTimeRate: completedOrders.length ? Math.round((deliveredOnTime / completedOrders.length) * 100) : null,
        },
      },
    };
  } catch (error) {
    return { ok: false, data: emptyData(), message: error instanceof Error ? error.message : "Procurement data could not be loaded." };
  }
}

export async function createProcurementItemRequest(input: {
  itemName: string;
  quantity: number;
  notes: string;
}): Promise<{ ok: true; request: ProcurementItemRequest } | { ok: false; message: string }> {
  try {
    const user = currentUserRequired(await getCurrentUserRecord("subhub"), "subhub");
    const itemName = clean(input.itemName);
    if (itemName.length < 2) return { ok: false, message: "Enter an item name." };
    if (!Number.isInteger(input.quantity) || input.quantity < 1) return { ok: false, message: "Quantity must be a whole number greater than zero." };
    const db = await getProcurementDb();
    const now = new Date();
    const request: ItemRequestDocument = {
      _id: randomUUID().replace(/-/g, ""),
      subhubUserId: user._id,
      subhubName: user.subhubName ?? user.name,
      itemName,
      quantity: input.quantity,
      notes: clean(input.notes),
      status: "Pending",
      response: "",
      createdAt: now,
      updatedAt: now,
    };
    await db.collection<ItemRequestDocument>("procurement_item_requests").insertOne(request);
    return { ok: true, request: toItemRequest(request) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The item request could not be sent." };
  }
}

export async function updateProcurementItemRequest(input: {
  id: string;
  status: "Approved" | "Declined";
  response: string;
}, panel: Panel): Promise<{ ok: true; request: ProcurementItemRequest } | { ok: false; message: string }> {
  try {
    if (panel === "subhub") return { ok: false, message: "Only Procurement Management or Master Admin can review item requests." };
    const user = currentUserRequired(await getCurrentUserRecord(panel), panel);
    const db = await getProcurementDb();
    const existing = await db.collection<ItemRequestDocument>("procurement_item_requests").findOne({ _id: input.id });
    if (!existing) return { ok: false, message: "Item request not found." };
    const updated: ItemRequestDocument = {
      ...existing,
      status: input.status,
      response: clean(input.response),
      updatedAt: new Date(),
    };
    await db.collection<ItemRequestDocument>("procurement_item_requests").replaceOne({ _id: input.id }, updated);
    return { ok: true, request: toItemRequest(updated) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The item request could not be updated." };
  }
}

async function createVendorRecord(db: Db, userId: string, input: VendorInput | NewVendorInput): Promise<ProcurementVendor> {
  const name = clean(input.name);
  if (name.length < 2) throw new Error("Vendor name must be at least 2 characters.");
  const now = new Date();
  const document: VendorDocument = {
    _id: randomUUID().replace(/-/g, ""),
    name,
    contactName: clean(input.contactName),
    phone: clean(input.phone),
    email: normalizeEmail(input.email),
    address: clean(input.address),
    city: clean(input.city),
    state: clean(input.state),
    pincode: clean(input.pincode),
    paymentTerms: clean(input.paymentTerms) || "Not specified",
    categories: (input.categories ?? []).map(clean).filter(Boolean),
    status: "active",
    notes: clean(input.notes),
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };
  const duplicate = await db.collection<VendorDocument>("procurement_vendors").findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    status: "active",
  });
  if (duplicate) throw new Error("An active vendor with this name already exists.");
  await db.collection<VendorDocument>("procurement_vendors").insertOne(document);
  return toVendor(document);
}

export async function createVendor(input: VendorInput, panel: Panel): Promise<{ ok: true; vendor: ProcurementVendor } | { ok: false; message: string }> {
  try {
    if (panel === "subhub") return { ok: false, message: "SubHub users cannot manage vendors." };
    const current = currentUserRequired(await getCurrentUserRecord(panel), panel);
    const db = await getProcurementDb();
    return { ok: true, vendor: await createVendorRecord(db, current._id, input) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Vendor could not be created." };
  }
}

export async function updateVendor(input: VendorInput & { id: string }, panel: Panel): Promise<{ ok: true; vendor: ProcurementVendor } | { ok: false; message: string }> {
  try {
    if (panel === "subhub") return { ok: false, message: "SubHub users cannot manage vendors." };
    const user = currentUserRequired(await getCurrentUserRecord(panel), panel);
    const db = await getProcurementDb();
    const existing = await db.collection<VendorDocument>("procurement_vendors").findOne({ _id: input.id });
    if (!existing) return { ok: false, message: "Vendor not found." };
    const name = clean(input.name);
    if (name.length < 2) return { ok: false, message: "Vendor name must be at least 2 characters." };
    const duplicate = await db.collection<VendorDocument>("procurement_vendors").findOne({
      _id: { $ne: input.id },
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      status: "active",
    });
    if (duplicate) return { ok: false, message: "An active vendor with this name already exists." };
    const updated: VendorDocument = {
      ...existing,
      name,
      contactName: clean(input.contactName),
      phone: clean(input.phone),
      email: normalizeEmail(input.email),
      address: clean(input.address),
      city: clean(input.city),
      state: clean(input.state),
      pincode: clean(input.pincode),
      paymentTerms: clean(input.paymentTerms) || "Not specified",
      categories: input.categories.map(clean).filter(Boolean),
      notes: clean(input.notes),
      updatedAt: new Date(),
      updatedBy: user._id,
    };
    await db.collection<VendorDocument>("procurement_vendors").replaceOne({ _id: input.id }, updated);
    return { ok: true, vendor: toVendor(updated) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Vendor could not be updated." };
  }
}

export async function deleteOrArchiveVendor(id: string, panel: Panel): Promise<{ ok: true; action: "deleted" | "archived" } | { ok: false; message: string }> {
  try {
    if (panel === "subhub") return { ok: false, message: "SubHub users cannot manage vendors." };
    const user = currentUserRequired(await getCurrentUserRecord(panel), panel);
    const db = await getProcurementDb();
    const vendor = await db.collection<VendorDocument>("procurement_vendors").findOne({ _id: id });
    if (!vendor) return { ok: false, message: "Vendor not found." };
    const orderCount = await db.collection<ProcurementOrderDocument>("procurement_orders").countDocuments({ vendorId: id });
    if (orderCount > 0) {
      await db.collection<VendorDocument>("procurement_vendors").updateOne(
        { _id: id },
        { $set: { status: "archived", updatedAt: new Date(), updatedBy: user._id } },
      );
      return { ok: true, action: "archived" };
    }
    await db.collection<VendorDocument>("procurement_vendors").deleteOne({ _id: id });
    return { ok: true, action: "deleted" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Vendor could not be removed." };
  }
}

export async function createProcurementOrder(input: {
  vendorId?: string | undefined;
  newVendor?: NewVendorInput | undefined;
  materialCode?: string | undefined;
  materialName?: string | undefined;
  quantity?: number | undefined;
  unitPrice?: number | undefined;
  items?: Array<{ materialCode: string; materialName?: string | undefined; quantity: number; unitPrice?: number | undefined }> | undefined;
  orderDate: string;
  expectedDelivery: string;
  notes: string;
  subhubUserId?: string | undefined;
}, panel: Panel): Promise<{ ok: true; order: ProcurementOrder; vendor?: ProcurementVendor } | { ok: false; message: string }> {
  try {
    if (panel === "subhub") return { ok: false, message: "SubHub users can only view assigned procurement and submit item requests." };
    const user = currentUserRequired(await getCurrentUserRecord(panel), panel);
    const orderDate = parseDate(input.orderDate);
    const expectedDelivery = parseDate(input.expectedDelivery);
    if (!orderDate || !expectedDelivery) return { ok: false, message: "Enter valid order and expected delivery dates." };
    if (expectedDelivery < orderDate) return { ok: false, message: "Expected delivery cannot be before the order date." };
    const requestedLines = input.items?.length
      ? input.items
      : input.materialCode && input.quantity !== undefined
        ? [{ materialCode: input.materialCode, materialName: input.materialName, quantity: input.quantity, unitPrice: input.unitPrice }]
        : [];
    if (!requestedLines.length) return { ok: false, message: "Add at least one raw material to this procurement order." };
    if (requestedLines.length > 40) return { ok: false, message: "A procurement order can contain up to 40 material lines." };
    const materialLines: ProcurementLineDocument[] = [];
    for (const line of requestedLines) {
      const catalogMaterial = subparts.find((part) => part.code === line.materialCode);
      const customMaterialName = clean(line.materialName);
      const material = catalogMaterial ?? (customMaterialName
        ? {
            code: line.materialCode === ONE_OFF_MATERIAL_CODE
              ? `MISC-${customMaterialName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 38)}-${randomUUID().slice(0, 6).toUpperCase()}`
              : line.materialCode,
            name: customMaterialName,
          }
        : null);
      if (!material) return { ok: false, message: "Select a raw material or enter a name for every one-off item." };
      if (!Number.isInteger(line.quantity) || line.quantity < 1) return { ok: false, message: `Enter a whole-number quantity for ${material.name}.` };
      if (catalogMaterial && line.unitPrice === undefined) return { ok: false, message: `Enter a unit price for ${material.name}.` };
      const unitPrice = line.unitPrice ?? 0;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, message: `Unit price for ${material.name} cannot be negative.` };
      materialLines.push({
        lineId: randomUUID().replace(/-/g, ""),
        materialCode: material.code,
        materialName: material.name,
        quantity: line.quantity,
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalAmount: Math.round(line.quantity * unitPrice * 100) / 100,
      });
    }
    const db = await getProcurementDb();
    let destinationUserId = user._id;
    let destinationName = "Admin procurement";
    if (user.panel !== "subhub") {
      if (!input.subhubUserId) return { ok: false, message: "Select the destination SubHub." };
      const destination = await db.collection<{ _id: string; name: string; subhubName?: string; panel: string; role: string; active: boolean }>("users").findOne({
        _id: input.subhubUserId,
        panel: "subhub",
        role: "subhub",
        active: true,
      });
      if (!destination) return { ok: false, message: "Select an active SubHub Manager." };
      destinationUserId = destination._id;
      destinationName = destination.subhubName ? `${destination.subhubName} · ${destination.name}` : destination.name;
    }
    let vendor: ProcurementVendor | undefined;
    if (input.vendorId === MISCELLANEOUS_VENDOR_ID) {
      const miscellaneousVendorName = clean(input.newVendor?.name);
      if (!miscellaneousVendorName) {
        vendor = {
          id: MISCELLANEOUS_VENDOR_ID,
          name: "Miscellaneous",
          contactName: "",
          phone: "",
          email: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
          paymentTerms: "",
          categories: ["Miscellaneous"],
          status: "active",
          notes: "",
          createdAt: "",
          updatedAt: "",
        };
      } else {
        const escapedName = miscellaneousVendorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existingVendor = await db.collection<VendorDocument>("procurement_vendors").findOne({
          name: { $regex: `^${escapedName}$`, $options: "i" },
          status: "active",
        });
        vendor = existingVendor
          ? toVendor(existingVendor)
          : await createVendorRecord(db, user._id, {
              ...input.newVendor,
              name: miscellaneousVendorName,
              categories: [...(input.newVendor?.categories ?? []), "Miscellaneous"],
            });
      }
    } else if (input.vendorId) {
      const vendorDocument = await db.collection<VendorDocument>("procurement_vendors").findOne({ _id: input.vendorId, status: "active" });
      if (!vendorDocument) return { ok: false, message: "Select an active vendor." };
      vendor = toVendor(vendorDocument);
    } else if (input.newVendor) {
      vendor = await createVendorRecord(db, user._id, input.newVendor);
    } else {
      return { ok: false, message: "Select a vendor or add a new vendor." };
    }
    const now = new Date();
    const statusHistory: StatusHistoryDocument[] = [{ status: "Order placed", changedAt: now, changedBy: user._id, changedByName: user.name }];
    const order: ProcurementOrderDocument = {
      _id: randomUUID().replace(/-/g, ""),
      orderNumber: `PO-${String(Date.now()).slice(-8)}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      subhubUserId: destinationUserId,
      subhubName: destinationName,
      materialCode: materialLines[0]!.materialCode,
      materialName: materialLines[0]!.materialName,
      items: materialLines,
      quantity: materialLines.reduce((sum, item) => sum + item.quantity, 0),
      unitPrice: materialLines[0]!.unitPrice,
      totalAmount: materialLines.reduce((sum, item) => sum + item.totalAmount, 0),
      orderDate,
      expectedDelivery,
      notes: clean(input.notes),
      status: "Order placed",
      statusHistory,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
    };
    await db.collection<ProcurementOrderDocument>("procurement_orders").insertOne(order);
    return input.newVendor
      ? { ok: true, order: toOrder(order), vendor }
      : { ok: true, order: toOrder(order) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Procurement order could not be created." };
  }
}

export async function updateProcurementOrderStatus(input: {
  id: string;
  status: ProcurementStatus;
}, panel: Panel): Promise<{ ok: true; order: ProcurementOrder } | { ok: false; message: string }> {
  try {
    if (panel === "subhub") return { ok: false, message: "SubHub users cannot change procurement order status." };
    const user = currentUserRequired(await getCurrentUserRecord(panel), panel);
    const db = await getProcurementDb();
    const order = await db.collection<ProcurementOrderDocument>("procurement_orders").findOne({ _id: input.id });
    if (!order) return { ok: false, message: "Order not found in your procurement workspace." };
    if (!PROCUREMENT_STATUSES.includes(input.status)) return { ok: false, message: "Select a valid procurement status." };
    if (order.status === input.status) return { ok: true, order: toOrder(order) };
    const now = new Date();
    const updated: ProcurementOrderDocument = {
      ...order,
      status: input.status,
      statusHistory: [...order.statusHistory, { status: input.status, changedAt: now, changedBy: user._id, changedByName: user.name }],
      updatedAt: now,
    };
    await db.collection<ProcurementOrderDocument>("procurement_orders").replaceOne({ _id: order._id }, updated);
    return { ok: true, order: toOrder(updated) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Order status could not be updated." };
  }
}

export async function getProcurementOrder(id: string, panel: Panel): Promise<
  { ok: true; order: ProcurementOrder } | { ok: false; message: string }
> {
  try {
    const user = currentUserRequired(await getCurrentUserRecord(panel), panel);
    const db = await getProcurementDb();
    const order = await db.collection<ProcurementOrderDocument>("procurement_orders").findOne(
      panel === "subhub" ? { _id: id, subhubUserId: user._id } : { _id: id },
    );
    return order ? { ok: true, order: toOrder(order) } : { ok: false, message: "Procurement order not found." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Procurement order could not be loaded." };
  }
}