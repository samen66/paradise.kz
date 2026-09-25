import type { ShowroomDay } from "./types";

/** Message keys of `showrooms.days`, index 0 = Monday like `weekly_hours`. */
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function dayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function minutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

export type OpenState =
  | { kind: "open"; until: string }
  | { kind: "opens-today"; at: string }
  | { kind: "opens-later"; day: number; at: string }
  | { kind: "closed" };

/** Open/closed by the visitor's clock (the showrooms are local to them). */
export function openState(hours: ShowroomDay[], now: Date): OpenState {
  const today = dayIndex(now);
  const current = now.getHours() * 60 + now.getMinutes();
  const todayHours = hours[today];

  if (todayHours && current >= minutes(todayHours.open) && current < minutes(todayHours.close)) {
    return { kind: "open", until: todayHours.close };
  }
  if (todayHours && current < minutes(todayHours.open)) {
    return { kind: "opens-today", at: todayHours.open };
  }
  for (let offset = 1; offset <= 7; offset++) {
    const day = (today + offset) % 7;
    const next = hours[day];
    if (next) {
      return { kind: "opens-later", day, at: next.open };
    }
  }

  return { kind: "closed" };
}

export type ScheduleRow = { from: number; to: number; hours: ShowroomDay };

/** Consecutive days with equal hours collapse into one row ("Пн–Пт 10:00–21:00"). */
export function scheduleRows(hours: ShowroomDay[]): ScheduleRow[] {
  const key = (day: ShowroomDay) => (day ? `${day.open}-${day.close}` : "off");
  const rows: ScheduleRow[] = [];

  hours.forEach((day, index) => {
    const last = rows[rows.length - 1];
    if (last && key(last.hours) === key(day)) {
      last.to = index;
    } else {
      rows.push({ from: index, to: index, hours: day });
    }
  });

  return rows;
}

type Point = { lat: number | null; lng: number | null };

/** 2GIS writes "lng,lat". */
export function mapUrl({ lat, lng }: Point): string | null {
  return lat === null || lng === null ? null : `https://2gis.kz/?m=${lng}%2C${lat}%2F17`;
}

export function routeUrl({ lat, lng }: Point): string | null {
  return lat === null || lng === null ? null : `https://2gis.kz/directions/points/%7C${lng}%2C${lat}%3B`;
}

export function whatsappUrl(whatsapp: string | null): string | null {
  return whatsapp ? `https://wa.me/${whatsapp}` : null;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
