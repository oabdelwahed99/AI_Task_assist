import { MongoClient, type Collection, type Db } from "mongodb";
import {
  COLLECTIONS,
  VALIDATORS,
  type AuditDoc,
  type CounterDoc,
  type EmployeeDoc,
  type TaskDoc,
  type TelegramLinkDoc,
} from "./schema";
import { SEED_EMPLOYEES } from "./seed";

export const DEFAULT_DB_NAME = "smart_task_assistant";

type DbHandle = { client: MongoClient; db: Db; ready: Promise<void> };

const globalForDb = globalThis as unknown as { __taskDb?: Map<string, DbHandle> };

export function mongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is missing. Add your MongoDB connection string to .env.");
  return uri;
}

export function databaseName(): string {
  return process.env.MONGODB_DB?.trim() || DEFAULT_DB_NAME;
}

async function migrateAndSeed(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const [name, validator] of Object.entries(VALIDATORS)) {
    if (!existing.has(name)) await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  await db.collection<TaskDoc>(COLLECTIONS.tasks).createIndex({ assigneeId: 1 });
  await db.collection<AuditDoc>(COLLECTIONS.auditLog).createIndex({ createdAt: -1 });
  await db.collection<EmployeeDoc>(COLLECTIONS.employees).bulkWrite(
    SEED_EMPLOYEES.map(({ id, ...rest }) => ({
      replaceOne: { filter: { _id: id }, replacement: rest, upsert: true },
    })),
  );
}

function handle(): DbHandle {
  const uri = mongoUri();
  const name = databaseName();
  const key = `${uri}|${name}`;
  globalForDb.__taskDb ??= new Map();
  let h = globalForDb.__taskDb.get(key);
  if (!h) {
    const client = new MongoClient(uri, { appName: "smart-task-assistant" });
    const db = client.db(name);
    const ready = client.connect().then(() => migrateAndSeed(db));
    // A failed connection must not be cached forever; the next request retries.
    ready.catch(() => globalForDb.__taskDb?.delete(key));
    h = { client, db, ready };
    globalForDb.__taskDb.set(key, h);
  }
  return h;
}

/** Returns a ready-to-use database (collections created and employees seeded). */
export async function getDb(): Promise<Db> {
  const h = handle();
  await h.ready;
  return h.db;
}

export async function collections() {
  const db = await getDb();
  return {
    employees: db.collection<EmployeeDoc>(COLLECTIONS.employees),
    tasks: db.collection<TaskDoc>(COLLECTIONS.tasks),
    auditLog: db.collection<AuditDoc>(COLLECTIONS.auditLog),
    telegramLinks: db.collection<TelegramLinkDoc>(COLLECTIONS.telegramLinks),
    counters: db.collection<CounterDoc>(COLLECTIONS.counters),
  };
}

/** Next value of an auto-increment sequence, so tasks keep short numeric ids ("المهمة رقم 3"). */
export async function nextId(counters: Collection<CounterDoc>, sequence: string): Promise<number> {
  const doc = await counters.findOneAndUpdate(
    { _id: sequence },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return doc!.seq;
}

/** Deletes all tasks, audit entries and Telegram links and resets id counters. Employees are re-seeded. */
export async function resetDatabase(): Promise<void> {
  const c = await collections();
  await Promise.all([
    c.tasks.deleteMany({}),
    c.auditLog.deleteMany({}),
    c.telegramLinks.deleteMany({}),
    c.counters.deleteMany({}),
  ]);
  await migrateAndSeed(await getDb());
}

/** Drops the whole database. Used by tests and the eval script for their throwaway databases. */
export async function dropDatabase(): Promise<void> {
  const h = handle();
  await h.ready;
  await h.db.dropDatabase();
  globalForDb.__taskDb?.delete(`${mongoUri()}|${databaseName()}`);
  await h.client.close();
}

/** Closes every open connection so scripts can exit. */
export async function closeDatabase(): Promise<void> {
  const handles = [...(globalForDb.__taskDb?.values() ?? [])];
  globalForDb.__taskDb?.clear();
  await Promise.all(handles.map((h) => h.client.close()));
}
