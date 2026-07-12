export function formatPrice(value: number | null | undefined, locale: string = "ru"): string {
  if (value === null || value === undefined) {
    return locale === "kk" ? "Бағасы сұрау бойынша" : "Цена по запросу";
  }

  return new Intl.NumberFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Safely extracts a localized string from a value that might be a raw JSON string, 
 * a parsed object, or just a plain string. 
 */
export function tValue(value: unknown, locale: string = "ru"): string {
  if (!value) return "";

  if (typeof value === "string") {
    // If it looks like a JSON string, try to parse it
    if (value.startsWith("{") && value.endsWith("}")) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null) {
          return (parsed[locale] ?? parsed["ru"] ?? value) as string;
        }
      } catch {
        return value;
      }
    }
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return (obj[locale] ?? obj["ru"] ?? "") as string;
  }

  return String(value);
}
