"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Showroom,
  openStatus,
  scheduleRows,
  routeUrl,
  mapUrl,
  whatsappUrl,
  img,
  SERVICE_LABELS,
  productById,
  statusMeta,
  formatPrice,
  DAY_LABELS
} from "@/lib/showroom-data";
import { AddToCartButton } from "@/components/ProductCard"; // Using from ProductCard if available, otherwise will create local stub

function plural(n: number, forms: string[]) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

// Minimal stub in case it doesn't exist exported
const AddToCartStub = ({ product }: { product: any }) => (
  <button type="button" className="flex h-11 w-full items-center justify-center rounded-xl bg-ink text-sm font-semibold text-white transition-colors hover:bg-ink/90">
    В корзину
  </button>
);

export function ShowroomClient({ showroom: s }: { showroom: Showroom }) {
  const [photo, setPhoto] = useState(0);
  const [filter, setFilter] = useState("all");

  const os = openStatus(s);
  const jsDay = new Date().getDay();
  const todayIdx = (jsDay + 6) % 7;

  const thumbs = s.gallery.map((seed, i) => ({
    url: img(seed).medium,
    active: i === photo
  }));

  const rawRows = scheduleRows(s);
  const dayName = DAY_LABELS[todayIdx];
  const schedule = rawRows.map(r => {
    const isToday = r.range === dayName || (r.range.includes("–") && (() => {
      const [a, b] = r.range.split("–");
      const ai = DAY_LABELS.indexOf(a), bi = DAY_LABELS.indexOf(b);
      return todayIdx >= ai && todayIdx <= bi;
    })());
    return {
      ...r,
      isToday,
      labelColor: r.open ? "#1c1a17" : "#8a8477",
      hoursColor: r.open ? "#1c1a17" : "#8a8477",
      weight: isToday ? 700 : (r.open ? 500 : 400)
    };
  });

  const allItems = s.items.map(it => {
    const p = productById(it.productId);
    const m = statusMeta(it.status, it.qty);
    const discountPct = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : null;
    return {
      status: it.status,
      statusKey: m.key,
      href: `/catalog/${p.article.toLowerCase()}`,
      article: p.article,
      name: p.name,
      image: img(p.seed).medium,
      priceLabel: formatPrice(p.price),
      discount: !!discountPct,
      discountLabel: discountPct ? `−${discountPct}%` : "",
      oldPriceLabel: p.oldPrice ? formatPrice(p.oldPrice) : "",
      statusLabel: m.label,
      statusBg: m.bg,
      statusColor: m.color,
      statusDot: m.dot,
      product: {
        id: p.id, external_id: p.article.toLowerCase(), name: p.name, slug: p.article.toLowerCase(),
        code: `P-${p.id}`, article: p.article, category_id: 12,
        brand: { id: 4, name: p.brand || "Ambianta", slug: "ambianta" },
        images: [img(p.seed)], image: img(p.seed).medium,
        stock: p.stock, in_stock: p.stock > 0, price: p.price,
        country: "Казахстан", supplier: "Ambianta Furniture", barcodes: [], attributes: {}
      }
    };
  });

  const statusDefs = [
    { key: "all", label: "Все" },
    { key: "in", label: "В наличии", dot: "#2f9e6f" },
    { key: "low", label: "Мало", dot: "#d08a2e" },
    { key: "order", label: "Под заказ", dot: "#5b6ee0" },
    { key: "sample", label: "Образцы", dot: "#9a6fc4" }
  ];

  const filterChips = statusDefs
    .filter(d => d.key === "all" || allItems.some(it => it.statusKey === d.key))
    .map(d => {
      const active = filter === d.key;
      const count = d.key === "all" ? allItems.length : allItems.filter(it => it.statusKey === d.key).length;
      return {
        ...d,
        active,
        count
      };
    });

  const products = filter === "all" ? allItems : allItems.filter(it => it.statusKey === filter);

  return (
    <div className="mx-auto max-w-[1360px] px-8 pb-14 pt-[18px]">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.35fr_1fr]">
        
        {/* Gallery */}
        <div>
          <div 
            className="relative overflow-hidden rounded-2xl border border-line bg-card bg-cover bg-center"
            style={{ aspectRatio: "16/10", backgroundImage: `url(${img(s.gallery[photo] || s.cover).full})` }}
          >
            {s.flagship && (
              <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-white">
                Флагманский шоурум
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {thumbs.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPhoto(i)}
                className={`cursor-pointer overflow-hidden rounded-xl border-2 bg-card bg-cover bg-center p-0 ${
                  t.active ? "border-red-600" : "border-transparent"
                }`}
                style={{ aspectRatio: "1/1", backgroundImage: `url(${t.url})` }}
              />
            ))}
          </div>
        </div>

        {/* Details & Schedule */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-white p-7 shadow-sm">
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <h1 className="m-0 font-display text-[26px] font-bold leading-tight tracking-tight text-ink">
                {s.name}
              </h1>
              <span 
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold"
                style={{ backgroundColor: os.open ? "#e3f3ea" : "#f0eee9", color: os.open ? "#1d6b4f" : "#8a8477" }}
              >
                <span 
                  className="h-2 w-2 rounded-full" 
                  style={{ backgroundColor: os.open ? "#2f9e6f" : "#c2bcb1" }} 
                />
                {os.open ? `${os.label} · ${os.sub}` : os.label}
              </span>
            </div>
            
            <div className="mb-4 flex items-center gap-2.5 text-[13px] text-muted">
              <span>{s.city} · {s.district}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23 6.09 20.34l1.13-6.57L2.45 9.14l6.6-.96z" fill="#f5a623" />
                </svg>
                {String(s.rating).replace(".", ",")} · {s.reviews} {plural(s.reviews, ["отзыв", "отзыва", "отзывов"])}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 border-b border-line pb-4.5 text-sm text-ink/80">
              <div className="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-px shrink-0">
                  <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#8a8477" strokeWidth="1.7" />
                  <circle cx="12" cy="10" r="2.3" stroke="#8a8477" strokeWidth="1.7" />
                </svg>
                <span>
                  <b className="font-semibold text-ink">{s.address}</b><br/>
                  <span className="text-muted">{s.landmark}</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M4 7h16M4 12h16M4 17h10" stroke="#8a8477" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <span>{s.area} · {s.floors} · {s.parking}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 6.2 2 2 0 016.5 4z" stroke="#8a8477" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                <a href={`tel:${s.phoneHref}`} className="font-semibold text-ink no-underline">{s.phone}</a>
              </div>
            </div>

            <div className="my-4.5 flex flex-wrap gap-2.5">
              <a 
                href={routeUrl(s)} 
                target="_blank" 
                rel="noopener" 
                className="flex min-w-[180px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-red-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#fff" strokeWidth="1.8" />
                  <circle cx="12" cy="10" r="2.3" fill="#fff" />
                </svg>
                Построить маршрут
              </a>
              <a 
                href={whatsappUrl(s)} 
                target="_blank" 
                rel="noopener" 
                className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-[#1d6b4f] no-underline hover:border-ink/30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.6-1.2A9 9 0 1012 3z" stroke="#1d6b4f" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M9 8.5c0 4 2.5 6.5 6.5 6.5.4-1 .2-1.6-.4-2l-1.4-.6-1 1c-1-.5-1.9-1.4-2.4-2.4l1-1-.6-1.4c-.4-.6-1-.8-1.7-.5z" fill="#1d6b4f" />
                </svg>
                WhatsApp
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              {s.services.map(srv => (
                <span 
                  key={srv}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-[11px] py-1 text-[12.5px] text-ink/80"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#1d6b4f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {SERVICE_LABELS[srv]}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white px-7 py-5 shadow-sm">
            <h2 className="mb-3.5 m-0 font-display text-base font-bold text-ink">Часы работы</h2>
            <div className="flex flex-col">
              {schedule.map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 text-sm last:border-0">
                  <span style={{ color: row.labelColor, fontWeight: row.weight }}>
                    {row.range}
                    {row.isToday && (
                      <span className="ml-2 rounded-full bg-red-600/10 px-2 py-0.5 text-[11px] font-bold text-red-600">
                        сегодня
                      </span>
                    )}
                  </span>
                  <span style={{ color: row.hoursColor, fontWeight: row.weight }}>
                    {row.hours}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Map Banner */}
      <div className="relative mt-4 h-[300px] overflow-hidden rounded-2xl border border-line bg-[#e9ebe6] shadow-sm">
        <svg viewBox="0 0 1296 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <rect x="0" y="0" width="1296" height="300" fill="#e9ebe6" />
          <path d="M-20 90 L400 40 L760 120 L1100 60 L1320 130 L1320 210 L820 240 L360 200 L-20 220 Z" fill="#dbe7f1" opacity="0.8" />
          <ellipse cx="1050" cy="220" rx="180" ry="120" fill="#dcefe0" />
          <g stroke="#ffffff" strokeWidth="14" strokeLinecap="round" opacity="0.95">
            <path d="M-20 160 L1320 130" />
            <path d="M-20 250 L1320 270" />
            <path d="M300 -20 L280 320" />
            <path d="M640 -20 L660 320" />
            <path d="M980 -20 L960 320" />
          </g>
          <g stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.8">
            <path d="M-20 210 L1320 200" />
            <path d="M150 -20 L140 320 M470 -20 L480 320 M820 -20 L810 320 M1140 -20 L1130 320" />
          </g>
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md">
          <svg width="44" height="56" viewBox="0 0 28 36">
            <path d="M14 0C6.3 0 0 6.1 0 13.7 0 24 14 36 14 36s14-12 14-22.3C28 6.1 21.7 0 14 0z" fill="#c8372f" stroke="#fff" strokeWidth="2" />
            <circle cx="14" cy="13.5" r="5" fill="#fff" />
          </svg>
        </div>
        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3.5 rounded-xl bg-white/95 px-[18px] py-3.5 shadow-md">
          <div>
            <div className="text-sm font-bold text-ink">{s.name}</div>
            <div className="text-[13px] text-muted">{s.address} · {s.landmark}</div>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <a 
              href={mapUrl(s)} 
              target="_blank" 
              rel="noopener" 
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-[15px] py-2.5 text-[13px] font-semibold text-ink no-underline hover:border-ink/30"
            >
              Открыть в 2ГИС
            </a>
            <a 
              href={routeUrl(s)} 
              target="_blank" 
              rel="noopener" 
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-[15px] py-2.5 text-[13px] font-semibold text-white no-underline transition-colors hover:bg-ink/90"
            >
              Маршрут
            </a>
          </div>
        </div>
      </div>

      {/* Catalog items in this showroom */}
      <div className="mt-11">
        <h2 className="mb-1.5 m-0 font-display text-2xl font-bold tracking-tight text-ink">
          Товары в этом шоуруме <span className="text-base font-medium text-muted">· {allItems.length} {plural(allItems.length, ["позиция", "позиции", "позиций"])}</span>
        </h2>
        <p className="mb-4.5 m-0 text-sm text-muted">
          Наличие указано для этой точки. Нажмите на товар, чтобы открыть карточку.
        </p>

        <div className="mb-[22px] flex flex-wrap gap-2">
          {filterChips.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-[15px] py-2 font-sans text-[13px] font-semibold transition-colors ${
                f.active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink/80 hover:border-ink/30"
              }`}
            >
              {f.dot && (
                <span 
                  className="h-[7px] w-[7px] rounded-full" 
                  style={{ backgroundColor: f.dot !== "transparent" ? f.dot : undefined }} 
                />
              )}
              {f.label}
              <span className="text-xs font-semibold opacity-60">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] items-start gap-[22px]">
          {products.map(p => (
            <div key={p.product.id} className="flex flex-col gap-2.5">
              <Link 
                href={p.href} 
                className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-ink no-underline shadow-[0_1px_2px_rgba(28,26,23,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(28,26,23,0.10)]"
              >
                <div 
                  className="relative bg-card bg-cover bg-center" 
                  style={{ aspectRatio: "1/1", backgroundImage: `url(${p.image})` }}
                >
                  <span 
                    className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.25 rounded-full px-2.5 py-1 text-[11.5px] font-bold shadow-sm"
                    style={{ backgroundColor: p.statusBg, color: p.statusColor }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.statusDot }} />
                    {p.statusLabel}
                  </span>
                  {p.discount && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-[#fbe3df] px-[9px] py-1 text-[11.5px] font-bold text-red-600">
                      {p.discountLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-[7px] px-[15px] pb-4 pt-3.5">
                  <div className="text-[11px] tracking-[0.02em] text-muted">{p.article}</div>
                  <div className="line-clamp-2 min-h-[38px] text-sm font-semibold leading-snug">
                    {p.name}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-display text-lg font-bold">{p.priceLabel}</span>
                    {p.discount && (
                      <span className="text-[13px] text-muted line-through">{p.oldPriceLabel}</span>
                    )}
                  </div>
                </div>
              </Link>
              <AddToCartStub product={p.product} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-9 flex justify-center">
        <Link 
          href="/showrooms" 
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-[22px] py-3 text-sm font-semibold text-ink no-underline hover:border-ink/30"
        >
          ← Все шоурумы Paradise.kz
        </Link>
      </div>
    </div>
  );
}
