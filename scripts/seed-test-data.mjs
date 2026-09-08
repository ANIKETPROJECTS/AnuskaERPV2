import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is not configured.");

const controlDatabaseName = process.env.MONGODB_CONTROL_DATABASE ?? "float_erp_control";
const now = new Date();
const dateOnly = (value) => value.toISOString().slice(0, 10);
const day = (offset) => {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() + offset);
  return value;
};
const upsert = (collection, id, document) =>
  collection.updateOne({ _id: id }, { $set: { ...document, _id: id } }, { upsert: true });

async function main() {
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();

  try {
    const controlDb = client.db(controlDatabaseName);
    const admin = await controlDb.collection("users").findOne({
      panel: "admin",
      role: { $in: ["master_admin", "admin"] },
      active: true,
    });
    const subhubs = await controlDb.collection("users")
      .find({ panel: "subhub", role: "subhub", active: true, subhubName: { $exists: true, $ne: "" } })
      .sort({ subhubName: 1, name: 1 })
      .limit(2)
      .toArray();

    if (!admin) throw new Error("No active Admin or Master Admin user exists.");
    if (!subhubs.length) throw new Error("No active SubHub Manager exists. Create one before seeding test data.");

    const primaryHub = subhubs[0];
    const secondaryHub = subhubs[1] ?? primaryHub;
    const primaryDb = client.db(primaryHub.databaseName);
    const secondaryDb = client.db(secondaryHub.databaseName);

    const orderId = "test-production-order-001";
    await upsert(controlDb.collection("production_orders"), orderId, {
      orderNumber: "ORD-TEST-001",
      subhubUserId: primaryHub._id,
      subhubName: primaryHub.subhubName,
      productCode: "P-FLT",
      productName: "Float",
      variantCode: "FL-RVN",
      variantName: "Eureka Reviva NXT",
      target: 60,
      dueDate: dateOnly(day(7)),
      notes: "Small seeded order for dashboard and production testing.",
      createdBy: admin._id,
      createdAt: day(-3),
      updatedAt: now,
    });
    await upsert(controlDb.collection("production_orders"), "test-production-order-002", {
      orderNumber: "ORD-TEST-002",
      subhubUserId: secondaryHub._id,
      subhubName: secondaryHub.subhubName,
      productCode: "P-ARM",
      productName: "Float Arm",
      variantCode: "FL-AOS",
      variantName: "AO Smith SM",
      target: 40,
      dueDate: dateOnly(day(10)),
      notes: "Second small order for SubHub comparison.",
      createdBy: admin._id,
      createdAt: day(-2),
      updatedAt: now,
    });
    await upsert(controlDb.collection("production_order_activity"), "test-production-activity-001", {
      orderId,
      action: "created",
      actorId: admin._id,
      actorName: admin.name,
      actorRole: admin.role === "master_admin" ? "Master Admin" : "Admin",
      summary: `Test order assigned to ${primaryHub.subhubName}`,
      details: "Seeded for dashboard verification.",
      createdAt: day(-3),
    });
    await upsert(controlDb.collection("hub_capacities"), primaryHub._id, {
      capacityUnits: 100,
      updatedBy: admin._id,
      updatedAt: now,
    });
    await upsert(controlDb.collection("hub_capacities"), secondaryHub._id, {
      capacityUnits: 80,
      updatedBy: admin._id,
      updatedAt: now,
    });

    await upsert(primaryDb.collection("production_reports"), "test-production-report-001", {
      orderId,
      date: dateOnly(day(-1)),
      quantity: 24,
      notes: "Seeded first-shift production report.",
      reportedBy: primaryHub._id,
      createdAt: day(-1),
      updatedAt: now,
    });
    await upsert(secondaryDb.collection("production_reports"), "test-production-report-002", {
      orderId: "test-production-order-002",
      date: dateOnly(day(-1)),
      quantity: 18,
      notes: "Seeded second SubHub production report.",
      reportedBy: secondaryHub._id,
      createdAt: day(-1),
      updatedAt: now,
    });

    const inventoryItems = [
      { code: "GP006-001", name: "Washer", category: "Raw Material", quantity: 18, price: 210 },
      { code: "GP006-002", name: "Pivot Pin", category: "Raw Material", quantity: 120, price: 260 },
      { code: "FL-RVN", name: "Eureka Reviva NXT", category: "Float", quantity: 12, price: 950 },
    ];
    for (const item of inventoryItems) {
      await upsert(primaryDb.collection("inventory_items"), item.code, {
        name: item.name,
        category: item.category,
        unit: "pcs",
        quantity: item.quantity,
        price: item.price,
        createdAt: day(-5),
        updatedAt: now,
        updatedBy: primaryHub._id,
      });
    }
    await upsert(primaryDb.collection("inventory_movements"), "test-inventory-movement-001", {
      code: "GP006-001",
      product: "Washer",
      type: "Stock added",
      change: 26,
      balance: 26,
      reason: "Received stock",
      notes: "Seeded stock receipt for testing.",
      sourceType: "manual",
      sourceId: "test-receipt-001",
      createdAt: day(-5),
    });
    await upsert(primaryDb.collection("inventory_movements"), "test-inventory-movement-002", {
      code: "GP006-001",
      product: "Washer",
      type: "Quality rejected",
      change: -8,
      balance: 18,
      reason: "Faulty",
      notes: "Seeded quality rejection for testing.",
      sourceType: "quality",
      sourceId: "test-quality-log-001",
      createdAt: day(-2),
    });

    await upsert(primaryDb.collection("inventory_batches"), "test-batch-washer-001", {
      batchCode: "WASHER-TEST-001",
      itemCode: "GP006-001",
      itemName: "Washer",
      category: "Raw Material",
      sourceType: "manual",
      sourceId: "test-receipt-001",
      sourceMetadata: { note: "Seeded test receipt" },
      receivedQuantity: 26,
      producedQuantity: 0,
      consumedQuantity: 0,
      defectiveQuantity: 8,
      availableQuantity: 18,
      batchSequence: 1,
      createdAt: day(-5),
      updatedAt: now,
    });
    await upsert(primaryDb.collection("inventory_batches"), "test-batch-float-001", {
      batchCode: "FLOAT-TEST-001",
      itemCode: "FL-RVN",
      itemName: "Eureka Reviva NXT",
      category: "Float",
      sourceType: "production",
      sourceId: "test-float-production-001",
      sourceMetadata: { note: "Seeded finished-product output" },
      receivedQuantity: 0,
      producedQuantity: 12,
      consumedQuantity: 0,
      defectiveQuantity: 0,
      availableQuantity: 12,
      batchSequence: 1,
      createdAt: day(-1),
      updatedAt: now,
    });
    await upsert(primaryDb.collection("inventory_batch_movements"), "test-batch-event-001", {
      sourceEventId: "test-receipt-001:initial",
      batchId: "test-batch-washer-001",
      batchCode: "WASHER-TEST-001",
      itemCode: "GP006-001",
      type: "IN",
      quantityDelta: 26,
      balance: 26,
      actor: primaryHub._id,
      reason: "Received stock",
      reference: "test-receipt-001",
      createdAt: day(-5),
    });
    await upsert(primaryDb.collection("inventory_batch_movements"), "test-batch-event-002", {
      sourceEventId: "test-quality-log-001:quality",
      batchId: "test-batch-washer-001",
      batchCode: "WASHER-TEST-001",
      itemCode: "GP006-001",
      type: "QUALITY",
      quantityDelta: -8,
      balance: 18,
      actor: primaryHub._id,
      reason: "Faulty",
      reference: "test-quality-log-001",
      createdAt: day(-2),
    });
    await upsert(primaryDb.collection("quality_logs"), "test-quality-log-001", {
      subhubUserId: primaryHub._id,
      subhubName: primaryHub.subhubName,
      code: "GP006-001",
      product: "Washer",
      category: "Raw Material",
      issue: "Faulty",
      quantity: 8,
      beforeQuantity: 26,
      afterQuantity: 18,
      notes: "Seeded quality issue for testing.",
      recordedBy: primaryHub._id,
      recordedByName: primaryHub.name,
      createdAt: day(-2),
      batchId: "test-batch-washer-001",
      batchCode: "WASHER-TEST-001",
      allocations: [{ batchId: "test-batch-washer-001", batchCode: "WASHER-TEST-001", quantity: 8 }],
    });

    const shiftId = "test-shift-day";
    await upsert(primaryDb.collection("hr_shifts"), shiftId, {
      name: "Test day shift",
      normalizedName: "test day shift",
      startTime: "09:00",
      endTime: "17:00",
      createdAt: day(-5),
      updatedAt: now,
    });
    for (const [index, employee] of [
      ["001", "Test Employee One", "9876500001", "Present"],
      ["002", "Test Employee Two", "9876500002", "Late"],
    ]) {
      const employeeId = `test-employee-${index}`;
      await upsert(primaryDb.collection("hr_employees"), employeeId, {
        name: employee,
        normalizedName: employee.toLowerCase(),
        phoneNumber: employee.includes("One") ? "9876500001" : "9876500002",
        normalizedPhoneNumber: employee.includes("One") ? "9876500001" : "9876500002",
        active: true,
        createdAt: day(-5),
        updatedAt: now,
      });
      await upsert(primaryDb.collection("hr_shift_assignments"), `test-assignment-${index}`, {
        shiftId,
        employeeId,
        createdAt: day(-5),
        updatedAt: now,
      });
      await upsert(primaryDb.collection("hr_attendance"), `test-attendance-${index}`, {
        employeeId,
        date: dateOnly(day(-1)),
        status: employee.includes("One") ? "Present" : "Late",
        updatedAt: now,
        createdAt: now,
      });
    }

    await upsert(controlDb.collection("procurement_vendors"), "test-vendor-001", {
      name: "Test Components Supply",
      contactName: "Test Contact",
      phone: "9876500100",
      email: "test.vendor@gadsons.demo",
      address: "Test Industrial Estate",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      paymentTerms: "Net 30 days",
      categories: ["Fasteners"],
      status: "active",
      notes: "Seeded vendor for procurement testing.",
      createdAt: day(-4),
      updatedAt: now,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    await upsert(controlDb.collection("procurement_orders"), "test-procurement-order-001", {
      orderNumber: "PO-TEST-001",
      vendorId: "test-vendor-001",
      vendorName: "Test Components Supply",
      subhubUserId: primaryHub._id,
      subhubName: primaryHub.subhubName,
      materialCode: "GP006-001",
      materialName: "Washer",
      quantity: 50,
      unitPrice: 210,
      totalAmount: 10500,
      orderDate: day(-2),
      expectedDelivery: day(3),
      notes: "Seeded open purchase order.",
      status: "Order placed",
      statusHistory: [{
        status: "Order placed",
        changedAt: day(-2),
        changedBy: admin._id,
        changedByName: admin.name,
      }],
      createdAt: day(-2),
      updatedAt: now,
      createdBy: admin._id,
    });
    await upsert(controlDb.collection("procurement_orders"), "test-procurement-order-002", {
      orderNumber: "PO-TEST-002",
      vendorId: "test-vendor-001",
      vendorName: "Test Components Supply",
      subhubUserId: secondaryHub._id,
      subhubName: secondaryHub.subhubName,
      materialCode: "GP006-002",
      materialName: "Pivot Pin",
      quantity: 20,
      unitPrice: 260,
      totalAmount: 5200,
      orderDate: day(-6),
      expectedDelivery: day(-2),
      notes: "Seeded completed purchase order.",
      status: "Delivery done",
      statusHistory: [
        { status: "Order placed", changedAt: day(-6), changedBy: admin._id, changedByName: admin.name },
        { status: "Delivery done", changedAt: day(-2), changedBy: admin._id, changedByName: admin.name },
      ],
      createdAt: day(-6),
      updatedAt: now,
      createdBy: admin._id,
    });

    console.log(JSON.stringify({
      ok: true,
      message: "Seeded a small MongoDB test dataset without deleting users or existing records.",
      subhubs: subhubs.map((user) => ({ id: user._id, name: user.subhubName })),
      productionOrders: 2,
      productionReports: 2,
      inventoryItems: 3,
      inventoryBatches: 2,
      qualityLogs: 1,
      employees: 2,
      attendanceRecords: 2,
      procurementVendors: 1,
      procurementOrders: 2,
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});