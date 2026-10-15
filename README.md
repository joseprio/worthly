# Worthly

A Material 3 PWA (Svelte 5 + Vite + m3-svelte) for UK users to estimate their net worth today
and see how it's likely to grow.

Live: https://joseprio.github.io/worthly/

## Development

```sh
npm install
npm run dev      # http://localhost:5173/worthly/
npm run check    # type-check
npm run build    # writes the deployable site to docs/
npm run preview  # serves docs/ at http://localhost:4173/worthly/
```

GitHub Pages serves the `docs/` folder on `main`, so **run `npm run build` and commit `docs/`**
with every change you want to publish.

The colour theme is generated from a seed colour: edit `SEED` in `scripts/gen-theme.mjs` and run
`node scripts/gen-theme.mjs`.

## How estimates work

Each item (ISA, SIPP, pension, mortgage…) has known values on specific dates, a yearly growth
range (or interest rate, for debts) and an optional monthly contribution or repayment. On any date,
an item is projected from its most recent known value, compounding monthly at the lowest and highest
rates. Net worth low = lowest assets − highest debts; high = highest assets − lowest debts. Data is
stored only on the device (localStorage).
