<script lang="ts">
  import { Button, Card, Icon, ListItem } from "m3-svelte";
  import iconChart from "@ktibow/iconset-material-symbols/show-chart";
  import iconAdd from "@ktibow/iconset-material-symbols/add";
  import TopAppBar from "../lib/TopAppBar.svelte";
  import { categories, itemRange, netWorthRange, todayIso } from "../lib/model";
  import { dateLong, formatRange, money } from "../lib/format";
  import { go } from "../lib/router.svelte";
  import { store } from "../lib/store.svelte";

  const today = todayIso();
  const tracked = $derived(store.items.filter((i) => i.snapshots.length > 0));
  const range = $derived(netWorthRange(store.items, today));
  const breakdown = $derived(
    tracked
      .map((item) => ({ item, range: itemRange(item, today) }))
      .filter((x) => x.range != undefined),
  );
</script>

<TopAppBar title="Worthly" />

<div class="page">
  {#if tracked.length == 0}
    <Card variant="filled">
      <div class="empty">
        <h2>Welcome to Worthly</h2>
        <p>
          Add your accounts, pensions and debts with a value you know. Worthly projects them forward
          to estimate what you're worth today.
        </p>
        <Button variant="filled" iconType="left" onclick={() => go("item/new")}>
          <Icon icon={iconAdd} />
          Add your first item
        </Button>
      </div>
    </Card>
  {:else}
    <section class="hero" aria-labelledby="hero-label">
      <p id="hero-label" class="label">Estimated net worth today</p>
      <p class="value">
        {#if Math.round(range.low) == Math.round(range.high)}
          {money(range.low)}
        {:else}
          <span>{money(range.low)}</span>
          <span class="to">to</span>
          <span>{money(range.high)}</span>
        {/if}
      </p>
      <p class="date">{dateLong(today)}</p>
      <Button variant="tonal" iconType="left" onclick={() => go("progression")}>
        <Icon icon={iconChart} />
        See progression
      </Button>
    </section>

    <h2 class="section">Breakdown</h2>
    <div class="list">
      {#each breakdown as { item, range } (item.id)}
        <ListItem
          href={`#/item/${item.id}`}
          headline={item.name || categories[item.category].label}
          supporting={categories[item.category].label}
        >
          {#snippet trailing()}
            <span class="amount" class:debt={item.kind == "liability"}>
              {item.kind == "liability" ? "−" : ""}{formatRange(range!.low, range!.high)}
            </span>
          {/snippet}
        </ListItem>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem 1rem 1.5rem;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.5rem;
  }
  .empty h2 {
    @apply --m3-headline-small;
  }
  .empty p {
    color: var(--m3c-on-surface-variant);
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 1.5rem;
    border-radius: var(--m3-shape-extra-large);
    background-color: var(--m3c-primary-container);
    color: var(--m3c-on-primary-container);
  }
  .hero .label {
    @apply --m3-title-medium;
  }
  .hero .value {
    @apply --m3-display-small;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.5rem;
    font-variant-numeric: tabular-nums;
  }
  .hero .to {
    @apply --m3-title-medium;
  }
  .hero .date {
    @apply --m3-body-medium;
    margin-bottom: 0.5rem;
  }

  .section {
    @apply --m3-title-medium;
    color: var(--m3c-on-surface-variant);
    padding-inline: 0.25rem;
  }
  .list {
    display: flex;
    flex-direction: column;
    margin-inline: -1rem;
  }
  .amount {
    @apply --m3-label-large;
    font-variant-numeric: tabular-nums;
    text-align: end;
  }
  .amount.debt {
    color: var(--m3c-error);
  }
</style>
