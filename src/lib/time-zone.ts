export const VIEWER_TIME_ZONE_COOKIE = "roamline-time-zone";
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function decodeTimeZoneCookie(value: string | null | undefined) {
  if (!value) return "";

  try {
    const decoded = decodeURIComponent(value);
    return decoded.length <= 100 ? decoded : "";
  } catch {
    return value.length <= 100 ? value : "";
  }
}

export function normalizeTimeZone(value: string | null | undefined) {
  const timeZone = decodeTimeZoneCookie(value);
  if (!timeZone) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return "UTC";
  }
}

function zonedParts(value: Date | string | number, timeZone: string): ZonedParts {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
    second: number("second"),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function isDateKey(value: string) {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function dateKeyInTimeZone(
  value: Date | string | number,
  timeZone: string
) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function dateTimeLocalInTimeZone(
  value: Date | string | number,
  timeZone: string
) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatInTimeZone(
  value: Date | string | number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US"
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: normalizeTimeZone(timeZone),
  }).format(date);
}
