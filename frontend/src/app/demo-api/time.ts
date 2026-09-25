/**
 * Property-time arithmetic for the in-browser demo API. Instants are epoch milliseconds;
 * wall-clock values are always interpreted in America/Chicago, never the viewer's zone.
 */
export const TIME_ZONE = 'America/Chicago';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface Wall { y: number; m: number; d: number; h: number; min: number }

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

export function wall(ms: number): Wall {
  const p = Object.fromEntries(partsFormat.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p['year'], m: +p['month'], d: +p['day'], h: +p['hour'] % 24, min: +p['minute'] };
}

function offsetMinutes(ms: number): number {
  const w = wall(ms);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min);
  return Math.round((asUtc - Math.floor(ms / MINUTE) * MINUTE) / MINUTE);
}

/** Instant for a property wall-clock time. */
export function at(y: number, m: number, d: number, h = 0, min = 0): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let result = guess - offsetMinutes(guess) * MINUTE;
  const corrected = guess - offsetMinutes(result) * MINUTE;
  if (corrected !== result) result = corrected;
  return result;
}

/** Calendar day number (days since epoch) of the property date. */
export function dayOf(ms: number): number {
  const w = wall(ms);
  return Date.UTC(w.y, w.m - 1, w.d) / DAY;
}

/** Minutes after property midnight. */
export function minuteOfDay(ms: number): number {
  const w = wall(ms);
  return w.h * 60 + w.min;
}

export function atDay(day: number, hour: number, minute = 0): number {
  const date = new Date(day * DAY);
  return at(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute);
}

export function addMonths(ms: number, months: number): number {
  const w = wall(ms);
  const total = w.m - 1 + months;
  return at(w.y + Math.floor(total / 12), (total % 12) + 1, w.d, w.h, w.min);
}

/** Parses "YYYY-MM-DDTHH:mm" as property wall-clock time; accepts ISO strings with an offset too. */
export function parseLocal(value: string | null | undefined): number | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(v)) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(v);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;
  return at(y, m, d, h, min);
}

export const iso = (ms: number) => new Date(ms).toISOString();
export const isoOrNull = (ms: number | null | undefined) => (ms === null || ms === undefined ? null : iso(ms));

export function zoneAbbreviation(ms: number): string {
  return offsetMinutes(ms) === -300 ? 'CDT' : 'CST';
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options });
const clockFormat = fmt({ hour: 'numeric', minute: '2-digit' });
const weekdayFormat = fmt({ weekday: 'long' });
const weekdayShortFormat = fmt({ weekday: 'short' });
const monthDayFormat = fmt({ month: 'short', day: 'numeric' });
const longMonthDayFormat = fmt({ month: 'long', day: 'numeric' });
const longDateFormat = fmt({ month: 'long', day: 'numeric', year: 'numeric' });

/** "4:00 PM" */
export const clock = (ms: number) => clockFormat.format(ms);
/** "Saturday" */
export const weekday = (ms: number) => weekdayFormat.format(ms);
/** "Sep 26, 4:00 PM" */
export const monthDayTime = (ms: number) => `${monthDayFormat.format(ms)}, ${clock(ms)}`;
/** "Sat Sep 26" */
export const shortWeekdayDate = (ms: number) => `${weekdayShortFormat.format(ms)} ${monthDayFormat.format(ms)}`;
/** "Saturday, Sep 26 at 4:00 PM" */
export const weekdayDateAt = (ms: number) => `${weekday(ms)}, ${monthDayFormat.format(ms)} at ${clock(ms)}`;
/** "Saturday, October 3" */
export const weekdayLongDate = (ms: number) => `${weekday(ms)}, ${longMonthDayFormat.format(ms)}`;
/** "September 1, 2026" */
export const longDate = (ms: number) => longDateFormat.format(ms);
/** "Sat 4:00 PM" */
export const shortWeekdayClock = (ms: number) => `${weekdayShortFormat.format(ms)} ${clock(ms)}`;

/** "8:00 AM" for minutes after midnight (1439 → "midnight"). */
export function clockOfMinutes(minutes: number): string {
  if (minutes >= 23 * 60 + 59) return 'midnight';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
