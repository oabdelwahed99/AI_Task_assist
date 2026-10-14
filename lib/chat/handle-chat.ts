import { randomUUID } from "node:crypto";
import { buildAgentGraph, type AgentGraph } from "@/lib/agent/graph";
import { createOpenAiDeps } from "@/lib/agent/llm";
import * as replies from "@/lib/agent/replies";
import type { AgentDeps, ChatResult } from "@/lib/agent/types";
import { disableTracingWithoutKey } from "@/lib/env";
import { writeAudit } from "@/lib/repo/audit";

export type Channel = "api" | "telegram" | "script";

export type ChatInput = { userId: number; message: string; channel: Channel };

export type ChatResponse = ChatResult & { run_id: string };

let defaultGraph: AgentGraph | null = null;

function graphFor(deps?: AgentDeps): AgentGraph {
  disableTracingWithoutKey();
  if (deps) return buildAgentGraph(deps);
  defaultGraph ??= buildAgentGraph(createOpenAiDeps());
  return defaultGraph;
}

/**
 * Single entry point shared by the HTTP API, the Telegram bot and the scripts.
 * Runs the LangGraph agent (traced in LangSmith under `runId`) and writes the audit log.
 */
export async function handleChat(input: ChatInput, deps?: AgentDeps): Promise<ChatResponse> {
  const runId = randomUUID();
  const startedAt = Date.now();
  let result: ChatResult;
  let intent: string | null = null;

  try {
    const state = await graphFor(deps).invoke(
      { userId: input.userId, message: input.message },
      {
        runId,
        runName: "smart-task-assistant",
        tags: [input.channel],
        metadata: { user_id: input.userId, channel: input.channel },
      },
    );
    intent = state.intent?.intent ?? null;
    result = state.result ?? { action: "error", reason: "internal_error", reply: replies.INTERNAL_ERROR };
  } catch (error) {
    console.error(`[chat] graph failed (run ${runId}):`, error instanceof Error ? error.message : error);
    result = { action: "error", reason: "internal_error", reply: replies.INTERNAL_ERROR };
  }

  await writeAudit({
    userId: input.userId,
    channel: input.channel,
    message: input.message,
    intent,
    action: result.action,
    taskId: result.task_id ?? null,
    reason: result.reason ?? null,
    reply: result.reply,
    runId,
    latencyMs: Date.now() - startedAt,
  });

  return { ...result, run_id: runId };
}
