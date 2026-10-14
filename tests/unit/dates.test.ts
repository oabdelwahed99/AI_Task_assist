import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { formatArabicDate, formatArabicTime } from "@/lib/dates/format";
import { resolveSchedule, resolveTime, type DateRef, type TimeRef } from "@/lib/dates/resolve";

const TUESDAY = DateTime.fromISO("2026-10-13T09:00:00", { zone: "Asia/Riyadh" });
const THURSDAY = DateTime.fromISO("2026-10-15T09:00:00", { zone: "Asia/Riyadh" });
const t = (hour: number | null, period: TimeRef["period"] = null, minute: number | null = null): TimeRef => ({ hour, minute, period });

describe("resolveTime", () => {
  it.each([
    [t(10), "10:00"],
    [t(9), "09:00"],
    [t(1, "noon"), "13:00"],
    [t(1), "13:00"],
    [t(3, "asr"), "15:00"],
    [t(null, "asr"), "15:00"],
    [t(null, "morning"), "09:00"],
    [t(12), "12:00"],
    [t(15), "15:00"],
    [t(9, "evening"), "21:00"],
    [t(9, "morning", 30), "09:30"],
    [null, null],
  ])("%j → %s", (ref, expected) => {
    expect(resolveTime(ref)).toEqual({ ok: true, time: expected });
  });

  it("rejects impossible times", () => {
    expect(resolveTime(t(25)).ok).toBe(false);
    expect(resolveTime(t(10, null, 75)).ok).toBe(false);
  });
});

describe("resolveSchedule (today = Tuesday 2026-10-13, Asia/Riyadh)", () => {
  const cases: [string, DateRef, string, string | null][] = [
    ["اليوم", { kind: "today" }, "2026-10-13", null],
    ["بكرة", { kind: "tomorrow" }, "2026-10-14", null],
    ["بعد بكرة", { kind: "day_after_tomorrow" }, "2026-10-15", null],
    ["الأحد الجاي", { kind: "weekday", weekday: "sunday" }, "2026-10-18", null],
    ["الثلاثاء (same weekday → next week)", { kind: "weekday", weekday: "tuesday" }, "2026-10-20", null],
    ["بعد 3 أيام → Friday → Saturday", { kind: "in_days", days: 3 }, "2026-10-17", "2026-10-16"],
    ["الجمعة → Saturday", { kind: "weekday", weekday: "friday" }, "2026-10-17", "2026-10-16"],
    ["20 أكتوبر", { kind: "absolute", day: 20, month: 10, year: null }, "2026-10-20", null],
    ["1 مارس (passed → next year)", { kind: "absolute", day: 1, month: 3, year: null }, "2027-03-01", null],
  ];

  it.each(cases)("%s", (_label, ref, date, movedFrom) => {
    const result = resolveSchedule(ref, null, TUESDAY);
    expect(result).toEqual({ ok: true, schedule: { date, time: null, movedFromDate: movedFrom } });
  });

  it("R4: Friday 9:00 moves to Saturday 9:00 (T03)", () => {
    expect(resolveSchedule({ kind: "weekday", weekday: "friday" }, t(9), TUESDAY)).toEqual({
      ok: true,
      schedule: { date: "2026-10-17", time: "09:00", movedFromDate: "2026-10-16" },
    });
  });

  it("R4: 'بكرة' on a Thursday lands on Friday and moves to Saturday", () => {
    expect(resolveSchedule({ kind: "tomorrow" }, t(1, "noon"), THURSDAY)).toEqual({
      ok: true,
      schedule: { date: "2026-10-17", time: "13:00", movedFromDate: "2026-10-16" },
    });
  });

  it("asks for a date when none was given", () => {
    expect(resolveSchedule({ kind: "none" }, t(10), TUESDAY)).toEqual({ ok: false, reason: "missing_date" });
  });

  it("rejects invalid or past explicit dates", () => {
    expect(resolveSchedule({ kind: "absolute", day: 31, month: 2, year: null }, null, TUESDAY)).toEqual({ ok: false, reason: "invalid_date" });
    expect(resolveSchedule({ kind: "absolute", day: 1, month: 1, year: 2026 }, null, TUESDAY)).toEqual({ ok: false, reason: "past_date" });
  });
});

describe("Arabic formatting", () => {
  it("uses the Gregorian calendar with Western digits", () => {
    expect(formatArabicDate("2026-10-17")).toBe("السبت 17 أكتوبر 2026");
    expect(formatArabicTime("09:00")).toBe("9:00 صباحاً");
    expect(formatArabicTime("13:00")).toBe("1:00 ظهراً");
    expect(formatArabicTime("15:30")).toBe("3:30 عصراً");
  });
});
