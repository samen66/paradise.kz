"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { retailStockLabel } from "@/lib/stock";

const CATALOG = [
  { id: 101, name: "Диван Milan прямой, 3-местный", price: 389900, oldPrice: 486900, rating: 4.7, reviews: 128, stock: 6, seed: "sofa-milan-1", cat: "диван", color: "серый", room: "гостиная", size: "большой" },
  { id: 105, name: "Диван Sofia классический, 2-местный", price: 298000, rating: 4.5, reviews: 64, stock: 4, seed: "sofa-sofia-1", cat: "диван", color: "кремовый", room: "гостиная", size: "компактный" },
  { id: 103, name: "Диван-кровать Nova, еврокнижка", price: 268500, rating: 4.6, reviews: 52, stock: 9, seed: "sofa-nova-1", cat: "диван", color: "синий", room: "гостиная", size: "компактный" },
  { id: 107, name: "Диван Roma угловой, правый угол", price: 445000, rating: 4.4, reviews: 38, stock: 2, seed: "sofa-roma-1", cat: "диван", color: "серый", room: "гостиная", size: "большой" },
  { id: 102, name: "Диван Bergen угловой, левый угол", price: 512000, rating: 4.8, reviews: 41, stock: 3, seed: "sofa-bergen-1", cat: "диван", color: "бежевый", room: "гостиная", size: "большой" },
  { id: 104, name: "Кресло офисное Ergo Pro", price: 128000, rating: 4.6, reviews: 73, stock: 14, seed: "chair-ergo-1", cat: "кресло", color: "чёрный", room: "офис", size: "компактный" },
  { id: 120, name: "Кресло Oslo мягкое", price: 145900, rating: 4.5, reviews: 31, stock: 7, seed: "chair-oslo-1", cat: "кресло", color: "горчичный", room: "гостиная", size: "компактный" },
  { id: 130, name: "Стол обеденный Oslo, массив дуба", price: 164500, rating: 4.7, reviews: 44, stock: 5, seed: "table-oslo-1", cat: "стол", color: "дуб", room: "кухня", size: "большой" },
  { id: 140, name: "Кровать Bergen 160×200 с подъёмным механизмом", price: 278000, rating: 4.8, reviews: 96, stock: 6, seed: "bed-bergen-1", cat: "кровать", color: "серый", room: "спальня", size: "большой" },
  { id: 150, name: "Шкаф-купе Lund, 5 секций", price: 312000, rating: 4.6, reviews: 58, stock: 4, seed: "wardrobe-lund-1", cat: "шкаф", color: "белый", room: "спальня", size: "большой" },
  { id: 106, name: "Тумба ТВ Lund, дуб сонома", price: 87500, oldPrice: 102000, rating: 4.4, reviews: 22, stock: 12, seed: "tv-lund-1", cat: "тумба", color: "дуб", room: "гостиная", size: "компактный" }
];

const CAT_WORDS: Record<string, string> = { "диван": "диван", "софа": "диван", "кресл": "кресло", "стол": "стол", "кроват": "кровать", "спал": "кровать", "шкаф": "шкаф", "купе": "шкаф", "тумб": "тумба" };
const COLOR_WORDS = ["серый", "бежевый", "белый", "чёрный", "черный", "синий", "кремовый", "горчичный", "дуб"];
const ROOM_WORDS = ["гостиная", "гостин", "спальня", "спальн", "кухня", "кухн", "офис"];

const stockLabels = { many: "Много", pieces: (count: number) => `${count} шт.` };

function fmtPrice(n: number) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸"; }
function ru(n: number) { return String(n).replace(".", ","); }

function catalogView(item: any) {
  return {
    href: "/catalog", // Changed from Product.dc.html
    img: `https://picsum.photos/seed/${item.seed}/180/180`,
    name: item.name, priceLabel: fmtPrice(item.price),
    hasOld: !!item.oldPrice, oldPriceLabel: item.oldPrice ? fmtPrice(item.oldPrice) : "",
    ratingLabel: ru(item.rating), metaLabel: `${item.reviews} отзывов`,
    stockLabel: item.stock > 0 ? `В наличии` : "Под заказ",
    stockColor: item.stock > 0 ? "var(--color-mint-ink,#1f7a4d)" : "var(--color-neutral-500,#8a8477)"
  };
}

type Message = {
  role: "bot" | "user";
  kind: "text" | "image" | "products";
  text?: string;
  image?: string;
  products?: any[];
};

export function AIAssistant({ product, startOpen = false, photoSearch = true, accentColor = "#c8372f" }: any) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<"typing" | "analyzing" | null>(null);
  const [seeded, setSeeded] = useState(false);

  const scrollEl = useRef<HTMLDivElement>(null);
  const fileEl = useRef<HTMLInputElement>(null);
  const inputEl = useRef<HTMLTextAreaElement>(null);
  const t1 = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql as any);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    
    if (startOpen) openChat();

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
      if (t1.current) clearTimeout(t1.current);
    };
  }, [startOpen]); // Added startOpen to dependency array to satisfy exhaustive-deps, though it shouldn't matter for mock

  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
  }, [messages, pending]);

  const greeting = (): Message => {
    if (product) return { role: "bot", kind: "text", text: `Здравствуйте! Я AI-помощник Paradise.kz. Спросите про этот товар — расскажу про отзывы, характеристики, наличие и доставку. Или опишите, что ещё ищете.` };
    return { role: "bot", kind: "text", text: `Здравствуйте! Опишите, что вы ищете, или загрузите фото похожего товара — подберу подходящие варианты из каталога Paradise.kz.` };
  };

  const openChat = () => {
    if (!seeded) {
      setOpen(true);
      setSeeded(true);
      setMessages([greeting()]);
    } else {
      setOpen(true);
    }
    setTimeout(() => inputEl.current?.focus(), 60);
  };

  const closeChat = () => setOpen(false);

  const ask = (text: string) => {
    const t = (text || "").trim();
    if (!t || pending) return;
    setMessages(s => [...s, { role: "user", kind: "text", text: t }]);
    setInput("");
    setPending("typing");
    if (inputEl.current) inputEl.current.style.height = "auto";
    if (t1.current) clearTimeout(t1.current);
    t1.current = setTimeout(() => {
      const reply = respond(t);
      setMessages(s => [...s, ...reply]);
      setPending(null);
    }, 850);
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  const onSend = () => ask(input);

  const pickPhoto = () => { if (fileEl.current) fileEl.current.click(); };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pending) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMessages(s => [...s, { role: "user", kind: "image", image: reader.result as string }]);
      setPending("analyzing");
      if (t1.current) clearTimeout(t1.current);
      t1.current = setTimeout(() => {
        const pool = CATALOG.filter(i => i.cat === "диван").slice(0, 3);
        const reply: Message[] = [
          { role: "bot", kind: "text", text: "Готово! По фото я подобрал похожие товары — обратите внимание на форму и цвет обивки:" },
          { role: "bot", kind: "products", products: pool.map(catalogView) },
          { role: "bot", kind: "text", text: "Хотите сузить подбор? Напишите цвет, размер или бюджет." }
        ];
        setMessages(s => [...s, ...reply]);
        setPending(null);
      }, 1900);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const respond = (q: string): Message[] => {
    const t = q.toLowerCase();
    if (product) {
      if (/отзыв|рейтинг|оцен|хвал|пишут|плюс|минус|нравится/.test(t)) return reviewsAnswer(product);
      if (/характер|размер|материал|механизм|габарит|вес|ткан|каркас|цвет|обивк/.test(t)) return specsAnswer(product);
      if (/куп|продаж|популяр|сколько раз|берут|хит|спрос/.test(t)) return salesAnswer(product);
      if (/налич|остат|доставк|срок|когда|привез|получ|сборк/.test(t)) return deliveryAnswer(product);
      if (/цена|стоит|скидк|дешевл|дорог|рассроч|акци/.test(t)) return priceAnswer(product);
      if (/похож|аналог|альтернатив|вариант|ещё|еще|друг/.test(t)) return similarAnswer(product);
      if (/что это|расскаж|подроб|обзор|описан/.test(t)) return aboutAnswer(product);
    }
    return searchAnswer(t);
  };

  const reviewsAnswer = (p: any): Message[] => {
    let txt = `Средняя оценка — ${ru(p.rating)} из 5 на основе ${p.reviewsCount} отзывов.`;
    if (p.pros && p.pros.length) txt += `\n\nЧаще всего хвалят: ${p.pros.join(", ")}.`;
    if (p.cons && p.cons.length) txt += `\nИз минусов упоминают: ${p.cons.join(", ")}.`;
    return [{ role: "bot", kind: "text", text: txt }];
  };
  const specsAnswer = (p: any): Message[] => {
    let txt = `Ключевые характеристики:`;
    (p.specs || []).slice(0, 6).forEach((s: any) => { txt += `\n• ${s.name}: ${s.value}`; });
    return [{ role: "bot", kind: "text", text: txt }];
  };
  const salesAnswer = (p: any): Message[] => {
    let txt = p.sales ? `Это один из хитов категории — товар купили уже ${p.sales} раз` : `Товар пользуется стабильным спросом`;
    txt += `, рейтинг держится на ${ru(p.rating)} из 5 (${p.reviewsCount} отзывов).`;
    if (p.stock) txt += ` Сейчас в наличии: ${retailStockLabel(p.stock, stockLabels).toLowerCase()}.`;
    return [{ role: "bot", kind: "text", text: txt }];
  };
  const deliveryAnswer = (p: any): Message[] => {
    let txt = p.stock ? `В наличии на складе: ${retailStockLabel(p.stock, stockLabels).toLowerCase()}.` : `Товар под заказ.`;
    if (p.delivery) txt += `\n${p.delivery}`;
    if (p.assembly) txt += `\n${p.assembly}`;
    return [{ role: "bot", kind: "text", text: txt }];
  };
  const priceAnswer = (p: any): Message[] => {
    let txt = `Цена — ${p.priceLabel}`;
    if (p.oldPriceLabel) txt += ` со скидкой${p.discountLabel ? " " + p.discountLabel : ""} (было ${p.oldPriceLabel})`;
    txt += `. Доставка по Алматы включена бесплатно.`;
    return [{ role: "bot", kind: "text", text: txt }];
  };
  const aboutAnswer = (p: any): Message[] => {
    const txt = p.about || `${p.name} — качественная модель бренда ${p.brand || "Paradise.kz"}. Спросите про характеристики, отзывы или наличие.`;
    return [{ role: "bot", kind: "text", text: txt }];
  };
  const similarAnswer = (p: any): Message[] => {
    const items = (p.similar || []).map(catalogView);
    if (!items.length) return searchAnswer("похожие");
    return [
      { role: "bot", kind: "text", text: "Вот несколько похожих вариантов из той же категории:" },
      { role: "bot", kind: "products", products: items }
    ];
  };

  const searchAnswer = (t: string): Message[] => {
    let cat = null;
    for (const k in CAT_WORDS) if (t.includes(k)) { cat = CAT_WORDS[k]; break; }
    const color = COLOR_WORDS.find(c => t.includes(c));
    const room = ROOM_WORDS.find(r => t.includes(r));
    const compact = /маленьк|компакт|небольш|узк/.test(t);
    if (!cat && !color && !room) {
      return [{ role: "bot", kind: "text", text: "Уточните, пожалуйста: что именно ищете — диван, кресло, стол, кровать, шкаф или тумбу? Можно указать комнату, цвет и бюджет, либо загрузить фото похожего товара." }];
    }
    let list = CATALOG.slice();
    if (cat) list = list.filter(i => i.cat === cat);
    if (color) list = list.filter(i => i.color.startsWith(color.replace("черный", "чёрный")));
    if (room) list = list.filter(i => room.startsWith(i.room.slice(0, 5)));
    if (compact) list = list.filter(i => i.size === "компактный");
    if (!list.length) list = cat ? CATALOG.filter(i => i.cat === cat) : CATALOG.slice(0, 3);
    list = list.slice(0, 4);
    const intro = compact ? "Для компактного пространства подойдут эти варианты:" : "Нашёл подходящие товары в каталоге:";
    const out: Message[] = [
      { role: "bot", kind: "text", text: intro },
      { role: "bot", kind: "products", products: list.map(catalogView) }
    ];
    if (!color) out.push({ role: "bot", kind: "text", text: "Подсказать по конкретному цвету или бюджету?" });
    return out;
  };

  const chipList = () => {
    if (product) return [
      { label: "Отзывы", q: "Какой рейтинг и что пишут в отзывах?" },
      { label: "Характеристики", q: "Расскажи характеристики" },
      { label: "Похожие товары", q: "Покажи похожие товары" },
      { label: "Доставка", q: "Когда доставка и есть ли в наличии?" }
    ];
    return [
      { label: "Диван для гостиной", q: "Ищу диван для гостиной" },
      { label: "Кровать в спальню", q: "Нужна кровать в спальню" },
      { label: "Офисное кресло", q: "Посоветуй офисное кресло" },
      { label: "Обеденный стол", q: "Ищу обеденный стол" }
    ];
  };

  const accentGradient = accentColor === "#c8372f"
    ? "linear-gradient(135deg,#c8372f,#e8894f)"
    : `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 60%, #f0a35a))`;
  
  const sendReady = input.trim() && !pending;

  return (
    <div className="font-sans">
      {!open && (
        <button 
          type="button" 
          onClick={openChat} 
          aria-label="AI-помощник" 
          className="fixed bottom-6 right-6 z-[2147483000] w-[60px] h-[60px] rounded-full border-none flex items-center justify-center shadow-[0_12px_30px_rgba(28,26,23,0.28)]"
          style={{ background: accentGradient, color: "#fff" }}
        >
          <span 
            className="absolute inset-0 rounded-full animate-[pulse_2.6s_infinite]" 
            style={{ 
              background: accentGradient, 
              boxShadow: "0 0 0 0 rgba(200,55,47,0.45)",
              animation: "ai-pulse 2.6s infinite" 
            }}
          />
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes ai-pulse { 0% { box-shadow: 0 0 0 0 rgba(200,55,47,0.45) } 70% { box-shadow: 0 0 0 14px rgba(200,55,47,0) } 100% { box-shadow: 0 0 0 0 rgba(200,55,47,0) } }
            @keyframes ai-pop { 0% { transform: translateY(14px) scale(0.96); opacity: 0 } 100% { transform: none; opacity: 1 } }
            @keyframes ai-spin { to { transform: rotate(360deg) } }
            @keyframes ai-dot { 0%,60%,100% { transform: translateY(0); opacity: 0.4 } 30% { transform: translateY(-4px); opacity: 1 } }
            .ai-scroll::-webkit-scrollbar { width: 7px }
            .ai-scroll::-webkit-scrollbar-thumb { background: #d8d2c8; border-radius: 999px }
            .ai-card:hover { border-color: #c8372f !important; box-shadow: 0 8px 22px rgba(28,26,23,0.12) !important }
          `}} />
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" className="relative"><path d="M12 2l1.9 5.3a4 4 0 0 0 2.8 2.8L22 12l-5.3 1.9a4 4 0 0 0-2.8 2.8L12 22l-1.9-5.3a4 4 0 0 0-2.8-2.8L2 12l5.3-1.9a4 4 0 0 0 2.8-2.8L12 2z"></path></svg>
          {!!product && (
            <span className="absolute -top-[3px] -right-[3px] w-[15px] h-[15px] rounded-full bg-[#1f7a4d] border-[2.5px] border-white" />
          )}
        </button>
      )}

      {open && (
        <div 
          className={isMobile 
            ? "fixed inset-0 z-[2147483000] bg-white flex flex-col overflow-hidden"
            : "fixed bottom-6 right-6 z-[2147483000] w-[400px] max-w-[calc(100vw-32px)] h-[min(660px,calc(100vh-48px))] bg-white rounded-[20px] flex flex-col overflow-hidden shadow-[0_24px_70px_rgba(28,26,23,0.28)] border border-[#e4ded6] animate-[ai-pop_0.26s_ease-out]"
          }
        >
          <div className="flex items-center gap-[12px] px-[18px] py-[16px] text-white shrink-0" style={{ background: accentGradient }}>
            <span className="w-[40px] h-[40px] rounded-[12px] bg-[rgba(255,255,255,0.18)] flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.3a4 4 0 0 0 2.8 2.8L22 12l-5.3 1.9a4 4 0 0 0-2.8 2.8L12 22l-1.9-5.3a4 4 0 0 0-2.8-2.8L2 12l5.3-1.9a4 4 0 0 0 2.8-2.8L12 2z"></path></svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[16px] leading-[1.15]">AI-помощник</div>
              <div className="flex items-center gap-[6px] text-[12px] opacity-90 mt-[1px]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#7ff0b0] shadow-[0_0_0_2px_rgba(127,240,176,0.3)]"></span>
                Paradise.kz · онлайн
              </div>
            </div>
            <button type="button" onClick={closeChat} aria-label="Закрыть" className="w-[34px] h-[34px] rounded-full border-none bg-[rgba(255,255,255,0.16)] text-white cursor-pointer flex items-center justify-center shrink-0">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
            </button>
          </div>

          {!!product && (
            <div className="flex items-center gap-[10px] px-[16px] py-[10px] bg-[#faf8f5] border-b border-[#e4ded6] shrink-0">
              <div role="img" className="w-[36px] h-[36px] rounded-[9px] shrink-0 bg-cover bg-center border border-[#e4ded6]" style={{ backgroundImage: `url(${product.thumb || ""})` }}></div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-[#8a8477] uppercase tracking-[0.04em]">Обсуждаем товар</div>
                <div className="text-[13px] font-semibold text-[#1c1a17] whitespace-nowrap overflow-hidden text-ellipsis">{product.name}</div>
              </div>
            </div>
          )}

          <div className="ai-scroll flex-1 overflow-y-auto px-[16px] py-[18px] flex flex-col gap-[14px] bg-white" ref={scrollEl}>
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  {m.kind === "text" && (
                    <div className={`max-w-[82%] px-[14px] py-[11px] text-[14px] leading-[1.5] whitespace-pre-wrap break-words ${isUser ? "bg-[#1c1a17] text-white rounded-[16px_16px_4px_16px]" : "bg-[#f3f0ea] text-[#1c1a17] rounded-[16px_16px_16px_4px]"}`}>
                      {m.text}
                    </div>
                  )}
                  {m.kind === "image" && (
                    <div className="max-w-[60%] rounded-[16px_16px_4px_16px] overflow-hidden border border-[#e4ded6]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.image} alt="Загруженное фото" className="block w-full max-h-[180px] object-cover" />
                    </div>
                  )}
                  {m.kind === "products" && (
                    <div className="flex flex-col gap-[10px] w-full">
                      {m.products?.map((p, idx) => (
                        <Link href={p.href} key={idx} className="ai-card flex gap-[12px] p-[10px] bg-white border border-[#e4ded6] rounded-[14px] no-underline shadow-[0_1px_2px_rgba(28,26,23,0.05)] transition-all duration-150">
                          <div role="img" aria-label={p.name} className="w-[66px] h-[66px] rounded-[10px] shrink-0 bg-cover bg-center bg-[#f0ece5]" style={{ backgroundImage: `url(${p.img})` }}></div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="text-[13px] font-semibold text-[#1c1a17] leading-[1.3] line-clamp-2">{p.name}</div>
                            <div className="flex items-center gap-[5px] my-[4px]">
                              <svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23 6.09 20.34l1.13-6.57L2.45 9.14l6.6-.96z" fill="#f5a623"></path></svg>
                              <span className="text-[12px] font-semibold text-[#1c1a17]">{p.ratingLabel}</span>
                              <span className="text-[11px] text-[#8a8477]">· {p.metaLabel}</span>
                            </div>
                            <div className="flex items-baseline gap-[7px]">
                              <span className="font-display text-[15px] font-bold text-[#1c1a17]">{p.priceLabel}</span>
                              {p.hasOld && (
                                <span className="text-[12px] text-[#8a8477] line-through">{p.oldPriceLabel}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-between shrink-0">
                            <span className="text-[10.5px] font-semibold whitespace-nowrap" style={{ color: p.stockColor }}>{p.stockLabel}</span>
                            <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full bg-[#faf8f5]">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#c8372f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {pending === "typing" && (
              <div className="flex justify-start">
                <div className="flex gap-[5px] px-[16px] py-[13px] bg-[#f3f0ea] rounded-[16px_16px_16px_4px]">
                  <span className="w-[7px] h-[7px] rounded-full bg-[#8a8477] animate-[ai-dot_1.2s_infinite]"></span>
                  <span className="w-[7px] h-[7px] rounded-full bg-[#8a8477] animate-[ai-dot_1.2s_infinite_0.18s]"></span>
                  <span className="w-[7px] h-[7px] rounded-full bg-[#8a8477] animate-[ai-dot_1.2s_infinite_0.36s]"></span>
                </div>
              </div>
            )}

            {pending === "analyzing" && (
              <div className="flex items-center gap-[11px] self-start px-[16px] py-[12px] bg-[#f3f0ea] rounded-[16px_16px_16px_4px]">
                <span className="w-[18px] h-[18px] rounded-full border-[2.5px] border-[#e0dacf] border-t-[#c8372f] animate-[ai-spin_0.8s_linear_infinite] shrink-0"></span>
                <span className="text-[13px] text-[#5f5a50] font-medium">Ищу похожие товары…</span>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#e4ded6] bg-white px-[14px] pt-[12px] pb-[14px]">
            <div className="flex gap-[7px] overflow-x-auto pb-[10px] scrollbar-none" style={{ scrollbarWidth: "none" }}>
              {chipList().map((c, i) => (
                <button 
                  key={i} 
                  type="button" 
                  onClick={() => ask(c.q)} 
                  className="shrink-0 px-[13px] py-[7px] rounded-full border border-[#e4ded6] bg-[#faf8f5] text-[#1c1a17] text-[12.5px] font-semibold cursor-pointer whitespace-nowrap hover:border-[#c8372f] hover:text-[#c8372f] transition-colors"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-[8px]">
              {photoSearch && (
                <button 
                  type="button" 
                  onClick={pickPhoto} 
                  aria-label="Загрузить фото" 
                  className="w-[44px] h-[44px] rounded-[14px] border border-[#e4ded6] bg-[#faf8f5] text-[#1c1a17] cursor-pointer flex items-center justify-center shrink-0 hover:border-[#c8372f] hover:text-[#c8372f] transition-colors"
                >
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M3 9a2 2 0 0 1 2-2h1.5l1.2-1.8A1 1 0 0 1 8.5 5h7a1 1 0 0 1 .8.2L17.5 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke="currentColor" strokeWidth="1.7"></path><circle cx="12" cy="13" r="3.3" stroke="currentColor" strokeWidth="1.7"></circle></svg>
                </button>
              )}
              <textarea 
                ref={inputEl} 
                value={input} 
                onChange={onInput} 
                onKeyDown={onKeyDown} 
                rows={1} 
                placeholder={product ? "Спросите про этот товар…" : "Опишите, что ищете…"} 
                className="flex-1 resize-none max-h-[96px] px-[14px] py-[12px] border border-[#e4ded6] rounded-[14px] text-[14px] text-[#1c1a17] outline-none leading-[1.35] bg-white"
              />
              <button 
                type="button" 
                onClick={onSend} 
                disabled={!sendReady} 
                aria-label="Отправить" 
                className={`w-[44px] h-[44px] rounded-[14px] border-none shrink-0 flex items-center justify-center transition-colors ${sendReady ? "cursor-pointer text-white" : "cursor-default bg-[#e5e1da] text-[#8a8477]"}`}
                style={sendReady ? { background: accentGradient } : {}}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"></path></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <input type="file" accept="image/*" ref={fileEl} onChange={onPhotoChange} className="hidden" />
    </div>
  );
}
