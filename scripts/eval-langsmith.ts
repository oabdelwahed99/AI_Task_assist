/**
 * LangSmith evaluation of the ten acceptance messages.
 *
 *   pnpm eval              # creates the dataset if missing, then runs an experiment
 *   pnpm eval --recreate   # deletes and re-uploads the dataset first
 *
 * Runs in a throwaway MongoDB database (dropped at the end) that is reset before every example,
 * so results are independent and repeatable. Requires OPENAI_API_KEY, LANGSMITH_API_KEY and MONGODB_URI.
 */
import "./load-env";
import { randomUUID } from "node:crypto";
import { Client } from "langsmith";
import { evaluate, type EvaluatorT } from "langsmith/evaluation";
import type { ChatResult } from "@/lib/agent/types";
import { visibilityScope } from "@/lib/auth/permissions";
import { closeDatabase, dropDatabase, resetDatabase } from "@/lib/db/client";
import { SEED_EMPLOYEES } from "@/lib/db/seed";
import { now, openAiModel } from "@/lib/env";
import { checkScenario, SCENARIOS } from "@/lib/scenarios";

const DATASET = "smart-task-assistant-T01-T10";

for (const key of ["OPENAI_API_KEY", "LANGSMITH_API_KEY", "MONGODB_URI"]) {
  if (!process.env[key]) {
    console.error(`${key} is missing. Add it to .env first.`);
    process.exit(1);
  }
}
process.env.LANGSMITH_TRACING = "true";
process.env.MONGODB_DB = `eval_${randomUUID().slice(0, 8)}`;

/** Expected outcome per scenario, stored as the dataset's reference outputs. */
const REFERENCE: Record<string, { action: ChatResult["action"]; reason?: string; clause?: number; assignee_id?: number }> = {
  T01: { action: "create_task", assignee_id: 4 },
  T02: { action: "rejected", reason: "employee_can_only_assign_self" },
  T03: { action: "create_task", assignee_id: 3 },
  T04: { action: "rejected", reason: "supervisor_other_department" },
  T05: { action: "list_tasks" },
  T06: { action: "answer_policy", clause: 2 },
  T07: { action: "info_not_available" },
  T08: { action: "rejected", reason: "employee_can_only_view_self" },
  T09: { action: "create_task", assignee_id: 6 },
  T10: { action: "clarify", reason: "unknown_assignee" },
};

const client = new Client();

if (process.argv.includes("--recreate") && (await client.hasDataset({ datasetName: DATASET }))) {
  await client.deleteDataset({ datasetName: DATASET });
}
if (!(await client.hasDataset({ datasetName: DATASET }))) {
  const dataset = await client.createDataset(DATASET, {
    description: "مساعد المهام الذكي — the ten acceptance messages (T01–T10) from the task brief.",
  });
  await client.createExamples(
    SCENARIOS.map((s) => ({
      dataset_id: dataset.id,
      inputs: { id: s.id, user_id: s.userId, message: s.message },
      outputs: { ...REFERENCE[s.id], expected: s.expected },
      metadata: { scenario: s.id, sender: s.sender },
    })),
  );
  console.log(`Created dataset "${DATASET}" with ${SCENARIOS.length} examples.`);
}

type Inputs = { id: string; user_id: number; message: string };
type Outputs = ChatResult & { previous_t01?: ChatResult };

async function target(inputs: Inputs): Promise<Outputs> {
  // Clean database per example; maxConcurrency is 1 so examples never overlap.
  await resetDatabase();
  const { handleChat } = await import("@/lib/chat/handle-chat");

  // T05 ("وش مهامي؟") is only meaningful after T01 created a task for Khalid.
  let previous_t01: ChatResult | undefined;
  if (inputs.id === "T05") {
    const t01 = SCENARIOS.find((s) => s.id === "T01")!;
    previous_t01 = await handleChat({ userId: t01.userId, message: t01.message, channel: "script" });
  }
  const result = await handleChat({ userId: inputs.user_id, message: inputs.message, channel: "script" });
  return { ...result, previous_t01 };
}

type EvalArgs = { inputs: Inputs; outputs: Outputs; referenceOutputs?: (typeof REFERENCE)[string] };
type EvalResult = { key: string; score: number; comment?: string };

const actionMatches = ({ outputs, referenceOutputs }: EvalArgs): EvalResult => ({
  key: "action_matches",
  score: outputs.action === referenceOutputs?.action ? 1 : 0,
  comment: `expected ${referenceOutputs?.action}, got ${outputs.action}`,
});

const scenarioChecks = ({ inputs, outputs }: EvalArgs): EvalResult => {
  const previous: Record<string, ChatResult> = outputs.previous_t01 ? { T01: outputs.previous_t01 } : {};
  const failures = checkScenario(inputs.id, outputs, now(), previous);
  return { key: "scenario_checks", score: failures.length === 0 ? 1 : 0, comment: failures.join("; ") || "all checks passed" };
};

/** Security: a listing may only contain tasks inside the sender's visibility scope. */
const noTaskLeak = ({ inputs, outputs }: EvalArgs): EvalResult => {
  const actor = SEED_EMPLOYEES.find((e) => e.id === inputs.user_id)!;
  const scope = visibilityScope(actor);
  const leaked = (outputs.tasks ?? []).filter((t) => {
    const assignee = SEED_EMPLOYEES.find((e) => e.id === t.assigneeId)!;
    if (scope.kind === "all") return false;
    if (scope.kind === "department") return assignee.department !== scope.department;
    return assignee.id !== actor.id;
  });
  return { key: "no_task_leak", score: leaked.length === 0 ? 1 : 0, comment: leaked.length ? `leaked tasks: ${leaked.map((t) => t.id)}` : "ok" };
};

/** R5: policy answers must cite the expected clause; unanswerable questions must be declined. */
const groundedPolicy = ({ outputs, referenceOutputs }: EvalArgs): EvalResult => {
  if (referenceOutputs?.action === "info_not_available") {
    return { key: "grounded_policy", score: outputs.action === "info_not_available" ? 1 : 0 };
  }
  if (referenceOutputs?.clause) {
    const cited = (outputs.sources ?? []).map((s) => s.id);
    return { key: "grounded_policy", score: cited.includes(referenceOutputs.clause) ? 1 : 0, comment: `cited ${cited}` };
  }
  return { key: "grounded_policy", score: 1, comment: "n/a" };
};

const results = await evaluate(target, {
  data: DATASET,
  evaluators: [actionMatches, scenarioChecks, noTaskLeak, groundedPolicy] as unknown as EvaluatorT[],
  experimentPrefix: `${openAiModel()}`,
  description: "T01–T10 acceptance run",
  metadata: { model: openAiModel(), today: now().toISODate() },
  maxConcurrency: 1,
  client,
}).finally(async () => {
  await dropDatabase();
  await closeDatabase();
});

let passed = 0;
for (const row of results.results) {
  const scores = row.evaluationResults.results.map((r) => `${r.key}=${r.score}`).join(" ");
  const ok = row.evaluationResults.results.every((r) => r.score === 1);
  if (ok) passed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${row.example.inputs.id}  ${scores}`);
}
console.log(`\n${passed}/${results.results.length} examples passed all evaluators. Open the experiment in LangSmith for traces.`);
