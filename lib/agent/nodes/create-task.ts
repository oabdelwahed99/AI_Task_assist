import { matchByName } from "@/lib/arabic/normalize";
import { canAssign, PermissionError } from "@/lib/auth/permissions";
import { resolveSchedule } from "@/lib/dates/resolve";
import { now } from "@/lib/env";
import { listEmployees } from "@/lib/repo/employees";
import { createTaskAs } from "@/lib/repo/tasks";
import { toDateRef, toTimeRef } from "../intent";
import * as replies from "../replies";
import type { AgentStateType, AgentUpdate } from "../state";

const clarifyResult = (reason: Parameters<typeof replies.clarify>[0], ctx?: Parameters<typeof replies.clarify>[1]) => ({
  result: { action: "clarify" as const, reason, reply: replies.clarify(reason, ctx) },
});

/** Resolves who the task is for against the employees table. Unknown or ambiguous names are never guessed. */
export async function resolveAssignee(state: AgentStateType): Promise<AgentUpdate> {
  const actor = state.actor!;
  const task = state.intent!.task;
  if (!task) return clarifyResult("missing_description");

  if (task.assignee === "self") return { assignee: actor };

  const name = task.assignee_name?.trim();
  if (!name) return clarifyResult("missing_assignee");

  const all = await listEmployees();
  const matches = matchByName(name, all);
  if (matches.length === 1 && matches[0].id === actor.id) return { assignee: actor };

  // An employee may only assign to themself, whether or not the named person exists.
  if (actor.role === "employee") {
    return {
      result: {
        action: "rejected",
        reason: "employee_can_only_assign_self",
        reply: replies.rejected(actor, "employee_can_only_assign_self"),
      },
    };
  }

  if (matches.length === 0) {
    const assignable = all.filter((e) => canAssign(actor, e).allowed).map((e) => e.name);
    return clarifyResult("unknown_assignee", { name, options: assignable });
  }
  if (matches.length > 1) {
    return clarifyResult("ambiguous_assignee", { name, options: matches.map((m) => `${m.name} (${m.department})`) });
  }
  return { assignee: matches[0] };
}

export async function authorizeAssignment(state: AgentStateType): Promise<AgentUpdate> {
  const actor = state.actor!;
  const assignee = state.assignee!;
  const decision = canAssign(actor, assignee);
  if (decision.allowed) return {};
  return {
    result: { action: "rejected", reason: decision.reason, reply: replies.rejected(actor, decision.reason, { assignee }) },
  };
}

export async function resolveTaskSchedule(state: AgentStateType): Promise<AgentUpdate> {
  const task = state.intent!.task!;
  if (!task.description?.trim()) return clarifyResult("missing_description");

  const dateRef = toDateRef(task.date);
  if (!dateRef) return clarifyResult("invalid_date");

  const resolved = resolveSchedule(dateRef, toTimeRef(task.time), now());
  if (!resolved.ok) return clarifyResult(resolved.reason);
  return { schedule: resolved.schedule };
}

export async function persistTask(state: AgentStateType): Promise<AgentUpdate> {
  const actor = state.actor!;
  const assignee = state.assignee!;
  const schedule = state.schedule!;
  try {
    const task = await createTaskAs(actor, {
      assignee,
      description: state.intent!.task!.description!.trim(),
      dueDate: schedule.date,
      dueTime: schedule.time,
      movedFromDate: schedule.movedFromDate,
      sourceMessage: state.message,
    });
    return { result: { action: "create_task", task_id: task.id, task, reply: replies.taskCreated(actor, task) } };
  } catch (error) {
    if (error instanceof PermissionError) {
      return {
        result: { action: "rejected", reason: error.reason, reply: replies.rejected(actor, error.reason, { assignee }) },
      };
    }
    throw error;
  }
}
