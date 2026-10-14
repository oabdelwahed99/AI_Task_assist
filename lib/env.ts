import { DateTime } from "luxon";

export const TIMEZONE = "Asia/Riyadh";

/** "Now" in Asia/Riyadh. `APP_NOW` pins the clock for reproducible demos and tests. */
export function now(): DateTime {
  const pinned = process.env.APP_NOW?.trim();
  if (pinned) {
    const dt = DateTime.fromISO(pinned, { zone: TIMEZONE });
    if (!dt.isValid) throw new Error(`Invalid APP_NOW: ${pinned}`);
    return dt;
  }
  return DateTime.now().setZone(TIMEZONE);
}

export function openAiModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

/** Tracing without a LangSmith key only produces failed uploads, so it is switched off. */
export function disableTracingWithoutKey(): void {
  if (!process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_API_KEY) {
    process.env.LANGSMITH_TRACING = "false";
    process.env.LANGCHAIN_TRACING_V2 = "false";
  }
}

export function demoResetEnabled(): boolean {
  return process.env.ENABLE_DEMO_RESET === "true";
}
