import { getControlPlaneDatabase, getCurrentUserRecord, type UserDocument } from "./auth.server";
import { bomCatalog } from "./lib/bom-catalog";
import { subparts } from "./lib/erp-data";
import { getMongoDb } from "./mongodb.server";

type ProductionOrderDocument = {
  _id: string;
  orderNumber: string;
  subhubUserId: string;
  subhubName: string;
  variantCode: string;
  target: number;
};

type ProductionReportDocument = {
  orderId: string;
  quantity: number;
};

type InventoryItemDocument = {
  _id: string;
  quantity: number;
};

type ProcurementOrderDocument = {
  _id: string;
  orderNumber: string;
  vendorName: string;
  subhubUserId: string;
  subhubName: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  expectedDelivery: Date;
  status: string;
  statusHistory?: Array<{
    changedByName: string;
    changedAt: Date;
  }>;
  createdAt: Date;
};

export type ShortageHub = {
  id: string;
  name: string;
  managerName: string;
};

export type ShortageCell = {
  requirement: number;
  stock: number;
  gap: number;
};

export type ShortageRow = {
  code: string;
  name: string;
  material: string;
  source: "Molded" | "Purchased";
  cells: Record<string, ShortageCell>;
  net: number;
};

export type ShortageAction = {
  id: string;
  type: "Procurement" | "Production";
  item: string;
  itemCode: string | null;
  hubName: string;
  quantity: number | null;
  status: string;
  note: string;
  actor: string;
  createdAt: string;
};

export type ShortageData = {
  hubs: ShortageHub[];
  rows: ShortageRow[];
  totalDeficit: number;
  affectedParts: number;
  totalParts: number;
  hubsInDeficit: number;
  coveredHubs: number;
  actions: ShortageAction[];
};

function emptyData(): ShortageData {
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

function isAdmin(user: UserDocument | null): user is UserDocument {
  return user?.panel === "admin" && (user.role === "master_admin" || user.role === "admin");
}

function variantParts() {
  return new Map(
    bomCatalog
      .flatMap((product) => product.variants)
      .map((variant) => [variant.code, variant.parts]),
  );
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function getShortageData(): Promise<
  { ok: true; data: ShortageData } | { ok: false; data: ShortageData; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) {
    return { ok: false, data: emptyData(), message: "Only Admin users can view consolidated shortages." };
  }

  const controlDb = await getControlPlaneDatabase();
  const [users, orders, procurementOrders] = await Promise.all([
    controlDb
      .collection<UserDocument>("users")
      .find({ panel: "subhub", role: "subhub", active: true, subhubName: { $exists: true, $ne: "" } })
      .sort({ subhubName: 1, name: 1 })
      .toArray(),
    controlDb
      .collection<ProductionOrderDocument>("production_orders")
      .find()
      .toArray(),
    controlDb
      .collection<ProcurementOrderDocument>("procurement_orders")
      .find()
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
  ]);

  const workspaceData = await Promise.all(
    users.map(async (user) => {
      const db = await getMongoDb(user.databaseName);
      const [inventory, reports] = await Promise.all([
        db.collection<InventoryItemDocument>("inventory_items").find().toArray(),
        db.collection<ProductionReportDocument>("production_reports").find().toArray(),
      ]);
      return { user, inventory, reports };
    }),
  );

  const hubs: ShortageHub[] = users.map((user) => ({
    id: user._id,
    name: user.subhubName!,
    managerName: user.name,
  }));
  const workspaceByUserId = new Map(workspaceData.map((entry) => [entry.user._id, entry]));
  const openRequirementByHub = new Map<string, Map<string, number>>();
  const partsByVariant = variantParts();

  users.forEach((user) => openRequirementByHub.set(user._id, new Map()));
  orders.forEach((order) => {
    const hubRequirements = openRequirementByHub.get(order.subhubUserId);
    const parts = partsByVariant.get(order.variantCode);
    const workspace = workspaceByUserId.get(order.subhubUserId);
    if (!hubRequirements || !parts || !workspace) return;

    const produced = workspace.reports
      .filter((report) => report.orderId === order._id)
      .reduce((sum, report) => sum + report.quantity, 0);
    const remainingUnits = Math.max(0, order.target - produced);
    Object.entries(parts).forEach(([partCode, quantityPerUnit]) => {
      hubRequirements.set(
        partCode,
        (hubRequirements.get(partCode) ?? 0) + remainingUnits * quantityPerUnit,
      );
    });
  });

  const rows: ShortageRow[] = subparts.map((part) => {
    const cells = Object.fromEntries(
      workspaceData.map(({ user, inventory }) => {
        const stock = inventory.find((item) => item._id === part.code)?.quantity ?? 0;
        const requirement = openRequirementByHub.get(user._id)?.get(part.code) ?? 0;
        return [
          user._id,
          {
            requirement,
            stock,
            gap: requirement - stock,
          },
        ];
      }),
    ) as Record<string, ShortageCell>;
    return {
      code: part.code,
      name: part.name,
      material: part.material,
      source: part.source,
      cells,
      net: Object.values(cells).reduce((sum, cell) => sum + cell.gap, 0),
    };
  });

  const totalDeficit = rows.reduce(
    (sum, row) => sum + Object.values(row.cells).reduce((rowSum, cell) => rowSum + Math.max(0, cell.gap), 0),
    0,
  );
  const affectedParts = rows.filter((row) => Object.values(row.cells).some((cell) => cell.gap > 0)).length;
  const hubsInDeficit = users.filter((user) =>
    rows.some((row) => {
      const cell = row.cells[user._id];
      return cell ? cell.gap > 0 : false;
    }),
  ).length;

  const shortageByHubAndPart = new Set(
    rows.flatMap((row) =>
      Object.entries(row.cells)
        .filter(([, cell]) => cell.gap > 0)
        .map(([hubId]) => `${hubId}:${row.code}`),
    ),
  );
  const actions: ShortageAction[] = procurementOrders
    .filter((order) => shortageByHubAndPart.has(`${order.subhubUserId}:${order.materialCode}`))
    .map((order) => ({
      id: order._id,
      type: "Procurement" as const,
      item: order.materialName,
      itemCode: order.materialCode,
      hubName: order.subhubName,
      quantity: order.quantity,
      status: order.status,
      note: `${order.orderNumber} · ${order.vendorName} · ETA ${formatDate(order.expectedDelivery)}`,
      actor: order.statusHistory?.at(-1)?.changedByName ?? "Procurement",
      createdAt: order.createdAt.toISOString(),
    }));

  return {
    ok: true,
    data: {
      hubs,
      rows,
      totalDeficit,
      affectedParts,
      totalParts: rows.length,
      hubsInDeficit,
      coveredHubs: Math.max(0, hubs.length - hubsInDeficit),
      actions,
    },
  };
}