/**
 * Every schedule is displayed in property time (Panama City Beach, US Central),
 * never in the viewer's machine time zone.
 */
export const PROPERTY_TIME_ZONE = 'America/Chicago';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: PROPERTY_TIME_ZONE, ...options });
    formatters.set(key, f);
  }
  return f;
}

export type TimeFormat = 'time' | 'date' | 'dateShort' | 'dateTime' | 'weekday' | 'long' | 'weekdayDate';

const formats: Record<TimeFormat, Intl.DateTimeFormatOptions> = {
  time: { hour: 'numeric', minute: '2-digit' },
  date: { month: 'short', day: 'numeric', year: 'numeric' },
  dateShort: { month: 'short', day: 'numeric' },
  dateTime: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  weekday: { weekday: 'long' },
  long: { weekday: 'long', month: 'long', day: 'numeric' },
  weekdayDate: { weekday: 'short', month: 'short', day: 'numeric' },
};

export function formatPropertyTime(value: string | Date | null | undefined, format: TimeFormat = 'dateTime'): string {
  if (!value) {
    return '—';
  }
  return formatter(formats[format]).format(typeof value === 'string' ? new Date(value) : value);
}

/** Calendar date key (YYYY-MM-DD) in property time. */
export function propertyDateKey(value: string | Date): string {
  const parts = formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    typeof value === 'string' ? new Date(value) : value,
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "YYYY-MM-DDTHH:mm" in property wall-clock time, for datetime-local inputs. */
export function toPropertyInputValue(value: string | Date): string {
  const parts = formatter({
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(typeof value === 'string' ? new Date(value) : value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** "2 min ago" relative to the demo clock, never the machine clock. */
export function relativeTo(value: string | null | undefined, now: string | null | undefined): string {
  if (!value || !now) {
    return '—';
  }
  const minutes = Math.round((new Date(now).getTime() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Short duration such as "8 min" or "1 hr 5 min". */
export function durationBetween(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) {
    return '—';
  }
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)} d`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
