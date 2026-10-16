<script lang="ts">
  import { Button, ConnectedButtons } from "m3-svelte";
  import RangeChart from "./RangeChart.svelte";
  import { earliestSnapshot, netWorthSeries, parseDate, toIso, type Item } from "./model";
  import { dateMonthYear, formatRange } from "./format";

  let { items, today, title = "Progression" }: { items: Item[]; today: string; title?: string } =
    $props();

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
</script>

<div class="panel">
  <div class="head">
    <h2>{title}</h2>
    <p class="sub">Shaded area: lowest to highest growth.</p>
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
    <RangeChart {points} {today} />
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
  h2 {
    @apply --m3-title-medium;
  }
  .sub {
    @apply --m3-body-small;
    color: var(--m3c-on-surface-variant);
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
