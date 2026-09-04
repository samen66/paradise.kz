"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

const AV = ["#c8372f", "#1d6b4f", "#5b6ee0", "#c77d1a", "#7b4fa8", "#2b8a9e"];

function fmtK(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0).replace(".", ",") + " тыс." : String(n);
}

function initials(s: string) {
  const p = String(s).replace(/^@/, "").trim().split(/\s+/);
  return ((p[0] && p[0][0]) || "" + (p[1] ? p[1][0] : "")).toUpperCase() + (p[1] ? p[1][0].toUpperCase() : "");
}

const REELS = [
  { id: 1, poster: "sofa-milan-reel", handle: "@Mebel BRO", brand: "Официальный партнёр Paradise.kz", caption: "Диван Milan — раскладывается за 3 секунды. Показываем механизм еврокнижка и бельевой ящик 👀", likes: 1240, comments: 86, productName: "Диван Milan прямой", productPrice: "389 900 ₸", productTag: "РАЗМЕР", productImg: "sofa-milan-1" },
  { id: 2, poster: "kitchen-nordic-reel", handle: "@InteriorKZ", brand: "Дизайн-студия · Алматы", caption: "Собрали кухню-гостиную в скандинавском стиле. Стол Oslo и стулья из массива дуба.", likes: 3420, comments: 214, productName: "Стол обеденный Oslo", productPrice: "164 500 ₸", productTag: "ДУБ", productImg: "table-oslo-1" },
  { id: 3, poster: "bedroom-cozy-reel", handle: "@SleepWell", brand: "Спальни · Paradise.kz", caption: "Кровать Bergen с мягким изголовьем и подъёмным механизмом. Идеально для маленьких спален.", likes: 892, comments: 41, productName: "Кровать Bergen 160×200", productPrice: "278 000 ₸", productTag: "ХИТ", productImg: "bed-bergen-1" },
  { id: 4, poster: "office-chair-reel", handle: "@WorkSpace", brand: "Офис и кабинет", caption: "Эргономичное кресло Oslo — поддержка спины на весь рабочий день. Тест на 300 кг ✅", likes: 2110, comments: 128, productName: "Кресло офисное Oslo", productPrice: "145 900 ₸", productTag: "ЭРГО", productImg: "chair-oslo-1" },
  { id: 5, poster: "wardrobe-reel", handle: "@Mebel BRO", brand: "Официальный партнёр Paradise.kz", caption: "Шкаф-купе на заказ: 5 секций, зеркало, доводчики. Замер бесплатно по Алматы.", likes: 1580, comments: 73, productName: "Шкаф-купе Lund", productPrice: "312 000 ₸", productTag: "НА ЗАКАЗ", productImg: "wardrobe-lund-1" }
];

const COMMENTS = [
  { author: "Асель Н.", time: "2 ч", text: "Какой размер спального места в разложенном виде?", likes: 12 },
  { author: "Тимур Б.", time: "5 ч", text: "Заказал такой же, привезли на следующий день. Качество топ 🔥", likes: 34 },
  { author: "Динара К.", time: "1 д", text: "А есть в бежевом цвете? И как ухаживать за велюром?", likes: 8 },
  { author: "Ержан М.", time: "1 д", text: "Механизм реально плавный, проверил в шоуруме на Райымбека", likes: 21 },
  { author: "Камила А.", time: "2 д", text: "Цена с учётом доставки и сборки? Или отдельно?", likes: 5 }
];

export function ShortsFeed() {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState<Record<number, boolean>>({});
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [commentsFor, setCommentsFor] = useState<number | null>(null);
  const [toast, setToast] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = searchParams.get("reel");
    if (target && scrollRef.current) {
      const idx = REELS.findIndex((r) => String(r.id) === target);
      if (idx > 0) {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: idx * scrollRef.current.clientHeight });
          }
        }, 80);
      }
    }
  }, [searchParams]);

  const nav = (dir: number) => {
    if (!scrollRef.current) return;
    const h = scrollRef.current.clientHeight;
    const idx = Math.round(scrollRef.current.scrollTop / h);
    scrollRef.current.scrollTo({ top: (idx + dir) * h, behavior: "smooth" });
  };

  const togglePlay = (id: number) => {
    setPlaying((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  
  const toggleLike = (id: number) => {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSave = (id: number) => {
    setSaved((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const share = () => {
    setToast(true);
    setTimeout(() => setToast(false), 1900);
  };

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] bg-[#0b0a09] font-sans text-white overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-40 flex items-center gap-[18px] px-[22px] py-4 pointer-events-none bg-gradient-to-b from-black/55 to-transparent">
        <Link href="/" className="pointer-events-auto font-display text-xl font-bold tracking-tight text-white hover:text-[#f0d9c4] transition-colors">
          Paradise.kz
        </Link>
        <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-[13px] font-bold backdrop-blur-md">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M8 5v14l11-7z" fill="#c8372f"></path>
          </svg>
          Shorts
        </span>
        <div className="flex-1"></div>
        <Link href="/catalog" className="pointer-events-auto text-sm font-semibold text-white/90 hover:text-[#f0d9c4] transition-colors">
          Каталог
        </Link>
        <Link href="/" className="pointer-events-auto inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/14 text-white hover:bg-white/20 transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
          </svg>
        </Link>
      </header>

      {/* Desktop Navigation */}
      <div className="absolute right-[26px] top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-3.5">
        <button type="button" onClick={() => nav(-1)} className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-none bg-white/14 text-white backdrop-blur-md cursor-pointer hover:bg-white/20 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
        <button type="button" onClick={() => nav(1)} className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-none bg-white/14 text-white backdrop-blur-md cursor-pointer hover:bg-white/20 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
      </div>

      <div
        ref={scrollRef}
        className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {REELS.map((reel) => {
          const isLiked = !!liked[reel.id];
          const isSaved = !!saved[reel.id];
          const isPaused = !playing[reel.id];

          return (
            <section key={reel.id} className="h-[100dvh] snap-start snap-always flex items-center justify-center bg-[#0b0a09]">
              <div className="relative overflow-hidden bg-black md:h-[calc(100dvh-48px)] md:aspect-[9/16] md:max-w-[440px] md:rounded-[24px] md:shadow-[0_30px_80px_rgba(0,0,0,0.6)] w-full h-[100dvh]">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(https://picsum.photos/seed/${reel.poster}/540/960)` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/70 pointer-events-none" />

                <button
                  type="button"
                  onClick={() => togglePlay(reel.id)}
                  className="absolute inset-0 flex items-center justify-center bg-transparent border-none cursor-pointer p-0"
                >
                  {isPaused && (
                    <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff">
                        <path d="M8 5v14l11-7z"></path>
                      </svg>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMuted(!muted)}
                  className="absolute left-4 top-[74px] z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full border-none bg-black/40 text-white backdrop-blur-md cursor-pointer hover:bg-black/50 transition-colors"
                >
                  {muted ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"></path>
                      <path d="M17 9l4 6M21 9l-4 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"></path>
                      <path d="M15.5 8.5a5 5 0 010 7M18 6a9 9 0 010 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
                    </svg>
                  )}
                </button>

                <div className="absolute bottom-[150px] right-3 z-10 flex flex-col items-center gap-5">
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleLike(reel.id)}
                      className={`flex h-[50px] w-[50px] items-center justify-center rounded-full border-none bg-white/16 backdrop-blur-md cursor-pointer transition-transform ${isLiked ? "scale-[1.12]" : "scale-100 hover:scale-105"}`}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill={isLiked ? "#f43f5e" : "none"} className={isLiked ? "text-[#f43f5e]" : "text-white"}>
                        <path d="M12 21s-7.5-4.6-10-9.2C.3 8.3 1.9 4.8 5.3 4.8c2 0 3.4 1.2 4.2 2.5.8-1.3 2.2-2.5 4.2-2.5 3.4 0 5 3.5 3.3 7C19.5 16.4 12 21 12 21z" stroke="currentColor" strokeWidth="1.6"></path>
                      </svg>
                    </button>
                    <span className="text-xs font-bold text-white drop-shadow-md">{fmtK(reel.likes + (isLiked ? 1 : 0))}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCommentsFor(reel.id)}
                      className="flex h-[50px] w-[50px] items-center justify-center rounded-full border-none bg-white/16 text-white backdrop-blur-md cursor-pointer hover:bg-white/25 transition-colors"
                    >
                      <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
                        <path d="M21 11.5a8.4 8.4 0 01-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1121 11.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                    <span className="text-xs font-bold text-white drop-shadow-md">{fmtK(reel.comments)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleSave(reel.id)}
                      className="flex h-[50px] w-[50px] items-center justify-center rounded-full border-none bg-white/16 backdrop-blur-md cursor-pointer hover:bg-white/25 transition-colors"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill={isSaved ? "#f0d9c4" : "none"} className={isSaved ? "text-[#f0d9c4]" : "text-white"}>
                        <path d="M6 4h12v16l-6-4-6 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={share}
                      className="flex h-[50px] w-[50px] items-center justify-center rounded-full border-none bg-white/16 text-white backdrop-blur-md cursor-pointer hover:bg-white/25 transition-colors"
                    >
                      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
                        <path d="M18 8a3 3 0 10-2.8-4M6 12a3 3 0 100 0m12 4a3 3 0 10-2.8 4M8.6 13.4l6.8 3.9M15.4 6.7L8.6 10.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="absolute bottom-5 left-4 right-[82px] z-10">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white"
                      style={{ background: AV[reel.id % AV.length] }}
                    >
                      {initials(reel.handle)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white drop-shadow-md">{reel.handle}</div>
                      <div className="text-xs text-white/80 drop-shadow-md">{reel.brand}</div>
                    </div>
                  </div>
                  <p className="mb-3 text-[13px] leading-relaxed text-white/95 drop-shadow-md">
                    {reel.caption}
                  </p>

                  <Link href={`/product/dummy-${reel.id}`} className="flex flex-col gap-[11px] rounded-2xl border border-white/12 bg-[#141210]/75 p-3 backdrop-blur-xl no-underline hover:bg-[#141210]/90 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-[50px] w-[50px] shrink-0 rounded-[10px] bg-cover bg-center"
                        style={{ backgroundImage: `url(https://picsum.photos/seed/${reel.productImg}/120/120)` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">{reel.productName}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="whitespace-nowrap text-[15px] font-bold text-white">{reel.productPrice}</span>
                          <span className="rounded-md bg-white/12 px-1.5 py-0.5 text-[11px] font-semibold text-[#f0d9c4]">{reel.productTag}</span>
                        </div>
                      </div>
                    </div>
                    <span className="flex items-center justify-center gap-1.5 rounded-xl bg-[#c8372f] p-[11px] text-sm font-bold text-white hover:bg-[#a92e27] transition-colors">
                      Перейти к товару
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </span>
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {commentsFor != null && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
          onClick={() => setCommentsFor(null)}
        >
          <div
            className="flex h-[72dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-white md:mb-6 md:h-[70dvh] md:w-[440px] md:max-w-[92vw] md:rounded-[20px] md:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f0eee9] px-5 py-4">
              <span className="font-display text-base font-bold text-[#1c1a17]">
                Комментарии · {fmtK(REELS.find((r) => r.id === commentsFor)?.comments || 0)}
              </span>
              <button
                type="button"
                onClick={() => setCommentsFor(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-[#faf8f5] text-[#1c1a17] cursor-pointer hover:bg-[#f0eee9] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {COMMENTS.map((c, i) => (
                <div key={i} className="flex gap-3 py-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold text-white"
                    style={{ background: AV[i % AV.length] }}
                  >
                    {initials(c.author)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[#1c1a17]">{c.author}</span>
                      <span className="text-xs text-[#8a8477]">{c.time}</span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-[#5f5a50]">{c.text}</p>
                  </div>
                  <span className="flex flex-col items-center gap-0.5 text-[#8a8477]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 21s-7.5-4.6-10-9.2C.3 8.3 1.9 4.8 5.3 4.8c2 0 3.4 1.2 4.2 2.5.8-1.3 2.2-2.5 4.2-2.5 3.4 0 5 3.5 3.3 7C19.5 16.4 12 21 12 21z" stroke="currentColor" strokeWidth="1.6"></path>
                    </svg>
                    <span className="text-[11px]">{c.likes}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 border-t border-[#f0eee9] px-5 py-3.5">
              <input
                type="text"
                placeholder="Добавить комментарий…"
                className="flex-1 rounded-full border border-[#e5e1da] px-3.5 py-2.5 text-sm text-[#1c1a17] outline-none placeholder:text-[#8a8477] focus:border-[#c8372f] transition-colors"
              />
              <button
                type="button"
                className="cursor-pointer rounded-full border-none bg-[#c8372f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#a92e27] transition-colors"
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#141210]/92 px-5 py-3 text-[13px] font-semibold text-white shadow-2xl backdrop-blur-md">
          Ссылка на товар скопирована
        </div>
      )}
    </div>
  );
}
