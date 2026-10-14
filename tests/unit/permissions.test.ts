import { describe, expect, it } from "vitest";
import { canAssign, canList, visibilityScope } from "@/lib/auth/permissions";
import { SEED_EMPLOYEES } from "@/lib/db/seed";

const [muneera, sara, fahd, khalid, noura, abdulrahman] = SEED_EMPLOYEES;

describe("canAssign (R3)", () => {
  // rows = actor, columns = assignee (ids 1..6)
  const matrix: Record<string, boolean[]> = {
    "منيرة (مدير)": [true, true, true, true, true, true],
    "سارة (مشرف المشاريع)": [false, true, true, true, false, false],
    "فهد (موظف)": [false, false, true, false, false, false],
    "خالد (موظف)": [false, false, false, true, false, false],
    "نورة (موظف)": [false, false, false, false, true, false],
    "عبدالرحمن (مشرف المالية)": [false, false, false, false, true, true],
  };

  SEED_EMPLOYEES.forEach((actor, i) => {
    const row = Object.values(matrix)[i];
    SEED_EMPLOYEES.forEach((assignee, j) => {
      it(`${actor.name} → ${assignee.name} = ${row[j]}`, () => {
        expect(canAssign(actor, assignee).allowed).toBe(row[j]);
      });
    });
  });

  it("gives the specific reason for a denial", () => {
    expect(canAssign(fahd, khalid)).toEqual({ allowed: false, reason: "employee_can_only_assign_self" });
    expect(canAssign(sara, noura)).toEqual({ allowed: false, reason: "supervisor_other_department" });
  });
});

describe("visibility (R3)", () => {
  it("derives scope from role only", () => {
    expect(visibilityScope(muneera)).toEqual({ kind: "all" });
    expect(visibilityScope(sara)).toEqual({ kind: "department", department: "المشاريع" });
    expect(visibilityScope(fahd)).toEqual({ kind: "self", userId: 3 });
  });

  it("lets everyone list their own tasks", () => {
    for (const e of SEED_EMPLOYEES) expect(canList(e, { kind: "self" }).allowed).toBe(true);
  });

  it("rejects an employee asking for all tasks (T08)", () => {
    expect(canList(fahd, { kind: "all" })).toEqual({ allowed: false, reason: "employee_can_only_view_self" });
  });

  it("rejects an employee asking for a colleague's tasks", () => {
    expect(canList(fahd, { kind: "employee", employee: khalid }).allowed).toBe(false);
    expect(canList(fahd, { kind: "department", department: "المشاريع" }).allowed).toBe(false);
  });

  it("limits supervisors to their department", () => {
    expect(canList(sara, { kind: "employee", employee: khalid }).allowed).toBe(true);
    expect(canList(sara, { kind: "department", department: "المشاريع" }).allowed).toBe(true);
    expect(canList(sara, { kind: "employee", employee: noura }).allowed).toBe(false);
    expect(canList(sara, { kind: "department", department: "المالية" }).allowed).toBe(false);
    expect(canList(abdulrahman, { kind: "all" }).allowed).toBe(false);
  });

  it("lets the manager see everything", () => {
    expect(canList(muneera, { kind: "all" }).allowed).toBe(true);
    expect(canList(muneera, { kind: "employee", employee: noura }).allowed).toBe(true);
    expect(canList(muneera, { kind: "department", department: "المالية" }).allowed).toBe(true);
  });
});
