import type { Filter } from "mongodb";
import { canAssign, canList, PermissionError, visibilityScope, type Actor, type ListRequest } from "@/lib/auth/permissions";
import { collections, nextId } from "@/lib/db/client";
import { COLLECTIONS, type TaskStatus } from "@/lib/db/schema";

/**
 * The only module that touches the `tasks` collection. Every function takes the acting
 * employee and re-checks permissions here, so a bug or a manipulated flow upstream
 * still cannot write or read outside the actor's scope. The collection's validator
 * additionally rejects Friday due dates (see lib/db/schema.ts).
 */

export type NewTask = {
  assignee: Actor;
  description: string;
  dueDate: string;
  dueTime: string | null;
  movedFromDate: string | null;
  sourceMessage: string;
};

export type TaskView = {
  id: number;
  description: string;
  assigneeId: number;
  assigneeName: string;
  createdBy: number;
  dueDate: string;
  dueTime: string | null;
  movedFromDate: string | null;
  status: TaskStatus;
};

export async function createTaskAs(actor: Actor, input: NewTask): Promise<TaskView> {
  const decision = canAssign(actor, input.assignee);
  if (!decision.allowed) throw new PermissionError(decision.reason);

  const { tasks, counters } = await collections();
  const id = await nextId(counters, COLLECTIONS.tasks);
  const doc = {
    _id: id,
    description: input.description,
    assigneeId: input.assignee.id,
    createdBy: actor.id,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    movedFromDate: input.movedFromDate,
    status: "pending" as const,
    sourceMessage: input.sourceMessage,
    createdAt: new Date(),
  };
  await tasks.insertOne(doc);

  return {
    id,
    description: doc.description,
    assigneeId: doc.assigneeId,
    assigneeName: input.assignee.name,
    createdBy: doc.createdBy,
    dueDate: doc.dueDate,
    dueTime: doc.dueTime,
    movedFromDate: doc.movedFromDate,
    status: doc.status,
  };
}

export async function listTasksAs(actor: Actor, request: ListRequest): Promise<TaskView[]> {
  const decision = canList(actor, request);
  if (!decision.allowed) throw new PermissionError(decision.reason);

  // The actor's scope is always applied, and the request can only narrow it further.
  const scope = visibilityScope(actor);
  const conditions: Filter<Record<string, unknown>>[] = [];
  if (scope.kind === "self") conditions.push({ assigneeId: scope.userId });
  if (scope.kind === "department") conditions.push({ "assignee.department": scope.department });

  switch (request.kind) {
    case "self":
      conditions.push({ assigneeId: actor.id });
      break;
    case "employee":
      conditions.push({ assigneeId: request.employee.id });
      break;
    case "department":
      conditions.push({ "assignee.department": request.department });
      break;
    case "all":
      break;
  }

  const { tasks } = await collections();
  return tasks
    .aggregate<TaskView>([
      { $lookup: { from: COLLECTIONS.employees, localField: "assigneeId", foreignField: "_id", as: "assignee" } },
      { $unwind: "$assignee" },
      { $match: conditions.length > 0 ? { $and: conditions } : {} },
      { $sort: { dueDate: 1, dueTime: 1, _id: 1 } },
      {
        $project: {
          _id: 0,
          id: "$_id",
          description: 1,
          assigneeId: 1,
          assigneeName: "$assignee.name",
          createdBy: 1,
          dueDate: 1,
          dueTime: 1,
          movedFromDate: 1,
          status: 1,
        },
      },
    ])
    .toArray();
}
