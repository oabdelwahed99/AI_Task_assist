import { toWesternDigits } from "@/lib/arabic/normalize";

/** The company policy, verbatim from the task brief. This is the only knowledge source for policy answers (R5). */
export const POLICY_CLAUSES = [
  { id: 1, text: "الدوام من الأحد إلى الخميس من 8:00 صباحاً حتى 4:00 عصراً، والسبت دوام نصفي حتى 12:00 ظهراً." },
  { id: 2, text: "طلب الإجازة الاعتيادية قبل 5 أيام عمل على الأقل، ويعتمده المشرف المباشر." },
  { id: 3, text: "الإجازة المرضية تتطلب تقريراً طبياً خلال يومين من العودة." },
  { id: 4, text: "العمل عن بُعد يوم واحد في الأسبوع بموافقة المشرف." },
  { id: 5, text: "المصروفات حتى 500 ريال يعتمدها المشرف، وما فوقها المدير." },
  { id: 6, text: "تحديث حالة المهمة يومياً قبل نهاية الدوام." },
] as const;

export type PolicyClause = (typeof POLICY_CLAUSES)[number];

export function policyAsPromptText(): string {
  return POLICY_CLAUSES.map((c) => `[${c.id}] ${c.text}`).join("\n");
}

export function findClauses(ids: readonly number[]): PolicyClause[] {
  return POLICY_CLAUSES.filter((c) => ids.includes(c.id));
}

function numbersIn(text: string): string[] {
  return toWesternDigits(text).match(/\d+(?:[.,:]\d+)?/g) ?? [];
}

/**
 * Deterministic guard against fabrication: the answer must cite at least one existing
 * clause, and every number it mentions must appear in the cited clauses.
 */
export function isGroundedAnswer(answer: string, clauseIds: readonly number[]): boolean {
  const clauses = findClauses(clauseIds);
  if (clauses.length === 0 || clauses.length !== new Set(clauseIds).size) return false;
  const allowedNumbers = new Set([...clauses.flatMap((c) => numbersIn(c.text)), ...clauseIds.map(String)]);
  const allowedHours = new Set([...allowedNumbers].map((n) => n.split(":")[0]));
  return numbersIn(answer).every((n) => allowedNumbers.has(n) || allowedHours.has(n.split(":")[0]));
}
