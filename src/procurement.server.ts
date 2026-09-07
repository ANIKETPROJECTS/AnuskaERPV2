import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { getCurrentUserRecord, getControlPlaneDatabase } from "./auth.server";
import { subparts } from "./lib/erp-data";
import { MISCELLANEOUS_VENDOR_ID, ONE_OFF_MATERIAL_CODE, PROCUREMENT_STATUSES, type ProcurementStatus } from "./lib/procurement-types";

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

type ProcurementOrderDocument = {
  _id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  subhubUserId: string;
  subhubName: string;
  materialCode: string;
  materialName: string;
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
  return {
    id: document._id,
    orderNumber: document.orderNumber,
    vendorId: document.vendorId,
    vendorName: document.vendorName,
    subhubUserId: document.subhubUserId,
    subhubName: document.subhubName,
    materialCode: document.materialCode,
    materialName: document.materialName,
    quantity: document.quantity,
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

function emptyData(): ProcurementData {
  return {
    vendors: [],
    orders: [],
    subhubs: [],
    vendorPerformance: [],
    subhubSummary: [],
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

function currentUserRequired(user: Awaited<ReturnType<typeof getCurrentUserRecord>>, panel: "admin" | "subhub") {
  if (!user || user.panel !== panel || !user.active) {
    throw new Error(panel === "admin" ? "Only Admin Panel users can access Procurement." : "Only SubHub Managers can access Procurement.");
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
    row.totalQuantity += order.quantity;
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

export async function getProcurementData(): Promise<
  { ok: true; data: ProcurementData } | { ok: false; data: ProcurementData; message: string }
> {
  try {
    const requestedPanel = "admin";
    const admin = await getCurrentUserRecord(requestedPanel);
    const subhub = admin ? null : await getCurrentUserRecord("subhub");
    const user = admin ?? subhub;
    if (!user) return { ok: false, data: emptyData(), message: "Sign in to view Procurement." };
    const panel = admin ? "admin" : "subhub";
    currentUserRequired(user, panel);
    const db = await getProcurementDb();
    const [vendorDocuments, orderDocuments, subhubDocuments] = await Promise.all([
      db.collection<VendorDocument>("procurement_vendors").find(panel === "admin" ? {} : { status: "active" }).sort({ name: 1 }).toArray(),
      db.collection<ProcurementOrderDocument>("procurement_orders")
        .find(panel === "admin" ? {} : { subhubUserId: user._id })
        .sort({ orderDate: -1, createdAt: -1 })
        .toArray(),
      panel === "admin"
        ? db.collection<{ _id: string; name: string; subhubName?: string; panel: string; role: string; active: boolean }>("users")
            .find({ panel: "subhub", role: "subhub", active: true })
            .sort({ subhubName: 1, name: 1 })
            .toArray()
        : Promise.resolve([]),
    ]);
    const vendors = vendorDocuments.map(toVendor);
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

export async function createVendor(input: VendorInput): Promise<{ ok: true; vendor: ProcurementVendor } | { ok: false; message: string }> {
  try {
    const user = await getCurrentUserRecord("admin");
    const subhub = user ? null : await getCurrentUserRecord("subhub");
    const current = currentUserRequired(user ?? subhub, user ? "admin" : "subhub");
    const db = await getProcurementDb();
    return { ok: true, vendor: await createVendorRecord(db, current._id, input) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Vendor could not be created." };
  }
}

export async function updateVendor(input: VendorInput & { id: string }): Promise<{ ok: true; vendor: ProcurementVendor } | { ok: false; message: string }> {
  try {
    const user = currentUserRequired(await getCurrentUserRecord("admin"), "admin");
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

export async function deleteOrArchiveVendor(id: string): Promise<{ ok: true; action: "deleted" | "archived" } | { ok: false; message: string }> {
  try {
    const user = currentUserRequired(await getCurrentUserRecord("admin"), "admin");
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
  materialCode: string;
  materialName?: string | undefined;
  quantity: number;
  unitPrice?: number | undefined;
  orderDate: string;
  expectedDelivery: string;
  notes: string;
  subhubUserId?: string | undefined;
}): Promise<{ ok: true; order: ProcurementOrder; vendor?: ProcurementVendor } | { ok: false; message: string }> {
  try {
    const admin = await getCurrentUserRecord("admin");
    const subhub = admin ? null : await getCurrentUserRecord("subhub");
    const user = currentUserRequired(admin ?? subhub, admin ? "admin" : "subhub");
    const orderDate = parseDate(input.orderDate);
    const expectedDelivery = parseDate(input.expectedDelivery);
    if (!orderDate || !expectedDelivery) return { ok: false, message: "Enter valid order and expected delivery dates." };
    if (expectedDelivery < orderDate) return { ok: false, message: "Expected delivery cannot be before the order date." };
    const catalogMaterial = subparts.find((part) => part.code === input.materialCode);
    const customMaterialName = clean(input.materialName);
    const material = catalogMaterial ?? (customMaterialName
      ? {
          code: input.materialCode === ONE_OFF_MATERIAL_CODE
            ? `MISC-${customMaterialName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 38)}-${randomUUID().slice(0, 6).toUpperCase()}`
            : input.materialCode,
          name: customMaterialName,
        }
      : null);
    if (!material) return { ok: false, message: "Select a raw material or enter a one-off material name." };
    if (!Number.isInteger(input.quantity) || input.quantity < 1) return { ok: false, message: "Quantity must be a whole number greater than zero." };
    if (subparts.some((part) => part.code === input.materialCode) && input.unitPrice === undefined) return { ok: false, message: "Enter a unit price for catalog materials." };
    const unitPrice = input.unitPrice ?? 0;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, message: "Unit price cannot be negative." };
    const db = await getProcurementDb();
    let destinationUserId = user._id;
    let destinationName = user.panel === "subhub" ? user.subhubName ?? user.name : "Admin procurement";
    if (user.panel === "admin") {
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
      materialCode: material.code,
      materialName: material.name,
      quantity: input.quantity,
       unitPrice: Math.round(unitPrice * 100) / 100,
       totalAmount: Math.round(input.quantity * unitPrice * 100) / 100,
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
}): Promise<{ ok: true; order: ProcurementOrder } | { ok: false; message: string }> {
  try {
    const admin = await getCurrentUserRecord("admin");
    const subhub = admin ? null : await getCurrentUserRecord("subhub");
    const user = currentUserRequired(admin ?? subhub, admin ? "admin" : "subhub");
    const db = await getProcurementDb();
    const order = await db.collection<ProcurementOrderDocument>("procurement_orders").findOne(
      admin ? { _id: input.id } : { _id: input.id, subhubUserId: user._id },
    );
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

export async function getProcurementOrder(id: string): Promise<
  { ok: true; order: ProcurementOrder } | { ok: false; message: string }
> {
  try {
    const admin = await getCurrentUserRecord("admin");
    const subhub = admin ? null : await getCurrentUserRecord("subhub");
    const user = currentUserRequired(admin ?? subhub, admin ? "admin" : "subhub");
    const db = await getProcurementDb();
    const order = await db.collection<ProcurementOrderDocument>("procurement_orders").findOne(
      admin ? { _id: id } : { _id: id, subhubUserId: user._id },
    );
    return order ? { ok: true, order: toOrder(order) } : { ok: false, message: "Procurement order not found." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Procurement order could not be loaded." };
  }
}