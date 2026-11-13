import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured.");

const controlDbName = process.env.MONGODB_CONTROL_DATABASE ?? "float_erp_control";
const now = new Date();
const orderDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const expectedDelivery = new Date(orderDate);
expectedDelivery.setUTCDate(expectedDelivery.getUTCDate() + 7);

const materials = [
  { code: "GP006-001", name: "Washer", unitPrice: 210 },
  { code: "GP006-002", name: "Pivot Pin", unitPrice: 260 },
  { code: "GP006-003", name: "Screw M3x8", unitPrice: 95 },
  { code: "GP006-020", name: "Seal Gasket", unitPrice: 340 },
];

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
await client.connect();

try {
  const db = client.db(controlDbName);
  const [admin, hubs, vendors] = await Promise.all([
    db.collection("users").findOne(
      { panel: "admin", role: { $in: ["master_admin", "admin"] }, active: true },
      { projection: { _id: 1, name: 1 } },
    ),
    db.collection("users")
      .find(
        { panel: "subhub", role: "subhub", active: true, subhubName: { $exists: true, $ne: "" } },
        { projection: { _id: 1, name: 1, subhubName: 1 } },
      )
      .sort({ subhubName: 1, name: 1 })
      .limit(2)
      .toArray(),
    db.collection("procurement_vendors")
      .find({ status: "active" }, { projection: { _id: 1, name: 1 } })
      .sort({ name: 1 })
      .limit(2)
      .toArray(),
  ]);

  if (!admin) throw new Error("No active Admin or Master Admin is available.");
  if (hubs.length < 2) throw new Error("At least two active SubHubs are required for the multi-factory sample.");
  if (!vendors.length) throw new Error("No active procurement vendor is available.");

  const hubLabel = (hub) => (hub.subhubName ? `${hub.subhubName} · ${hub.name}` : hub.name);
  const vendorFor = (index) => vendors[index % vendors.length];
  const hubFor = (index) => hubs[index % hubs.length];
  const createItems = (codes, idPrefix, quantitySeed) =>
    codes.map((code, index) => {
      const material = materials.find((item) => item.code === code);
      if (!material) throw new Error(`Unknown sample material code: ${code}`);
      const quantity = quantitySeed + index * 25;
      return {
        lineId: `${idPrefix}-line-${index + 1}`,
        materialCode: material.code,
        materialName: material.name,
        quantity,
        unitPrice: material.unitPrice,
        totalAmount: quantity * material.unitPrice,
      };
    });

  const samples = [
    {
      id: "sample-procurement-single-v1",
      orderNumber: "PO-SAMPLE-SINGLE-001",
      notes: "Sample: one factory, one vendor, one material.",
      allocations: [{ hub: hubFor(0), vendor: vendorFor(0), items: createItems(["GP006-001"], "sample-single", 100) }],
    },
    {
      id: "sample-procurement-one-hub-multi-material-v1",
      orderNumber: "PO-SAMPLE-ONE-HUB-001",
      notes: "Sample: one factory with several material lines.",
      allocations: [{
        hub: hubFor(0),
        vendor: vendorFor(1),
        items: createItems(["GP006-001", "GP006-002", "GP006-003"], "sample-one-hub", 75),
      }],
    },
    {
      id: "sample-procurement-multi-hub-v1",
      orderNumber: "PO-SAMPLE-MULTI-HUB-001",
      notes: "Sample: one master order split across factories, vendors, and materials.",
      allocations: [
        {
          hub: hubFor(0),
          vendor: vendorFor(0),
          items: createItems(["GP006-001", "GP006-020"], "sample-multi-hub-a", 60),
        },
        {
          hub: hubFor(1),
          vendor: vendorFor(1),
          items: createItems(["GP006-002", "GP006-003"], "sample-multi-hub-b", 45),
        },
      ],
    },
  ];

  const orders = samples.map((sample, sampleIndex) => {
    const allocations = sample.allocations.map(({ hub, vendor, items }, allocationIndex) => ({
      allocationId: `${sample.id}-allocation-${allocationIndex + 1}`,
      vendorId: vendor._id,
      vendorName: vendor.name,
      subhubUserId: hub._id,
      subhubName: hubLabel(hub),
      materialCode: items[0].materialCode,
      materialName: items[0].materialName,
      items,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: items.reduce((sum, item) => sum + item.totalAmount, 0),
    }));
    const items = allocations.flatMap((allocation) => allocation.items);
    const vendorSet = new Map(allocations.map((allocation) => [allocation.vendorId, allocation.vendorName]));
    const hubSet = new Map(allocations.map((allocation) => [allocation.subhubUserId, allocation.subhubName]));
    const isBulk = sampleIndex > 0;

    return {
      _id: sample.id,
      orderNumber: sample.orderNumber,
      ...(isBulk ? { bulkOrderId: sample.id } : {}),
      vendorId: vendorSet.size === 1 ? [...vendorSet.keys()][0] : "",
      vendorName: vendorSet.size === 1 ? [...vendorSet.values()][0] : "Multiple vendors",
      subhubUserId: hubSet.size === 1 ? [...hubSet.keys()][0] : "",
      subhubName: hubSet.size === 1 ? [...hubSet.values()][0] : "Multiple factories",
      materialCode: items.length === 1 ? items[0].materialCode : "MULTIPLE",
      materialName: items.length === 1 ? items[0].materialName : `${items.length} material lines`,
      items,
      allocations,
      quantity: allocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
      unitPrice: items.length === 1 ? items[0].unitPrice : 0,
      totalAmount: allocations.reduce((sum, allocation) => sum + allocation.totalAmount, 0),
      orderDate,
      expectedDelivery,
      notes: sample.notes,
      status: "Order placed",
      statusHistory: [{
        status: "Order placed",
        changedAt: now,
        changedBy: admin._id,
        changedByName: admin.name,
      }],
      createdAt: now,
      updatedAt: now,
      createdBy: admin._id,
    };
  });

  const results = [];
  for (const order of orders) {
    const result = await db.collection("procurement_orders").updateOne(
      { _id: order._id },
      { $setOnInsert: order },
      { upsert: true },
    );
    results.push({
      orderNumber: order.orderNumber,
      inserted: result.upsertedCount === 1,
      factories: new Set(order.allocations.map((allocation) => allocation.subhubUserId)).size,
      materialLines: order.items.length,
      quantity: order.quantity,
    });
  }

  console.log(JSON.stringify({ created: results.filter((item) => item.inserted).length, orders: results }, null, 2));
} finally {
  await client.close();
}
