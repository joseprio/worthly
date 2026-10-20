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

export const categories: Record<Category, { label: string; kinds: Kind[] }> = {
  isa: { label: "ISA", kinds: ["asset"] },
  sipp: { label: "SIPP", kinds: ["asset"] },
  pension: { label: "Workplace pension", kinds: ["asset"] },
  savings: { label: "Savings account", kinds: ["asset"] },
  investments: { label: "General investment account", kinds: ["asset"] },
  property: { label: "Property", kinds: ["asset"] },
  mortgage: { label: "Mortgage", kinds: ["liability"] },
  loan: { label: "Loan or credit", kinds: ["liability"] },
  other: { label: "Other", kinds: ["asset", "liability"] },
};

/** Default yearly growth range for a new item, in percent. Property tracks the 2% inflation target. */
export const defaultGrowth = (category: Category): [number, number] =>
  category == "property" ? [1, 3] : [3, 6];

export const categoriesFor = (kind: Kind) =>
  (Object.keys(categories) as Category[]).filter((c) => categories[c].kinds.includes(kind));

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
  /** Mortgage terms. When set, the repayment is worked out from these and `monthly` is unused. */
  mortgage?: Mortgage;
};

export type RepaymentType = "repayment" | "interest-only";
export type Mortgage = {
  type: RepaymentType;
  /** Last day of the mortgage term (ISO yyyy-mm-dd). */
  termEnd: string;
  /** Paid each month on top of the required payment, in pounds. */
  overpayment: number;
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
const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;
export const monthsBetween = (from: string, to: string) =>
  ((parseDate(to) - parseDate(from)) / DAY) * MONTHS_PER_DAY;

// UK lenders quote a nominal annual rate and charge a twelfth of it each month.
const mortgageRate = (annualPct: number) => annualPct / 100 / 12;

const grow = (value: number, annualPct: number, monthly: number, months: number) =>
  growAt(value, monthlyRate(annualPct), monthly, months);
const growAt = (value: number, r: number, monthly: number, months: number) => {
  const factor = Math.pow(1 + r, months);
  const contributions = r == 0 ? monthly * months : (monthly * (factor - 1)) / r;
  return value * factor + contributions;
};

/**
 * Value range of an item on `date`. Exact on a snapshot date; between snapshots it
 * projects forward from the latest earlier snapshot. Before the first snapshot the
 * item is treated as not existing. Liabilities are returned as positive balances.
 */
/**
 * Required monthly payment: on a repayment mortgage, the amount that clears `balance` over
 * `months` at the rate (as UK lenders recalculate it when a rate changes); on interest-only,
 * just the interest.
 */
export const mortgagePayment = (
  balance: number,
  annualPct: number,
  months: number,
  type: RepaymentType,
) => {
  const r = mortgageRate(annualPct);
  if (type == "interest-only") return balance * r;
  if (months <= 0) return 0;
  return r == 0 ? balance / months : (balance * r) / (1 - Math.pow(1 + r, -months));
};

/** Mortgage balance on `date`, starting from a known balance on `from`. */
const mortgageBalance = (m: Mortgage, balance: number, annualPct: number, from: string, date: string) => {
  const elapsed = Math.max(0, monthsBetween(from, date));
  const remaining = monthsBetween(from, m.termEnd);
  if (m.type == "interest-only") {
    // Interest is paid as it accrues; only overpayments reduce the balance, which stays
    // due in full at the end of the term.
    return Math.max(0, balance - m.overpayment * Math.min(elapsed, Math.max(0, remaining)));
  }
  if (remaining <= 0 || elapsed >= remaining) return 0;
  const payment = mortgagePayment(balance, annualPct, remaining, "repayment") + m.overpayment;
  return Math.max(0, growAt(balance, mortgageRate(annualPct), -payment, elapsed));
};

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
  if (item.mortgage) {
    const a = mortgageBalance(item.mortgage, base.value, item.growthMin, base.date, date);
    const b = mortgageBalance(item.mortgage, base.value, item.growthMax, base.date, date);
    return { low: Math.min(a, b), high: Math.max(a, b) };
  }
  // Liabilities: interest grows the balance, repayments shrink it; never below zero.
  const a = Math.max(0, grow(base.value, item.growthMin, -item.monthly, months));
  const b = Math.max(0, grow(base.value, item.growthMax, -item.monthly, months));
  return { low: Math.min(a, b), high: Math.max(a, b) };
};

/** Whether the item's value on `date` is projected rather than known on that exact day. */
export const isProjected = (item: Item, date: string) => {
  const base = sortedSnapshots(item).findLast((s) => s.date <= date);
  return base != undefined && base.date < date;
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
