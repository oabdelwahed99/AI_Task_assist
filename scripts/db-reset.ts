import "./load-env";
import { closeDatabase, databaseName, resetDatabase } from "@/lib/db/client";

await resetDatabase();
console.log(`Database reset: ${databaseName()} (employees re-seeded, tasks and audit log cleared)`);
await closeDatabase();
