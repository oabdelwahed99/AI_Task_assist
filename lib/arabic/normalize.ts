const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;

/** Converts ٠-٩ and ۰-۹ to 0-9. */
export function toWesternDigits(text: string): string {
  return text
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Canonical form for comparing Arabic names: strips diacritics, tatweel and whitespace,
 * and unifies letter variants (أ/إ/آ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي).
 * "عبد الرحمن" and "عبدالرحمن" therefore compare equal.
 */
export function normalizeArabic(text: string): string {
  return toWesternDigits(text)
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\s\u200c\u200f\u200e]+/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Exact (normalized) name matching. If the raw name carries the preposition "ل"
 * ("لخالد") and only the stripped form matches, the stripped form is used.
 * There is deliberately no fuzzy matching: an unknown name must lead to a clarification,
 * never to a guess.
 */
export function matchByName<T extends { name: string }>(rawName: string, candidates: readonly T[]): T[] {
  const target = normalizeArabic(rawName);
  if (!target) return [];
  const exact = candidates.filter((c) => normalizeArabic(c.name) === target);
  if (exact.length > 0) return exact;
  if (target.startsWith("ل") && target.length > 3) {
    const stripped = target.slice(1);
    return candidates.filter((c) => normalizeArabic(c.name) === stripped);
  }
  return [];
}

/** Matches a department name, tolerating the definite article ("المالية" / "مالية" / "قسم المالية"). */
export function matchDepartment(rawName: string, departments: readonly string[]): string | null {
  const strip = (s: string) => normalizeArabic(s).replace(/^قسم/, "").replace(/^ال/, "");
  const target = strip(rawName);
  if (!target) return null;
  return departments.find((d) => strip(d) === target) ?? null;
}
