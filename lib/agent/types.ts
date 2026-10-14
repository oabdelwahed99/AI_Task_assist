import type { DenyReason } from "@/lib/auth/permissions";
import type { TaskView } from "@/lib/repo/tasks";
import type { Intent, PolicyDraft } from "./intent";

export const CHAT_ACTIONS = [
  "create_task",
  "list_tasks",
  "answer_policy",
  "info_not_available",
  "clarify",
  "rejected",
  "error",
] as const;
export type ChatAction = (typeof CHAT_ACTIONS)[number];

export type ClarifyReason =
  | "unknown_assignee"
  | "ambiguous_assignee"
  | "missing_assignee"
  | "missing_description"
  | "missing_date"
  | "invalid_date"
  | "past_date"
  | "invalid_time"
  | "unknown_employee"
  | "unknown_department"
  | "unsupported_request";

export type ChatResult = {
  action: ChatAction;
  reply: string;
  task_id?: number;
  task?: TaskView;
  tasks?: TaskView[];
  sources?: { id: number; text: string }[];
  /** Machine-readable reason for clarify / rejected outcomes. */
  reason?: ClarifyReason | DenyReason | "unknown_user" | "internal_error";
};

/** The two LLM capabilities the graph needs. Injected so tests can run without a network. */
export type AgentDeps = {
  extractIntent(input: { message: string; senderName: string }): Promise<Intent>;
  answerPolicy(question: string): Promise<PolicyDraft>;
};
