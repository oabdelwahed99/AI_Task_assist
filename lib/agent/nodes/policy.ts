import { findClauses, isGroundedAnswer } from "@/lib/policy/policy";
import * as replies from "../replies";
import type { AgentStateType, AgentUpdate } from "../state";
import type { AgentDeps } from "../types";

export function answerPolicy(deps: AgentDeps) {
  return async (state: AgentStateType): Promise<AgentUpdate> => {
    const question = state.intent!.policy_question?.trim() || state.message;
    return { policyDraft: await deps.answerPolicy(question) };
  };
}

/** R5: the model's answer is only used if it cites real clauses and adds no numbers of its own. */
export async function verifyGrounding(state: AgentStateType): Promise<AgentUpdate> {
  const draft = state.policyDraft!;
  const clauses = findClauses(draft.clause_ids);
  const sources = clauses.map((c) => ({ id: c.id, text: c.text }));

  if (!draft.found || clauses.length === 0) {
    return { result: { action: "info_not_available", reply: replies.INFO_NOT_AVAILABLE, sources: [] } };
  }
  if (draft.answer.trim() && isGroundedAnswer(draft.answer, draft.clause_ids)) {
    return { result: { action: "answer_policy", reply: replies.policyAnswer(draft.answer, clauses), sources } };
  }
  return { result: { action: "answer_policy", reply: replies.policyVerbatim(clauses), sources } };
}
