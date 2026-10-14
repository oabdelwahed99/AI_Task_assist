import { getEmployee } from "@/lib/repo/employees";
import * as replies from "../replies";
import type { AgentStateType, AgentUpdate } from "../state";
import type { AgentDeps } from "../types";

export async function loadActor(state: AgentStateType): Promise<AgentUpdate> {
  const employee = await getEmployee(state.userId);
  if (!employee) {
    return { actor: null, result: { action: "rejected", reason: "unknown_user", reply: replies.UNKNOWN_USER } };
  }
  return { actor: employee };
}

export function extractIntent(deps: AgentDeps) {
  return async (state: AgentStateType): Promise<AgentUpdate> => {
    const intent = await deps.extractIntent({ message: state.message, senderName: state.actor!.name });
    return { intent };
  };
}

export async function unsupported(): Promise<AgentUpdate> {
  return {
    result: { action: "clarify", reason: "unsupported_request", reply: replies.clarify("unsupported_request") },
  };
}
