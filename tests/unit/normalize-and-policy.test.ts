import { describe, expect, it } from "vitest";
import { matchByName, matchDepartment, normalizeArabic } from "@/lib/arabic/normalize";
import { DEPARTMENTS, SEED_EMPLOYEES } from "@/lib/db/seed";
import { isGroundedAnswer } from "@/lib/policy/policy";

describe("Arabic name matching", () => {
  it("normalizes letter variants, diacritics and spaces", () => {
    expect(normalizeArabic("عبد الرحمن")).toBe(normalizeArabic("عبدالرحمن"));
    expect(normalizeArabic("نوره")).toBe(normalizeArabic("نورة"));
    expect(normalizeArabic("سَارَة")).toBe(normalizeArabic("ساره"));
    expect(normalizeArabic("٣")).toBe("3");
  });

  it("matches existing employees, including the ل prefix", () => {
    expect(matchByName("خالد", SEED_EMPLOYEES).map((e) => e.id)).toEqual([4]);
    expect(matchByName("لخالد", SEED_EMPLOYEES).map((e) => e.id)).toEqual([4]);
    expect(matchByName("عبد الرحمن", SEED_EMPLOYEES).map((e) => e.id)).toEqual([6]);
  });

  it("never guesses an unknown name (T10)", () => {
    expect(matchByName("أحمد", SEED_EMPLOYEES)).toEqual([]);
    expect(matchByName("خالدد", SEED_EMPLOYEES)).toEqual([]);
    expect(matchByName("", SEED_EMPLOYEES)).toEqual([]);
  });

  it("matches departments with or without the article", () => {
    expect(matchDepartment("المالية", DEPARTMENTS)).toBe("المالية");
    expect(matchDepartment("قسم المشاريع", DEPARTMENTS)).toBe("المشاريع");
    expect(matchDepartment("مالية", DEPARTMENTS)).toBe("المالية");
    expect(matchDepartment("التسويق", DEPARTMENTS)).toBeNull();
  });
});

describe("policy grounding guard (R5)", () => {
  it("accepts answers that only restate cited clauses", () => {
    expect(isGroundedAnswer("لازم تقدم الطلب قبل 5 أيام عمل على الأقل، ويعتمده مشرفك المباشر.", [2])).toBe(true);
    expect(isGroundedAnswer("الدوام من 8 صباحاً إلى 4 عصراً.", [1])).toBe(true);
  });

  it("rejects invented numbers", () => {
    expect(isGroundedAnswer("لازم تقدم قبل 7 أيام.", [2])).toBe(false);
    expect(isGroundedAnswer("بدل السكن 25% من الراتب.", [5])).toBe(false);
  });

  it("rejects missing or unknown clause ids", () => {
    expect(isGroundedAnswer("أي شيء", [])).toBe(false);
    expect(isGroundedAnswer("أي شيء", [9])).toBe(false);
  });
});
