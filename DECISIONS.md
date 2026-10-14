# Decisions page — مساعد المهام الذكي

## 1. The one decision everything else follows from

**The LLM is a parser, not a decision maker.** It turns a free-form Arabic message into a typed JSON
description of what was asked (intent, person, task text, *described* date/time, requested scope).
Everything that must be correct is plain TypeScript working on database rows:

| Concern | Who decides | Where |
|---|---|---|
| Who is the sender and what is their role | Database, by `user_id` | `lib/agent/nodes/common.ts` → `loadActor` |
| May X assign to Y / may X see these tasks | Pure functions | `lib/auth/permissions.ts` |
| Re-check on every read/write | Repository | `lib/repo/tasks.ts` |
| Last line of defence on writes | MongoDB collection validators (shape + no Friday) | `lib/db/schema.ts` |
| Calendar date, time, Friday → Saturday | Deterministic resolver (Luxon, Asia/Riyadh) | `lib/dates/resolve.ts` |
| Does a name exist | Exact normalized match, never fuzzy | `lib/arabic/normalize.ts` |
| Reply wording | Templates | `lib/agent/replies.ts` |
| Policy answer | LLM restricted to the 6 clauses, then verified in code | `lib/agent/nodes/policy.ts`, `lib/policy/policy.ts` |

Consequences:
- **Prompt injection cannot escalate privileges (T08).** The schema has no "role" field. Even if the model is
  fully jailbroken and returns "list all tasks" or "assign to نورة", the request goes through `canList`/`canAssign`
  with the role from the database and gets rejected. `tests/integration/security.test.ts` checks this with a
  deliberately malicious fake LLM.
- **The bot cannot claim it did something it didn't.** Replies about tasks are built from the row that
  was actually inserted.
- **Wider-than-allowed requests are rejected, not silently narrowed.** If "show all company tasks" from an
  employee quietly returned only their own tasks, the reply would look like a complete answer. An explicit
  rejection is clearer and is what the brief expects for T08.

## 2. Why these tools

| Tool | Why | Alternatives considered |
|---|---|---|
| **Next.js 15 (App Router)** | One deployable for the `POST /chat` API, the demo UI and the helper endpoints. Route handlers make `app/chat/route.ts` exactly `POST /chat`. | Express/Fastify + a separate UI: two things to run. |
| **LangGraph.js** | The flow is a small state machine: load the actor, parse, route, then authorize, resolve and persist. LangGraph makes each step a named node with explicit conditional edges, so the permission checks are visible steps in the graph (and in every trace), not buried in a prompt. It also gives a path to multi-turn clarification later through checkpointers. | A single "agent with tools" loop: the model would decide when to call `create_task`, so permissions would depend on the model's behaviour. |
| **LangSmith** | Every request is one trace with `user_id`/channel metadata and child runs per node and per LLM call. The `run_id` is stored in the audit log, so any audit row links to its trace. `pnpm eval` turns T01–T10 into a dataset plus experiment, giving regression testing whenever the prompt or model changes. | Langfuse (self-hostable, good alternative if data residency is a concern). |
| **OpenAI `gpt-4.1-mini`** | Strict JSON-schema structured outputs (the response always matches the Zod schema), solid Gulf-dialect understanding, low latency for chat, and cheap. `temperature: 0`. Model is configurable via `OPENAI_MODEL`. | `gpt-4.1-nano` (4× cheaper, weaker on dialect), `gpt-5-mini` (reasoning latency not needed for parsing), Claude Haiku / Gemini Flash (equally viable). |
| **MongoDB (official Node driver)** | Hosted (e.g. Atlas free tier), so there is nothing to run locally besides `pnpm dev`: set `MONGODB_URI` and the collections, validators and seed employees are created on the first request. `$jsonSchema` + `$expr` validators reject malformed tasks and Friday due dates at the database. Tasks keep short numeric ids via a `counters` collection so replies can say "المهمة رقم 3". Tests use an in-memory MongoDB, so they never touch the real database. Trade-off: validators can't look at other collections, so unlike SQL triggers they cannot re-check R3 (who may assign to whom); that stays in layers 1–3. | SQLite (previous version), Postgres + RLS (best for production, see §6), Supabase. |
| **Luxon** | Correct time-zone arithmetic for `Asia/Riyadh` regardless of the server's zone. | date-fns-tz. |
| **Zod 4** | One schema for the LLM output contract and for request validation. | — |
| **Vitest** | Fast TS-native tests. 120 deterministic tests run without any API key. | Jest. |

## 3. Assumptions (made without asking, as the brief allows)

**Identity**
- `user_id` in the request identifies the sender (as in the brief). In production it would come from the
  authenticated channel (the verified WhatsApp number), never from the message body. The Telegram demo uses
  `/as <id>` to stand in for this.

**Permissions (R3)**
- Anyone may create a task for themselves, including supervisors and the manager.
- A supervisor may assign to anyone in their department, including themselves. The manager may assign to anyone.
- An employee who names *any* other person is rejected before name lookup. They cannot assign to others anyway,
  and this avoids confirming whether a name exists.
- Viewing: employee → own tasks; supervisor → department; manager → all.

**Dates and times (R2/R4)** — all in `Asia/Riyadh`, "today" = the run date (`APP_NOW` can pin it for demos/tests).
- `بكرة` = +1 day, `بعد بكرة` = +2 days.
- `الأحد` / `الأحد الجاي` = the next Sunday **strictly after today** (if today is Sunday, next week's Sunday).
- A part of day without an hour: `الصبح` 09:00, `الظهر` 12:00, `العصر` **15:00** (Asr in Riyadh is ≈ 15:00–15:30 and
  inside working hours), `المغرب` 18:00, `المساء/الليل` 20:00.
- A bare hour with no part of day: 1–6 → PM (13:00–18:00), 7–11 → AM. Only these readings fall in or near working hours (08:00–16:00).
  So "الساعة 10" = 10:00, "الساعة 9" = 09:00, "1 الظهر" = 13:00.
- A time but no day (e.g. "العصر") → today.
- Friday → Saturday, same time, and the reply says so. This is also enforced by the `tasks` collection validator. The moved time is kept
  even if it falls after Saturday's 12:00 half-day, because the brief says "بنفس الوقت".
- A task needs a description and a date. If either is missing, the bot asks instead of inventing one. Time is optional.
- An explicit date already past this year (no year given) means next year.

**Names**
- Matching is exact after Arabic normalization (أ/إ/آ→ا, ة→ه, ى→ي, diacritics, spaces, so "عبد الرحمن" = "عبدالرحمن").
  No fuzzy matching: an unknown or ambiguous name always leads to a clarification (T10), never a guess.

**Policy (R5)**
- The six clauses in the brief are the entire policy. The model must return the clause ids it used. The code then
  checks the ids exist, and that **every number in the answer appears in the cited clauses**. If that check fails,
  the bot quotes the clauses verbatim instead. `found=false` → fixed "غير متوفرة" reply.

**Scope**
- Single-turn: a clarification question does not remember the previous message. The user resends the full request
  (see §6).

## 4. Monthly cost — 100 employees × 20 messages/day

**Volume:** 100 × 20 × 30 days = **60,000 messages/month**. This is an upper bound: with Sunday–Thursday plus half-day
Saturday it's closer to 52,000.

**Tokens per message (from LangSmith traces of `gpt-4.1-mini`, not a prompt-length guess):**
- Intent parsing (every message): **≈ 2,430 input**, **≈ 31 output** (observed 18–82). A cached trace costs **≈ $0.00045**.
- Policy answer (assume 25% of messages): a second call, **462 input + 31 output ≈ $0.00023**. That prompt is under 1,024 tokens, so it is not cached.
- One cold trace, before the prefix was cached, cost **$0.00110**. That is not the steady price.
- Task creation, listing, permissions and replies use no LLM tokens (templates).

**`gpt-4.1-mini` prices:** $0.40 / 1M input, $0.10 / 1M cached input, $1.60 / 1M output.

| Item | Calculation | Cold (no cache) | As traced (~79% of intent input cached) |
|---|---|---|---|
| Parsing input | 60k × 2,430 | $58.3 | $23.8 |
| Parsing output | 60k × 31 | $3.0 | $3.0 |
| Policy input | 15k × 462 | $2.8 | $2.8 |
| Policy output | 15k × 31 | $0.7 | $0.7 |
| **LLM total** | | **≈ $65** | **≈ $30** |

The earlier draft assumed 2,000 input and 150 output and landed near $42–68. The traces are cheaper because the completion is ~31 tokens and most of the static prefix is cached.

| Other items | Monthly |
|---|---|
| LangSmith Plus, 1 seat ($39, includes 10k traces) with `LANGSMITH_TRACING_SAMPLING_RATE≈0.15` | $39 |
| Hosting: one small VM (2 vCPU / 4 GB) or a Node host, plus MongoDB Atlas (free M0 is enough for this volume; a Flex/M10 cluster with backups costs more) | $10–25 |
| WhatsApp Cloud API: user-initiated service conversations, answered within 24 h | $0 |
| **Total** | **≈ $80–95 / month** with the traced model price (≈ $0.30 of model per employee, ≈ $0.00045 per ordinary message). The seat and the host are most of the rest. |

Notes:
- Tracing 100% of traffic in LangSmith would add about $125 (50k traces over the allowance × $2.50/1k). Sampling plus
  the audit log (which stores every request) is the better trade-off. Evaluations run separately on demand.
- Switching to `gpt-4.1-nano` would cut the LLM line to about $8. That's only worth it if `pnpm eval` stays at 10/10
  and a larger dialect eval set passes.
- Latency: one LLM call for tasks/lists (≈ 0.6–1.2 s), two for policy questions.

## 5. Where permissions are enforced (summary for reviewers)

1. `loadActor` reads the role from the database by `user_id`. The message is never consulted for identity.
2. Graph nodes `authorizeAssignment` / `authorizeListing` call `canAssign` / `canList` (`lib/auth/permissions.ts`).
3. Repository: `createTaskAs` / `listTasksAs` re-check and always apply the actor's visibility scope in the MongoDB
   query (`lib/repo/tasks.ts`).
4. Database: the `tasks` collection validator rejects malformed documents and Friday due dates (`lib/db/schema.ts`).
5. Audit: every request, including rejections, is written to `audit_log` with its LangSmith `run_id`. Readable via
   `GET /audit` by the manager only.

## 6. With one more week

1. **Database-enforced R3.** Either move to Postgres (or Supabase) and express R3 as RLS policies driven by a
   per-request `app.user_id` setting, or on MongoDB give each role its own database user with views/custom roles
   scoped to what it may read. Then the database enforces R3 on reads and writes, not only the application.
2. **Real WhatsApp channel.** WhatsApp Cloud API webhook (`/api/whatsapp`) with signature verification, mapping the
   verified phone number to `employees`. The Telegram adapter already shows the shape.
3. **Multi-turn clarification.** Add a LangGraph checkpointer keyed by sender, so "لأحمد؟ قصدك أحمد مين" → "خالد"
   continues the pending task instead of starting over. Include confirmation before destructive actions.
4. **More task operations.** Update status ("خلصت المهمة 12") and reschedule/cancel, with the same permission
   layers. This directly supports policy clause 6 (daily status updates).
5. **Bigger eval set.** 100+ dialect variations (Najdi/Hijazi/Gulf spellings, Arabizi, typos, voice-note
   transcripts) in LangSmith, plus an LLM-as-judge evaluator for reply tone. CI fails if any security evaluator
   drops below 100%.
6. **Ops.** Rate limiting per sender, PII redaction in traces, structured logging, and a manager dashboard over the audit log.
