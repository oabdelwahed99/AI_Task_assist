export const ROLES = ["manager", "supervisor", "employee"] as const;
export type Role = (typeof ROLES)[number];

export const TASK_STATUSES = ["pending", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Employee = {
  id: number;
  name: string;
  department: string;
  role: Role;
};

export type Task = {
  id: number;
  description: string;
  assigneeId: number;
  createdBy: number;
  /** YYYY-MM-DD in Asia/Riyadh */
  dueDate: string;
  /** HH:mm (24h) in Asia/Riyadh, null when no time was given */
  dueTime: string | null;
  /** Set when the requested date was a Friday and the task was moved to Saturday */
  movedFromDate: string | null;
  status: TaskStatus;
  sourceMessage: string;
  createdAt: Date;
};

export type AuditRow = {
  id: number;
  createdAt: Date;
  userId: number | null;
  channel: string;
  message: string;
  intent: string | null;
  action: string;
  taskId: number | null;
  reason: string | null;
  reply: string;
  runId: string | null;
  latencyMs: number;
};

export type AuditEntry = Omit<AuditRow, "id" | "createdAt">;

export type TelegramLink = {
  chatId: string;
  userId: number;
  linkedAt: Date;
};

/** Stored documents use the numeric (or chat) id as `_id`; repositories map it back to `id`. */
export type EmployeeDoc = Omit<Employee, "id"> & { _id: number };
export type TaskDoc = Omit<Task, "id"> & { _id: number };
export type AuditDoc = Omit<AuditRow, "id"> & { _id: number };
export type TelegramLinkDoc = Omit<TelegramLink, "chatId"> & { _id: string };
export type CounterDoc = { _id: string; seq: number };

export const COLLECTIONS = {
  employees: "employees",
  tasks: "tasks",
  auditLog: "audit_log",
  telegramLinks: "telegram_links",
  counters: "counters",
} as const;

const nullableString = { bsonType: ["string", "null"] };

/**
 * `$jsonSchema` validators installed when a collection is created. The `tasks` validator also
 * rejects any due date that falls on a Friday (R4), so even code that bypasses the repository
 * cannot store one. `$dayOfWeek` returns 1 for Sunday, so Friday is 6.
 */
export const VALIDATORS: Record<string, object> = {
  [COLLECTIONS.employees]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "name", "department", "role"],
      properties: {
        _id: { bsonType: "int" },
        name: { bsonType: "string" },
        department: { bsonType: "string" },
        role: { enum: [...ROLES] },
      },
    },
  },
  [COLLECTIONS.tasks]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "description", "assigneeId", "createdBy", "dueDate", "status", "sourceMessage", "createdAt"],
      properties: {
        _id: { bsonType: "int" },
        description: { bsonType: "string" },
        assigneeId: { bsonType: "int" },
        createdBy: { bsonType: "int" },
        dueDate: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        dueTime: { bsonType: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
        movedFromDate: nullableString,
        status: { enum: [...TASK_STATUSES] },
        sourceMessage: { bsonType: "string" },
        createdAt: { bsonType: "date" },
      },
    },
    $expr: { $ne: [{ $dayOfWeek: { $dateFromString: { dateString: "$dueDate", format: "%Y-%m-%d" } } }, 6] },
  },
  [COLLECTIONS.auditLog]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "createdAt", "channel", "message", "action", "reply", "latencyMs"],
      properties: {
        _id: { bsonType: "int" },
        createdAt: { bsonType: "date" },
        channel: { bsonType: "string" },
        message: { bsonType: "string" },
        action: { bsonType: "string" },
        reply: { bsonType: "string" },
        latencyMs: { bsonType: ["int", "long", "double"] },
      },
    },
  },
  [COLLECTIONS.telegramLinks]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "userId", "linkedAt"],
      properties: {
        _id: { bsonType: "string" },
        userId: { bsonType: "int" },
        linkedAt: { bsonType: "date" },
      },
    },
  },
};
