<script lang="ts">
  import { Button, ConnectedButtons } from "m3-svelte";
  import RangeChart, { type Focus } from "./RangeChart.svelte";
  import {
    categories,
    earliestSnapshot,
    itemRange,
    netWorthSeries,
    parseDate,
    toIso,
    type Item,
  } from "./model";
  import { dateMonthYear, formatRange } from "./format";

  let {
    items,
    today,
    title = "Progression",
    label = "Net worth",
    active,
  }: {
    items: Item[];
    today: string;
    title?: string;
    /** What the overall series is, e.g. "Net worth" or "Assets". */
    label?: string;
    /** Item to draw on top of the overall series. */
    active?: string;
  } = $props();

  const horizons = [
    { value: "0", text: "To today" },
    { value: "1", text: "+1 yr" },
    { value: "5", text: "+5 yrs" },
    { value: "10", text: "+10 yrs" },
  ];
  let horizon = $state("5");

  const from = $derived(earliestSnapshot(items));
  const to = $derived.by(() => {
    const d = new Date(parseDate(today));
    d.setUTCFullYear(d.getUTCFullYear() + Number(horizon));
    return toIso(d.getTime());
  });
  const points = $derived(from && from < to ? netWorthSeries(items, from, to, 80) : []);
  // A coarser set of rows for the screen-reader table.
  const rows = $derived(from && from < to ? netWorthSeries(items, from, to, 13) : []);

  const focused = $derived(items.find((i) => i.id == active));
  // The item on the same dates as the overall series; debts are negative, as in net worth.
  const focus = $derived.by((): Focus | undefined => {
    if (!focused) return undefined;
    const item = focused;
    const sign = item.kind == "asset" ? 1 : -1;
    return {
      label: item.name || categories[item.category].label,
      kind: item.kind,
      points: points.map((p) => {
        const r = itemRange(item, p.date);
        if (!r) return undefined;
        const [a, b] = [r.low * sign, r.high * sign];
        return { date: p.date, low: Math.min(a, b), high: Math.max(a, b) };
      }),
    };
  });
</script>

<div class="panel">
  <div class="head">
    <h2>{title}</h2>
    {#if focus}
      <div class="legend" aria-hidden="true">
        <span class="key {focus.kind}">{focus.label}</span>
        <span class="key overall">{label}</span>
      </div>
    {/if}
  </div>

  <div class="horizons">
    <ConnectedButtons>
      {#each horizons as h (h.value)}
        <Button variant="tonal" size="xs" label>
          <input type="radio" name="horizon" value={h.value} bind:group={horizon} />
          {h.text}
        </Button>
      {/each}
    </ConnectedButtons>
  </div>

  {#if points.length == 0}
    <p class="empty">
      {from
        ? "Your first known value is today, so there's no history yet. Choose a future range to see a projection."
        : "None of these items has a known value yet."}
    </p>
  {:else}
    <RangeChart {points} {today} {label} {focus} />
    <table class="sr-only">
      <caption>{title}: estimated range over time</caption>
      <thead>
        <tr><th scope="col">Date</th><th scope="col">Estimated range</th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.date)}
          <tr><td>{dateMonthYear(r.date)}</td><td>{formatRange(r.low, r.high)}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 1rem;
    min-height: 1.5rem;
  }
  h2 {
    @apply --m3-title-medium;
  }
  .legend {
    display: flex;
    gap: 0.75rem;
    min-width: 0;
  }
  .key {
    @apply --m3-label-medium;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--m3c-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .key::before {
    content: "";
    flex-shrink: 0;
    width: 0.75rem;
    height: 0.25rem;
    border-radius: var(--m3-shape-full);
  }
  .key.asset::before {
    background-color: var(--viz-asset);
  }
  .key.liability::before {
    background-color: var(--viz-debt);
  }
  .key.overall::before {
    background-color: --translucent(var(--m3c-on-surface-variant), 0.55);
  }
  .horizons {
    display: flex;
  }
  .horizons > :global(*) {
    flex: 1;
  }
  .horizons > :global(* > *) {
    flex: 1;
  }
  .empty {
    @apply --m3-body-medium;
    color: var(--m3c-on-surface-variant);
    padding-block: 2rem;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
