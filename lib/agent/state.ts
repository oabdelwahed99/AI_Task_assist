import { Annotation } from "@langchain/langgraph";
import type { Actor, ListRequest } from "@/lib/auth/permissions";
import type { Schedule } from "@/lib/dates/resolve";
import type { Intent, PolicyDraft } from "./intent";
import type { ChatResult } from "./types";

export const AgentState = Annotation.Root({
  userId: Annotation<number>,
  message: Annotation<string>,
  /** Loaded from the database by userId — the single source of truth for the role. */
  actor: Annotation<Actor | null>,
  intent: Annotation<Intent | null>,
  assignee: Annotation<Actor | null>,
  schedule: Annotation<Schedule | null>,
  listRequest: Annotation<ListRequest | null>,
  policyDraft: Annotation<PolicyDraft | null>,
  /** Set by any node that finishes the conversation turn; the graph stops when it is present. */
  result: Annotation<ChatResult | null>,
});

export type AgentStateType = typeof AgentState.State;
export type AgentUpdate = typeof AgentState.Update;
