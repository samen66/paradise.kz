"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/Button";

// ── Mock review data (will be replaced by API) ─────────────────────────────
interface Review {
  id: number;
  author: string;
  date: string;
  rating: number;
  verified: boolean;
  text: string;
  photos: string[];
  up: number;
  down: number;
  reply: { date: string; text: string } | null;
}

const AVATAR_COLORS = ["#c8372f", "#1d6b4f", "#5b6ee0", "#c77d1a", "#7b4fa8", "#2b8a9e"];
const RATING_AVG = 4.7;
const RATING_TOTAL = 128;

const HISTOGRAM = [
  { star: 5, count: 96 },
  { star: 4, count: 22 },
  { star: 3, count: 6 },
  { star: 2, count: 2 },
  { star: 1, count: 2 },
];

const MOCK_REVIEWS: Review[] = [
  {
    id: 1, author: "Айгерим С.", date: "2 июля 2026", rating: 5, verified: true,
    text: "Диван просто шикарный! Велюр приятный на ощупь, цвет точь-в-точь как на фото. Собрали за 20 минут в день доставки, ящик для белья вместительный. Рекомендую!",
    photos: ["https://picsum.photos/seed/rev-milan-a/240/240", "https://picsum.photos/seed/rev-milan-b/240/240"],
    up: 24, down: 1,
    reply: { date: "3 июля 2026", text: "Айгерим, спасибо за тёплый отзыв! Рады, что диван вам подошёл. Приятного отдыха." },
  },
  {
    id: 2, author: "Данияр К.", date: "28 июня 2026", rating: 4, verified: true,
    text: "Диван удобный, механизм еврокнижка работает плавно. Снял звезду за доставку — привезли на день позже. По качеству вопросов нет.",
    photos: [], up: 11, down: 0, reply: null,
  },
  {
    id: 3, author: "Марина В.", date: "21 июня 2026", rating: 5, verified: true,
    text: "Брали в гостиную, отлично вписался в интерьер. Сидеть комфортно, поролон плотный, не проваливается. Чехлы снимаются — большой плюс для семьи с детьми.",
    photos: ["https://picsum.photos/seed/rev-milan-c/240/240"], up: 8, down: 0, reply: null,
  },
  {
    id: 4, author: "Ержан Т.", date: "14 июня 2026", rating: 3, verified: false,
    text: "Диван нормальный за свои деньги, но подушки показались жестковаты. Возможно, со временем разомнутся.",
    photos: [], up: 3, down: 2,
    reply: { date: "15 июня 2026", text: "Ержан, благодарим за отзыв. Подушки из ППУ становятся мягче в первые 2–3 недели использования." },
  },
  {
    id: 5, author: "Гульнара А.", date: "5 июня 2026", rating: 5, verified: true,
    text: "Второй заказ в Paradise.kz, снова всё на высоте. Сборщики аккуратные, упаковку забрали с собой. Диваном очень довольна!",
    photos: ["https://picsum.photos/seed/rev-milan-d/240/240", "https://picsum.photos/seed/rev-milan-e/240/240"],
    up: 15, down: 0, reply: null,
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

// ── Component ───────────────────────────────────────────────────────────────

export function ProductReviews() {
  const t = useTranslations("product");

  // Review form state
  const [formRating, setFormRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [formName, setFormName] = useState("");
  const [formText, setFormText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
  const [votes, setVotes] = useState<Record<number, "up" | "down" | null>>({});
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("new");

  const displayRating = hoverRating || formRating;

  const submitReview = useCallback(() => {
    if (!formRating || !formText.trim()) return;
    const newReview: Review = {
      id: Date.now(),
      author: formName.trim() || "Гость",
      date: "Сегодня",
      rating: formRating,
      verified: false,
      text: formText.trim(),
      photos: [],
      up: 0,
      down: 0,
      reply: null,
    };
    setReviews((prev) => [newReview, ...prev]);
    setFormRating(0);
    setHoverRating(0);
    setFormName("");
    setFormText("");
    setSubmitted(true);
  }, [formRating, formName, formText]);

  const vote = useCallback((id: number, dir: "up" | "down") => {
    setVotes((prev) => ({ ...prev, [id]: prev[id] === dir ? null : dir }));
  }, []);

  // Filter + sort
  let visibleReviews = reviews.slice();
  if (filter === "photo") visibleReviews = visibleReviews.filter((r) => r.photos.length > 0);
  else if (filter !== "all") visibleReviews = visibleReviews.filter((r) => r.rating === Number(filter));

  if (sort === "helpful") visibleReviews.sort((a, b) => b.up - a.up);
  else if (sort === "high") visibleReviews.sort((a, b) => b.rating - a.rating);
  else if (sort === "low") visibleReviews.sort((a, b) => a.rating - b.rating);

  const filterButtons = [
    { key: "all", label: t("filterAll") },
    { key: "photo", label: t("filterWithPhotos") },
    { key: "5", label: "5 ★" },
    { key: "4", label: "4 ★" },
    { key: "3", label: "3 ★" },
  ];

  return (
    <section
      id="reviews"
      className="scroll-mt-[130px] rounded-[20px] border border-line bg-white p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)]"
    >
      {/* Header */}
      <div className="mb-[22px] flex items-baseline gap-3">
        <h2 className="font-display text-xl font-bold text-ink">{t("reviews")}</h2>
        <span className="text-sm text-muted">{t("reviewsCount", { count: RATING_TOTAL })}</span>
      </div>

      {/* Rating summary + histogram */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-9 border-b border-surface pb-[26px]">
        <div className="min-w-[150px] text-center">
          <div className="font-display text-[54px] font-bold leading-none text-ink">
            {RATING_AVG.toFixed(1).replace(".", ",")}
          </div>
          <div className="mt-2.5 mb-1.5">
            <StarRating rating={RATING_AVG} size={22} />
          </div>
          <div className="text-[13px] text-muted">{t("reviewsCount", { count: RATING_TOTAL })}</div>
        </div>

        <div className="flex max-w-[420px] flex-col gap-2">
          {HISTOGRAM.map((row) => (
            <button
              key={row.star}
              type="button"
              onClick={() => setFilter(String(row.star))}
              className="flex w-full items-center gap-3 border-none bg-transparent p-0 text-left cursor-pointer"
            >
              <span className="w-3.5 text-[13px] font-semibold text-ink">{row.star}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" className="flex-shrink-0">
                <path
                  d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23 6.09 20.34l1.13-6.57L2.45 9.14l6.6-.96z"
                  className="fill-star"
                />
              </svg>
              <span className="flex-1 h-2 overflow-hidden rounded-full bg-surface">
                <span
                  className="block h-full rounded-full bg-star"
                  style={{ width: `${Math.round((row.count / RATING_TOTAL) * 100)}%` }}
                />
              </span>
              <span className="w-[34px] text-right text-[13px] text-muted">{row.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Review form */}
      <div className="mt-[26px] rounded-2xl border border-surface bg-surface/50 p-6">
        <h3 className="font-display text-base font-bold text-ink">{t("leaveReview")}</h3>
        <p className="mt-1 mb-4 text-[13px] text-muted">{t("reviewHelpText")}</p>

        <div className="mb-4 flex items-center gap-3.5">
          <span className="text-sm font-semibold text-ink">{t("yourRating")}</span>
          <div
            className="flex gap-1"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setFormRating(i); setSubmitted(false); }}
                onMouseEnter={() => setHoverRating(i)}
                className="border-none bg-transparent p-0.5 cursor-pointer leading-[0]"
              >
                <svg width={30} height={30} viewBox="0 0 24 24" className="block">
                  <path
                    d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23 6.09 20.34l1.13-6.57L2.45 9.14l6.6-.96z"
                    fill={i <= displayRating ? "#f5a623" : "#e5e1da"}
                  />
                </svg>
              </button>
            ))}
          </div>
          <span className="text-[13px] text-muted">
            {displayRating ? t("ratingLabel", { n: displayRating }) : t("ratingHint")}
          </span>
        </div>

        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder={t("yourName")}
          className="mb-3 block w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
        <textarea
          value={formText}
          onChange={(e) => setFormText(e.target.value)}
          placeholder={t("reviewPlaceholder")}
          rows={3}
          className="mb-3.5 block w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
        <div className="flex items-center gap-3.5">
          <Button
            variant="primary"
            onClick={submitReview}
            disabled={!(formRating > 0 && formText.trim())}
          >
            {t("submitReview")}
          </Button>
          {submitted ? (
            <span className="text-[13px] font-semibold text-mint-ink">{t("reviewSubmitted")}</span>
          ) : null}
        </div>
      </div>

      {/* Filters + sort */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                  active
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-muted hover:border-ink"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-[13px] text-muted">
          {t("sorting")}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="cursor-pointer rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none"
          >
            <option value="new">{t("sortNew")}</option>
            <option value="helpful">{t("sortHelpful")}</option>
            <option value="high">{t("sortHigh")}</option>
            <option value="low">{t("sortLow")}</option>
          </select>
        </label>
      </div>

      {/* Review list */}
      <div className="mt-2">
        {visibleReviews.map((rv) => {
          const v = votes[rv.id] ?? null;
          const upCount = rv.up + (v === "up" ? 1 : 0);
          const downCount = rv.down + (v === "down" ? 1 : 0);
          const upActive = v === "up";
          const downActive = v === "down";

          return (
            <article key={rv.id} className="border-t border-surface py-6">
              <div className="flex items-start gap-3.5">
                {/* Avatar */}
                <span
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold text-white"
                  style={{ background: AVATAR_COLORS[Math.abs(rv.id) % AVATAR_COLORS.length] }}
                >
                  {initials(rv.author)}
                </span>

                <div className="min-w-0 flex-1">
                  {/* Author line */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[15px] font-bold text-ink">{rv.author}</span>
                    {rv.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-mint-ink">
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t("verifiedPurchase")}
                      </span>
                    ) : null}
                    <span className="ml-auto text-[13px] text-muted">{rv.date}</span>
                  </div>

                  {/* Stars */}
                  <div className="mt-2 mb-2.5">
                    <StarRating rating={rv.rating} size={15} />
                  </div>

                  {/* Text */}
                  <p className="text-sm leading-relaxed text-muted">{rv.text}</p>

                  {/* Photos */}
                  {rv.photos.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rv.photos.map((ph, idx) => (
                        <div
                          key={idx}
                          className="relative h-[72px] w-[72px] overflow-hidden rounded-xl border border-line"
                        >
                          <Image
                            src={ph}
                            alt={`${t("reviews")} ${idx + 1}`}
                            fill
                            sizes="72px"
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Vote buttons */}
                  <div className="mt-3.5 flex items-center gap-2.5">
                    <span className="text-[13px] text-muted">{t("helpful")}</span>
                    <button
                      type="button"
                      onClick={() => vote(rv.id, "up")}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                        upActive
                          ? "border-mint-ink bg-mint text-mint-ink"
                          : "border-line bg-white text-muted hover:border-ink"
                      }`}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm4-9l-4 9v9h9.5a2 2 0 001.95-1.57l1.4-6.3A2 2 0 0018.9 9H14V4a2 2 0 00-3-1.73z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
                      </svg>
                      {t("yes")} ({upCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => vote(rv.id, "down")}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                        downActive
                          ? "border-sale bg-sale/10 text-sale"
                          : "border-line bg-white text-muted hover:border-ink"
                      }`}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ transform: "rotate(180deg)" }}>
                        <path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm4-9l-4 9v9h9.5a2 2 0 001.95-1.57l1.4-6.3A2 2 0 0018.9 9H14V4a2 2 0 00-3-1.73z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
                      </svg>
                      {t("no")} ({downCount})
                    </button>
                  </div>

                  {/* Shop reply */}
                  {rv.reply ? (
                    <div className="mt-3.5 rounded-xl border-l-[3px] border-l-red-600 bg-surface/50 p-4">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-[13px] font-bold text-ink">Paradise.kz</span>
                        <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          {t("shopBadge")}
                        </span>
                        <span className="text-xs text-muted">{rv.reply.date}</span>
                      </div>
                      <p className="text-[13px] leading-[1.55] text-muted">{rv.reply.text}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
