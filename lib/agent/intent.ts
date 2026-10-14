import { z } from "zod";
import { PERIODS, WEEKDAYS, type DateRef, type TimeRef } from "@/lib/dates/resolve";

/**
 * Structured output of the LLM. Every field is required + nullable so the schema works
 * with OpenAI strict JSON-schema mode. The schema describes what the user *said*; it
 * contains no permission or identity fields on purpose.
 */
export const IntentSchema = z.object({
  intent: z
    .enum(["create_task", "list_tasks", "policy_question", "other"])
    .describe("What the sender wants. Reminders (ذكرني) are create_task."),
  task: z
    .object({
      assignee: z
        .enum(["self", "named"])
        .describe("self = the task is for the sender (ذكرني، سجل لي، or no person mentioned). named = a person is named."),
      assignee_name: z
        .string()
        .nullable()
        .describe("The person's name exactly as written, without the preposition ل (لخالد → خالد). Never correct or guess."),
      description: z
        .string()
        .nullable()
        .describe("The task itself, short, without the person, date or time. null if the message has no task content."),
      date: z.object({
        kind: z.enum(["today", "tomorrow", "day_after_tomorrow", "weekday", "in_days", "absolute", "none"]),
        weekday: z.enum(WEEKDAYS).nullable().describe("Only for kind=weekday"),
        days: z.number().nullable().describe("Only for kind=in_days (بعد 3 أيام → 3)"),
        day: z.number().nullable().describe("Only for kind=absolute"),
        month: z.number().nullable().describe("Only for kind=absolute, 1-12"),
        year: z.number().nullable().describe("Only for kind=absolute, null if not said"),
      }),
      time: z.object({
        hour: z.number().nullable().describe("Hour exactly as said (الساعة 10 → 10, 1 الظهر → 1). Do NOT convert to 24h."),
        minute: z.number().nullable().describe("ونص → 30, وربع → 15, إلا ربع → hour-1 and 45"),
        period: z
          .enum(PERIODS)
          .nullable()
          .describe("Part of day if said: الصبح/صباحاً=morning, الظهر=noon, العصر=asr, المغرب=maghrib, المساء/الليل=evening"),
      }),
    })
    .nullable()
    .describe("Only for intent=create_task"),
  list: z
    .object({
      scope: z
        .enum(["self", "employee", "department", "all"])
        .describe("self = my tasks; employee = a named person's tasks; department = a team/department; all = everyone / the whole company"),
      employee_name: z.string().nullable().describe("Only for scope=employee"),
      department_name: z.string().nullable().describe("Only for scope=department; null means the sender's own department"),
    })
    .nullable()
    .describe("Only for intent=list_tasks"),
  policy_question: z.string().nullable().describe("Only for intent=policy_question: the question, copied as asked"),
});

export type Intent = z.infer<typeof IntentSchema>;
export type TaskIntent = NonNullable<Intent["task"]>;

export const PolicyAnswerSchema = z.object({
  found: z.boolean().describe("true only if the policy clauses fully answer the question"),
  clause_ids: z.array(z.number()).describe("Ids of the clauses the answer is based on; empty if not found"),
  answer: z.string().describe("Short Arabic answer using only the clause content; empty if not found"),
});

export type PolicyDraft = z.infer<typeof PolicyAnswerSchema>;

/** Maps the LLM's date description to the resolver's type. Returns null when it is self-contradictory. */
export function toDateRef(date: TaskIntent["date"]): DateRef | null {
  switch (date.kind) {
    case "weekday":
      return date.weekday ? { kind: "weekday", weekday: date.weekday } : null;
    case "in_days":
      return date.days !== null ? { kind: "in_days", days: date.days } : null;
    case "absolute": {
      const { day, month, year } = date;
      const valid =
        Number.isInteger(day) && Number.isInteger(month) && (year === null || Number.isInteger(year));
      return valid ? { kind: "absolute", day: day!, month: month!, year } : null;
    }
    default:
      return { kind: date.kind };
  }
}

export function toTimeRef(time: TaskIntent["time"]): TimeRef {
  return { hour: time.hour, minute: time.minute, period: time.period };
}
