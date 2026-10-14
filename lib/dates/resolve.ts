import type { DateTime } from "luxon";

/**
 * The LLM only *describes* the date/time the user said ("بكرة", "الجمعة", "العصر").
 * Turning that description into a calendar date is done here, deterministically,
 * relative to "now" in Asia/Riyadh. This is also where R4 (no Friday tasks) is applied.
 */

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PERIODS = ["morning", "noon", "asr", "maghrib", "evening"] as const;
export type Period = (typeof PERIODS)[number];

export type DateRef =
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "day_after_tomorrow" }
  | { kind: "weekday"; weekday: Weekday }
  | { kind: "in_days"; days: number }
  | { kind: "absolute"; day: number; month: number; year: number | null }
  | { kind: "none" };

export type TimeRef = { hour: number | null; minute: number | null; period: Period | null };

export type Schedule = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (24h) or null when the user gave no time */
  time: string | null;
  /** The originally requested date when it fell on a Friday and was moved to Saturday */
  movedFromDate: string | null;
};

export type ScheduleResult =
  | { ok: true; schedule: Schedule }
  | { ok: false; reason: "missing_date" | "invalid_date" | "invalid_time" | "past_date" };

/** Luxon weekday numbers: Monday = 1 … Sunday = 7. */
const LUXON_FRIDAY = 5;

/** Default clock time when only a part of the day is mentioned ("العصر" → 15:00). */
const PERIOD_DEFAULT_TIME: Record<Period, string> = {
  morning: "09:00",
  noon: "12:00",
  asr: "15:00",
  maghrib: "18:00",
  evening: "20:00",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function resolveTime(ref: TimeRef | null): { ok: true; time: string | null } | { ok: false } {
  if (!ref || (ref.hour === null && ref.period === null)) return { ok: true, time: null };
  if (ref.hour === null) return { ok: true, time: PERIOD_DEFAULT_TIME[ref.period!] };

  const minute = ref.minute ?? 0;
  if (!Number.isInteger(ref.hour) || !Number.isInteger(minute)) return { ok: false };
  if (ref.hour < 0 || ref.hour > 24 || minute < 0 || minute > 59) return { ok: false };

  let hour = ref.hour % 24;
  if (hour >= 13 || hour === 0) {
    // already 24h
  } else if (hour === 12) {
    if (ref.period === "evening") hour = 0;
  } else {
    switch (ref.period) {
      case "morning":
        break;
      case "noon":
        if (hour <= 5) hour += 12;
        break;
      case "asr":
      case "maghrib":
      case "evening":
        hour += 12;
        break;
      case null:
        // No part of day given: 1–6 can only mean the afternoon within working hours
        // (08:00–16:00), 7–11 mean the morning.
        if (hour <= 6) hour += 12;
        break;
    }
  }
  return { ok: true, time: `${pad(hour)}:${pad(minute)}` };
}

export function resolveDate(ref: DateRef, now: DateTime): DateTime | "missing" | "invalid" | "past" {
  const today = now.startOf("day");
  switch (ref.kind) {
    case "none":
      return "missing";
    case "today":
      return today;
    case "tomorrow":
      return today.plus({ days: 1 });
    case "day_after_tomorrow":
      return today.plus({ days: 2 });
    case "in_days":
      if (!Number.isInteger(ref.days) || ref.days < 0 || ref.days > 365) return "invalid";
      return today.plus({ days: ref.days });
    case "weekday": {
      // "الأحد" / "الأحد الجاي" = the next Sunday strictly after today.
      const target = WEEKDAYS.indexOf(ref.weekday) + 1;
      if (target === 0) return "invalid";
      const diff = (target - today.weekday + 7) % 7 || 7;
      return today.plus({ days: diff });
    }
    case "absolute": {
      const year = ref.year ?? today.year;
      let dt = today.set({ year, month: ref.month, day: ref.day });
      if (!dt.isValid || dt.month !== ref.month || dt.day !== ref.day) return "invalid";
      if (dt < today) {
        if (ref.year !== null) return "past";
        dt = dt.plus({ years: 1 });
      }
      return dt;
    }
  }
}

/** R4: a task that lands on a Friday moves to Saturday, same time. */
export function applyFridayRule(date: DateTime): { date: DateTime; movedFrom: DateTime | null } {
  if (date.weekday === LUXON_FRIDAY) return { date: date.plus({ days: 1 }), movedFrom: date };
  return { date, movedFrom: null };
}

export function resolveSchedule(dateRef: DateRef, timeRef: TimeRef | null, now: DateTime): ScheduleResult {
  const date = resolveDate(dateRef, now);
  if (date === "missing") return { ok: false, reason: "missing_date" };
  if (date === "invalid") return { ok: false, reason: "invalid_date" };
  if (date === "past") return { ok: false, reason: "past_date" };

  const time = resolveTime(timeRef);
  if (!time.ok) return { ok: false, reason: "invalid_time" };

  const { date: finalDate, movedFrom } = applyFridayRule(date);
  return {
    ok: true,
    schedule: {
      date: finalDate.toISODate()!,
      time: time.time,
      movedFromDate: movedFrom ? movedFrom.toISODate()! : null,
    },
  };
}
