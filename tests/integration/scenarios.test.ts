import { beforeAll, describe, expect, it } from "vitest";
import type { ChatResult } from "@/lib/agent/types";
import { now } from "@/lib/env";
import { checkScenario, SCENARIOS } from "@/lib/scenarios";
import { fakeDeps, SCENARIO_INTENTS, useTempDatabase } from "../helpers/fixtures";

/**
 * Runs the brief's ten messages through the real graph, database and permission code.
 * Only the LLM is replaced by the intents a correct parser produces, so this suite is
 * deterministic and needs no API key. `pnpm test:e2e` runs the same flow against OpenAI.
 */

const intentsByMessage = Object.fromEntries(SCENARIOS.map((s) => [s.message, SCENARIO_INTENTS[s.id]]));

describe.each([
  ["Tuesday", "2026-10-13T09:00:00"],
  ["Wednesday (day after tomorrow is Friday)", "2026-10-14T09:00:00"],
  ["Thursday (tomorrow is Friday)", "2026-10-15T09:00:00"],
])("T01–T10 when today is %s", (_label, pinnedNow) => {
  const results: Record<string, ChatResult> = {};

  beforeAll(async () => {
    useTempDatabase();
    process.env.APP_NOW = pinnedNow;
    const { handleChat } = await import("@/lib/chat/handle-chat");
    for (const s of SCENARIOS) {
      results[s.id] = await handleChat({ userId: s.userId, message: s.message, channel: "script" }, fakeDeps(intentsByMessage));
    }
  });

  for (const s of SCENARIOS) {
    it(`${s.id} (${s.sender}): ${s.expected}`, () => {
      expect(checkScenario(s.id, results[s.id], now(), results)).toEqual([]);
    });
  }
});
