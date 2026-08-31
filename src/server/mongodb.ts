import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClient?: MongoClient;
  mongoClientPromise?: Promise<MongoClient>;
};

function getMongoUri(): string {
  const uri = process.env["MONGODB_URI"];

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}

export function getMongoClient(): Promise<MongoClient> {
  if (globalForMongo.mongoClientPromise) {
    return globalForMongo.mongoClientPromise;
  }

  const client = globalForMongo.mongoClient ?? new MongoClient(getMongoUri(), {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5_000,
  });

  globalForMongo.mongoClient = client;
  globalForMongo.mongoClientPromise = client.connect();

  return globalForMongo.mongoClientPromise;
}

export async function getMongoDb(databaseName?: string): Promise<Db> {
  const client = await getMongoClient();
  return client.db(databaseName);
}

export async function verifyMongoConnection(): Promise<void> {
  const client = await getMongoClient();
  await client.db().command({ ping: 1 });
}