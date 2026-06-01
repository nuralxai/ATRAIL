import { DateTime } from "luxon";
import { env } from "../env.js";

const TZ = env.APP_TIMEZONE || "Asia/Kolkata";

// returns Date object representing start of "today" in TZ, stored as an instant
export function startOfTodayInTz(): Date {
  return DateTime.now().setZone(TZ).startOf("day").toJSDate();
}

// parse YYYY-MM-DD (in TZ) -> start of that day
export function startOfDayInTz(isoDate: string): Date {
  const dt = DateTime.fromISO(isoDate, { zone: TZ });
  if (!dt.isValid) throw new Error("Invalid date format. Use YYYY-MM-DD");
  return dt.startOf("day").toJSDate();
}

// parse month YYYY-MM -> [start, endExclusive]
export function monthRangeInTz(yyyyMm: string): {
  start: Date;
  endExclusive: Date;
} {
  const dt = DateTime.fromFormat(yyyyMm, "yyyy-MM", { zone: TZ });
  if (!dt.isValid) throw new Error("Invalid month format. Use YYYY-MM");
  const start = dt.startOf("month");
  const endExclusive = start.plus({ months: 1 });
  return { start: start.toJSDate(), endExclusive: endExclusive.toJSDate() };
}

export function minutesBetween(
  a?: Date | null,
  b?: Date | null
): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
