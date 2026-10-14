import { DateTime } from "luxon";
import { TIMEZONE } from "@/lib/env";

// Formatted by hand: Intl "ar-SA" defaults to the Hijri calendar and Arabic-Indic digits.
const WEEKDAY_NAMES = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];
const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/** "2026-10-14" → "الأربعاء 14 أكتوبر 2026" */
export function formatArabicDate(isoDate: string): string {
  const dt = DateTime.fromISO(isoDate, { zone: TIMEZONE });
  return `${WEEKDAY_NAMES[dt.weekday - 1]} ${dt.day} ${MONTH_NAMES[dt.month - 1]} ${dt.year}`;
}

/** "13:00" → "1:00 ظهراً" */
export function formatArabicTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const display = `${h % 12 || 12}:${String(m).padStart(2, "0")}`;
  if (h < 12) return `${display} صباحاً`;
  if (h < 15) return `${display} ظهراً`;
  if (h < 18) return `${display} عصراً`;
  return `${display} مساءً`;
}

export function formatArabicDateTime(isoDate: string, time: string | null): string {
  return time ? `${formatArabicDate(isoDate)} الساعة ${formatArabicTime(time)}` : formatArabicDate(isoDate);
}
