import { collections, nextId } from "@/lib/db/client";
import { COLLECTIONS, type AuditEntry, type AuditRow } from "@/lib/db/schema";

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { auditLog, counters } = await collections();
  const id = await nextId(counters, COLLECTIONS.auditLog);
  await auditLog.insertOne({ _id: id, createdAt: new Date(), ...entry });
}

export async function listAudit(limit = 100): Promise<AuditRow[]> {
  const { auditLog } = await collections();
  const docs = await auditLog.find().sort({ _id: -1 }).limit(limit).toArray();
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
}
