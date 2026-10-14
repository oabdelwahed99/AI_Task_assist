import { END, START, StateGraph } from "@langchain/langgraph";
import { extractIntent, loadActor, unsupported } from "./nodes/common";
import { authorizeAssignment, persistTask, resolveAssignee, resolveTaskSchedule } from "./nodes/create-task";
import { authorizeListing, fetchTasks } from "./nodes/list-tasks";
import { answerPolicy, verifyGrounding } from "./nodes/policy";
import { AgentState, type AgentStateType } from "./state";
import type { AgentDeps } from "./types";

/** Continue to `next` unless a node already produced the final result (rejection / clarification). */
const unlessDone =
  <T extends string>(next: T) =>
  (state: AgentStateType) =>
    state.result ? END : next;

function routeByIntent(state: AgentStateType) {
  switch (state.intent?.intent) {
    case "create_task":
      return "resolveAssignee";
    case "list_tasks":
      return "authorizeListing";
    case "policy_question":
      return "answerPolicy";
    default:
      return "unsupported";
  }
}

/**
 *   START → loadActor → extractIntent ─┬─ create_task ─→ resolveAssignee → authorizeAssignment → resolveTaskSchedule → persistTask
 *                                      ├─ list_tasks ──→ authorizeListing → fetchTasks
 *                                      ├─ policy ──────→ answerPolicy → verifyGrounding
 *                                      └─ other ───────→ unsupported
 * Any node may end the turn early by setting `result`.
 */
export function buildAgentGraph(deps: AgentDeps) {
  return new StateGraph(AgentState)
    .addNode("loadActor", loadActor)
    .addNode("extractIntent", extractIntent(deps))
    .addNode("resolveAssignee", resolveAssignee)
    .addNode("authorizeAssignment", authorizeAssignment)
    .addNode("resolveTaskSchedule", resolveTaskSchedule)
    .addNode("persistTask", persistTask)
    .addNode("authorizeListing", authorizeListing)
    .addNode("fetchTasks", fetchTasks)
    .addNode("answerPolicy", answerPolicy(deps))
    .addNode("verifyGrounding", verifyGrounding)
    .addNode("unsupported", unsupported)
    .addEdge(START, "loadActor")
    .addConditionalEdges("loadActor", unlessDone("extractIntent"), ["extractIntent", END])
    .addConditionalEdges("extractIntent", routeByIntent, [
      "resolveAssignee",
      "authorizeListing",
      "answerPolicy",
      "unsupported",
    ])
    .addConditionalEdges("resolveAssignee", unlessDone("authorizeAssignment"), ["authorizeAssignment", END])
    .addConditionalEdges("authorizeAssignment", unlessDone("resolveTaskSchedule"), ["resolveTaskSchedule", END])
    .addConditionalEdges("resolveTaskSchedule", unlessDone("persistTask"), ["persistTask", END])
    .addEdge("persistTask", END)
    .addConditionalEdges("authorizeListing", unlessDone("fetchTasks"), ["fetchTasks", END])
    .addEdge("fetchTasks", END)
    .addEdge("answerPolicy", "verifyGrounding")
    .addEdge("verifyGrounding", END)
    .addEdge("unsupported", END)
    .compile();
}

export type AgentGraph = ReturnType<typeof buildAgentGraph>;
