import type { Employee, Role } from "@/lib/db/schema";

/**
 * R3 lives here as pure functions. Every decision takes the actor as loaded from the
 * database by user_id — nothing the user writes in the message can change `actor.role`.
 */

export type Actor = Pick<Employee, "id" | "name" | "department" | "role">;

export type DenyReason =
  | "employee_can_only_assign_self"
  | "supervisor_other_department"
  | "employee_can_only_view_self"
  | "supervisor_can_only_view_department";

export type Decision = { allowed: true } | { allowed: false; reason: DenyReason };

const allow: Decision = { allowed: true };
const deny = (reason: DenyReason): Decision => ({ allowed: false, reason });

export function canAssign(actor: Actor, assignee: Actor): Decision {
  if (actor.role === "manager") return allow;
  if (actor.id === assignee.id) return allow;
  if (actor.role === "supervisor") {
    return actor.department === assignee.department ? allow : deny("supervisor_other_department");
  }
  return deny("employee_can_only_assign_self");
}

/** The widest set of tasks an actor may ever read. */
export type VisibilityScope =
  | { kind: "all" }
  | { kind: "department"; department: string }
  | { kind: "self"; userId: number };

export function visibilityScope(actor: Actor): VisibilityScope {
  switch (actor.role) {
    case "manager":
      return { kind: "all" };
    case "supervisor":
      return { kind: "department", department: actor.department };
    case "employee":
      return { kind: "self", userId: actor.id };
  }
}

/** What the user asked to see, after names were resolved against the database. */
export type ListRequest =
  | { kind: "self" }
  | { kind: "employee"; employee: Actor }
  | { kind: "department"; department: string }
  | { kind: "all" };

/**
 * Requests wider than the actor's scope are rejected, never silently narrowed, so the
 * user gets an explicit answer instead of a partial list that looks complete.
 */
export function canList(actor: Actor, request: ListRequest): Decision {
  const scope = visibilityScope(actor);
  const denyForRole = deny(
    actor.role === "employee" ? "employee_can_only_view_self" : "supervisor_can_only_view_department",
  );
  if (scope.kind === "all") return allow;
  switch (request.kind) {
    case "self":
      return allow;
    case "employee":
      if (request.employee.id === actor.id) return allow;
      return scope.kind === "department" && request.employee.department === scope.department
        ? allow
        : denyForRole;
    case "department":
      return scope.kind === "department" && request.department === scope.department ? allow : denyForRole;
    case "all":
      return denyForRole;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  manager: "مدير",
  supervisor: "مشرف",
  employee: "موظف",
};

export class PermissionError extends Error {
  constructor(public readonly reason: DenyReason) {
    super(`permission_denied: ${reason}`);
    this.name = "PermissionError";
  }
}
