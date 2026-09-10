import type { Settings } from "../types.ts";
export const TIMEZONE = "America/Santiago";
export function chileParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  const year = get("year"),
    month = get("month"),
    day = get("day");
  return {
    year,
    month,
    day,
    hour: get("hour"),
    minute: get("minute"),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}
function localDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = target;
  for (let i = 0; i < 4; i++) {
    const p = chileParts(new Date(timestamp));
    const mapped = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const correction = target - mapped;
    if (correction === 0) break;
    timestamp += correction;
  }
  return new Date(timestamp);
}
function dayHours(now: Date, offset = 0) {
  const p = chileParts(now);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day + offset));
  const sunday = day.getUTCDay() === 0;
  return {
    opening: localDate(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      sunday ? 12 : 11,
      0,
    ),
    closing: localDate(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      sunday ? 20 : 23,
      sunday ? 0 : 30,
    ),
  };
}
function manualUntil(settings: Settings): Date | null {
  if (!settings.manualClosed || !settings.reopenAt) return null;
  const d = new Date(settings.reopenAt);
  return Number.isNaN(+d) ? null : d;
}
export function nextOpening(now: Date, settings: Settings): Date {
  const reopen = manualUntil(settings);
  const from = reopen && reopen > now ? reopen : now;
  const day = dayHours(from);
  if (from < day.opening) return day.opening;
  if (from < day.closing) return from;
  return dayHours(from, 1).opening;
}
export function branchAvailability(now: Date, settings: Settings) {
  const { opening, closing } = dayHours(now);
  const reopen = manualUntil(settings);
  const manual = settings.manualClosed && (!reopen || reopen > now);
  const next = nextOpening(now, settings);
  const p = chileParts(now),
    n = chileParts(next);
  const sameDay = p.year === n.year && p.month === n.month && p.day === n.day;
  return {
    open: !manual && now >= opening && now < closing,
    canScheduleToday:
      now < closing && (!manual || (!!reopen && sameDay && next < closing)),
    nextOpening: next,
    closesAt: closing,
    reason: manual
      ? "manual"
      : now < opening
        ? "before_open"
        : now >= closing
          ? "after_close"
          : "open",
  };
}
export const displayTime = (date: Date | string) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
export function scheduledTime(
  text: string,
  now: Date,
  settings: Settings,
): { ok: boolean; time?: string; error?: string } {
  const match = text
    .trim()
    .match(/^(?:(?:hoy\s+)?(?:a\s+las\s+)?)?(\d{1,2}):(\d{2})$/i);
  if (!match)
    return {
      ok: false,
      error:
        "Escribe una hora de hoy en formato HH:MM (bloques de 15 minutos).",
    };
  const hour = Number(match[1]),
    minute = Number(match[2]);
  if (hour > 23 || minute > 59 || minute % 15 !== 0)
    return {
      ok: false,
      error: "Usa bloques de 15 minutos: por ejemplo, 14:30 o 14:45.",
    };
  const p = chileParts(now);
  const date = localDate(p.year, p.month, p.day, hour, minute);
  const availability = branchAvailability(now, settings);
  const atTime = branchAvailability(date, settings);
  const exactClose =
    +date === +atTime.closesAt &&
    !(
      settings.manualClosed &&
      settings.reopenAt &&
      +new Date(settings.reopenAt) > +date
    );
  if (
    !availability.canScheduleToday ||
    (!atTime.open && !exactClose) ||
    +date - +now < 30 * 60000
  )
    return {
      ok: false,
      error: `Debe ser hoy, dentro del horario y al menos 30 minutos desde ahora. Próxima apertura: ${displayTime(availability.nextOpening)}.`,
    };
  return { ok: true, time: date.toISOString() };
}
