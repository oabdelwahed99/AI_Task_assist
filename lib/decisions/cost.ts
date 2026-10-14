/** Monthly cost model from DECISIONS.md §4. Prices are gpt-4.1-mini list prices used in that estimate. */

export const PRICES = {
  inputPerToken: 0.4 / 1_000_000,
  cachedInputPerToken: 0.1 / 1_000_000,
  outputPerToken: 1.6 / 1_000_000,
};

/**
 * Share of intent-input tokens that hit the prompt cache in the LangSmith traces.
 * Derived from a cached call: 2,428 prompt tokens billed at $0.0003952, which is
 * 79% at the cached rate and 21% at the full input rate.
 */
export const CACHE_HIT_RATE = 0.79;

/**
 * Token counts taken from LangSmith root traces of gpt-4.1-mini (not from a prompt-length guess).
 * A normal message is one call: about 2,430 input tokens and 18–82 output tokens (31 on the common traces).
 * A policy question adds a second call of 462 input + 31 output. That prompt is under 1,024 tokens, so it is not cached.
 */
export const TOKENS = {
  parseInput: 2430,
  parseOutput: 31,
  policyInput: 462,
  policyOutput: 31,
};

/** Share of messages that also ask a policy question (a second LLM call). */
export const POLICY_SHARE = 0.25;

export const HOSTING = { lowUsd: 10, highUsd: 25 };

export type CostInput = {
  employees: number;
  messagesPerDay: number;
  days: number;
};

export type CostLine = {
  id: string;
  label: string;
  detail: string;
  tokens: number;
  usd: number;
  cachedUsd: number;
};

export type MonthlyCost = {
  messages: number;
  policyMessages: number;
  lines: CostLine[];
  llmUsd: number;
  llmCachedUsd: number;
  hostingLowUsd: number;
  hostingHighUsd: number;
  whatsappUsd: number;
  /** Intent call only, with the cache rate seen in LangSmith. This is the Cost column on a normal trace. */
  typicalMessageUsd: number;
  totalLowUsd: number;
  totalHighUsd: number;
};

export function monthlyCost(input: CostInput): MonthlyCost {
  const employees = clamp(input.employees, 1, 100_000);
  const messagesPerDay = clamp(input.messagesPerDay, 1, 1_000);
  const days = clamp(input.days, 1, 31);
  const messages = employees * messagesPerDay * days;
  const policyMessages = messages * POLICY_SHARE;

  const parseIn = messages * TOKENS.parseInput;
  const parseOut = messages * TOKENS.parseOutput;
  const policyIn = policyMessages * TOKENS.policyInput;
  const policyOut = policyMessages * TOKENS.policyOutput;

  const cachedInput = CACHE_HIT_RATE * PRICES.cachedInputPerToken + (1 - CACHE_HIT_RATE) * PRICES.inputPerToken;

  const lines: CostLine[] = [
    {
      id: "parse-in",
      label: "تحليل النية — إدخال",
      detail: `${formatCount(messages)} × ${TOKENS.parseInput.toLocaleString("en-US")} رمز`,
      tokens: parseIn,
      usd: parseIn * PRICES.inputPerToken,
      cachedUsd: parseIn * cachedInput,
    },
    {
      id: "parse-out",
      label: "تحليل النية — إخراج",
      detail: `${formatCount(messages)} × ${TOKENS.parseOutput} رمز`,
      tokens: parseOut,
      usd: parseOut * PRICES.outputPerToken,
      cachedUsd: parseOut * PRICES.outputPerToken,
    },
    {
      id: "policy-in",
      label: "إجابة السياسة — إدخال",
      detail: `${formatCount(policyMessages)} × ${TOKENS.policyInput} رمز، بلا تخزين (أقصر من 1024)`,
      tokens: policyIn,
      usd: policyIn * PRICES.inputPerToken,
      cachedUsd: policyIn * PRICES.inputPerToken,
    },
    {
      id: "policy-out",
      label: "إجابة السياسة — إخراج",
      detail: `${formatCount(policyMessages)} × ${TOKENS.policyOutput} رمز`,
      tokens: policyOut,
      usd: policyOut * PRICES.outputPerToken,
      cachedUsd: policyOut * PRICES.outputPerToken,
    },
  ];

  const llmUsd = sum(lines, (line) => line.usd);
  const llmCachedUsd = sum(lines, (line) => line.cachedUsd);
  const typicalMessageUsd = messages === 0 ? 0 : (lines[0].cachedUsd + lines[1].cachedUsd) / messages;

  const totalLowUsd = llmCachedUsd + HOSTING.lowUsd;
  const totalHighUsd = llmCachedUsd + HOSTING.highUsd;

  return {
    messages,
    policyMessages,
    lines,
    llmUsd,
    llmCachedUsd,
    hostingLowUsd: HOSTING.lowUsd,
    hostingHighUsd: HOSTING.highUsd,
    whatsappUsd: 0,
    typicalMessageUsd,
    totalLowUsd,
    totalHighUsd,
  };
}

/** Brief scenario: 100 employees, 20 messages/day, 30-day upper bound. */
export const BRIEF_SCENARIO: CostInput = { employees: 100, messagesPerDay: 20, days: 30 };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const digits = millions >= 10 ? 0 : 1;
    return `${millions.toFixed(digits)} مليون`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("en-US")} ألف`;
  return formatCount(value);
}

export function formatAmount(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return trimZeros(value.toFixed(1));
  if (abs >= 1) return trimZeros(value.toFixed(2));
  if (abs >= 0.01) return value.toFixed(2);
  if (abs >= 0.001) return trimZeros(value.toFixed(4));
  return trimZeros(value.toFixed(5));
}

export function formatUsd(value: number): string {
  if (value === 0) return "مجاناً";
  return `${formatAmount(value)} دولار`;
}

export function formatUsdRange(low: number, high: number): string {
  return `من ${formatAmount(low)} إلى ${formatAmount(high)} دولاراً`;
}

function trimZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
