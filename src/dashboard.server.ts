import { getAdminHrData, type AdminHrData } from "./hr.server";
import { getMasterQualityManagement, type MasterQualityData } from "./inventory.server";
import { getMongoDb } from "./mongodb.server";
import { getProcurementData, type ProcurementData } from "./procurement.server";
import { getAdminProductionDashboard, type AdminProductionDashboard } from "./production.server";
import { getControlPlaneDatabase, type UserDocument } from "./auth.server";
import { getShortageData, type ShortageData } from "./shortages.server";
import { bomCatalog } from "./lib/bom-catalog";
import { subparts } from "./lib/erp-data";

type InventoryItemDocument = {
  _id: string;
  category?: string;
  quantity: number;
  price?: number;
  updatedAt?: Date;
};

export type DashboardInventoryHub = {
  userId: string;
  name: string;
  units: number;
  value: number;
  rawMaterialUnits: number;
  finalProductUnits: number;
  lastUpdated: string | null;
};

export type DashboardInventory = {
  totalItems: number;
  totalUnits: number;
  totalValue: number;
  rawMaterialUnits: number;
  finalProductUnits: number;
  lastUpdated: string | null;
  byHub: DashboardInventoryHub[];
};

export type DashboardBomSummary = {
  productFamilies: number;
  variants: number;
  materials: number;
};

export type OperationsDashboard = {
  production: AdminProductionDashboard;
  inventory: DashboardInventory;
  shortages: ShortageData;
  procurement: ProcurementData;
  hr: AdminHrData;
  quality: MasterQualityData;
  bom: DashboardBomSummary;
};

function emptyInventory(): DashboardInventory {
  return {
    totalItems: 0,
    totalUnits: 0,
    totalValue: 0,
    rawMaterialUnits: 0,
    finalProductUnits: 0,
    lastUpdated: null,
    byHub: [],
  };
}

function emptyShortages(): ShortageData {
  return {
    hubs: [],
    rows: [],
    totalDeficit: 0,
    affectedParts: 0,
    totalParts: 0,
    hubsInDeficit: 0,
    coveredHubs: 0,
    actions: [],
  };
}

function emptyProcurement(): ProcurementData {
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

function emptyHr(): AdminHrData {
  return { month: "", subhubs: [], summaries: [] };
}

function emptyQuality(): MasterQualityData {
  return {
    logs: [],
    bySubhub: [],
    byReason: [],
    summary: { records: 0, rejectedUnits: 0, subhubsWithIssues: 0 },
  };
}

function todayInIndia(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valueFor = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

async function getInventoryOverview(): Promise<DashboardInventory> {
  const controlDb = await getControlPlaneDatabase();
  const users = await controlDb
    .collection<UserDocument>("users")
    .find({ panel: "subhub", role: "subhub", active: true, subhubName: { $exists: true, $ne: "" } })
    .sort({ subhubName: 1, name: 1 })
    .toArray();

  const byHub = await Promise.all(users.map(async (user) => {
    const workspaceDb = await getMongoDb(user.databaseName);
    const items = await workspaceDb.collection<InventoryItemDocument>("inventory_items").find().toArray();
    const lastUpdated = items
      .map((item) => item.updatedAt)
      .filter((date): date is Date => date instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    const rawMaterialUnits = items
      .filter((item) => item.category !== "Float" && item.category !== "Final Product")
      .reduce((sum, item) => sum + item.quantity, 0);
    const finalProductUnits = items
      .filter((item) => item.category === "Float" || item.category === "Final Product")
      .reduce((sum, item) => sum + item.quantity, 0);

    return {
      userId: user._id,
      name: user.subhubName ?? user.name,
      units: items.reduce((sum, item) => sum + item.quantity, 0),
      value: items.reduce((sum, item) => sum + item.quantity * (item.price ?? 0), 0),
      rawMaterialUnits,
      finalProductUnits,
      lastUpdated: lastUpdated?.toISOString() ?? null,
    };
  }));

  const lastUpdated = byHub
    .map((hub) => hub.lastUpdated)
    .filter((date): date is string => Boolean(date))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    totalItems: byHub.length ? await countInventoryItems(users) : 0,
    totalUnits: byHub.reduce((sum, hub) => sum + hub.units, 0),
    totalValue: byHub.reduce((sum, hub) => sum + hub.value, 0),
    rawMaterialUnits: byHub.reduce((sum, hub) => sum + hub.rawMaterialUnits, 0),
    finalProductUnits: byHub.reduce((sum, hub) => sum + hub.finalProductUnits, 0),
    lastUpdated,
    byHub,
  };
}

async function countInventoryItems(users: UserDocument[]): Promise<number> {
  const counts = await Promise.all(users.map(async (user) => {
    const db = await getMongoDb(user.databaseName);
    return db.collection<InventoryItemDocument>("inventory_items").countDocuments();
  }));
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function getOperationsDashboard(): Promise<
  { ok: true; data: OperationsDashboard } | { ok: false; data: null; message: string }
> {
  const productionResult = await getAdminProductionDashboard();
  if (!productionResult.ok) return { ok: false, data: null, message: productionResult.message };

  const month = todayInIndia().slice(0, 7);
  const [inventory, shortages, procurement, hr, quality] = await Promise.all([
    getInventoryOverview().catch(() => emptyInventory()),
    getShortageData().then((result) => (result.ok ? result.data : emptyShortages())).catch(() => emptyShortages()),
    getProcurementData().then((result) => (result.ok ? result.data : emptyProcurement())).catch(() => emptyProcurement()),
    getAdminHrData(month).then((result) => (result.ok ? result.data : emptyHr())).catch(() => emptyHr()),
    getMasterQualityManagement().then((result) => (result.ok ? result.data : emptyQuality())).catch(() => emptyQuality()),
  ]);

  return {
    ok: true,
    data: {
      production: productionResult.data,
      inventory,
      shortages,
      procurement,
      hr,
      quality,
      bom: {
        productFamilies: bomCatalog.length,
        variants: bomCatalog.reduce((sum, product) => sum + product.variants.length, 0),
        materials: subparts.length,
      },
    },
  };
}