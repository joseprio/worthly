export type Kind = "asset" | "liability";

export type Category =
  | "isa"
  | "sipp"
  | "pension"
  | "savings"
  | "investments"
  | "property"
  | "mortgage"
  | "loan"
  | "other";

export const categories: Record<Category, { label: string; kind: Kind }> = {
  isa: { label: "ISA", kind: "asset" },
  sipp: { label: "SIPP", kind: "asset" },
  pension: { label: "Workplace pension", kind: "asset" },
  savings: { label: "Savings account", kind: "asset" },
  investments: { label: "General investment account", kind: "asset" },
  property: { label: "Property", kind: "asset" },
  mortgage: { label: "Mortgage", kind: "liability" },
  loan: { label: "Loan or credit", kind: "liability" },
  other: { label: "Other", kind: "asset" },
};

/** A reported, exact value of an item on a given day (ISO yyyy-mm-dd). */
export type Snapshot = { id: string; date: string; value: number };

export type Item = {
  id: string;
  name: string;
  category: Category;
  kind: Kind;
  snapshots: Snapshot[];
  /** Expected annual growth, in percent. For liabilities this is the interest rate. */
  growthMin: number;
  growthMax: number;
  /** Paid in each month (assets) or repaid each month (liabilities), in pounds. */
  monthly: number;
};

export type Range = { low: number; high: number };

const DAY = 86_400_000;
const MONTHS_PER_DAY = 12 / 365.25;

export const parseDate = (iso: string) => new Date(iso + "T00:00:00Z").getTime();
export const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const todayIso = () => toIso(Date.now() - new Date().getTimezoneOffset() * 60_000);

export const sortedSnapshots = (item: Item) =>
  [...item.snapshots].sort((a, b) => a.date.localeCompare(b.date));

/**
 * Compounds `value` monthly at an annual rate over `months`, adding `monthly` each month.
 * Uses the closed form so fractional months work.
 */
const grow = (value: number, annualPct: number, monthly: number, months: number) => {
  const r = Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  const factor = Math.pow(1 + r, months);
  const contributions = r == 0 ? monthly * months : (monthly * (factor - 1)) / r;
  return value * factor + contributions;
};

/**
 * Value range of an item on `date`. Exact on a snapshot date; between snapshots it
 * projects forward from the latest earlier snapshot. Before the first snapshot the
 * item is treated as not existing. Liabilities are returned as positive balances.
 */
export const itemRange = (item: Item, date: string): Range | undefined => {
  const snaps = sortedSnapshots(item);
  let base: Snapshot | undefined;
  for (const s of snaps) {
    if (s.date <= date) base = s;
    else break;
  }
  if (!base) return undefined;

  const months = Math.max(0, (parseDate(date) - parseDate(base.date)) / DAY) * MONTHS_PER_DAY;
  if (item.kind == "asset") {
    const a = grow(base.value, item.growthMin, item.monthly, months);
    const b = grow(base.value, item.growthMax, item.monthly, months);
    return { low: Math.min(a, b), high: Math.max(a, b) };
  }
  // Liabilities: interest grows the balance, repayments shrink it; never below zero.
  const a = Math.max(0, grow(base.value, item.growthMin, -item.monthly, months));
  const b = Math.max(0, grow(base.value, item.growthMax, -item.monthly, months));
  return { low: Math.min(a, b), high: Math.max(a, b) };
};

/** Net worth range: best-case assets minus best-case debts, and vice versa. */
export const netWorthRange = (items: Item[], date: string): Range => {
  let low = 0;
  let high = 0;
  for (const item of items) {
    const r = itemRange(item, date);
    if (!r) continue;
    if (item.kind == "asset") {
      low += r.low;
      high += r.high;
    } else {
      low -= r.high;
      high -= r.low;
    }
  }
  return { low, high };
};

export const earliestSnapshot = (items: Item[]) =>
  items
    .flatMap((i) => i.snapshots.map((s) => s.date))
    .sort()
    .at(0);

/** Evenly spaced series of net worth ranges, `points` samples from `from` to `to`. */
export const netWorthSeries = (items: Item[], from: string, to: string, points = 60) => {
  const start = parseDate(from);
  const end = parseDate(to);
  const step = (end - start) / Math.max(1, points - 1);
  return Array.from({ length: points }, (_, i) => {
    const date = toIso(start + step * i);
    return { date, ...netWorthRange(items, date) };
  });
};

export const newId = () => crypto.randomUUID();
