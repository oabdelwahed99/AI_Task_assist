import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { after } from "next/server";
import { z } from "zod";

export const UserIdSchema = z.coerce.number().int().positive();

/** Makes sure LangSmith traces are flushed after the response is sent. */
export function flushTracesAfterResponse() {
  after(() => awaitAllCallbacks());
}
