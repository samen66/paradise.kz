"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { SHOWROOMS, openStatus, scheduleRows, routeUrl, mapUrl, whatsappUrl, img, SERVICE_LABELS, productById, statusMeta } from "@/lib/showroom-data";

function plural(n: number, forms: string[]) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

export function ShowroomsClient() {
  const [city, setCity] = useState("all");
  const [district, setDistrict] = useState("all");
  const [activeId, setActiveId] = useState<number | null>(null);

  const cities = Array.from(new Set(SHOWROOMS.map(s => s.city)));
  
  const cityChips = [
    { key: "all", label: "Все города", count: SHOWROOMS.length },
    ...cities.map(c => ({
      key: c,
      label: c,
      count: SHOWROOMS.filter(s => s.city === c).length
    }))
  ];

  const cityForDistricts = city !== "all" ? SHOWROOMS.filter(s => s.city === city) : [];
  const districts = Array.from(new Set(cityForDistricts.map(s => s.district)));
  const showDistricts = districts.length > 1;

  const districtChips = [
    { key: "all", label: "Все районы" },
    ...districts.map(d => ({ key: d, label: d }))
  ];

  let list = [...SHOWROOMS];
  if (city !== "all") list = list.filter(s => s.city === city);
  if (showDistricts && district !== "all") list = list.filter(s => s.district === district);

  const focusCard = (id: number) => {
    setActiveId(id);
    const el = document.querySelector(`[data-sr-card="${id}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 150;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const handleCityClick = (c: string) => {
    setCity(c);
    setDistrict("all");
    setActiveId(null);
  };

  const activeSr = list.find(s => s.id === activeId) || list[0];
  const activeRouteUrl = activeSr ? mapUrl(activeSr) : "#";

  return (
    <>
      <div className="mx-auto max-w-[1360px] px-8 pt-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="m-0 font-display text-[34px] font-extrabold tracking-tight text-ink">
              Шоурумы Paradise.kz
            </h1>
            <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-muted">
              Приходите посмотреть и потрогать мебель вживую. Проверяйте наличие в конкретной точке и стройте маршрут в один клик.
            </p>
          </div>
          <div className="flex shrink-0 gap-[26px]">
            <div>
              <div className="font-display text-[26px] font-bold text-ink">{SHOWROOMS.length}</div>
              <div className="text-[13px] text-muted">шоурумов</div>
            </div>
            <div>
              <div className="font-display text-[26px] font-bold text-ink">{cities.length}</div>
              <div className="text-[13px] text-muted">города</div>
            </div>
          </div>
        </div>

        <div className="mt-[22px] flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[13px] font-semibold text-muted">Город</span>
            {cityChips.map(c => {
              const active = city === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleCityClick(c.key)}
                  className={`inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-4 py-2 font-sans text-sm font-semibold transition-colors ${
                    active 
                      ? "border-ink bg-ink text-white" 
                      : "border-line bg-white text-ink/80 hover:border-ink/30"
                  }`}
                >
                  {c.label}
                  <span className="text-[12px] font-semibold opacity-65">{c.count}</span>
                </button>
              );
            })}
          </div>
          {showDistricts && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-0.5 text-[13px] font-semibold text-muted">Район</span>
              {districtChips.map(d => {
                const active = district === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDistrict(d.key)}
                    className={`cursor-pointer whitespace-nowrap rounded-full border px-[14px] py-1.5 font-sans text-[13px] font-medium transition-colors ${
                      active
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-white text-ink/80 hover:border-ink/30"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-7 px-8 pb-16 pt-[22px] lg:grid-cols-[1fr_424px]">
        <div className="flex flex-col gap-[18px]">
          <div className="text-sm text-muted">
            Найдено <b className="text-ink">{list.length} {plural(list.length, ["шоурум", "шоурума", "шоурумов"])}</b>
          </div>
          
          {list.map((s, i) => {
            const os = openStatus(s);
            const jsDay = new Date().getDay();
            const idx = (jsDay + 6) % 7;
            const today = s.weekly[idx];
            const items = s.items;
            const strip = items.slice(0, 5).map(it => {
              const p = productById(it.productId);
              return { 
                href: `/catalog/${p.article.toLowerCase()}`, 
                name: p.name, 
                thumb: img(p.seed).thumb, 
                dot: statusMeta(it.status, it.qty).dot 
              };
            });
            const moreCount = Math.max(0, items.length - 5);
            const hasMore = moreCount > 0;
            const active = activeId === s.id;
            const detailHref = `/showrooms/${s.slug}`;

            return (
              <article
                key={s.id}
                data-sr-card={s.id}
                onMouseEnter={() => setActiveId(s.id)}
                onMouseLeave={() => setActiveId(null)}
                className={`scroll-mt-[150px] overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-150 ${
                  active ? "border-red-600 shadow-md" : "border-line hover:border-ink/20"
                }`}
              >
                <div className="grid grid-cols-[188px_1fr] items-stretch gap-0">
                  <Link
                    href={detailHref}
                    className="relative block min-h-[200px] bg-card bg-cover bg-center no-underline"
                    style={{ backgroundImage: `url(${img(s.cover).medium})` }}
                  >
                    <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                      {i + 1}
                    </span>
                    {s.flagship && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/80 px-[9px] py-1 text-[11px] font-bold tracking-[0.02em] text-white">
                        Флагман
                      </span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-col gap-3 p-5 pb-5 pt-5 pr-[22px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={detailHref} className="no-underline">
                          <h2 className="m-0 font-display text-[19px] font-bold leading-tight tracking-tight text-ink">
                            {s.name}
                          </h2>
                        </Link>
                        <div className="mt-1 text-[13px] text-muted">
                          {s.city} · {s.district}
                        </div>
                      </div>
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1.5 text-xs font-bold"
                        style={{ backgroundColor: os.open ? "#e3f3ea" : "#f0eee9", color: os.open ? "#1d6b4f" : "#8a8477" }}
                      >
                        <span
                          className="h-[7px] w-[7px] rounded-full"
                          style={{ backgroundColor: os.open ? "#2f9e6f" : "#c2bcb1" }}
                        />
                        {os.label}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 text-[13.5px] text-ink/80">
                      <div className="flex items-start gap-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-px shrink-0">
                          <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#8a8477" strokeWidth="1.7" />
                          <circle cx="12" cy="10" r="2.3" stroke="#8a8477" strokeWidth="1.7" />
                        </svg>
                        <span>
                          {s.address} · <span className="text-muted">{s.landmark}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
                          <circle cx="12" cy="12" r="9" stroke="#8a8477" strokeWidth="1.7" />
                          <path d="M12 7.5V12l3 2" stroke="#8a8477" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                        <span>
                          {os.sub.charAt(0).toUpperCase() + os.sub.slice(1)} · сегодня {today ? `${today.o}–${today.c}` : "выходной"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {s.services.slice(0, 3).map(serv => (
                        <span key={serv} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink/80">
                          {SERVICE_LABELS[serv]}
                        </span>
                      ))}
                    </div>

                    <div className="mt-0.5 flex flex-wrap gap-2">
                      <a
                        href={routeUrl(s)}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-[15px] py-[9px] text-[13px] font-semibold text-white no-underline transition-colors hover:bg-ink/90"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#fff" strokeWidth="1.8" />
                          <circle cx="12" cy="10" r="2.3" fill="#fff" />
                        </svg>
                        Построить маршрут
                      </a>
                      <a
                        href={`tel:${s.phoneHref}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-[15px] py-[9px] text-[13px] font-semibold text-ink no-underline hover:border-ink/30"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 6.2 2 2 0 016.5 4z" stroke="#1c1a17" strokeWidth="1.6" strokeLinejoin="round" />
                        </svg>
                        {s.phone}
                      </a>
                      <a
                        href={whatsappUrl(s)}
                        target="_blank"
                        rel="noopener"
                        title="Написать в WhatsApp"
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-[13px] py-[9px] text-[13px] font-semibold text-[#1d6b4f] no-underline hover:border-ink/30"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.6-1.2A9 9 0 1012 3z" stroke="#1d6b4f" strokeWidth="1.6" strokeLinejoin="round" />
                          <path d="M9 8.5c0 4 2.5 6.5 6.5 6.5.4-1 .2-1.6-.4-2l-1.4-.6-1 1c-1-.5-1.9-1.4-2.4-2.4l1-1-.6-1.4c-.4-.6-1-.8-1.7-.5z" fill="#1d6b4f" />
                        </svg>
                        WhatsApp
                      </a>
                    </div>

                    <div className="mt-1.5 border-t border-line pt-3.5">
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold text-ink">
                          В этой точке — {items.length} {plural(items.length, ["товар", "товара", "товаров"])}
                        </span>
                        <Link href={detailHref} className="whitespace-nowrap text-[13px] font-semibold text-red-600 no-underline hover:text-red-700">
                          Смотреть все →
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-[9px]">
                        {strip.map((p, pIdx) => (
                          <Link
                            key={pIdx}
                            href={p.href}
                            title={p.name}
                            className="relative block h-[58px] w-[58px] shrink-0 overflow-hidden rounded-xl border border-line bg-card bg-cover bg-center no-underline"
                            style={{ backgroundImage: `url(${p.thumb})` }}
                          >
                            <span 
                              className="absolute bottom-1 left-1 h-2 w-2 rounded-full shadow-[0_0_0_2px_#fff]"
                              style={{ backgroundColor: p.dot }}
                            />
                          </Link>
                        ))}
                        {hasMore && (
                          <Link
                            href={detailHref}
                            className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-[13px] font-bold text-muted no-underline hover:border-ink/30 hover:text-ink"
                          >
                            +{moreCount}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {list.length === 0 && (
            <div className="rounded-2xl border border-line bg-white p-12 text-center text-muted">
              В выбранном фильтре нет шоурумов.
            </div>
          )}
        </div>

        <div className="sticky top-[150px]">
          <div className="relative h-[672px] overflow-hidden rounded-2xl border border-line bg-[#e9ebe6] shadow-[0_1px_2px_rgba(28,26,23,0.04),0_16px_40px_rgba(28,26,23,0.07)]">
            {/* Fake SVG Map Background */}
            <svg viewBox="0 0 456 672" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
              <rect x="0" y="0" width="456" height="672" fill="#e9ebe6" />
              <path d="M-20 210 L200 120 L360 190 L520 130 L520 260 L330 320 L120 260 Z" fill="#dbe7f1" opacity="0.85" />
              <path d="M300 430 q60 -30 130 -10 l0 130 q-90 30 -150 -5 z" fill="#dcefe0" />
              <ellipse cx="90" cy="520" rx="90" ry="70" fill="#dcefe0" />
              <g stroke="#ffffff" strokeWidth="12" strokeLinecap="round" opacity="0.95">
                <path d="M-10 90 L470 150" />
                <path d="M-10 300 L470 340" />
                <path d="M-10 500 L470 560" />
                <path d="M90 -10 L60 690" />
                <path d="M250 -10 L230 690" />
                <path d="M400 -10 L380 690" />
              </g>
              <g stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.8">
                <path d="M-10 195 L470 245" />
                <path d="M-10 400 L470 450" />
                <path d="M170 -10 L150 690" />
                <path d="M330 -10 L310 690" />
              </g>
              <g stroke="#d9d6cd" strokeWidth="1.5" opacity="0.6">
                <path d="M-10 145 L470 90 M-10 240 L470 300 M-10 350 L470 410 M-10 450 L470 500 M-10 560 L470 620" />
                <path d="M40 -10 L20 690 M130 -10 L110 690 M210 -10 L190 690 M290 -10 L270 690 M370 -10 L350 690 M440 -10 L420 690" />
              </g>
            </svg>

            <div className="absolute left-[14px] top-[14px] inline-flex items-center gap-2 rounded-full bg-white/95 px-[13px] py-2 text-[13px] font-semibold text-ink shadow-[0_2px_8px_rgba(28,26,23,0.12)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#c8372f" strokeWidth="2" />
                <circle cx="12" cy="10" r="2.4" fill="#c8372f" />
              </svg>
              {city === "all" ? "Все города" : city}
            </div>

            {list.map((s, i) => {
              const active = activeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-sr-pin={s.id}
                  onClick={() => focusCard(s.id)}
                  onMouseEnter={() => setActiveId(s.id)}
                  onMouseLeave={() => setActiveId(null)}
                  title={s.name}
                  className="absolute cursor-pointer border-none bg-none p-0 leading-none transition-transform duration-150"
                  style={{
                    left: `${s.mx}%`,
                    top: `${s.my}%`,
                    transform: `translate(-50%, -100%) scale(${active ? 1.18 : 1})`,
                    zIndex: active ? 6 : 2,
                    filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.28))"
                  }}
                >
                  <svg width="34" height="43" viewBox="0 0 28 36">
                    <path 
                      d="M14 0C6.3 0 0 6.1 0 13.7 0 24 14 36 14 36s14-12 14-22.3C28 6.1 21.7 0 14 0z" 
                      fill={active ? "#1c1a17" : "#c8372f"} 
                      stroke="#fff" 
                      strokeWidth="2" 
                    />
                  </svg>
                  <span className="absolute left-1/2 top-[13px] -translate-x-1/2 -translate-y-1/2 font-display text-[13px] font-bold text-white">
                    {i + 1}
                  </span>
                </button>
              );
            })}

            <div className="absolute bottom-[14px] left-[14px] right-[14px] flex items-center justify-between gap-2.5 rounded-xl bg-white/95 px-[15px] py-[11px] shadow-[0_2px_10px_rgba(28,26,23,0.12)]">
              <span className="text-[12.5px] leading-snug text-muted">
                Кликните на метку, чтобы найти шоурум в списке
              </span>
              <a 
                href={activeRouteUrl} 
                target="_blank" 
                rel="noopener" 
                className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-red-600 no-underline hover:text-red-700"
              >
                Открыть в 2ГИС →
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
