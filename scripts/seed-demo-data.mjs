import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is not configured.");

const controlDatabaseName = process.env.MONGODB_CONTROL_DATABASE ?? "float_erp_control";
const demoPassword = "Gadsons@12345";
const now = new Date();

const protectedCollections = new Set([
  "_workspace",
  "users",
  "sessions",
  "provisioning",
  "bom",
  "boms",
  "bill_of_materials",
  "raw_materials",
  "raw-materials",
  "rawMaterials",
  "raw_material",
]);

const rawMaterials = [
  ["GP006-001", "Washer", 210],
  ["GP006-002", "Pivot Pin", 260],
  ["GP006-003", "Screw M3x8", 95],
  ["GP006-010", "Ball Float Body (Reviva NXT)", 128],
  ["GP006-011", "Float Split Arm Enhance", 175],
  ["GP006-012", "Float Arm SM", 175],
  ["GP006-013", "Float Body TM", 128],
  ["GP006-020", "Seal Gasket", 340],
  ["GP006-021", "Valve Seat Insert", 640],
  ["GP006-030", "Retainer Clip", 118],
  ["GP006-031", "Cover Cap", 155],
  ["GP006-040", "Label Sticker", 70],
];

const productVariants = [
  ["P-FLT", "Float", "FL-RVN", "Eureka Reviva NXT"],
  ["P-FLT", "Float", "FL-ENH", "Eureka Enhance"],
  ["P-FLT", "Float", "FL-SMM", "Eureka SM (MIC)"],
  ["P-ARM", "Float Arm", "FL-ETM", "Eureka TM"],
  ["P-ARM", "Float Arm", "FL-AOS", "AO Smith SM"],
  ["P-VAL", "Valve", "FL-VG6", "V-Guard TM-6L"],
];

const demoSubhubs = [
  ["demo-subhub-01", "Aarav Mehta", "Unit G1 — Pune", "demo_subhub_01"],
  ["demo-subhub-02", "Diya Nair", "Unit G2 — Nashik", "demo_subhub_02"],
  ["demo-subhub-03", "Kabir Shah", "Unit G3 — Surat", "demo_subhub_03"],
  ["demo-subhub-04", "Meera Joshi", "Unit G4 — Indore", "demo_subhub_04"],
  ["demo-subhub-05", "Rohan Iyer", "Unit G5 — Bengaluru", "demo_subhub_05"],
  ["demo-subhub-06", "Ishita Rao", "Unit G6 — Hyderabad", "demo_subhub_06"],
  ["demo-subhub-07", "Vihaan Kapoor", "Unit G7 — Jaipur", "demo_subhub_07"],
  ["demo-subhub-08", "Anaya Kulkarni", "Unit G8 — Nagpur", "demo_subhub_08"],
  ["demo-subhub-09", "Aditya Menon", "Unit G9 — Kochi", "demo_subhub_09"],
  ["demo-subhub-10", "Sara Fernandes", "Unit G10 — Goa", "demo_subhub_10"],
];

const vendors = [
  ["Apex Precision Plastics", "Nitin Bhat", "9876501001", "apex@gadsons.demo", "Molded parts"],
  ["Bharat Fasteners", "Kavita Rao", "9876501002", "bharat@gadsons.demo", "Fasteners"],
  ["Crystal Silicone Works", "Manoj Patil", "9876501003", "crystal@gadsons.demo", "Seals"],
  ["Dhanraj Brass Components", "Suresh Jain", "9876501004", "dhanraj@gadsons.demo", "Brass inserts"],
  ["Eastline Labels", "Pooja Das", "9876501005", "eastline@gadsons.demo", "Labels"],
  ["FineForm Moulders", "Rahul Verma", "9876501006", "fineform@gadsons.demo", "Molded parts"],
  ["Ganga Industrial Supply", "Neha Singh", "9876501007", "ganga@gadsons.demo", "Purchased parts"],
  ["Metro Hardware House", "Arjun Yadav", "9876501008", "metro@gadsons.demo", "Fasteners"],
  ["Nova Polymer Traders", "Snehal More", "9876501009", "nova@gadsons.demo", "Polymers"],
  ["Omni Components India", "Farhan Shaikh", "9876501010", "omni@gadsons.demo", "Mixed components"],
];

const employeeNames = [
  "Aditi Pawar",
  "Bharat Yadav",
  "Chaitanya More",
  "Deepa Shinde",
  "Eshan Patil",
  "Farah Khan",
  "Gaurav Jadhav",
  "Harini Deshmukh",
  "Irfan Shaikh",
  "Janhavi Joshi",
];

const employeeRoles = ["Assembly", "Molding", "Packing", "Quality", "Stores"];

function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

function id(prefix) {
  return `${prefix}-${randomUUID().replaceAll("-", "")}`;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date;
}

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalize(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function clearOperationalCollections(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const collection of collections) {
    if (!protectedCollections.has(collection.name) && !collection.name.startsWith("system.")) {
      await db.collection(collection.name).drop().catch((error) => {
        if (error?.codeName !== "NamespaceNotFound") throw error;
      });
    }
  }
}

async function ensureWorkspaceMetadata(db, userId) {
  await db.collection("_workspace").updateOne(
    { _id: "metadata" },
    {
      $setOnInsert: {
        _id: "metadata",
        userId,
        createdAt: now,
        schemaVersion: 1,
      },
    },
    { upsert: true },
  );
}

async function ensureDemoUsers(controlDb) {
  const permissions = ["inventory", "hub-manager", "hub-reports", "hr", "bom", "raw-materials", "procurement"];
  const passwordHash = hashPassword(demoPassword);

  for (const [index, [userId, name, subhubName, databaseName]] of demoSubhubs.entries()) {
    const email = `demo.subhub.${String(index + 1).padStart(2, "0")}@gadsons.demo`;
    const existing = await controlDb.collection("users").findOne({ $or: [{ _id: userId }, { email }] });
    if (existing) {
      if (existing.panel === "subhub" && existing.role === "subhub") {
        await controlDb.collection("users").updateOne(
          { _id: existing._id },
          { $set: { active: true, subhubName, databaseName, updatedAt: now } },
        );
      }
      continue;
    }

    await controlDb.collection("users").insertOne({
      _id: userId,
      name,
      email,
      passwordHash,
      panel: "subhub",
      subhubName,
      role: "subhub",
      permissions,
      databaseName,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await controlDb.collection("provisioning").updateOne(
      { userId },
      {
        $set: { userId, databaseName, status: "ready", updatedAt: now },
        $setOnInsert: { _id: userId, createdAt: now },
      },
      { upsert: true },
    );
  }

  return controlDb.collection("users")
    .find({ panel: "subhub", role: "subhub", active: true, subhubName: { $exists: true } })
    .sort({ subhubName: 1, name: 1 })
    .toArray();
}

async function seedHr(db, user, hubIndex) {
  const dayShiftId = `shift-day-${hubIndex}`;
  const nightShiftId = `shift-night-${hubIndex}`;
  await db.collection("hr_shifts").insertMany([
    { _id: dayShiftId, name: "Day shift", normalizedName: "day shift", startTime: "09:00", endTime: "17:00", createdAt: now, updatedAt: now },
    { _id: nightShiftId, name: "Night shift", normalizedName: "night shift", startTime: "18:00", endTime: "03:00", createdAt: now, updatedAt: now },
  ]);

  const employees = employeeNames.map((name, employeeIndex) => ({
    _id: `demo-employee-${hubIndex}-${employeeIndex + 1}`,
    name,
    normalizedName: normalize(`${name} ${hubIndex}`),
    phoneNumber: `${7000000000 + hubIndex * 100 + employeeIndex + 1}`,
    normalizedPhoneNumber: `${7000000000 + hubIndex * 100 + employeeIndex + 1}`,
    active: employeeIndex !== 9,
    createdAt: addDays(now, -(employeeIndex + 5)),
    updatedAt: now,
  }));
  await db.collection("hr_employees").insertMany(employees);

  await db.collection("hr_shift_assignments").insertMany(
    employees.map((employee, employeeIndex) => ({
      _id: id("assignment"),
      shiftId: employeeIndex % 3 === 0 ? nightShiftId : dayShiftId,
      employeeId: employee._id,
      createdAt: now,
      updatedAt: now,
    })),
  );

  const statuses = ["Present", "Present", "Late", "Present", "Half-day", "Absent", "Present", "Present", "Late", "Present"];
  const attendance = employees.flatMap((employee, employeeIndex) =>
    Array.from({ length: 10 }, (_, dayIndex) => {
      const date = dateOnly(addDays(now, -dayIndex));
      return {
        _id: `${employee._id}_${date}`,
        employeeId: employee._id,
        date,
        status: statuses[(employeeIndex + dayIndex) % statuses.length],
        updatedAt: now,
        createdAt: now,
      };
    }),
  );
  await db.collection("hr_attendance").insertMany(attendance);
  return { employees: employees.length, attendance: attendance.length };
}

async function seedInventory(db, user, hubIndex) {
  const items = rawMaterials.map(([code, name, rate], materialIndex) => ({
    _id: code,
    quantity: 900 + hubIndex * 125 + materialIndex * 75,
    batches: 2 + (materialIndex % 4),
    updatedAt: now,
    updatedBy: user._id,
  }));
  await db.collection("inventory_items").insertMany(items);

  const movements = rawMaterials.slice(0, 10).map(([code, name], materialIndex) => ({
    _id: id("movement"),
    code,
    product: name,
    type: materialIndex % 3 === 0 ? "Stock removed" : "Stock added",
    change: materialIndex % 3 === 0 ? -(80 + materialIndex * 10) : 150 + materialIndex * 20,
    balance: 900 + hubIndex * 125 + materialIndex * 75,
    reason: materialIndex % 3 === 0 ? "Production issue" : "Supplier receipt",
    notes: materialIndex % 3 === 0 ? "Issued against today's assembly plan." : "Demo GRN received and checked by stores.",
    createdAt: addDays(now, -(materialIndex + 1)),
  }));
  await db.collection("inventory_movements").insertMany(movements);
  return { items: items.length, movements: movements.length };
}

async function seedProduction(controlDb, workspaceDb, user, hubIndex, adminUser) {
  const orders = [];
  const reports = [];
  const activities = [];
  const assignments = Array.from({ length: 5 }, (_, orderIndex) => [
    (hubIndex + orderIndex) % productVariants.length,
    850 + hubIndex * 65 + orderIndex * 140,
    [0.72, 1.06, 0.88, 0.64, 1.01][orderIndex],
  ]);

  for (const [orderIndex, [variantIndex, target, producedRatio]] of assignments.entries()) {
    const [productCode, productName, variantCode, variantName] = productVariants[(hubIndex + variantIndex) % productVariants.length];
    const orderId = `demo-production-order-${hubIndex}-${orderIndex + 1}`;
    const orderDate = addDays(now, -(18 + hubIndex + orderIndex));
    const dueDate = dateOnly(addDays(now, 4 + hubIndex + orderIndex));
    const order = {
      _id: orderId,
      orderNumber: `ORD-DEMO-${String(hubIndex + 1).padStart(2, "0")}-${String(orderIndex + 1).padStart(2, "0")}`,
      subhubUserId: user._id,
      subhubName: user.subhubName,
      productCode,
      productName,
      variantCode,
      variantName,
      target,
      dueDate,
      notes: orderIndex === 0 ? "Steady run for the monthly customer plan." : "Priority replenishment order for the next dispatch window.",
      createdBy: adminUser._id,
      createdAt: orderDate,
      updatedAt: now,
    };
    orders.push(order);

    const produced = Math.round(target * producedRatio);
    const firstQuantity = Math.round(produced * 0.55);
    const secondQuantity = produced - firstQuantity;
    for (const [reportIndex, quantity] of [firstQuantity, secondQuantity].entries()) {
      const reportDate = dateOnly(addDays(now, -(8 - reportIndex * 3 + hubIndex % 3)));
      reports.push({
        _id: `${orderId}_${reportDate}`,
        orderId,
        date: reportDate,
        quantity,
        notes: reportIndex === 0 ? "Morning production report." : "Second shift output reconciled by the Hub Manager.",
        reportedBy: user._id,
        createdAt: addDays(now, -(8 - reportIndex * 3)),
        updatedAt: now,
      });
    }

    activities.push(
      {
        _id: id("activity"),
        orderId,
        action: "created",
        actorId: adminUser._id,
        actorName: adminUser.name,
        actorRole: adminUser.role === "master_admin" ? "Master Admin" : "Admin",
        summary: `Order created and assigned to ${user.subhubName}`,
        details: `${variantName} · target ${target.toLocaleString()} units · due ${dueDate}`,
        createdAt: orderDate,
      },
      {
        _id: id("activity"),
        orderId,
        action: "production_updated",
        actorId: user._id,
        actorName: user.name,
        actorRole: "Hub Manager",
        summary: `Production updated for ${dateOnly(addDays(now, -2))}`,
        details: `${produced.toLocaleString()} units reported against this target.`,
        createdAt: addDays(now, -2),
      },
    );
  }

  await controlDb.collection("production_orders").insertMany(orders);
  await controlDb.collection("production_order_activity").insertMany(activities);
  await workspaceDb.collection("production_reports").insertMany(reports);
  await controlDb.collection("hub_capacities").insertOne({
    _id: user._id,
    capacityUnits: 2800 + hubIndex * 180,
    updatedBy: adminUser._id,
    updatedAt: now,
  });
  return { orders: orders.length, reports: reports.length, activities: activities.length };
}

async function seedProcurement(controlDb, subhubs, adminUser) {
  const vendorDocuments = vendors.map(([name, contactName, phone, email, category], index) => ({
    _id: `demo-vendor-${index + 1}`,
    name,
    contactName,
    phone,
    email,
    address: `${10 + index}, Industrial Estate Road`,
    city: ["Pune", "Mumbai", "Nashik", "Thane"][index % 4],
    state: "Maharashtra",
    pincode: `400${100 + index}`,
    paymentTerms: index % 3 === 0 ? "Advance 30%, balance on delivery" : "Net 30 days",
    categories: [category],
    status: "active",
    notes: "Demo vendor profile for procurement training.",
    createdAt: addDays(now, -(30 + index)),
    updatedAt: now,
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
  }));
  await controlDb.collection("procurement_vendors").insertMany(vendorDocuments);

  const orders = [];
  const statuses = ["Order placed", "Payment done", "Dispatch done", "Delivery done"];
  for (let index = 0; index < Math.max(20, subhubs.length * 2); index += 1) {
    const subhub = subhubs[index % subhubs.length];
    const vendor = vendorDocuments[index % vendorDocuments.length];
    const material = rawMaterials[index % rawMaterials.length];
    const orderDate = addDays(now, -(4 + index));
    const expectedDelivery = addDays(orderDate, 5 + (index % 4));
    const currentStatusIndex = index % statuses.length;
    const statusHistory = statuses.slice(0, currentStatusIndex + 1).map((status, statusIndex) => ({
      status,
      changedAt: addDays(orderDate, statusIndex + 1),
      changedBy: statusIndex === 0 ? adminUser._id : subhub._id,
      changedByName: statusIndex === 0 ? adminUser.name : subhub.name,
    }));
    orders.push({
      _id: `demo-procurement-order-${index + 1}`,
      orderNumber: `PO-DEMO-${String(index + 1).padStart(3, "0")}`,
      vendorId: vendor._id,
      vendorName: vendor.name,
      subhubUserId: subhub._id,
      subhubName: subhub.subhubName,
      materialCode: material[0],
      materialName: material[1],
      quantity: 500 + index * 75,
      unitPrice: material[2],
      totalAmount: (500 + index * 75) * material[2],
      orderDate,
      expectedDelivery,
      notes: index % 2 === 0 ? "Confirm packaging and inspection certificate before dispatch." : "Receive against the open production target.",
      status: statuses[currentStatusIndex],
      statusHistory,
      createdAt: orderDate,
      updatedAt: now,
      createdBy: index % 2 === 0 ? adminUser._id : subhub._id,
    });
  }
  await controlDb.collection("procurement_orders").insertMany(orders);
  return { vendors: vendorDocuments.length, orders: orders.length };
}

async function seedReassignments(controlDb, subhubs, adminUser) {
  const orders = await controlDb.collection("production_orders").find().sort({ createdAt: 1 }).limit(10).toArray();
  const records = orders.map((order, index) => ({
    _id: `demo-reassignment-${index + 1}`,
    orderId: order._id,
    orderNumber: order.orderNumber,
    productName: order.productName,
    variantName: order.variantName,
    fromHub: subhubs[(index + 1) % subhubs.length].subhubName,
    toHub: order.subhubName,
    reason: "Training example: workload balanced between active SubHubs.",
    createdAt: addDays(now, -(index + 1)),
    createdBy: adminUser._id,
  }));
  if (records.length) await controlDb.collection("production_reassignments").insertMany(records);
  return records.length;
}

async function main() {
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  try {
    const controlDb = client.db(controlDatabaseName);
    const adminUser = await controlDb.collection("users").findOne({
      panel: "admin",
      role: { $in: ["master_admin", "admin"] },
      active: true,
    });
    if (!adminUser) throw new Error("No active Admin or Master Admin user exists.");

    const existingSubhubCount = await controlDb.collection("users").countDocuments({ panel: "subhub", role: "subhub", active: true });
    await ensureDemoUsers(controlDb);
    const subhubs = await controlDb.collection("users")
      .find({ panel: "subhub", role: "subhub", active: true, subhubName: { $exists: true } })
      .sort({ subhubName: 1, name: 1 })
      .toArray();

    await clearOperationalCollections(controlDb);
    for (const subhub of subhubs) {
      const workspaceDb = client.db(subhub.databaseName);
      await clearOperationalCollections(workspaceDb);
      await ensureWorkspaceMetadata(workspaceDb, subhub._id);
    }

    const totals = {
      subhubs: subhubs.length,
      employees: 0,
      attendance: 0,
      inventoryItems: 0,
      inventoryMovements: 0,
      productionOrders: 0,
      productionReports: 0,
      productionActivities: 0,
      productionReassignments: 0,
    };

    for (const [hubIndex, subhub] of subhubs.entries()) {
      const workspaceDb = client.db(subhub.databaseName);
      const hr = await seedHr(workspaceDb, subhub, hubIndex);
      const inventory = await seedInventory(workspaceDb, subhub, hubIndex);
      const production = await seedProduction(controlDb, workspaceDb, subhub, hubIndex, adminUser);
      totals.employees += hr.employees;
      totals.attendance += hr.attendance;
      totals.inventoryItems += inventory.items;
      totals.inventoryMovements += inventory.movements;
      totals.productionOrders += production.orders;
      totals.productionReports += production.reports;
      totals.productionActivities += production.activities;
    }

    const procurement = await seedProcurement(controlDb, subhubs, adminUser);
    totals.productionReassignments = await seedReassignments(controlDb, subhubs, adminUser);
    console.log(JSON.stringify({
      ok: true,
      reset: "Operational MongoDB collections reset; users, auth metadata, BOM/raw-material collections preserved.",
      previousActiveSubhubs: existingSubhubCount,
      ...totals,
      procurement,
      demoLogin: {
        emailPattern: "demo.subhub.01@gadsons.demo through demo.subhub.10@gadsons.demo",
        password: demoPassword,
      },
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});