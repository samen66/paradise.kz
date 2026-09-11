"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/AddToCartButton";

function img(seed: string) {
  return {
    thumb: `https://picsum.photos/seed/${seed}/200/200`,
    medium: `https://picsum.photos/seed/${seed}/600/600`,
    full: `https://picsum.photos/seed/${seed}/1200/1200`,
  };
}

const STANDARD = [
  { id: 201, name: "Кровать Oslo 160×200, дуб", article: "OSL-BED-OAK", price: 189900, qty: 1, seed: "ai-bed-oslo", cat: 16 },
  { id: 202, name: "Шкаф-купе Lund 2-дв., белый", article: "LND-WR-WHT", price: 124500, qty: 1, seed: "ai-wardrobe-lund", cat: 17 },
  { id: 203, name: "Комод Bergen, 4 ящика", article: "BRG-DR-OAK", price: 68900, qty: 1, seed: "ai-dresser-bergen", cat: 18 },
  { id: 204, name: "Тумба прикроватная Nord", article: "NRD-NS-OAK", price: 24900, qty: 2, seed: "ai-nightstand-nord", cat: 18 },
  { id: 205, name: "Покрывало + подушки Cozy", article: "COZ-TXT-BEG", price: 18900, qty: 1, seed: "ai-textile-cozy", cat: 15 },
  { id: 206, name: "Торшер Aria, тёплый свет", article: "ARI-LMP-BLK", price: 32900, qty: 1, seed: "ai-lamp-aria", cat: 15 },
];

const CHEAPER = [
  { id: 211, name: "Кровать Nord ЛДСП 160×200, сонома", article: "NRD-BED-SON", price: 119900, qty: 1, seed: "ai-bed-nord", cat: 16 },
  { id: 212, name: "Стеллаж-гардероб Frame, открытый", article: "FRM-WR-OAK", price: 74900, qty: 1, seed: "ai-rack-frame", cat: 17 },
  { id: 213, name: "Комод Smart, 3 ящика", article: "SMT-DR-WHT", price: 44900, qty: 1, seed: "ai-dresser-smart", cat: 18 },
  { id: 214, name: "Тумба Cube", article: "CUB-NS-WHT", price: 15900, qty: 2, seed: "ai-nightstand-cube", cat: 18 },
  { id: 215, name: "Текстиль Basic, комплект", article: "BSC-TXT-GRY", price: 12900, qty: 1, seed: "ai-textile-basic", cat: 15 },
  { id: 216, name: "Лампа настольная Mini", article: "MIN-LMP-WHT", price: 14900, qty: 1, seed: "ai-lamp-mini", cat: 15 },
];

const STEP_LABELS = [
  "Анализирую запрос и фото…",
  "Подбираю мебель из ассортимента…",
  "Комплектую текстиль и декор…",
  "Формирую дизайн и смету…",
];

export function AiDesignClient() {
  const t = useTranslations("common");
  const [phase, setPhase] = useState<"form" | "processing" | "result">("form");
  const [step, setStep] = useState(0);
  const [variant, setVariant] = useState<"standard" | "cheaper">("standard");
  const [tab, setTab] = useState<"mood" | "render">("mood");
  const [renderDone, setRenderDone] = useState(false);
  const [photo, setPhoto] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [addedAll, setAddedAll] = useState(false);
  const [shared, setShared] = useState(false);
  const [budget, setBudget] = useState(500000);

  const descRef = useRef<HTMLTextAreaElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "processing") {
      timer = setInterval(() => {
        setStep((s) => {
          if (s >= STEP_LABELS.length - 1) {
            clearInterval(timer);
            setTimeout(() => setPhase("result"), 650);
            return s;
          }
          return s + 1;
        });
      }, 1050);
    }
    return () => clearInterval(timer);
  }, [phase]);

  const startGen = () => {
    let b = 500000;
    if (budgetRef.current) {
      const raw = budgetRef.current.value.replace(/[^\d]/g, "");
      if (raw) b = parseInt(raw, 10);
    }
    setPhase("processing");
    setStep(0);
    setBudget(b);
  };

  const reset = () => {
    setPhase("form");
    setStep(0);
    setVariant("standard");
    setTab("mood");
    setRenderDone(false);
    setAddedAll(false);
    setShared(false);
  };

  const toggleCheaper = () => {
    setVariant((v) => (v === "standard" ? "cheaper" : "standard"));
    setAddedAll(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const r = new FileReader();
      r.onload = (ev) => setPhoto(ev.target?.result as string);
      r.readAsDataURL(f);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const r = new FileReader();
      r.onload = (ev) => setPhoto(ev.target?.result as string);
      r.readAsDataURL(f);
    }
  };

  const setDemoPrompt = (txt: string) => () => {
    if (descRef.current) descRef.current.value = txt;
  };

  const list = variant === "standard" ? STANDARD : CHEAPER;
  const total = list.reduce((a, p) => a + p.price * p.qty, 0);
  const over = total > budget;
  const diff = Math.abs(budget - total);
  const barPct = Math.min(100, Math.round((total / budget) * 100));

  const chipDefs = [
    { label: "Спальня", txt: "спальня 15 м², в скандинавском стиле, светлые тона, бюджет до 500 000 ₸" },
    { label: "Гостиная", txt: "гостиная 20 м², современный стиль, тёплые оттенки" },
    { label: "Скандинавский", txt: "спальня в скандинавском стиле, натуральное дерево и светлый текстиль" },
    { label: "Минимализм", txt: "минимализм, спокойная палитра, ничего лишнего" },
    { label: "До 300 000 ₸", txt: "спальня, бюджетный вариант до 300 000 ₸" },
  ];

  // Demo picks shaped like an API product, so ProductCard renders them as-is.
  const products: Product[] = list.map((p): Product => ({
    id: p.id,
    external_id: p.article,
    name: p.name,
    slug: p.article.toLowerCase(),
    code: null,
    price: p.price,
    in_stock: true,
    stock: 8,
    is_new: false,
    article: p.article,
    category_id: p.cat,
    images: [img(p.seed)],
    image: img(p.seed).medium,
    country: null,
    supplier: null,
    barcodes: [],
    attributes: {},
  }));

  const collH = [230, 180, 200, 170, 210, 190];
  const collage = list.map((p, i) => ({
    img: img(p.seed).medium,
    label: p.name.split(",")[0],
    h: collH[i % collH.length],
  }));

  const rows = list.map((p) => ({
    name: p.name,
    qty: p.qty,
    img: img(p.seed).thumb,
    priceFmt: formatPrice(p.price, "ru"),
    sumFmt: formatPrice(p.price * p.qty, "ru"),
  }));

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="mx-auto max-w-[1360px] px-8 pt-5 text-[13px] text-muted hidden md:block">
        <a href="/" className="text-muted no-underline hover:underline">Главная</a>
        <span className="mx-2">›</span>
        <span className="font-medium text-ink">AI-дизайн интерьера</span>
      </div>

      {phase === "form" && (
        <div className="mx-auto max-w-[1360px] px-8 py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#c8372f] to-[#e8894f] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 4.9L19 9.8l-4.1 3 1.4 5.2L12 15.4 7.7 18l1.4-5.2L5 9.8l5.1-1.9L12 3z" fill="#fff" /></svg>
              AI-подбор
            </span>
          </div>
          <h1 className="m-0 max-w-[760px] font-display text-4xl font-extrabold tracking-tight text-ink leading-tight">
            Дизайн интерьера за минуту — из товаров Paradise.kz
          </h1>
          <p className="mt-4 max-w-[640px] text-[17px] leading-relaxed text-muted">
            Опишите комнату или загрузите фото — AI подберёт мебель, декор и текстиль под ваш стиль и бюджет, а мы соберём готовый заказ.
          </p>

          <div className="mt-10 grid gap-7 md:grid-cols-[1.35fr_1fr] items-start">
            <div className="rounded-[20px] border border-line bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-semibold text-ink">Опишите задачу</label>
              <textarea
                ref={descRef}
                placeholder="Например: спальня 15 м², в скандинавском стиле, светлые тона, бюджет до 500 000 ₸"
                className="w-full min-h-[104px] resize-y rounded-xl border border-line p-4 font-sans text-[15px] text-ink outline-none focus:border-[#c8372f]"
                defaultValue="спальня 15 м², в скандинавском стиле, светлые тона, бюджет до 500 000 ₸"
              />

              <div className="mt-4 text-[13px] font-semibold text-muted">Быстрый выбор</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {chipDefs.map((c, i) => (
                  <button
                    key={i}
                    onClick={setDemoPrompt(c.txt)}
                    className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold cursor-pointer ${
                      i === 0 ? "border-[#e8b98f] bg-[#f6efe3] text-ink" : "border-line bg-white text-ink hover:bg-surface"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3.5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink">Бюджет, ₸</label>
                  <input
                    ref={budgetRef}
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-line p-3.5 text-[15px] text-ink outline-none focus:border-[#c8372f]"
                    defaultValue="500 000"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink">Площадь, м²</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-line p-3.5 text-[15px] text-ink outline-none focus:border-[#c8372f]"
                    defaultValue="15"
                  />
                </div>
              </div>

              <div className="mt-7">
                <Button variant="primary" onClick={startGen} className="w-full h-12 text-base font-bold flex items-center justify-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 4.9L19 9.8l-4.1 3 1.4 5.2L12 15.4 7.7 18l1.4-5.2L5 9.8l5.1-1.9L12 3z" fill="currentColor" /></svg>
                  Сгенерировать дизайн
                </Button>
              </div>
            </div>

            <div className="rounded-[20px] border border-line bg-white p-6 shadow-sm">
              <label className="mb-3 block text-sm font-semibold text-ink">
                Фото вашей комнаты <span className="font-medium text-muted">(необязательно)</span>
              </label>

              {photo ? (
                <div className="relative overflow-hidden rounded-2xl border border-line">
                  <img src={photo} alt="" className="block h-[240px] w-full object-cover" />
                  <button
                    onClick={() => { setPhoto(""); if (fileRef.current) fileRef.current.value = ""; }}
                    className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-base text-white hover:bg-black"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDrop={onDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                      dragging ? "border-[#c8372f] bg-[#f6efe3]" : "border-line bg-[#faf8f5]"
                    }`}
                  >
                    <span className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#f6efe3]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 16V6m0 0l-4 4m4-4l4 4" stroke="#c8372f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#c8372f" strokeWidth="2" strokeLinecap="round" /></svg>
                    </span>
                    <div className="text-[15px] font-semibold text-ink">Перетащите фото сюда</div>
                    <div className="mt-1 text-[13px] text-muted">или нажмите, чтобы выбрать файл</div>
                  </div>
                  <div className="mt-3 flex gap-2.5">
                    <button onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white p-3 text-sm font-semibold text-ink hover:bg-surface">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h3l1.5-2h7L18 7h2a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg>
                      Сделать фото
                    </button>
                  </div>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />

              <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
                <div className="flex items-start gap-2.5"><span className="font-bold text-[#c8372f]">✓</span><span className="text-[13px] leading-relaxed text-muted">Только реальные товары в наличии на складе Paradise.kz</span></div>
                <div className="flex items-start gap-2.5"><span className="font-bold text-[#c8372f]">✓</span><span className="text-[13px] leading-relaxed text-muted">Готовый список с ценами и итоговой стоимостью</span></div>
                <div className="flex items-start gap-2.5"><span className="font-bold text-[#c8372f]">✓</span><span className="text-[13px] leading-relaxed text-muted">Добавление всего интерьера в корзину в один клик</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="mx-auto max-w-[720px] px-8 py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="rounded-3xl border border-line bg-white px-10 py-12 text-center shadow-lg">
            <div className="mx-auto mb-6 relative h-[78px] w-[78px]">
              <div className="absolute inset-0 rounded-full border-4 border-[#f6efe3]"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#c8372f] animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 4.9L19 9.8l-4.1 3 1.4 5.2L12 15.4 7.7 18l1.4-5.2L5 9.8l5.1-1.9L12 3z" fill="#c8372f" /></svg>
              </div>
            </div>
            <h2 className="mb-1.5 font-display text-2xl font-bold tracking-tight text-ink">Создаём ваш интерьер</h2>
            <p className="mb-7 text-sm text-muted">Обычно это занимает 10–15 секунд</p>

            <div className="mx-auto flex max-w-[420px] flex-col gap-3 text-left">
              {STEP_LABELS.map((label, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <div key={i} className={`flex items-center gap-3.5 rounded-xl border p-3 ${active ? 'border-[#e8b98f] bg-[#f6efe3]' : done ? 'border-[#bfe3cb] bg-[#dff0e4]' : 'border-[#f0eee9] bg-[#faf8f5]'}`}>
                    <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-[#2f9e5b] text-white' : active ? 'bg-[#c8372f] text-white' : 'bg-[#f0eee9] text-muted'}`}>
                      {done ? '✓' : active ? '•' : i + 1}
                    </span>
                    <span className={`text-[15px] ${active ? 'font-bold text-ink' : done ? 'font-medium text-ink' : 'font-medium text-muted'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="mx-auto max-w-[1360px] px-8 py-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-bold text-mint-ink">✦ Дизайн готов</span>
              <h1 className="m-0 font-display text-3xl font-extrabold tracking-tight text-ink">Спальня в скандинавском стиле · 15 м²</h1>
              <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-muted">
                Светлая палитра, натуральное дерево и мягкий текстиль. {list.length} товара из ассортимента Paradise.kz — все в наличии.
              </p>
            </div>
            <button onClick={reset} className="shrink-0 flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 10a8 8 0 00-14-3M4 14a8 8 0 0014 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Новый запрос
            </button>
          </div>

          <div className="grid gap-7 md:grid-cols-[1.15fr_1fr] items-start">
            {/* Visuals */}
            <div>
              <div className="mb-3.5 flex gap-2">
                <button
                  onClick={() => setTab("mood")}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${tab === "mood" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-surface"}`}
                >
                  Мудборд
                </button>
                <button
                  onClick={() => setTab("render")}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${tab === "render" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-surface"}`}
                >
                  Фото-рендер <span className="rounded-full bg-gradient-to-br from-[#c8372f] to-[#e8894f] px-1.5 py-0.5 text-[10px] font-bold text-white">AI</span>
                </button>
              </div>

              {tab === "mood" && (
                <div className="animate-in fade-in rounded-[20px] border border-line bg-white p-4 shadow-sm">
                  <div className="columns-2 gap-3 space-y-3">
                    {collage.map((m, i) => (
                      <div key={i} className="relative break-inside-avoid overflow-hidden rounded-2xl border border-[#f0eee9]">
                        <img src={m.img} alt="" style={{ height: m.h }} className="block w-full object-cover" />
                        <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur-sm shadow-sm">{m.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-xs text-muted">Мудборд собран из реальных фото товаров подборки</p>
                </div>
              )}

              {tab === "render" && (
                <div className="animate-in fade-in rounded-[20px] border border-line bg-white p-4 shadow-sm">
                  {renderDone ? (
                    <div className="relative overflow-hidden rounded-2xl animate-in fade-in">
                      <img src={img("ai-room-render-scandi").full} alt="" className="block h-[440px] w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-full bg-gradient-to-br from-[#c8372f] to-[#e8894f] px-3 py-1 text-[11px] font-bold text-white shadow-sm">AI-визуализация · демо</span>
                    </div>
                  ) : (
                    <div className="flex h-[440px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line p-6 text-center animate-pulse bg-gradient-to-r from-[#faf8f5] via-[#f0eee9] to-[#faf8f5]">
                      <span className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-2xl border border-line bg-white shadow-sm">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v14H4z" stroke="#c8372f" strokeWidth="1.6" /><circle cx="9" cy="10" r="1.6" fill="#c8372f" /><path d="M4 17l4.5-4 3 2.5L16 11l4 4" stroke="#c8372f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      <div className="text-base font-bold text-ink">Фото-рендер комнаты</div>
                      <div className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-muted">AI разместит подобранную мебель в вашей комнате и покажет фотореалистичную визуализацию</div>
                      <div className="mt-5">
                        <Button variant="primary" onClick={() => setRenderDone(true)}>Сгенерировать рендер</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Report */}
            <div className="flex flex-col gap-4">
              <div className="rounded-[20px] border border-line bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-muted">Итоговая стоимость</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${over ? 'bg-[#fbe9e7] text-[#c8372f]' : 'bg-mint text-mint-ink'}`}>
                    {over ? "Превышение бюджета" : "В рамках бюджета"}
                  </span>
                </div>
                <div className="mt-1.5 font-display text-4xl font-extrabold tracking-tight text-ink">{formatPrice(total, "ru")}</div>
                <div className="relative mt-3.5 h-2.5 overflow-hidden rounded-full bg-[#f0eee9]">
                  <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-[#c8372f]' : 'bg-[#2f9e5b]'}`} style={{ width: `${barPct}%` }}></div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted">
                  <span>Потрачено {formatPrice(total, "ru")}</span>
                  <span>Бюджет {formatPrice(budget, "ru")}</span>
                </div>
                <div className={`mt-2.5 text-[13px] font-semibold ${over ? 'text-[#c8372f]' : 'text-[#2f9e5b]'}`}>
                  {over ? `Превышение на ${formatPrice(diff, "ru")}` : `Остаётся ${formatPrice(diff, "ru")} до лимита`}
                </div>

                {(over || variant === "standard") && (
                  <button onClick={toggleCheaper} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-[#f6efe3] p-3 text-sm font-semibold text-ink transition hover:opacity-80">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M8 7h6a3 3 0 010 6H8m8 4H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    {variant === "standard" ? "Подобрать вариант дешевле" : "Вернуть базовый вариант"}
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-sm">
                <div className="border-b border-line px-5 py-4 font-display text-[15px] font-bold text-ink">Смета интерьера</div>
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-5 py-3 font-semibold">Товар</th>
                      <th className="px-2 py-3 text-center font-semibold">Кол-во</th>
                      <th className="px-2 py-3 text-right font-semibold">Цена</th>
                      <th className="py-3 pl-2 pr-5 text-right font-semibold">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-[#f0eee9]">
                        <td className="px-5 py-3 font-medium text-ink">
                          <div className="flex items-center gap-3">
                            <img src={r.img} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-[#f0eee9] object-cover" />
                            <span>{r.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center text-muted">{r.qty}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-right text-muted">{r.priceFmt}</td>
                        <td className="whitespace-nowrap py-3 pl-2 pr-5 text-right font-semibold text-ink">{r.sumFmt}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-[#faf8f5]">
                      <td colSpan={3} className="py-3.5 pl-5 pr-2 font-bold text-ink">Итого</td>
                      <td className="whitespace-nowrap py-3.5 pl-2 pr-5 text-right text-[15px] font-extrabold text-ink">{formatPrice(total, "ru")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-white p-4 shadow-sm">
                <Button variant="primary" onClick={() => setAddedAll(true)} className="w-full h-12 text-base font-bold flex items-center justify-center gap-2">
                  {addedAll ? "Добавлено в корзину ✓" : `Добавить всё в корзину · ${formatPrice(total, "ru")}`}
                </Button>
                <div className="flex gap-2.5">
                  <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white p-3 text-sm font-semibold text-ink hover:bg-surface">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    Скачать PDF
                  </button>
                  <button onClick={() => { setShared(true); setTimeout(() => setShared(false), 2000); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white p-3 text-sm font-semibold text-ink hover:bg-surface">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.7" /><circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" /><circle cx="18" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.7" /><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" stroke="currentColor" strokeWidth="1.7" /></svg>
                    {shared ? "Ссылка скопирована ✓" : "Поделиться"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-11">
            <h2 className="mb-5 font-display text-2xl font-bold tracking-tight text-ink">Использованные товары</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {products.map((product) => (
                <div key={product.id} className="relative flex flex-col gap-2.5 group">
                  <div className="absolute left-3 top-3 z-20 flex gap-1.5 pointer-events-none">
                    <Badge variant="mint">
                      {list.find(p => p.id === product.id)?.qty! > 1 ? `×${list.find(p => p.id === product.id)?.qty} в подборке` : "В подборке"}
                    </Badge>
                  </div>
                  <ProductCard product={product} showOverlay={false} showAddToCart={false} />
                  <div className="px-1 mt-auto">
                    <AddToCartButton product={product} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
