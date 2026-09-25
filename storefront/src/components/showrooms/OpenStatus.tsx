"use client";

import { useTranslations } from "next-intl";
import { DAY_KEYS, dayIndex, openState } from "@/lib/showrooms";
import type { ShowroomDay } from "@/lib/types";
import { useNow } from "@/lib/use-now";

/**
 * Open/closed state and its caption ("до 21:00", "откроется в Пн в 10:00").
 * null until the client knows the time — SSR and hydration render nothing.
 */
function useOpenInfo(hours: ShowroomDay[]) {
  const t = useTranslations("showrooms");
  const now = useNow();

  if (!now) {
    return null;
  }

  const state = openState(hours, now);
  let caption = "";

  if (state.kind === "open") {
    caption = t("until", { time: state.until });
  } else if (state.kind === "opens-today") {
    caption = t("opensToday", { time: state.at });
  } else if (state.kind === "opens-later") {
    caption = t("opensOn", { day: t(`days.${DAY_KEYS[state.day]}`), time: state.at });
  }

  return { now, open: state.kind === "open", caption };
}

/** "Открыто · до 21:00" chip. */
export function OpenBadge({ hours, withSubtitle = false }: { hours: ShowroomDay[]; withSubtitle?: boolean }) {
  const t = useTranslations("showrooms");
  const info = useOpenInfo(hours);

  if (!info) {
    return null;
  }

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1.5 text-xs font-bold"
      style={{ backgroundColor: info.open ? "#e3f3ea" : "#f0eee9", color: info.open ? "#1d6b4f" : "#8a8477" }}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: info.open ? "#2f9e6f" : "#c2bcb1" }} />
      {info.open ? t("open") : t("closed")}
      {withSubtitle && info.caption && ` · ${info.caption}`}
    </span>
  );
}

/** "До 21:00 · сегодня 10:00–21:00". */
export function TodayLine({ hours }: { hours: ShowroomDay[] }) {
  const t = useTranslations("showrooms");
  const info = useOpenInfo(hours);

  if (!info) {
    return null;
  }

  const today = hours[dayIndex(info.now)];
  const todayText = t("todayHours", { hours: today ? `${today.open}–${today.close}` : t("dayOff").toLowerCase() });
  const caption = info.caption.charAt(0).toUpperCase() + info.caption.slice(1);

  return <span>{[caption, todayText].filter(Boolean).join(" · ")}</span>;
}
