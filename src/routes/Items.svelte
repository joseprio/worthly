<script lang="ts">
  import { FAB, Icon, ListItem } from "m3-svelte";
  import iconAdd from "@ktibow/iconset-material-symbols/add";
  import iconAsset from "@ktibow/iconset-material-symbols/savings-outline";
  import iconDebt from "@ktibow/iconset-material-symbols/credit-card";
  import TopAppBar from "../lib/TopAppBar.svelte";
  import { categories, sortedSnapshots } from "../lib/model";
  import { dateShort, money, percent } from "../lib/format";
  import { go } from "../lib/router.svelte";
  import { store } from "../lib/store.svelte";

  const groups = $derived([
    { title: "Assets", items: store.items.filter((i) => i.kind == "asset") },
    { title: "Liabilities", items: store.items.filter((i) => i.kind == "liability") },
  ]);

  const describe = (item: (typeof store.items)[number]) => {
    const last = sortedSnapshots(item).at(-1);
    const rate =
      item.growthMin == item.growthMax
        ? percent(item.growthMin)
        : `${percent(item.growthMin)} to ${percent(item.growthMax)}`;
    return last
      ? `${money(last.value)} on ${dateShort(last.date)} · ${rate} a year`
      : `No values yet · ${rate} a year`;
  };
</script>

<TopAppBar title="Items" />

<div class="page">
  {#if store.items.length == 0}
    <p class="empty">
      Nothing here yet. Add an ISA, pension, mortgage or anything else you'd like to track.
    </p>
  {/if}
  {#each groups as group (group.title)}
    {#if group.items.length}
      <h2 class="section">{group.title}</h2>
      <div class="list">
        {#each group.items as item (item.id)}
          <ListItem
            href={`#/item/${item.id}`}
            headline={item.name || categories[item.category].label}
            supporting={describe(item)}
          >
            {#snippet leading()}
              <Icon icon={item.kind == "asset" ? iconAsset : iconDebt} />
            {/snippet}
          </ListItem>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<div class="fab">
  <FAB color="primary-container" icon={iconAdd} text="Add item" onclick={() => go("item/new")} />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 1rem 6rem;
  }
  .empty {
    color: var(--m3c-on-surface-variant);
    padding: 1rem 0.25rem;
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
  .fab {
    position: fixed;
    right: max(1rem, calc((100vw - 40rem) / 2 + 1rem));
    bottom: calc(var(--m3v-bottom-offset, 0px) + 1rem);
    z-index: 1;
  }
</style>
