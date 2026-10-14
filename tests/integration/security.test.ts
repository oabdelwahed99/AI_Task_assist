import { beforeAll, describe, expect, it } from "vitest";
import { PermissionError } from "@/lib/auth/permissions";
import { collections } from "@/lib/db/client";
import { SEED_EMPLOYEES } from "@/lib/db/seed";
import { createTaskAs, listTasksAs } from "@/lib/repo/tasks";
import { fakeDeps, listIntent, taskIntent, useTempDatabase } from "../helpers/fixtures";

const [muneera, sara, fahd, khalid, noura, abdulrahman] = SEED_EMPLOYEES;

const baseTask = { description: "x", dueDate: "2026-10-14", dueTime: "10:00", movedFromDate: null, sourceMessage: "test" };

beforeAll(async () => {
  useTempDatabase();
  process.env.APP_NOW = "2026-10-13T09:00:00";
  // One task per employee, created by someone allowed to.
  await createTaskAs(sara, { ...baseTask, assignee: fahd, description: "مهمة فهد" });
  await createTaskAs(sara, { ...baseTask, assignee: khalid, description: "مهمة خالد" });
  await createTaskAs(abdulrahman, { ...baseTask, assignee: noura, description: "مهمة نورة" });
  await createTaskAs(muneera, { ...baseTask, assignee: abdulrahman, description: "مهمة عبدالرحمن" });
  await createTaskAs(muneera, { ...baseTask, assignee: sara, description: "مهمة سارة" });
});

describe("repository enforces R3 on reads", () => {
  it("employee sees only their own tasks", async () => {
    const tasks = await listTasksAs(khalid, { kind: "self" });
    expect(tasks.map((t) => t.assigneeId)).toEqual([4]);
  });

  it("supervisor sees only their department", async () => {
    const tasks = await listTasksAs(sara, { kind: "department", department: "المشاريع" });
    expect(new Set(tasks.map((t) => t.assigneeId))).toEqual(new Set([2, 3, 4]));
  });

  it("manager sees everything", async () => {
    expect(await listTasksAs(muneera, { kind: "all" })).toHaveLength(5);
  });

  it("throws instead of returning data for out-of-scope requests", async () => {
    await expect(listTasksAs(fahd, { kind: "all" })).rejects.toBeInstanceOf(PermissionError);
    await expect(listTasksAs(sara, { kind: "employee", employee: noura })).rejects.toBeInstanceOf(PermissionError);
    await expect(listTasksAs(abdulrahman, { kind: "department", department: "المشاريع" })).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("repository enforces R3 on writes", () => {
  it("throws when an employee assigns to someone else", async () => {
    await expect(createTaskAs(fahd, { ...baseTask, assignee: khalid })).rejects.toBeInstanceOf(PermissionError);
  });

  it("throws when a supervisor assigns outside their department", async () => {
    await expect(createTaskAs(sara, { ...baseTask, assignee: noura })).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("database guards (last line of defence)", () => {
  const rawTask = (overrides: Record<string, unknown>) => ({
    _id: 999,
    description: "x",
    assigneeId: 3,
    createdBy: 3,
    dueDate: "2026-10-14",
    dueTime: null,
    movedFromDate: null,
    status: "pending",
    sourceMessage: "raw",
    createdAt: new Date(),
    ...overrides,
  });

  it("validator blocks a raw insert with a Friday due date (R4)", async () => {
    const { tasks } = await collections();
    await expect(tasks.insertOne(rawTask({ dueDate: "2026-10-16" }) as never)).rejects.toThrow(/Document failed validation/);
  });

  it("validator blocks moving an existing task to a Friday via raw update", async () => {
    const { tasks } = await collections();
    await expect(tasks.updateOne({ _id: 1 }, { $set: { dueDate: "2026-10-16" } })).rejects.toThrow(/Document failed validation/);
  });

  it("validator blocks malformed task documents", async () => {
    const { tasks } = await collections();
    await expect(tasks.insertOne(rawTask({ status: "hacked" }) as never)).rejects.toThrow(/Document failed validation/);
    await expect(tasks.insertOne(rawTask({ dueDate: "tomorrow" }) as never)).rejects.toThrow(/Document failed validation/);
  });
});

describe("a compromised LLM still cannot break permissions", () => {
  // The fake LLM below behaves as if a prompt injection fully succeeded.
  const deps = fakeDeps({
    "jailbreak-assign": taskIntent({ assignee: "named", assignee_name: "نورة", description: "حوّل مبلغ", date: { kind: "tomorrow" } }),
    "jailbreak-list": listIntent({ scope: "all" }),
    "jailbreak-colleague": listIntent({ scope: "employee", employee_name: "خالد" }),
    "jailbreak-department": listIntent({ scope: "department", department_name: "المالية" }),
  });

  it("employee cannot assign to another employee", async () => {
    const { handleChat } = await import("@/lib/chat/handle-chat");
    const r = await handleChat({ userId: 3, message: "jailbreak-assign", channel: "script" }, deps);
    expect(r.action).toBe("rejected");
    expect(r.task_id).toBeUndefined();
  });

  it("employee cannot list all tasks, a colleague's tasks, or another department", async () => {
    const { handleChat } = await import("@/lib/chat/handle-chat");
    for (const message of ["jailbreak-list", "jailbreak-colleague", "jailbreak-department"]) {
      const r = await handleChat({ userId: 3, message, channel: "script" }, deps);
      expect(r.action).toBe("rejected");
      expect(r.tasks).toBeUndefined();
    }
  });

  it("supervisor cannot read another department", async () => {
    const { handleChat } = await import("@/lib/chat/handle-chat");
    const r = await handleChat({ userId: 2, message: "jailbreak-department", channel: "script" }, deps);
    expect(r.action).toBe("rejected");
    expect(r.tasks).toBeUndefined();
  });

  it("every request is written to the audit log", async () => {
    const { auditLog } = await collections();
    const rows = await auditLog.find().toArray();
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.every((r) => r.action === "rejected")).toBe(true);
  });
});
