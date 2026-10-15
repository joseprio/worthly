const LOCALE = "en-GB";

const gbp = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const gbpCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});
const longDate = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const money = (n: number) => gbp.format(Math.round(n));
export const moneyCompact = (n: number) => gbpCompact.format(n);
export const formatRange = (low: number, high: number) =>
  Math.round(low) == Math.round(high) ? money(low) : `${money(low)} – ${money(high)}`;
export const percent = (n: number) => `${n.toLocaleString(LOCALE, { maximumFractionDigits: 2 })}%`;

const asDate = (iso: string) => new Date(iso + "T00:00:00Z");
export const dateLong = (iso: string) => longDate.format(asDate(iso));
export const dateShort = (iso: string) => shortDate.format(asDate(iso));
export const dateMonthYear = (iso: string) => monthYear.format(asDate(iso));
