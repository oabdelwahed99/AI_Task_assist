import { ChatOpenAI } from "@langchain/openai";
import { openAiModel } from "@/lib/env";
import { IntentSchema, PolicyAnswerSchema } from "./intent";
import { INTENT_SYSTEM_PROMPT, POLICY_SYSTEM_PROMPT } from "./prompts";
import type { AgentDeps } from "./types";

function chatModel() {
  const model = openAiModel();
  // Reasoning models (o-series, gpt-5) reject a custom temperature.
  const isReasoningModel = /^(o\d|gpt-5)/.test(model);
  return new ChatOpenAI({ model, ...(isReasoningModel ? {} : { temperature: 0 }), maxRetries: 2, timeout: 30_000 });
}

export function createOpenAiDeps(): AgentDeps {
  const intentParser = chatModel()
    .withStructuredOutput(IntentSchema, { name: "parse_intent", strict: true })
    .withConfig({ runName: "extract_intent_llm" });
  const policyAnswerer = chatModel()
    .withStructuredOutput(PolicyAnswerSchema, { name: "answer_policy", strict: true })
    .withConfig({ runName: "answer_policy_llm" });

  return {
    extractIntent: ({ message, senderName }) =>
      intentParser.invoke([
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: `(${senderName}) "${message}"` },
      ]),
    answerPolicy: (question) =>
      policyAnswerer.invoke([
        { role: "system", content: POLICY_SYSTEM_PROMPT },
        { role: "user", content: question },
      ]),
  };
}
