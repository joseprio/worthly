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

/**
 * A known entry for an item on a given day (ISO yyyy-mm-dd). Absolute entries are an exact
 * value (or balance owed). Relative entries are an amount paid in or out, signed by its effect:
 * positive raises the value or balance (a fund, new borrowing), negative lowers it (a
 * withdrawal, a payment).
 */
export type Snapshot = { id: string; date: string; value: number; relative?: boolean };

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

/** Entries oldest first; on the same day, the absolute value comes before relative amounts. */
export const sortedSnapshots = (item: Pick<Item, "snapshots">) =>
  [...item.snapshots].sort(
    (a, b) => a.date.localeCompare(b.date) || Number(!!a.relative) - Number(!!b.relative),
  );

/** Entries with `entry` added. One exact value per day: a new one replaces it; amounts paid in or out add up. */
export const withEntry = (snapshots: Snapshot[], entry: Snapshot) =>
  sortedSnapshots({
    snapshots: [
      ...snapshots.filter((s) => entry.relative || s.relative || s.date != entry.date),
      entry,
    ],
  });

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
  // Negative before `from`: the same payments run backwards give the earlier, higher balance.
  const elapsed = monthsBetween(from, date);
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

/** Value of `value`, known on `from`, on `date` at one yearly rate. Liabilities are positive. */
const project = (item: Item, value: number, annualPct: number, from: string, date: string) => {
  const months = monthsBetween(from, date);
  if (item.kind == "asset") return Math.max(0, grow(value, annualPct, item.monthly, months));
  if (item.mortgage) return mortgageBalance(item.mortgage, value, annualPct, from, date);
  // Liabilities: interest grows the balance, repayments shrink it; never below zero.
  return Math.max(0, grow(value, annualPct, -item.monthly, months));
};

/**
 * Value of an item on `date` at one yearly rate. Runs through the entries in order: an absolute
 * entry sets the value; a relative one is added to the value projected up to its date. Before the
 * first entry, an absolute value is projected backwards, so an item added later (e.g. a mortgage
 * first entered today) doesn't appear as a sudden step in the history; an item that starts with
 * a relative amount held nothing before it. Undefined only when there are no entries.
 */
export const valueAt = (item: Item, annualPct: number, date: string): number | undefined => {
  const entries = sortedSnapshots(item);
  const first = entries[0];
  if (!first) return undefined;
  if (first.relative && date < first.date) return 0;
  let from = first.date;
  let value = first.relative ? 0 : first.value;
  for (const e of entries) {
    if (e.date > date) break;
    value = e.relative
      ? Math.max(0, project(item, value, annualPct, from, e.date) + e.value)
      : e.value;
    from = e.date;
  }
  return project(item, value, annualPct, from, date);
};

/** Value range of an item on `date`, between its lowest and highest rates. */
export const itemRange = (item: Item, date: string): Range | undefined => {
  const a = valueAt(item, item.growthMin, date);
  const b = valueAt(item, item.growthMax, date);
  if (a == undefined || b == undefined) return undefined;
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
