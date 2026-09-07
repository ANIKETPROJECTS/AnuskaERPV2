import { createHash, randomUUID } from "node:crypto";
import type { ClientSession } from "mongodb";
import { getControlPlaneDatabase, getCurrentUserRecord, type Panel, type UserDocument } from "./auth.server";
import { bomCatalog } from "./lib/bom-catalog";
import { getMongoClient, getMongoDb } from "./mongodb.server";
import {
  getProductionBatchAllocationPreview,
  getProductionBatchAllocationState,
  ensureLegacyBatches,
  syncWorkspaceInventoryForUser,
  reconcileProductionBatchAllocation,
  getWorkspaceInventorySnapshot,
  type ProductionManualAllocation,
  type ProductionAllocationPreview,
  type SubhubInventoryData,
} from "./inventory.server";
import { procurement, subparts } from "./lib/erp-data";

export type AssignableSubhub = {
  id: string;
  name: string;
  subhubName: string;
};

export type ProductionOrder = {
  id: string;
  orderNumber: string;
  subhubUserId: string;
  subhubName: string;
  productCode: string;
  productName: string;
  variantCode: string;
  variantName: string;
  target: number;
  dueDate: string;
  notes: string;
  produced: number;
  remaining: number;
  lastProductionDate: string | null;
  status: "Unstarted" | "In progress" | "Complete" | "Over target";
  createdAt: string;
};

export type ProductionReport = {
  id: string;
  orderId: string;
  date: string;
  quantity: number;
  notes: string;
  updatedAt: string;
  batchAllocation?: {
    allocationMode: "fifo" | "hybrid";
    manualAllocations: ProductionManualAllocation[];
    allocations: Array<{ itemCode: string; batchId: string; batchCode: string; quantity: number }>;
  };
};

export type ManagerProductionData = {
  subhubName: string;
  orders: ProductionOrder[];
  reports: ProductionReport[];
  capacityUnits: number | null;
  openUnits: number;
  availableUnits: number | null;
  overloaded: boolean;
};

export type HubSummary = {
  userId: string;
  name: string;
  subhubName: string;
  orderCount: number;
  capacityUnits: number | null;
  openUnits: number;
  availableUnits: number | null;
  overloaded: boolean;
  target: number;
  produced: number;
  remaining: number;
  completion: number;
  reportCount: number;
  stockUnits: number;
  stockValue: number;
  lastProductionDate: string | null;
  status: "No assignments" | "Awaiting update" | "In progress" | "Complete" | "Over target";
};

export type ProductionChartHub = {
  key: string;
  userId: string;
  name: string;
  subhubName: string;
};

export type ProductionChartPoint = {
  label: string;
  date: string;
  total: number;
  [hubKey: string]: string | number;
};

export type ProductionReassignment = {
  orderNumber: string;
  productName: string;
  variantName: string;
  fromHub: string;
  toHub: string;
  reason: string;
  createdAt: string;
};

export type ProductionOrderActivity = {
  id: string;
  orderId: string;
  action: "created" | "assigned" | "reassigned" | "updated" | "production_updated";
  actorName: string;
  actorRole: string;
  summary: string;
  details: string;
  createdAt: string;
};

export type WorkspaceSearchResult = {
  id: string;
  kind: "order" | "hub" | "part" | "product";
  title: string;
  subtitle: string;
  href: string;
};

export type WorkspaceSearchScope =
  | "dashboard"
  | "bom"
  | "raw-materials"
  | "orders"
  | "hubs"
  | "shortages"
  | "procurement"
  | "production"
  | "user-management"
  | "hr";

export type OrderNotification = {
  id: string;
  orderId: string;
  orderNumber: string;
  action: ProductionOrderActivity["action"];
  summary: string;
  details: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
};

export type AdminProductionDashboard = {
  hubs: HubSummary[];
  orders: ProductionOrder[];
  chartHubs: ProductionChartHub[];
  dailyProduction: ProductionChartPoint[];
  weeklyProduction: ProductionChartPoint[];
  recentReassignments: ProductionReassignment[];
  totalTarget: number;
  totalProduced: number;
  totalRemaining: number;
  completion: number;
  reportsToday: number;
  latestReportDate: string | null;
};

export type AdminHubDetailReport = ProductionReport & {
  orderNumber: string;
  productName: string;
  variantName: string;
  variantCode: string;
};

export type AdminHubDetail = {
  hub: HubSummary;
  manager: {
    email: string;
    active: boolean;
    createdAt: string;
  };
  orders: ProductionOrder[];
  reports: AdminHubDetailReport[];
  inventory: SubhubInventoryData;
  activities: ProductionOrderActivity[];
  dailyProduction: Array<{ date: string; quantity: number }>;
};

type ProductionOrderDocument = {
  _id: string;
  orderNumber: string;
  subhubUserId: string;
  subhubName: string;
  productCode: string;
  productName: string;
  variantCode: string;
  variantName: string;
  target: number;
  dueDate: string;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type ProductionReportDocument = {
  _id: string;
  orderId: string;
  date: string;
  quantity: number;
  notes: string;
  reportedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type HubCapacityDocument = {
  _id: string;
  capacityUnits: number;
  updatedBy: string;
  updatedAt: Date;
};

type ReassignmentDocument = {
  _id?: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  variantName: string;
  fromHub: string;
  toHub: string;
  reason: string;
  createdAt: Date;
  createdBy: string;
};

type OrderActivityDocument = {
  _id: string;
  orderId: string;
  action: ProductionOrderActivity["action"];
  actorId: string;
  actorName: string;
  actorRole: string;
  summary: string;
  details: string;
  createdAt: Date;
};

type InventoryItemDocument = {
  _id: string;
  quantity: number;
  updatedAt: Date;
};

function isAdmin(user: UserDocument | null): user is UserDocument {
  return user?.panel === "admin" && (user.role === "master_admin" || user.role === "admin");
}

function isMasterAdmin(user: UserDocument | null): user is UserDocument {
  return user?.panel === "admin" && user.role === "master_admin";
}

function isSubhub(user: UserDocument | null): user is UserDocument {
  return user?.panel === "subhub" && user.role === "subhub";
}

function normalizeDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function statusFor(target: number, produced: number): ProductionOrder["status"] {
  if (produced > target) return "Over target";
  if (produced === target) return "Complete";
  if (produced > 0) return "In progress";
  return "Unstarted";
}

async function reportsForDatabase(databaseName: string): Promise<ProductionReportDocument[]> {
  return getMongoDb(databaseName)
    .then((db) => db.collection<ProductionReportDocument>("production_reports").find().sort({ date: -1 }).toArray());
}

function summarizeOrder(order: ProductionOrderDocument, reports: ProductionReportDocument[]): ProductionOrder {
  const orderReports = reports.filter((report) => report.orderId === order._id);
  const produced = orderReports.reduce((sum, report) => sum + report.quantity, 0);
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    subhubUserId: order.subhubUserId,
    subhubName: order.subhubName,
    productCode: order.productCode,
    productName: order.productName,
    variantCode: order.variantCode,
    variantName: order.variantName,
    target: order.target,
    dueDate: order.dueDate,
    notes: order.notes,
    produced,
    remaining: Math.max(0, order.target - produced),
    lastProductionDate: orderReports[0]?.date ?? null,
    status: statusFor(order.target, produced),
    createdAt: order.createdAt.toISOString(),
  };
}

function serializeReport(report: ProductionReportDocument, batchAllocation?: ProductionReport["batchAllocation"]): ProductionReport {
  return {
    id: report._id,
    orderId: report.orderId,
    date: report.date,
    quantity: report.quantity,
    notes: report.notes,
    updatedAt: report.updatedAt.toISOString(),
    ...(batchAllocation ? { batchAllocation } : {}),
  };
}

function serializeOrderActivity(activity: OrderActivityDocument): ProductionOrderActivity {
  return {
    id: activity._id,
    orderId: activity.orderId,
    action: activity.action,
    actorName: activity.actorName,
    actorRole: activity.actorRole,
    summary: activity.summary,
    details: activity.details,
    createdAt: activity.createdAt.toISOString(),
  };
}

function serializeNotification(activity: OrderActivityDocument, order: ProductionOrderDocument): OrderNotification {
  return {
    id: activity._id,
    orderId: activity.orderId,
    orderNumber: order.orderNumber,
    action: activity.action,
    summary: activity.summary,
    details: activity.details,
    actorName: activity.actorName,
    actorRole: activity.actorRole,
    createdAt: activity.createdAt.toISOString(),
  };
}

async function allSubhubUsers() {
  const db = await getControlPlaneDatabase();
  return db
    .collection<UserDocument>("users")
    .find({ panel: "subhub", role: "subhub" })
    .sort({ subhubName: 1, name: 1 })
    .toArray();
}

async function capacityDocumentsFor(users: UserDocument[]) {
  const db = await getControlPlaneDatabase();
  const documents = await db
    .collection<HubCapacityDocument>("hub_capacities")
    .find({ _id: { $in: users.map((user) => user._id) } })
    .toArray();
  return new Map(documents.map((document) => [document._id, document]));
}

async function reportsByUserFor(users: UserDocument[]) {
  return Promise.all(
    users.map(async (user) => ({
      user,
      reports: await reportsForDatabase(user.databaseName),
    })),
  );
}

function producedForOrder(order: ProductionOrderDocument, reports: ProductionReportDocument[]) {
  return reports
    .filter((report) => report.orderId === order._id)
    .reduce((sum, report) => sum + report.quantity, 0);
}

function openUnitsForOrder(order: ProductionOrderDocument, reports: ProductionReportDocument[]) {
  return Math.max(0, order.target - producedForOrder(order, reports));
}

async function moveOrderReports(
  orderId: string,
  fromDatabaseName: string,
  toDatabaseName: string,
) {
  if (fromDatabaseName === toDatabaseName) return;
  const fromDb = await getMongoDb(fromDatabaseName);
  const toDb = await getMongoDb(toDatabaseName);
  const reports = await fromDb
    .collection<ProductionReportDocument>("production_reports")
    .find({ orderId })
    .toArray();
  if (!reports.length) return;

  await toDb.collection<ProductionReportDocument>("production_reports").bulkWrite(
    reports.map((report) => ({
      replaceOne: {
        filter: { _id: report._id },
        replacement: report,
        upsert: true,
      },
    })),
    { ordered: true },
  );
  await fromDb.collection<ProductionReportDocument>("production_reports").deleteMany({ orderId });
}

async function recordOrderActivity(
  db: Awaited<ReturnType<typeof getControlPlaneDatabase>>,
  input: {
    orderId: string;
    action: ProductionOrderActivity["action"];
    actorId: string;
    actorName: string;
    actorRole: string;
    summary: string;
    details: string;
    id?: string;
  },
  session?: ClientSession,
) {
  const document: OrderActivityDocument = {
    _id: input.id ?? randomUUID().replace(/-/g, ""),
    orderId: input.orderId,
    action: input.action,
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    summary: input.summary,
    details: input.details,
    createdAt: new Date(),
  };
  if (input.id) {
    await db.collection<OrderActivityDocument>("production_order_activity").updateOne(
      { _id: input.id },
      { $setOnInsert: document },
      { upsert: true, ...(session ? { session } : {}) },
    );
  } else {
    await db.collection<OrderActivityDocument>("production_order_activity").insertOne(document, session ? { session } : {});
  }
}

async function rebalanceProductionOrders(actorId: string): Promise<ProductionReassignment[]> {
  const db = await getControlPlaneDatabase();
  const [orders, users] = await Promise.all([
    db.collection<ProductionOrderDocument>("production_orders").find().sort({ createdAt: 1 }).toArray(),
    allSubhubUsers(),
  ]);
  const activeUsers = users.filter((user) => user.active && user.subhubName);
  const capacities = await capacityDocumentsFor(activeUsers);
  const workspaceData = await reportsByUserFor(users);
  const reportsByUser = new Map(workspaceData.map(({ user, reports }) => [user._id, reports]));
  const actor = users.find((user) => user._id === actorId)
    ?? await db.collection<UserDocument>("users").findOne({ _id: actorId });
  const actorName = actor?.name ?? "System";
  const actorRole = actor?.role === "subhub" ? "Hub Manager" : actor?.role === "master_admin" ? "Master Admin" : "Admin";
  const loads = new Map<string, number>();
  const reassignments: ProductionReassignment[] = [];

  for (const order of orders) {
    loads.set(
      order.subhubUserId,
      (loads.get(order.subhubUserId) ?? 0) + openUnitsForOrder(order, reportsByUser.get(order.subhubUserId) ?? []),
    );
  }

  const eligibleUsers = activeUsers.filter((user) => user.subhubName);
  for (const source of eligibleUsers) {
    const sourceCapacity = capacities.get(source._id)?.capacityUnits;
    if (!sourceCapacity || (loads.get(source._id) ?? 0) <= sourceCapacity) continue;

    const sourceOrders = orders
      .filter((order) => order.subhubUserId === source._id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    for (const order of sourceOrders) {
      if ((loads.get(source._id) ?? 0) <= sourceCapacity) break;
      const openUnits = openUnitsForOrder(order, reportsByUser.get(source._id) ?? []);
      if (!openUnits) continue;

      const destination = eligibleUsers
        .filter((candidate) => candidate._id !== source._id)
        .map((candidate) => {
          const capacity = capacities.get(candidate._id)?.capacityUnits;
          const load = loads.get(candidate._id) ?? 0;
          return {
            candidate,
            available: capacity ? capacity - load : Number.POSITIVE_INFINITY,
          };
        })
        .filter(({ available }) => available >= openUnits)
        .sort((a, b) => b.available - a.available)[0]?.candidate;

      if (!destination) continue;

      // A report owns allocations and output batches in its original workspace.
      // Only untouched work can safely be moved between isolated workspaces.
      if ((reportsByUser.get(source._id) ?? []).some((report) => report.orderId === order._id)) continue;
      await db.collection<ProductionOrderDocument>("production_orders").updateOne(
        { _id: order._id },
        {
          $set: {
            subhubUserId: destination._id,
            subhubName: destination.subhubName!,
            updatedAt: new Date(),
          },
        },
      );

      const fromHub = order.subhubName;
      order.subhubUserId = destination._id;
      order.subhubName = destination.subhubName!;
      order.updatedAt = new Date();
      loads.set(source._id, (loads.get(source._id) ?? 0) - openUnits);
      loads.set(destination._id, (loads.get(destination._id) ?? 0) + openUnits);
      reassignments.push({
        orderNumber: order.orderNumber,
        productName: order.productName,
        variantName: order.variantName,
        fromHub,
        toHub: destination.subhubName!,
        reason: `${fromHub} exceeded its active target capacity`,
        createdAt: new Date().toISOString(),
      });
      await recordOrderActivity(db, {
        orderId: order._id,
        action: "reassigned",
        actorId,
        actorName,
        actorRole,
        summary: `Order reassigned from ${fromHub} to ${destination.subhubName!}`,
        details: `${fromHub} exceeded its active target capacity. Only an order with no saved production reports can be reassigned.`,
      });
    }
  }

  if (reassignments.length) {
    await db.collection<ReassignmentDocument>("production_reassignments").insertMany(
      reassignments.map((reassignment) => ({
        orderId: orders.find((order) => order.orderNumber === reassignment.orderNumber)?._id ?? "",
        orderNumber: reassignment.orderNumber,
        productName: reassignment.productName,
        variantName: reassignment.variantName,
        fromHub: reassignment.fromHub,
        toHub: reassignment.toHub,
        reason: reassignment.reason,
        createdAt: new Date(reassignment.createdAt),
        createdBy: actorId,
      })),
    );
  }

  return reassignments;
}

export async function setHubCapacity(input: {
  subhubUserId: string;
  capacityUnits: number | null;
}): Promise<
  { ok: true; capacityUnits: number | null; reassignments: ProductionReassignment[] } |
  { ok: false; message: string }
> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can manage their hub capacity." };
  if (
    input.capacityUnits !== null &&
    (!Number.isInteger(input.capacityUnits) || input.capacityUnits < 1)
  ) {
    return { ok: false, message: "Capacity must be a whole number greater than zero, or left blank for no limit." };
  }

  const db = await getControlPlaneDatabase();
  if (input.subhubUserId !== current._id) return { ok: false, message: "You can only manage your own hub capacity." };
  if (!current.subhubName) return { ok: false, message: "Your SubHub does not have a name yet." };

  if (input.capacityUnits === null) {
    await db.collection<HubCapacityDocument>("hub_capacities").deleteOne({ _id: input.subhubUserId });
  } else {
    await db.collection<HubCapacityDocument>("hub_capacities").updateOne(
      { _id: input.subhubUserId },
      {
        $set: {
          capacityUnits: input.capacityUnits,
          updatedBy: current._id,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  const reassignments = await rebalanceProductionOrders(current._id);
  return { ok: true, capacityUnits: input.capacityUnits, reassignments };
}

export async function setAdminHubCapacity(input: {
  subhubUserId: string;
  capacityUnits: number | null;
}): Promise<
  { ok: true; capacityUnits: number | null; reassignments: ProductionReassignment[] } |
  { ok: false; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, message: "Only Admin users can edit hub capacity." };
  if (
    input.capacityUnits !== null &&
    (!Number.isInteger(input.capacityUnits) || input.capacityUnits < 1)
  ) {
    return { ok: false, message: "Capacity must be a whole number greater than zero, or left blank for no limit." };
  }

  const db = await getControlPlaneDatabase();
  const hub = await db.collection<UserDocument>("users").findOne({
    _id: input.subhubUserId,
    panel: "subhub",
    role: "subhub",
    active: true,
  });
  if (!hub?.subhubName) return { ok: false, message: "That SubHub is not active or does not have a factory name." };

  if (input.capacityUnits === null) {
    await db.collection<HubCapacityDocument>("hub_capacities").deleteOne({ _id: input.subhubUserId });
  } else {
    await db.collection<HubCapacityDocument>("hub_capacities").updateOne(
      { _id: input.subhubUserId },
      {
        $set: {
          capacityUnits: input.capacityUnits,
          updatedBy: current._id,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  const reassignments = await rebalanceProductionOrders(current._id);
  return { ok: true, capacityUnits: input.capacityUnits, reassignments };
}

export async function listAssignableSubhubs(): Promise<
  { ok: true; subhubs: AssignableSubhub[] } | { ok: false; subhubs: AssignableSubhub[]; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, subhubs: [], message: "Only Admin users can assign production orders." };
  const users = await allSubhubUsers();
  return {
    ok: true,
    subhubs: users
      .filter((user) => user.active && user.subhubName)
      .map((user) => ({ id: user._id, name: user.name, subhubName: user.subhubName! })),
  };
}

export async function createProductionOrder(input: {
  subhubUserId: string;
  productCode: string;
  variantCode: string;
  target: number;
  dueDate: string;
  notes: string;
}): Promise<{ ok: true; order: ProductionOrder } | { ok: false; message: string }> {
  const result = await createProductionOrders({
    assignments: [input],
  });
  if (!result.ok) return result;
  const order = result.orders[0];
  if (!order) return { ok: false, message: "The production order could not be created." };
  return { ok: true, order };
}

export async function createProductionOrders(input: {
  assignments: Array<{
    subhubUserId: string;
    productCode: string;
    variantCode: string;
    target: number;
    dueDate: string;
    notes: string;
  }>;
}): Promise<{ ok: true; orders: ProductionOrder[] } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, message: "Only Admin users can create production orders." };

  const db = await getControlPlaneDatabase();
  const subhubUserIds = [...new Set(input.assignments.map((assignment) => assignment.subhubUserId))];
  const [subhubs] = await Promise.all([
    db.collection<UserDocument>("users").find({
      _id: { $in: subhubUserIds },
      panel: "subhub",
      role: "subhub",
      active: true,
    }).toArray(),
  ]);
  if (subhubs.length !== subhubUserIds.length || subhubs.some((subhub) => !subhub.subhubName)) {
    return { ok: false, message: "Select only active SubHub managers with assigned factory names." };
  }

  const now = new Date();
  const subhubById = new Map(subhubs.map((subhub) => [subhub._id, subhub]));
  const validatedAssignments: Array<{
    assignment: (typeof input.assignments)[number];
    subhub: UserDocument;
    product: (typeof bomCatalog)[number];
    variant: (typeof bomCatalog)[number]["variants"][number];
    dueDate: string;
  }> = [];

  for (const [index, assignment] of input.assignments.entries()) {
    const subhub = subhubById.get(assignment.subhubUserId);
    if (!subhub?.subhubName) return { ok: false, message: `Assignment ${index + 1}: select an active SubHub manager.` };
    if (!Number.isInteger(assignment.target) || assignment.target < 1) {
      return { ok: false, message: `Assignment ${index + 1}: target must be a whole number greater than zero.` };
    }
    const dueDate = normalizeDate(assignment.dueDate);
    if (!dueDate) return { ok: false, message: `Assignment ${index + 1}: enter a valid target date.` };
    const product = bomCatalog.find((item) => item.code === assignment.productCode);
    const variant = product?.variants.find((item) => item.code === assignment.variantCode);
    if (!product || !variant) return { ok: false, message: `Assignment ${index + 1}: select a valid Float type and variant.` };
    validatedAssignments.push({ assignment, subhub, product, variant, dueDate });
  }

  const orders: ProductionOrderDocument[] = validatedAssignments.map(({ assignment, subhub, product, variant, dueDate }) => ({
    _id: randomUUID().replace(/-/g, ""),
    orderNumber: `ORD-${now.getTime().toString().slice(-8)}-${randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`,
    subhubUserId: subhub._id,
    subhubName: subhub.subhubName!,
    productCode: product.code,
    productName: product.name,
    variantCode: variant.code,
    variantName: variant.name,
    target: assignment.target,
    dueDate,
    notes: assignment.notes.trim(),
    createdBy: current._id,
    createdAt: now,
    updatedAt: now,
  }));
  await db.collection<ProductionOrderDocument>("production_orders").insertMany(orders);
  await db.collection<OrderActivityDocument>("production_order_activity").insertMany(
    orders.map((order) => ({
      _id: randomUUID().replace(/-/g, ""),
      orderId: order._id,
      action: "created" as const,
      actorId: current._id,
      actorName: current.name,
      actorRole: current.role === "master_admin" ? "Master Admin" : "Admin",
      summary: `Order created and assigned to ${order.subhubName}`,
      details: `${order.variantName} · target ${order.target.toLocaleString()} units · due ${order.dueDate}`,
      createdAt: now,
    })),
  );
  await rebalanceProductionOrders(current._id);
  const savedOrders = await db.collection<ProductionOrderDocument>("production_orders")
    .find({ _id: { $in: orders.map((order) => order._id) } })
    .toArray();
  const users = await allSubhubUsers();
  const reportsByUser = await Promise.all(users.map(async (user) => ({
    userId: user._id,
    reports: await reportsForDatabase(user.databaseName),
  })));
  return {
    ok: true,
    orders: savedOrders.map((order) => summarizeOrder(
      order,
      reportsByUser.find((item) => item.userId === order.subhubUserId)?.reports ?? [],
    )),
  };
}

export async function updateProductionOrder(input: {
  orderId: string;
  subhubUserId: string;
  productCode: string;
  variantCode: string;
  target: number;
  dueDate: string;
  notes: string;
}): Promise<{ ok: true; order: ProductionOrder } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("admin");
  if (!isMasterAdmin(current)) return { ok: false, message: "Only Master Admin users can edit production targets." };
  if (!Number.isInteger(input.target) || input.target < 1) {
    return { ok: false, message: "Target must be a whole number greater than zero." };
  }
  const dueDate = normalizeDate(input.dueDate);
  if (!dueDate) return { ok: false, message: "Enter a valid target due date." };

  const product = bomCatalog.find((item) => item.code === input.productCode);
  const variant = product?.variants.find((item) => item.code === input.variantCode);
  if (!product || !variant) return { ok: false, message: "Select a valid Float type and variant." };

  const db = await getControlPlaneDatabase();
  const [order, destination] = await Promise.all([
    db.collection<ProductionOrderDocument>("production_orders").findOne({ _id: input.orderId }),
    db.collection<UserDocument>("users").findOne({
      _id: input.subhubUserId,
      panel: "subhub",
      role: "subhub",
      active: true,
    }),
  ]);
  if (!order) return { ok: false, message: "Production order not found." };
  if (!destination?.subhubName) return { ok: false, message: "Select an active destination SubHub." };

  const source = order.subhubUserId === destination._id
    ? destination
    : await db.collection<UserDocument>("users").findOne({ _id: order.subhubUserId, panel: "subhub", role: "subhub" });
  const sourceReports = source
    ? await (await getMongoDb(source.databaseName)).collection<ProductionReportDocument>("production_reports").find({ orderId: order._id }).limit(1).toArray()
    : [];
  if (sourceReports.length) {
    if (order.subhubUserId !== destination._id) {
      return { ok: false, message: "This order has saved production reports and cannot be moved to another SubHub. Keep it in its current workspace." };
    }
    if (order.productCode !== product.code || order.variantCode !== variant.code) {
      return { ok: false, message: "This order has saved production reports, so its product and variant cannot be changed. You may still edit target, due date, or notes." };
    }
  }

  await db.collection<ProductionOrderDocument>("production_orders").updateOne(
    { _id: order._id },
    {
      $set: {
        subhubUserId: destination._id,
        subhubName: destination.subhubName,
        productCode: product.code,
        productName: product.name,
        variantCode: variant.code,
        variantName: variant.name,
        target: input.target,
        dueDate,
        notes: input.notes.trim(),
        updatedAt: new Date(),
      },
    },
  );

  const movedHub = order.subhubUserId !== destination._id;
  await recordOrderActivity(db, {
    orderId: order._id,
    action: movedHub ? "reassigned" : "updated",
    actorId: current._id,
    actorName: current.name,
    actorRole: "Master Admin",
    summary: movedHub
      ? `Target edited and reassigned from ${order.subhubName} to ${destination.subhubName}`
      : `Production target edited for ${destination.subhubName}`,
    details: `${variant.name} · target ${input.target.toLocaleString()} units · due ${dueDate}`,
  });

  const reports = await reportsForDatabase(destination.databaseName);
  return {
    ok: true,
    order: summarizeOrder(
      {
        ...order,
        subhubUserId: destination._id,
        subhubName: destination.subhubName,
        productCode: product.code,
        productName: product.name,
        variantCode: variant.code,
        variantName: variant.name,
        target: input.target,
        dueDate,
        notes: input.notes.trim(),
        updatedAt: new Date(),
      },
      reports,
    ),
  };
}

export async function deleteProductionOrder(input: {
  orderId: string;
}): Promise<{ ok: true; orderNumber: string } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("admin");
  if (!isMasterAdmin(current)) return { ok: false, message: "Only Master Admin users can delete production targets." };

  const db = await getControlPlaneDatabase();
  const order = await db.collection<ProductionOrderDocument>("production_orders").findOne({ _id: input.orderId });
  if (!order) return { ok: false, message: "Production order not found." };

  const source = await db.collection<UserDocument>("users").findOne({
    _id: order.subhubUserId,
    panel: "subhub",
    role: "subhub",
  });
  if (!source) return { ok: false, message: "The assigned SubHub workspace could not be found; nothing was deleted." };
  const workspaceDb = await getMongoDb(source.databaseName);
  await ensureLegacyBatches(workspaceDb, current._id);
  const product = bomCatalog.find((candidate) => candidate.code === order.productCode);
  const variant = product?.variants.find((candidate) => candidate.code === order.variantCode);
  if (!product || !variant) return { ok: false, message: "The order BOM is unavailable, so its inventory cannot be safely reversed." };
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const reports = await workspaceDb.collection<ProductionReportDocument>("production_reports")
        .find({ orderId: order._id }, { session }).toArray();
      const derivedFilters = reports.flatMap((report) => [
        { _id: `float-production:${report._id}` },
        { sourceId: `float-production:${report._id}` },
        { _id: { $regex: `^production:${report._id}:` } },
        { sourceId: { $regex: `^production:${report._id}:` } },
      ]);
      const consumedOutput = reports.length
        ? await workspaceDb.collection<{ _id: string; sourceId: string; batchCode: string; itemCode: string; consumedQuantity: number; defectiveQuantity: number }>("inventory_batches")
          .find({
            $and: [
              { $or: derivedFilters },
              { $or: [{ consumedQuantity: { $gt: 0 } }, { defectiveQuantity: { $gt: 0 } }] },
            ],
          }, { session })
          .toArray()
        : [];
      const lockedBatch = consumedOutput[0];
      if (lockedBatch) {
        throw new Error(`This order cannot be deleted because batch ${lockedBatch.batchCode} (${lockedBatch.itemCode}) has already been consumed or quality-rejected.`);
      }
      for (const report of reports) {
        await reconcileProductionBatchAllocation({
          db: workspaceDb, reportId: report._id, reportDate: report.date,
          outputCode: `${product.code}-${variant.code}`, outputName: `${product.name} · ${variant.name}`,
          quantity: 0, requirements: {}, actor: current._id, notes: "Production order deleted", session,
        });
      }
      await workspaceDb.collection<{ _id: string }>("inventory_production_allocations")
        .deleteMany({ _id: { $in: reports.map((report) => report._id) } }, { session });
      await workspaceDb.collection<ProductionReportDocument>("production_reports").deleteMany({ orderId: order._id }, { session });
      const removed = await db.collection<ProductionOrderDocument>("production_orders").deleteOne({ _id: order._id }, { session });
      if (!removed.deletedCount) throw new Error("Production order changed before deletion.");
      await db.collection<OrderActivityDocument>("production_order_activity").deleteMany({ orderId: order._id }, { session });
      await db.collection<ReassignmentDocument>("production_reassignments").deleteMany({ orderId: order._id }, { session });
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error
      ? `Production order was not deleted: ${error.message}`
      : "Production order was not deleted because the transaction could not be committed." };
  } finally {
    await session.endSession();
  }

  return { ok: true, orderNumber: order.orderNumber };
}

export async function reassignProductionOrder(input: {
  orderId: string;
  subhubUserId: string;
  reason: string;
}): Promise<{ ok: true; order: ProductionOrder } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, message: "Only Admin users can reassign production orders." };

  const db = await getControlPlaneDatabase();
  const [order, destination] = await Promise.all([
    db.collection<ProductionOrderDocument>("production_orders").findOne({ _id: input.orderId }),
    db.collection<UserDocument>("users").findOne({
      _id: input.subhubUserId,
      panel: "subhub",
      role: "subhub",
      active: true,
    }),
  ]);
  if (!order) return { ok: false, message: "Production order not found." };
  if (!destination?.subhubName) return { ok: false, message: "Select an active destination SubHub." };
  if (order.subhubUserId === destination._id) return { ok: false, message: "Choose a different SubHub for reassignment." };

  const source = await db.collection<UserDocument>("users").findOne({ _id: order.subhubUserId, panel: "subhub", role: "subhub" });
  if (source) {
    const hasReports = await (await getMongoDb(source.databaseName))
      .collection<ProductionReportDocument>("production_reports")
      .find({ orderId: order._id })
      .limit(1)
      .hasNext();
    if (hasReports) {
      return { ok: false, message: "This order has saved production reports and cannot be reassigned. Its traceability remains in the current SubHub workspace." };
    }
  }
  await db.collection<ProductionOrderDocument>("production_orders").updateOne(
    { _id: order._id },
    {
      $set: {
        subhubUserId: destination._id,
        subhubName: destination.subhubName,
        updatedAt: new Date(),
      },
    },
  );

  const fromHub = order.subhubName;
  await recordOrderActivity(db, {
    orderId: order._id,
    action: "reassigned",
    actorId: current._id,
    actorName: current.name,
    actorRole: current.role === "master_admin" ? "Master Admin" : "Admin",
    summary: `Order manually reassigned from ${fromHub} to ${destination.subhubName}`,
    details: input.reason.trim() || "Reassigned by Admin based on current hub planning.",
  });

  const reports = await reportsForDatabase(destination.databaseName);
  return {
    ok: true,
    order: summarizeOrder(
      {
        ...order,
        subhubUserId: destination._id,
        subhubName: destination.subhubName,
        updatedAt: new Date(),
      },
      reports,
    ),
  };
}

export async function listProductionOrders(): Promise<
  { ok: true; orders: ProductionOrder[] } | { ok: false; orders: ProductionOrder[]; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!current || (!isAdmin(current) && !isSubhub(current))) return { ok: false, orders: [], message: "You do not have access to production orders." };
  const db = await getControlPlaneDatabase();
  const filter = isSubhub(current) ? { subhubUserId: current._id } : {};
  const orders = await db.collection<ProductionOrderDocument>("production_orders").find(filter).sort({ dueDate: 1, createdAt: -1 }).toArray();
  if (isSubhub(current)) {
    const reports = await reportsForDatabase(current.databaseName);
    return { ok: true, orders: orders.map((order) => summarizeOrder(order, reports)) };
  }
  const users = await allSubhubUsers();
  const reportsByUser = await Promise.all(users.map(async (user) => ({ userId: user._id, reports: await reportsForDatabase(user.databaseName) })));
  return {
    ok: true,
    orders: orders.map((order) => summarizeOrder(order, reportsByUser.find((item) => item.userId === order.subhubUserId)?.reports ?? [])),
  };
}

export async function getManagerProductionData(): Promise<
  { ok: true; data: ManagerProductionData } | { ok: false; data: ManagerProductionData; message: string }
> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return {
    ok: false,
    data: { subhubName: "", orders: [], reports: [], capacityUnits: null, openUnits: 0, availableUnits: null, overloaded: false },
    message: "Only SubHub Managers can enter production.",
  };
  const db = await getControlPlaneDatabase();
  const workspaceDb = await getMongoDb(current.databaseName);
  const [orders, reports] = await Promise.all([
    db.collection<ProductionOrderDocument>("production_orders").find({ subhubUserId: current._id }).sort({ dueDate: 1, createdAt: -1 }).toArray(),
    workspaceDb.collection<ProductionReportDocument>("production_reports").find().sort({ date: -1 }).toArray(),
  ]);
  const capacity = await db.collection<HubCapacityDocument>("hub_capacities").findOne({ _id: current._id });
  const serializedOrders = orders.map((order) => summarizeOrder(order, reports));
  const openUnits = serializedOrders.reduce((sum, order) => sum + order.remaining, 0);
  const capacityUnits = capacity?.capacityUnits ?? null;
  return {
    ok: true,
    data: {
      subhubName: current.subhubName ?? "SubHub",
      orders: serializedOrders,
      reports: await Promise.all(reports.map(async (report) => serializeReport(report, await getProductionBatchAllocationState(workspaceDb, report._id)))),
      capacityUnits,
      openUnits,
      availableUnits: capacityUnits === null ? null : capacityUnits - openUnits,
      overloaded: capacityUnits !== null && openUnits > capacityUnits,
    },
  };
}

export async function saveDailyProduction(input: {
  orderId: string;
  date: string;
  quantity: number;
  notes: string;
  manualAllocations?: ProductionManualAllocation[] | undefined;
}): Promise<{ ok: true; report: ProductionReport } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can enter production." };
  if (!Number.isInteger(input.quantity) || input.quantity < 0) return { ok: false, message: "Production must be a whole number of zero or more." };
  const date = normalizeDate(input.date);
  if (!date) return { ok: false, message: "Enter a valid production date." };

  const controlDb = await getControlPlaneDatabase();
  const reportId = `${input.orderId}_${date}`;
  const workspaceDb = await getMongoDb(current.databaseName);
  // Synchronize persisted authoritative sources before allocating this report.
  // Excluding the report being edited prevents its old output from being
  // independently reconciled immediately before allocation reconciliation.
  try {
    await syncWorkspaceInventoryForUser(current, workspaceDb, reportId);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Authoritative inventory sources could not be synchronized." };
  }
  const client = await getMongoClient();
  const session = client.startSession();
  let saved: ProductionReportDocument | undefined;
  try {
    await session.withTransaction(async () => {
      const order = await controlDb.collection<ProductionOrderDocument>("production_orders").findOne({
        _id: input.orderId,
        subhubUserId: current._id,
      }, { session });
      if (!order) throw new Error("That production order is not assigned to this SubHub.");
      const product = bomCatalog.find((candidate) => candidate.code === order.productCode);
      const variant = product?.variants.find((candidate) => candidate.code === order.variantCode);
      if (!product || !variant) throw new Error("The assigned order no longer has a valid BOM variant.");
      const existingReport = await workspaceDb.collection<ProductionReportDocument>("production_reports")
        .findOne({ _id: reportId }, { session });
      const changed = await reconcileProductionBatchAllocation({
        db: workspaceDb, reportId, reportDate: date, outputCode: `${product.code}-${variant.code}`,
        outputName: `${product.name} · ${variant.name}`, quantity: input.quantity, requirements: variant.parts,
        actor: current._id, notes: input.notes.trim(), manualAllocations: input.manualAllocations, session,
      });
      const now = new Date();
      if (changed || !existingReport || existingReport.notes !== input.notes.trim()) {
        await workspaceDb.collection<ProductionReportDocument>("production_reports").updateOne(
          { _id: reportId },
          {
            $set: { orderId: order._id, date, quantity: input.quantity, notes: input.notes.trim(), reportedBy: current._id, updatedAt: now },
            $setOnInsert: { _id: reportId, createdAt: now },
          },
          { upsert: true, session },
        );
        const activitySignature = createHash("sha256").update(JSON.stringify({
          reportId, quantity: input.quantity, notes: input.notes.trim(),
          manualAllocations: input.manualAllocations ?? [],
        })).digest("hex");
        await recordOrderActivity(controlDb, {
          id: `production_${activitySignature}`,
          orderId: order._id, action: "production_updated", actorId: current._id,
          actorName: current.name, actorRole: "Hub Manager",
          summary: existingReport ? `Production report updated for ${date}` : `Production report added for ${date}`,
          details: `${input.quantity.toLocaleString()} units reported for ${order.variantName}${input.notes.trim() ? ` · ${input.notes.trim()}` : ""}`,
        }, session);
      }
      saved = !changed && existingReport && existingReport.notes === input.notes.trim()
        ? existingReport
        : {
          _id: reportId, orderId: order._id, date, quantity: input.quantity, notes: input.notes.trim(),
          reportedBy: current._id, createdAt: existingReport?.createdAt ?? now, updatedAt: now,
        };
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Production batch allocation could not be reconciled." };
  } finally {
    await session.endSession();
  }
  if (!saved) return { ok: false, message: "Production transaction completed without a report state." };
  return { ok: true, report: serializeReport(saved, await getProductionBatchAllocationState(workspaceDb, reportId)) };
}

export async function previewProductionBatchAllocation(input: {
  orderId: string; date: string; quantity: number;
}): Promise<{ ok: true; preview: ProductionAllocationPreview } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can preview production allocations." };
  if (!Number.isInteger(input.quantity) || input.quantity < 0) return { ok: false, message: "Production must be a whole number of zero or more." };
  const date = normalizeDate(input.date);
  if (!date) return { ok: false, message: "Enter a valid production date." };
  const controlDb = await getControlPlaneDatabase();
  const order = await controlDb.collection<ProductionOrderDocument>("production_orders").findOne({ _id: input.orderId, subhubUserId: current._id });
  if (!order) return { ok: false, message: "That production order is not assigned to this SubHub." };
  const product = bomCatalog.find((candidate) => candidate.code === order.productCode);
  const variant = product?.variants.find((candidate) => candidate.code === order.variantCode);
  if (!variant) return { ok: false, message: "The assigned order no longer has a valid BOM variant." };
  const workspaceDb = await getMongoDb(current.databaseName);
  try {
    await syncWorkspaceInventoryForUser(current, workspaceDb, `${order._id}_${date}`);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Authoritative inventory sources could not be synchronized." };
  }
  return { ok: true, preview: await getProductionBatchAllocationPreview({ db: workspaceDb, reportId: `${order._id}_${date}`, requirements: variant.parts, quantity: input.quantity, actor: current._id }) };
}

export async function getProductionOrderActivity(orderId: string, panel: Panel): Promise<
  { ok: true; activities: ProductionOrderActivity[] } | { ok: false; activities: ProductionOrderActivity[]; message: string }
> {
  const [current, subhubCurrent] = await Promise.all([
    getCurrentUserRecord("admin"),
    getCurrentUserRecord("subhub"),
  ]);
  const user = panel === "admin" ? current : subhubCurrent;
  if (!user || (!isAdmin(user) && !isSubhub(user))) return { ok: false, activities: [], message: "You do not have access to order activity." };

  const db = await getControlPlaneDatabase();
  const order = await db.collection<ProductionOrderDocument>("production_orders").findOne({ _id: orderId });
  if (!order) return { ok: false, activities: [], message: "Production order not found." };
  if (isSubhub(user) && order.subhubUserId !== user._id) {
    return { ok: false, activities: [], message: "That order is not assigned to this SubHub." };
  }
  const activities = await db
    .collection<OrderActivityDocument>("production_order_activity")
    .find({ orderId })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return { ok: true, activities: activities.map(serializeOrderActivity) };
}

export async function searchWorkspace(query: string, panel: Panel, scope: WorkspaceSearchScope): Promise<
  { ok: true; results: WorkspaceSearchResult[] } | { ok: false; results: WorkspaceSearchResult[]; message: string }
> {
  const [adminCurrent, subhubCurrent] = await Promise.all([
    getCurrentUserRecord("admin"),
    getCurrentUserRecord("subhub"),
  ]);
  const admin = panel === "admin" && isAdmin(adminCurrent) ? adminCurrent : null;
  const subhub = panel === "subhub" && isSubhub(subhubCurrent) ? subhubCurrent : null;
  const current = admin ?? subhub;
  if (!current) {
    return { ok: false, results: [], message: "You do not have access to workspace search." };
  }
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return { ok: true, results: [] };

  const db = await getControlPlaneDatabase();
  const results: WorkspaceSearchResult[] = [];
  const matches = (...values: Array<string | undefined>) =>
    values.some((value) => value?.toLowerCase().includes(normalizedQuery));

  if (scope === "orders" || scope === "production") {
    const orders = await db.collection<ProductionOrderDocument>("production_orders")
      .find(subhub ? { subhubUserId: subhub._id } : {})
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(50)
      .toArray();
    orders
      .filter((order) => matches(order.orderNumber, order.subhubName, order.productName, order.variantName, order.productCode, order.variantCode))
      .slice(0, 20)
      .forEach((order) => results.push({
        id: order._id,
        kind: "order",
        title: `${order.orderNumber} · ${order.variantName}`,
        subtitle: `${order.subhubName} · due ${order.dueDate}`,
        href: scope === "production" ? "/production" : "/orders",
      }));
  } else if (scope === "hubs" || scope === "user-management" || scope === "hr") {
    const users = await allSubhubUsers();
    users
      .filter((user) => user.active && matches(user.name, user.subhubName))
      .slice(0, 20)
      .forEach((user) => results.push({
        id: user._id,
        kind: "hub",
        title: user.subhubName ?? user.name,
        subtitle: `${user.name} · managed SubHub`,
        href: scope === "user-management" ? "/admin/users" : scope === "hr" ? "/hr" : "/hubs",
      }));
  } else if (scope === "raw-materials" || scope === "shortages") {
    subparts
      .filter((part) => matches(part.code, part.name, part.material, part.source))
      .slice(0, 20)
      .forEach((part) => results.push({
        id: part.code,
        kind: "part",
        title: part.name,
        subtitle: `${part.code} · ${part.material} · ${part.source}`,
        href: scope === "shortages" ? "/shortages" : "/raw-materials",
      }));
  } else if (scope === "procurement") {
    procurement
      .filter((item) => matches(item.id, item.part, item.hub, item.status, item.vendor, item.by))
      .slice(0, 20)
      .forEach((item) => results.push({
        id: item.id,
        kind: "part",
        title: `${item.id} · ${item.part}`,
        subtitle: `${item.hub} · ${item.status} · ${item.vendor}`,
        href: "/procurement",
      }));
  } else if (scope === "bom") {
    bomCatalog.forEach((product) => {
      const productMatches = matches(product.code, product.name, product.description);
      if (productMatches) {
        results.push({
          id: product.code,
          kind: "product",
          title: product.name,
          subtitle: `${product.code} · ${product.variants.length} variants`,
          href: `/bom/${product.code}`,
        });
      }

      product.variants
        .filter((variant) => matches(variant.code, variant.name, variant.company))
        .slice(0, 12)
        .forEach((variant) => results.push({
          id: `${product.code}-${variant.code}`,
          kind: "product",
          title: variant.name,
          subtitle: `${product.name} · ${variant.code} variant`,
          href: `/bom/${product.code}`,
        }));
    });
  } else if (subhub) {
    const inventoryDb = await getMongoDb(subhub.databaseName);
    const inventory = await inventoryDb.collection<InventoryItemDocument>("inventory_items").find().limit(100).toArray();
    inventory
      .map((item) => subparts.find((part) => part.code === item._id) ?? { code: item._id, name: item._id, material: "Inventory item", source: "Workspace" })
      .filter((part) => matches(part.code, part.name, part.material, part.source))
      .slice(0, 8)
      .forEach((part) => results.push({
        id: part.code,
        kind: "part",
        title: part.name,
        subtitle: `${part.code} · inventory item`,
        href: "/inventory",
      }));
  }

  return { ok: true, results: results.slice(0, 20) };
}

export async function getOrderNotifications(panel: Panel): Promise<
  { ok: true; notifications: OrderNotification[] } | { ok: false; notifications: OrderNotification[]; message: string }
> {
  const [adminCurrent, subhubCurrent] = await Promise.all([
    getCurrentUserRecord("admin"),
    getCurrentUserRecord("subhub"),
  ]);
  const current = panel === "admin" ? adminCurrent : subhubCurrent;
  if (!current || (!isAdmin(current) && !isSubhub(current))) {
    return { ok: false, notifications: [], message: "You do not have access to order notifications." };
  }

  const db = await getControlPlaneDatabase();
  const orderFilter = isSubhub(current) ? { subhubUserId: current._id } : {};
  const orders = await db.collection<ProductionOrderDocument>("production_orders").find(orderFilter).toArray();
  if (!orders.length) return { ok: true, notifications: [] };
  const orderById = new Map(orders.map((order) => [order._id, order]));
  const activities = await db
    .collection<OrderActivityDocument>("production_order_activity")
    .find({ orderId: { $in: orders.map((order) => order._id) } })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();
  return {
    ok: true,
    notifications: activities
      .map((activity) => {
        const order = orderById.get(activity.orderId);
        return order ? serializeNotification(activity, order) : null;
      })
      .filter((notification): notification is OrderNotification => notification !== null),
  };
}

export async function getAdminProductionDashboard(): Promise<
  { ok: true; data: AdminProductionDashboard } | { ok: false; data: AdminProductionDashboard; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  const empty: AdminProductionDashboard = {
    hubs: [],
    orders: [],
    chartHubs: [],
    dailyProduction: [],
    weeklyProduction: [],
    recentReassignments: [],
    totalTarget: 0,
    totalProduced: 0,
    totalRemaining: 0,
    completion: 0,
    reportsToday: 0,
    latestReportDate: null,
  };
  if (!isAdmin(current)) return { ok: false, data: empty, message: "Only Admin users can view all hub performance." };

  await rebalanceProductionOrders(current._id);
  const db = await getControlPlaneDatabase();
  const [orders, users] = await Promise.all([
    db.collection<ProductionOrderDocument>("production_orders").find().sort({ dueDate: 1, createdAt: -1 }).toArray(),
    allSubhubUsers(),
  ]);
  const [reportsByUser, capacities] = await Promise.all([
    reportsByUserFor(users),
    capacityDocumentsFor(users),
  ]);
  const workspaceData = await Promise.all(
    users.map(async (user) => ({
      user,
      inventory: await getMongoDb(user.databaseName)
        .then((workspaceDb) => workspaceDb.collection<InventoryItemDocument>("inventory_items").find().toArray()),
    })),
  );
  const orderReports = new Map<string, ProductionReportDocument[]>();
  reportsByUser.forEach(({ user, reports }) => {
    const relevant = new Set(orders.filter((order) => order.subhubUserId === user._id).map((order) => order._id));
    reports.forEach((report) => {
      if (relevant.has(report.orderId)) {
        const currentReports = orderReports.get(report.orderId) ?? [];
        orderReports.set(report.orderId, [...currentReports, report]);
      }
    });
  });
  const serializedOrders = orders.map((order) => summarizeOrder(order, orderReports.get(order._id) ?? []));
  const today = new Date().toISOString().slice(0, 10);
  const activeUsers = users.filter((user) => user.active && user.subhubName);
  const hubs = activeUsers.map((user) => {
    const hubOrders = serializedOrders.filter((order) => order.subhubUserId === user._id);
    const target = hubOrders.reduce((sum, order) => sum + order.target, 0);
    const produced = hubOrders.reduce((sum, order) => sum + order.produced, 0);
    const workspace = workspaceData.find(({ user: candidate }) => candidate._id === user._id);
    const hubReports = reportsByUser.find(({ user: candidate }) => candidate._id === user._id)?.reports ?? [];
    const stockUnits = workspace?.inventory.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const stockValue = workspace?.inventory.reduce((sum, item) => sum + item.quantity * (subparts.find((part) => part.code === item._id)?.rate ?? 0), 0) ?? 0;
    const lastProductionDate = hubReports[0]?.date ?? null;
    const completion = target ? Math.round((produced / target) * 100) : 0;
    const capacityUnits = capacities.get(user._id)?.capacityUnits ?? null;
    const openUnits = hubOrders.reduce((sum, order) => sum + order.remaining, 0);
    const availableUnits = capacityUnits === null ? null : capacityUnits - openUnits;
    let status: HubSummary["status"] = "No assignments";
    if (target && completion > 100) status = "Over target";
    else if (target && completion >= 100) status = "Complete";
    else if (target && lastProductionDate && lastProductionDate < today) status = "Awaiting update";
    else if (target) status = "In progress";
    return {
      userId: user._id,
      name: user.name,
      subhubName: user.subhubName!,
      orderCount: hubOrders.length,
      capacityUnits,
      openUnits,
      availableUnits,
      overloaded: capacityUnits !== null && openUnits > capacityUnits,
      target,
      produced,
      remaining: Math.max(0, target - produced),
      completion,
      reportCount: hubReports.length,
      stockUnits,
      stockValue,
      lastProductionDate,
      status,
    };
  });
  const totalTarget = serializedOrders.reduce((sum, order) => sum + order.target, 0);
  const totalProduced = serializedOrders.reduce((sum, order) => sum + order.produced, 0);
  const allReports = reportsByUser
    .flatMap(({ user, reports }) => reports.map((report) => ({ user, report })))
    .sort((a, b) => b.report.date.localeCompare(a.report.date));
  const latestReportDate = allReports[0]?.report.date ?? null;
  const chartHubs: ProductionChartHub[] = activeUsers.map((user) => ({
    key: `hub_${user._id}`,
    userId: user._id,
    name: user.name,
    subhubName: user.subhubName!,
  }));
  const chartHubByUserId = new Map(chartHubs.map((hub) => [hub.userId, hub]));
  const orderOwnerById = new Map(orders.map((order) => [order._id, order.subhubUserId]));
  const dailyMap = new Map<string, ProductionChartPoint>();
  const weeklyMap = new Map<string, ProductionChartPoint>();

  function getOrCreatePoint(map: Map<string, ProductionChartPoint>, date: string, label: string) {
    const existing = map.get(date);
    if (existing) return existing;
    const point: ProductionChartPoint = { label, date, total: 0 };
    chartHubs.forEach((hub) => { point[hub.key] = 0; });
    map.set(date, point);
    return point;
  }

  function weekStart(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    const day = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - day);
    return date.toISOString().slice(0, 10);
  }

  allReports.forEach(({ user, report }) => {
    if (orderOwnerById.get(report.orderId) !== user._id) return;
    const hub = chartHubByUserId.get(user._id);
    if (!hub) return;
    const daily = getOrCreatePoint(dailyMap, report.date, report.date);
    daily[hub.key] = Number(daily[hub.key] ?? 0) + report.quantity;
    daily.total += report.quantity;
    const start = weekStart(report.date);
    const weekly = getOrCreatePoint(weeklyMap, start, `Week of ${start}`);
    weekly[hub.key] = Number(weekly[hub.key] ?? 0) + report.quantity;
    weekly.total += report.quantity;
  });

  const recentReassignmentDocuments = await db
    .collection<ReassignmentDocument>("production_reassignments")
    .find()
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  return {
    ok: true,
    data: {
      hubs,
      orders: serializedOrders,
      chartHubs,
      dailyProduction: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      weeklyProduction: [...weeklyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      recentReassignments: recentReassignmentDocuments.map((reassignment) => ({
        orderNumber: reassignment.orderNumber,
        productName: reassignment.productName,
        variantName: reassignment.variantName,
        fromHub: reassignment.fromHub,
        toHub: reassignment.toHub,
        reason: reassignment.reason,
        createdAt: reassignment.createdAt.toISOString(),
      })),
      totalTarget,
      totalProduced,
      totalRemaining: Math.max(0, totalTarget - totalProduced),
      completion: totalTarget ? Math.round((totalProduced / totalTarget) * 100) : 0,
      reportsToday: allReports.filter(({ report }) => report.date === today).length,
      latestReportDate,
    },
  };
}

export async function getAdminHubDetail(hubId: string): Promise<
  { ok: true; data: AdminHubDetail } | { ok: false; data: null; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, data: null, message: "Only Admin users can view hub details." };
  await rebalanceProductionOrders(current._id);

  const controlDb = await getControlPlaneDatabase();
  const user = await controlDb.collection<UserDocument>("users").findOne({
    _id: hubId,
    panel: "subhub",
    role: "subhub",
  });
  if (!user || !user.subhubName) return { ok: false, data: null, message: "The requested hub could not be found." };

  const [orders, reports, capacity, workspaceDb] = await Promise.all([
    controlDb.collection<ProductionOrderDocument>("production_orders")
      .find({ subhubUserId: user._id })
      .sort({ dueDate: 1, createdAt: -1 })
      .toArray(),
    getMongoDb(user.databaseName).then((db) => db.collection<ProductionReportDocument>("production_reports").find().sort({ date: -1, updatedAt: -1 }).toArray()),
    controlDb.collection<HubCapacityDocument>("hub_capacities").findOne({ _id: user._id }),
    getMongoDb(user.databaseName),
  ]);
  const inventory = await getWorkspaceInventorySnapshot(user, workspaceDb);
  const orderReports = new Map<string, ProductionReportDocument[]>();
  reports.forEach((report) => {
    const currentReports = orderReports.get(report.orderId) ?? [];
    orderReports.set(report.orderId, [...currentReports, report]);
  });
  const serializedOrders = orders.map((order) => summarizeOrder(order, orderReports.get(order._id) ?? []));
  const orderById = new Map(orders.map((order) => [order._id, order]));
  const serializedReports = await Promise.all(reports.map(async (report) => {
    const order = orderById.get(report.orderId);
    return {
      ...serializeReport(report, await getProductionBatchAllocationState(workspaceDb, report._id)),
      orderNumber: order?.orderNumber ?? "Unassigned order",
      productName: order?.productName ?? "Unknown product",
      variantName: order?.variantName ?? "Unknown variant",
      variantCode: order?.variantCode ?? "—",
    };
  }));
  const target = serializedOrders.reduce((sum, order) => sum + order.target, 0);
  const produced = serializedOrders.reduce((sum, order) => sum + order.produced, 0);
  const today = new Date().toISOString().slice(0, 10);
  const lastProductionDate = reports[0]?.date ?? null;
  const completion = target ? Math.round((produced / target) * 100) : 0;
  const openUnits = serializedOrders.reduce((sum, order) => sum + order.remaining, 0);
  const capacityUnits = capacity?.capacityUnits ?? null;
  let status: HubSummary["status"] = "No assignments";
  if (target && completion > 100) status = "Over target";
  else if (target && completion >= 100) status = "Complete";
  else if (target && lastProductionDate && lastProductionDate < today) status = "Awaiting update";
  else if (target) status = "In progress";
  const hub: HubSummary = {
    userId: user._id,
    name: user.name,
    subhubName: user.subhubName,
    orderCount: serializedOrders.length,
    capacityUnits,
    openUnits,
    availableUnits: capacityUnits === null ? null : capacityUnits - openUnits,
    overloaded: capacityUnits !== null && openUnits > capacityUnits,
    target,
    produced,
    remaining: Math.max(0, target - produced),
    completion,
    reportCount: reports.length,
    stockUnits: inventory.items.reduce((sum, item) => sum + item.quantity, 0),
    stockValue: inventory.items.reduce((sum, item) => sum + item.quantity * item.price, 0),
    lastProductionDate,
    status,
  };
  const activityDocuments = await controlDb.collection<OrderActivityDocument>("production_order_activity")
    .find({ orderId: { $in: orders.map((order) => order._id) } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  const daily = new Map<string, number>();
  reports.forEach((report) => daily.set(report.date, (daily.get(report.date) ?? 0) + report.quantity));

  return {
    ok: true,
    data: {
      hub,
      manager: { email: user.email, active: user.active, createdAt: user.createdAt.toISOString() },
      orders: serializedOrders,
      reports: serializedReports,
      inventory,
      activities: activityDocuments.map(serializeOrderActivity),
      dailyProduction: [...daily.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([date, quantity]) => ({ date, quantity })),
    },
  };
}