export const PAYMENT_CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar" },
  { value: "OMR", label: "OMR — Omani Rial" },
  { value: "BHD", label: "BHD — Bahraini Dinar" },
] as const;

/** Approximate fallback rates vs USD when live API is unavailable */
const USD_FALLBACK: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  AED: 3.67,
  SGD: 1.34,
  AUD: 1.52,
  CAD: 1.36,
  CHF: 0.88,
  JPY: 149,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  OMR: 0.38,
  BHD: 0.38,
};

export function roundMoney(n: number, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** How many units of `to` currency equal 1 unit of `from` */
export function fallbackRate(from: string, to: string): number {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;
  const fromUsd = USD_FALLBACK[f];
  const toUsd = USD_FALLBACK[t];
  if (!fromUsd || !toUsd) return 1;
  // 1 FROM = (1/fromUsd) USD = (toUsd/fromUsd) TO
  return roundMoney(toUsd / fromUsd, 6);
}

export async function fetchExchangeRate(
  from: string,
  to: string
): Promise<{ rate: number; source: "live" | "fallback"; date?: string }> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return { rate: 1, source: "live" };

  try {
    const res = await fetch(`https://api.frankfurter.dev/v2/rate/${f}/${t}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { rate?: number; date?: string };
      if (typeof data.rate === "number" && data.rate > 0) {
        return { rate: roundMoney(data.rate, 6), source: "live", date: data.date };
      }
    }
  } catch {
    // fall through
  }

  // Frankfurter may not support some Gulf currencies — try via USD hop
  try {
    if (f !== "USD" && t !== "USD") {
      const [a, b] = await Promise.all([
        fetch(`https://api.frankfurter.dev/v2/rate/${f}/USD`, { next: { revalidate: 3600 } }),
        fetch(`https://api.frankfurter.dev/v2/rate/USD/${t}`, { next: { revalidate: 3600 } }),
      ]);
      if (a.ok && b.ok) {
        const da = (await a.json()) as { rate?: number; date?: string };
        const db = (await b.json()) as { rate?: number };
        if (da.rate && db.rate) {
          return {
            rate: roundMoney(da.rate * db.rate, 6),
            source: "live",
            date: da.date,
          };
        }
      }
    }
  } catch {
    // fall through
  }

  return { rate: fallbackRate(f, t), source: "fallback" };
}

export function convertToBase(foreignAmount: number, rate: number) {
  return roundMoney(foreignAmount * rate, 2);
}

export function convertFromBase(baseAmount: number, rate: number) {
  if (!rate) return 0;
  return roundMoney(baseAmount / rate, 2);
}
