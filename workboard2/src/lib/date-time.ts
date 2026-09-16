export const APP_TIME_ZONE = "Asia/Bangkok";

export function formatThaiDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatThaiDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  },
): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatThaiTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function bangkokTodayKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function bangkokWeekDateKeys(now = new Date()): string[] {
  const [year, month, day] = bangkokTodayKey(now).split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = anchor.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  anchor.setUTCDate(anchor.getUTCDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() + index);
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
  });
}


/**
 * Converts an HTML datetime-local value entered as Bangkok local time into
 * an absolute ISO timestamp. Server runtimes may run in UTC, so calling
 * new Date("YYYY-MM-DDTHH:mm") directly would interpret the same input in
 * the server's local timezone and shift Thai deadlines by 7 hours.
 */
export function bangkokLocalDateTimeToIso(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    throw new Error("รูปแบบวันเวลาไม่ถูกต้อง");
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`,
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error("วันเวลาไม่ถูกต้อง");
  }

  return date.toISOString();
}


export function toBangkokDateTimeLocalValue(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
