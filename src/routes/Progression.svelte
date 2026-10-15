<script lang="ts">
  import { Button, ConnectedButtons } from "m3-svelte";
  import TopAppBar from "../lib/TopAppBar.svelte";
  import RangeChart from "../lib/RangeChart.svelte";
  import { earliestSnapshot, netWorthSeries, parseDate, toIso, todayIso } from "../lib/model";
  import { dateMonthYear, formatRange } from "../lib/format";
  import { back } from "../lib/router.svelte";
  import { store } from "../lib/store.svelte";

  const today = todayIso();
  const horizons = [
    { value: "0", text: "Up to today" },
    { value: "1", text: "+1 year" },
    { value: "5", text: "+5 years" },
    { value: "10", text: "+10 years" },
  ];
  let horizon = $state("5");
  let showTable = $state(false);

  const from = $derived(earliestSnapshot(store.items));
  const to = $derived.by(() => {
    const d = new Date(parseDate(today));
    d.setUTCFullYear(d.getUTCFullYear() + Number(horizon));
    return toIso(d.getTime());
  });
  const points = $derived(from && from < to ? netWorthSeries(store.items, from, to, 80) : []);
  // A coarser, readable set of rows for the table view.
  const rows = $derived(from && from < to ? netWorthSeries(store.items, from, to, 13) : []);
</script>

<TopAppBar title="Progression" onback={() => back("")} />

<div class="page">
  <div class="horizons">
    <ConnectedButtons>
      {#each horizons as h (h.value)}
        <Button variant="tonal" label>
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
        : "Add an item with a known value to see your progression."}
    </p>
  {:else}
    <div class="card">
      <h2>Estimated net worth</h2>
      <p class="sub">Shaded area shows the range between your lowest and highest growth rates.</p>
      <RangeChart {points} {today} />
    </div>

    <Button variant="text" onclick={() => (showTable = !showTable)}>
      {showTable ? "Hide table" : "Show as table"}
    </Button>
    {#if showTable}
      <table>
        <thead>
          <tr><th scope="col">Date</th><th scope="col">Estimated range</th></tr>
        </thead>
        <tbody>
          {#each rows as r (r.date)}
            <tr class:future={r.date > today}>
              <td>{dateMonthYear(r.date)}</td>
              <td>{formatRange(r.low, r.high)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem 1rem 2rem;
  }
  .horizons {
    overflow-x: auto;
    margin-inline: -1rem;
    padding-inline: 1rem;
    scrollbar-width: none;
  }
  .horizons > :global(*) {
    width: max-content;
  }
  .empty {
    color: var(--m3c-on-surface-variant);
    padding: 1rem 0.25rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem;
    border-radius: var(--m3-shape-large);
    background-color: var(--m3c-surface-container-low);
  }
  .card h2 {
    @apply --m3-title-medium;
  }
  .card .sub {
    @apply --m3-body-small;
    color: var(--m3c-on-surface-variant);
    margin-bottom: 0.75rem;
  }
  table {
    @apply --m3-body-medium;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th {
    @apply --m3-label-large;
    text-align: start;
    color: var(--m3c-on-surface-variant);
  }
  th,
  td {
    padding: 0.5rem 0.25rem;
    border-bottom: 1px solid var(--m3c-outline-variant);
  }
  th:last-child,
  td:last-child {
    text-align: end;
  }
  tr.future td {
    color: var(--m3c-on-surface-variant);
  }
</style>
