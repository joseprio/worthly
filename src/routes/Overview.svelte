<script lang="ts">
  import { Button, ConnectedButtons, FAB, Icon, ListItem, snackbar } from "m3-svelte";
  import iconAdd from "@ktibow/iconset-material-symbols/add";
  import iconAsset from "@ktibow/iconset-material-symbols/savings-outline";
  import iconDebt from "@ktibow/iconset-material-symbols/credit-card";
  import AddValueSheet from "../lib/AddValueSheet.svelte";
  import NetWorthDonut, { type Segment } from "../lib/NetWorthDonut.svelte";
  import ProgressionPanel from "../lib/ProgressionPanel.svelte";
  import {
    categories,
    itemRange,
    netWorthRange,
    todayIso,
    withEntry,
    type Item,
    type Snapshot,
  } from "../lib/model";
  import { money, percent, spread } from "../lib/format";
  import { go } from "../lib/router.svelte";
  import { saveItem, store } from "../lib/store.svelte";

  const today = todayIso();
  const hasValues = $derived(store.items.some((i) => i.snapshots.length > 0));
  const title = (item: Item) => item.name || categories[item.category].label;

  const filters = [
    { value: "all", text: "All", caption: "Net worth" },
    { value: "asset", text: "Assets", caption: "Assets" },
    { value: "liability", text: "Liabilities", caption: "Liabilities" },
  ];
  let filter = $state("all");
  const caption = $derived(filters.find((f) => f.value == filter)!.caption);
  // The filter drives the charts as well as the list.
  const shown = $derived(store.items.filter((i) => filter == "all" || i.kind == filter));

  const range = $derived(netWorthRange(shown, today));
  const segments = $derived.by(() => {
    const out: Record<Item["kind"], Segment[]> = { asset: [], liability: [] };
    for (const item of shown) {
      const r = itemRange(item, today);
      if (r)
        out[item.kind].push({
          id: item.id,
          label: title(item),
          ...r,
        });
    }
    return out;
  });
  // Slice highlighted in the donut; set by touching a slice or hovering a row below.
  let active = $state<string | undefined>();
  // A highlight can outlive its slice (e.g. its last known value was deleted); ignore it then.
  const highlighted = $derived(
    [...segments.asset, ...segments.liability].some((s) => s.id == active) ? active : undefined,
  );

  const groups = $derived(
    [
      { kind: "asset", title: "Assets", items: shown.filter((i) => i.kind == "asset") },
      { kind: "liability", title: "Liabilities", items: shown.filter((i) => i.kind == "liability") },
    ].filter((g) => g.items.length),
  );

  // Swipeable top card: page 0 is the donut, page 1 the progression chart.
  const pages = ["Net worth", "Progression"];
  let pager: HTMLElement | undefined = $state();
  let page = $state(0);
  const onscroll = () => {
    if (pager) page = Math.round(pager.scrollLeft / pager.clientWidth);
  };
  const showPage = (i: number) => pager?.scrollTo({ left: i * pager.clientWidth, behavior: "smooth" });

  const rate = (item: Item) =>
    item.growthMin == item.growthMax
      ? `${percent(item.growthMin)} a year`
      : `${percent(item.growthMin)} to ${percent(item.growthMax)} a year`;

  // Item getting a value straight from its row, without opening the editor.
  let addingTo = $state<Item | undefined>();
  const addEntry = (entry: Snapshot) => {
    const item = addingTo!;
    saveItem({ ...$state.snapshot(item), snapshots: withEntry(item.snapshots, entry) });
    addingTo = undefined;
    snackbar("Value added");
  };

  const supporting = (item: Item) => {
    const label = categories[item.category].label;
    return item.name && item.name != label ? `${label} · ${rate(item)}` : rate(item);
  };
</script>

<div class="page">
  <div class="side">
    {#if hasValues}
      <section class="hero" aria-roledescription="carousel" aria-label="Net worth">
        <div class="pager" bind:this={pager} {onscroll}>
          <div class="slide" role="group" aria-roledescription="slide" aria-label="Net worth today">
            <NetWorthDonut
              assets={segments.asset}
              liabilities={segments.liability}
              low={range.low}
              high={range.high}
              {caption}
              date={today}
              bind:active
            />
          </div>
          <div class="slide" role="group" aria-roledescription="slide" aria-label="Progression">
            <ProgressionPanel
              items={shown}
              {today}
              title={filter == "all" ? "Progression" : `${caption} over time`}
              label={caption}
              active={highlighted}
            />
          </div>
        </div>
        <div class="dots">
          {#each pages as label, i (label)}
            <button
              type="button"
              class="dot"
              class:on={page == i}
              aria-label={`Show ${label.toLowerCase()}`}
              aria-current={page == i}
              onclick={() => showPage(i)}
            ></button>
          {/each}
        </div>
      </section>
    {:else}
      <section class="welcome">
        <h2>Welcome to Worthly</h2>
        <p>
          Add your accounts, pensions and debts with a value you know. Worthly projects them forward
          to estimate what you're worth today.
        </p>
        {#if store.items.length}
          <p>Open an item below and add a known value to see your estimate.</p>
        {:else}
          <p>Use <strong>Add item</strong> to get started.</p>
        {/if}
      </section>
    {/if}
  </div>

  <div class="main">
    {#if store.items.length}
      <div class="filters" role="radiogroup" aria-label="Show">
        <ConnectedButtons>
          {#each filters as f (f.value)}
            <Button variant="tonal" size="s" label>
              <input type="radio" name="filter" value={f.value} bind:group={filter} />
              {f.text}
            </Button>
          {/each}
        </ConnectedButtons>
      </div>
    {/if}

    {#each groups as group (group.title)}
      {#if group.items.length}
        <h2 class="section">{group.title}</h2>
        <div class="list">
          {#each group.items as item (item.id)}
            {@const r = itemRange(item, today)}
            <div class="row">
              <ListItem
                onclick={() => go(`item/${item.id}`)}
                headline={title(item)}
                supporting={supporting(item)}
                onpointerenter={() => r && (active = item.id)}
                onpointerleave={() => (active = undefined)}
                onfocus={() => r && (active = item.id)}
                onblur={() => (active = undefined)}
              >
                {#snippet leading()}
                  <!-- Tinted with the donut's colours, so the list doubles as its legend. -->
                  <span class="legend {item.kind}" class:off={!r}>
                    <Icon icon={item.kind == "asset" ? iconAsset : iconDebt} />
                  </span>
                {/snippet}
                {#snippet trailing()}
                  {#if r}
                    <span class="amount" class:debt={item.kind == "liability"}>
                      {item.kind == "liability" ? "−" : ""}{money((r.low + r.high) / 2)}
                      {#if spread(r.low, r.high) > 0}
                        <span class="spread">±{money(spread(r.low, r.high))}</span>
                      {/if}
                    </span>
                  {:else}
                    <span class="missing">No values yet</span>
                  {/if}
                {/snippet}
              </ListItem>
              <!-- Beside the row, not in it: the row is itself a button. -->
              <Button
                variant="text"
                iconType="full"
                onclick={() => (addingTo = item)}
                aria-label={`Add value to ${title(item)}`}
              >
                <Icon icon={iconAdd} />
              </Button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
</div>

{#if addingTo}
  <AddValueSheet
    kind={addingTo.kind}
    snapshots={addingTo.snapshots}
    onadd={addEntry}
    onclose={() => (addingTo = undefined)}
  />
{/if}

<div class="fab">
  <FAB color="primary-container" icon={iconAdd} text="Add item" onclick={() => go("item/new")} />
</div>

<style>
  .page,
  .side,
  .main {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .page {
    /* No app bar on home, so clear the status bar ourselves. Bottom: room for the FAB. */
    padding: calc(env(safe-area-inset-top) + 1rem) 1rem 6rem;
  }

  .hero,
  .welcome {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.5rem;
    border-radius: var(--m3-shape-extra-large);
    margin-bottom: 0.5rem;
    background-color: var(--m3c-surface-container);
  }
  .hero {
    gap: 0.75rem;
    padding-inline: 0;
  }
  .pager {
    /* Positioned so absolutely placed children (the screen-reader table) are clipped too. */
    position: relative;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 100%;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  .pager::-webkit-scrollbar {
    display: none;
  }
  .slide {
    scroll-snap-align: start;
    scroll-snap-stop: always;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding-inline: 1.5rem;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 0.25rem;
  }
  .dot {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dot::before {
    content: "";
    width: 0.5rem;
    height: 0.5rem;
    border-radius: var(--m3-shape-full);
    background-color: var(--m3c-outline-variant);
    transition:
      width var(--m3-easing-fast),
      background-color var(--m3-easing-fast);
  }
  .dot.on::before {
    width: 1.25rem;
    background-color: var(--m3c-primary);
  }
  .filters {
    display: flex;
  }
  .filters > :global(*) {
    flex: 1;
  }
  .filters > :global(* > *) {
    flex: 1;
  }
  .welcome {
    align-items: flex-start;
  }
  .welcome h2 {
    @apply --m3-headline-small;
  }
  .welcome p {
    color: var(--m3c-on-surface-variant);
  }

  .section {
    @apply --m3-title-small;
    color: var(--m3c-primary);
    padding: 0.75rem 0.25rem 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    margin-inline: -1rem;
  }
  .row {
    display: flex;
    align-items: center;
    padding-inline-end: 0.25rem;
  }
  /* ListItem wraps its row in a display: contents <li>. */
  .row > :global(li > .m3-container) {
    flex: 1;
    min-width: 0;
  }
  .amount {
    @apply --m3-label-large;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-variant-numeric: tabular-nums;
  }
  .spread {
    @apply --m3-label-medium;
    color: var(--m3c-on-surface-variant);
  }
  .amount.debt {
    color: var(--m3c-error);
  }
  .missing {
    @apply --m3-label-medium;
    color: var(--m3c-on-surface-variant);
  }
  .legend {
    display: flex;
  }
  .legend.asset {
    color: var(--viz-asset);
  }
  .legend.liability {
    color: var(--viz-debt);
  }
  .legend.off {
    color: var(--m3c-on-surface-variant);
  }
  .fab {
    position: fixed;
    /* Follows the edge of the centred content (see .shell in App.svelte). */
    right: max(1rem, calc((100vw - 72rem) / 2 + 1rem));
    bottom: calc(1rem + env(safe-area-inset-bottom));
    z-index: 1;
  }

  /* Expanded window class (Material 3: 840px+): charts on the left, list on the right. */
  @media (min-width: 52.5rem) {
    .page {
      display: grid;
      grid-template-columns: minmax(20rem, 26rem) minmax(0, 1fr);
      align-items: start;
      column-gap: 2rem;
      padding: 1.5rem 1.5rem 6rem;
    }
    /* No swiping with a mouse: show both charts, one above the other. */
    .pager {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      overflow: visible;
      scroll-snap-type: none;
    }
    .dots {
      display: none;
    }
    .hero {
      padding-block: 1.5rem;
    }
  }
  /* Keep the charts in view while scrolling the list, when they fit on screen. */
  @media (min-width: 52.5rem) and (min-height: 46rem) {
    .side {
      position: sticky;
      top: 1.5rem;
    }
  }
</style>
