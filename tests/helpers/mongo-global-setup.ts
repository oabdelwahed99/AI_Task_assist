import { MongoMemoryServer } from "mongodb-memory-server";

/** Starts a throwaway in-memory MongoDB for the test run, so tests never touch the database in `.env`. */
let server: MongoMemoryServer | undefined;

export async function setup() {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
}

export async function teardown() {
  await server?.stop();
}
