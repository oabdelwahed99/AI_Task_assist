import { matchByName, matchDepartment } from "@/lib/arabic/normalize";
import { canList, PermissionError, type ListRequest } from "@/lib/auth/permissions";
import { DEPARTMENTS } from "@/lib/db/seed";
import { listEmployees } from "@/lib/repo/employees";
import { listTasksAs } from "@/lib/repo/tasks";
import * as replies from "../replies";
import type { AgentStateType, AgentUpdate } from "../state";

/** Turns the requested scope into a concrete request and checks it against the actor's role from the DB. */
export async function authorizeListing(state: AgentStateType): Promise<AgentUpdate> {
  const actor = state.actor!;
  const list = state.intent!.list ?? { scope: "self", employee_name: null, department_name: null };
  const reject = (reason: Parameters<typeof replies.rejected>[1]) => ({
    result: { action: "rejected" as const, reason, reply: replies.rejected(actor, reason) },
  });

  let request: ListRequest;
  switch (list.scope) {
    case "self":
      request = { kind: "self" };
      break;
    case "all":
      request = { kind: "all" };
      break;
    case "employee": {
      const name = list.employee_name?.trim() ?? "";
      const matches = matchByName(name, await listEmployees());
      if (matches.length === 1 && matches[0].id === actor.id) {
        request = { kind: "self" };
        break;
      }
      if (actor.role === "employee") return reject("employee_can_only_view_self");
      if (matches.length !== 1) {
        return { result: { action: "clarify", reason: "unknown_employee", reply: replies.clarify("unknown_employee", { name }) } };
      }
      request = { kind: "employee", employee: matches[0] };
      break;
    }
    case "department": {
      if (actor.role === "employee") return reject("employee_can_only_view_self");
      const rawName = list.department_name?.trim();
      const department = rawName ? matchDepartment(rawName, DEPARTMENTS) : actor.department;
      if (!department) {
        return {
          result: {
            action: "clarify",
            reason: "unknown_department",
            reply: replies.clarify("unknown_department", { name: rawName, options: [...DEPARTMENTS] }),
          },
        };
      }
      request = { kind: "department", department };
      break;
    }
  }

  const decision = canList(actor, request);
  if (!decision.allowed) return reject(decision.reason);
  return { listRequest: request };
}

export async function fetchTasks(state: AgentStateType): Promise<AgentUpdate> {
  const actor = state.actor!;
  const request = state.listRequest!;
  try {
    const tasks = await listTasksAs(actor, request);
    const heading =
      request.kind === "employee"
        ? { kind: "employee" as const, name: request.employee.name }
        : request.kind === "department"
          ? { kind: "department" as const, department: request.department }
          : { kind: request.kind };
    return { result: { action: "list_tasks", tasks, reply: replies.taskList(heading, tasks) } };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { result: { action: "rejected", reason: error.reason, reply: replies.rejected(actor, error.reason) } };
    }
    throw error;
  }
}
