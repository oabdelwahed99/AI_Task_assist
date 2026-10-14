import { randomUUID } from "node:crypto";
import type { Intent, PolicyDraft, TaskIntent } from "@/lib/agent/intent";
import type { AgentDeps } from "@/lib/agent/types";

/** Points the app at a fresh, empty MongoDB database. Call before the first database access in a test suite. */
export function useTempDatabase(): string {
  const name = `test_${randomUUID().slice(0, 8)}`;
  process.env.MONGODB_DB = name;
  return name;
}

const noDate: TaskIntent["date"] = { kind: "none", weekday: null, days: null, day: null, month: null, year: null };
const noTime: TaskIntent["time"] = { hour: null, minute: null, period: null };

export function taskIntent(task: Partial<Omit<TaskIntent, "date" | "time">> & {
  date?: Partial<TaskIntent["date"]>;
  time?: Partial<TaskIntent["time"]>;
}): Intent {
  return {
    intent: "create_task",
    task: {
      assignee: task.assignee ?? "self",
      assignee_name: task.assignee_name ?? null,
      description: task.description ?? null,
      date: { ...noDate, ...task.date },
      time: { ...noTime, ...task.time },
    },
    list: null,
    policy_question: null,
  };
}

export function listIntent(list: Partial<NonNullable<Intent["list"]>>): Intent {
  return {
    intent: "list_tasks",
    task: null,
    list: { scope: "self", employee_name: null, department_name: null, ...list },
    policy_question: null,
  };
}

export function policyIntent(question: string): Intent {
  return { intent: "policy_question", task: null, list: null, policy_question: question };
}

/** What a correct parser returns for each of the brief's ten messages. */
export const SCENARIO_INTENTS: Record<string, Intent> = {
  T01: taskIntent({ assignee: "named", assignee_name: "خالد", description: "يراجع عرض السعر", date: { kind: "tomorrow" }, time: { hour: 10 } }),
  T02: taskIntent({ assignee: "named", assignee_name: "خالد", description: "يطبع المخططات", date: { kind: "weekday", weekday: "sunday" } }),
  T03: taskIntent({ assignee: "self", description: "أرسل التقرير", date: { kind: "weekday", weekday: "friday" }, time: { hour: 9 } }),
  T04: taskIntent({ assignee: "named", assignee_name: "نورة", description: "تجهّز الفاتورة", date: { kind: "today" }, time: { period: "asr" } }),
  T05: listIntent({ scope: "self" }),
  T06: policyIntent("كم يوم لازم أقدّم قبل الإجازة؟"),
  T07: policyIntent("كم بدل السكن للموظفين؟"),
  T08: listIntent({ scope: "all" }),
  T09: taskIntent({ assignee: "named", assignee_name: "عبدالرحمن", description: "اجتماع مع المالية", date: { kind: "day_after_tomorrow" }, time: { hour: 1, period: "noon" } }),
  T10: taskIntent({ assignee: "named", assignee_name: "أحمد", description: null, date: { kind: "tomorrow" } }),
};

export const POLICY_DRAFTS: Record<string, PolicyDraft> = {
  "كم يوم لازم أقدّم قبل الإجازة؟": {
    found: true,
    clause_ids: [2],
    answer: "لازم تقدّم طلب الإجازة الاعتيادية قبل 5 أيام عمل على الأقل، ويعتمده مشرفك المباشر.",
  },
  "كم بدل السكن للموظفين؟": { found: false, clause_ids: [], answer: "" },
};

/** Fake LLM: returns a fixed intent per message. */
export function fakeDeps(intents: Record<string, Intent>, drafts: Record<string, PolicyDraft> = POLICY_DRAFTS): AgentDeps {
  return {
    extractIntent: async ({ message }) => {
      const intent = intents[message];
      if (!intent) throw new Error(`no fake intent for: ${message}`);
      return intent;
    },
    answerPolicy: async (question) => drafts[question] ?? { found: false, clause_ids: [], answer: "" },
  };
}
