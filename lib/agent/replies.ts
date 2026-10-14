import { ROLE_LABELS, type Actor, type DenyReason } from "@/lib/auth/permissions";
import { formatArabicDate, formatArabicDateTime, formatArabicTime } from "@/lib/dates/format";
import type { PolicyClause } from "@/lib/policy/policy";
import type { TaskView } from "@/lib/repo/tasks";
import type { ClarifyReason } from "./types";

/**
 * All user-facing text is produced from templates. The LLM never writes replies about
 * tasks or permissions, so it cannot claim an action happened when it did not.
 */

export function taskCreated(actor: Actor, task: TaskView): string {
  const when = formatArabicDateTime(task.dueDate, task.dueTime);
  const head =
    task.assigneeId === actor.id
      ? `تم، سجّلت لك المهمة رقم ${task.id}: «${task.description}» — ${when}.`
      : `تم، أسندت المهمة رقم ${task.id} إلى ${task.assigneeName}: «${task.description}» — ${when}.`;
  if (!task.movedFromDate) return head;
  const sameTime = task.dueTime ? ` بنفس الوقت (${formatArabicTime(task.dueTime)})` : "";
  return `${head}\nملاحظة: الموعد المطلوب كان يوم ${formatArabicDate(task.movedFromDate)}، والجمعة إجازة، فرحّلت المهمة إلى ${formatArabicDate(task.dueDate)}${sameTime}.`;
}

export function rejected(actor: Actor, reason: DenyReason, ctx: { assignee?: Actor } = {}): string {
  const role = ROLE_LABELS[actor.role];
  switch (reason) {
    case "employee_can_only_assign_self":
      return `عذراً يا ${actor.name}، صلاحيتك (${role}) تسمح لك بتسجيل المهام لنفسك فقط، ولا يمكنك إسناد مهام لغيرك. تقدر تطلب من مشرف القسم يسندها.`;
    case "supervisor_other_department":
      return `عذراً يا ${actor.name}، صلاحيتك (${role}) تقتصر على إسناد المهام لموظفي قسم ${actor.department}، و${ctx.assignee?.name ?? "هذا الموظف"} من قسم ${ctx.assignee?.department ?? "آخر"}. لم يتم تسجيل المهمة.`;
    case "employee_can_only_view_self":
      return `عذراً يا ${actor.name}، صلاحيتك (${role}) تسمح لك بعرض مهامك فقط. الصلاحيات تُحدَّد من بيانات حسابك في النظام وليس من محتوى الرسالة. اكتب «وش مهامي؟» لعرض مهامك.`;
    case "supervisor_can_only_view_department":
      return `عذراً يا ${actor.name}، صلاحيتك (${role}) تسمح لك بعرض مهام قسم ${actor.department} فقط. الصلاحيات تُحدَّد من بيانات حسابك في النظام وليس من محتوى الرسالة.`;
  }
}

export function clarify(reason: ClarifyReason, ctx: { name?: string; options?: string[] } = {}): string {
  const options = ctx.options?.length ? ctx.options.join("، ") : "";
  switch (reason) {
    case "unknown_assignee":
      return `ما لقيت موظف باسم «${ctx.name}» في النظام، فما سجّلت المهمة.${options ? ` تقدر تسند المهام إلى: ${options}.` : ""} لمين تبي تسجّلها؟`;
    case "ambiguous_assignee":
      return `يوجد أكثر من موظف باسم «${ctx.name}»: ${options}. حدّد الموظف المقصود من فضلك.`;
    case "missing_assignee":
      return "لمين المهمة؟ اكتب اسم الموظف من فضلك.";
    case "missing_description":
      return "وش المهمة المطلوبة بالضبط؟ اكتبها مع الموعد، مثلاً: «سجل مهمة لخالد بكرة الساعة 10 يراجع العقد».";
    case "missing_date":
      return "متى موعد المهمة؟ مثلاً: «بكرة الساعة 10» أو «الأحد الجاي».";
    case "invalid_date":
      return "ما قدرت أحدد التاريخ المقصود. اكتب الموعد بشكل أوضح، مثلاً: «بكرة» أو «الأحد الجاي» أو «20 أكتوبر».";
    case "past_date":
      return "التاريخ المذكور مضى. حدّد موعداً قادماً للمهمة من فضلك.";
    case "invalid_time":
      return "الوقت المذكور غير صحيح. اكتب الوقت مثلاً: «الساعة 10» أو «3 العصر».";
    case "unknown_employee":
      return `ما لقيت موظف باسم «${ctx.name}» في النظام.`;
    case "unknown_department":
      return `ما لقيت قسم باسم «${ctx.name}». الأقسام المتاحة: ${options}.`;
    case "unsupported_request":
      return "أقدر أساعدك في:\n- تسجيل مهمة: «سجل مهمة لخالد بكرة الساعة 10 يراجع العقد»\n- عرض مهامك: «وش مهامي؟»\n- أسئلة سياسة الشركة: «كم يوم لازم أقدم قبل الإجازة؟»";
  }
}

export type ListHeading =
  | { kind: "self" }
  | { kind: "employee"; name: string }
  | { kind: "department"; department: string }
  | { kind: "all" };

export function taskList(heading: ListHeading, tasks: TaskView[]): string {
  const title = {
    self: "مهامك",
    employee: `مهام ${heading.kind === "employee" ? heading.name : ""}`,
    department: `مهام قسم ${heading.kind === "department" ? heading.department : ""}`,
    all: "كل مهام الشركة",
  }[heading.kind];

  if (tasks.length === 0) {
    return heading.kind === "self" ? "ما عندك مهام مسجّلة حالياً." : `لا توجد ${title} مسجّلة حالياً.`;
  }
  const showAssignee = heading.kind === "department" || heading.kind === "all";
  const lines = tasks.map((t) => {
    const who = showAssignee ? ` (${t.assigneeName})` : "";
    const moved = t.movedFromDate ? " [مرحّلة من الجمعة]" : "";
    return `- #${t.id} ${t.description}${who} — ${formatArabicDateTime(t.dueDate, t.dueTime)}${moved}`;
  });
  return `${title} (${tasks.length}):\n${lines.join("\n")}`;
}

export function policyAnswer(answer: string, clauses: PolicyClause[]): string {
  const ids = clauses.map((c) => c.id).join(" و");
  return `${answer.trim()}\n(المصدر: سياسة الشركة، البند ${ids})`;
}

/** Used when the model's wording failed the grounding check: quote the clauses verbatim instead. */
export function policyVerbatim(clauses: PolicyClause[]): string {
  return `حسب سياسة الشركة:\n${clauses.map((c) => `- البند ${c.id}: ${c.text}`).join("\n")}`;
}

export const INFO_NOT_AVAILABLE =
  "عذراً، هذه المعلومة غير متوفرة في سياسة الشركة المتاحة لدي، فما أقدر أجاوب عليها. تقدر تتواصل مع الإدارة للاستفسار.";

export const UNKNOWN_USER = "المستخدم غير معروف في النظام.";

export const INTERNAL_ERROR = "عذراً، صار خطأ تقني أثناء معالجة طلبك. حاول مرة ثانية بعد قليل.";
