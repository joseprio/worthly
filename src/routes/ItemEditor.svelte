<script lang="ts">
  import { Button, DateField, Dialog, Icon, ListItem, Select, TextField, snackbar } from "m3-svelte";
  import iconAdd from "@ktibow/iconset-material-symbols/add";
  import iconDelete from "@ktibow/iconset-material-symbols/delete-outline";
  import TopAppBar from "../lib/TopAppBar.svelte";
  import {
    categories,
    newId,
    sortedSnapshots,
    todayIso,
    type Category,
    type Item,
    type Kind,
    type Snapshot,
  } from "../lib/model";
  import { dateLong, money } from "../lib/format";
  import { back, go } from "../lib/router.svelte";
  import { blankItem, deleteItem, getItem, saveItem } from "../lib/store.svelte";

  let { id }: { id: string } = $props();

  // The parent re-creates this component when `id` changes ({#key}), so reading it once is fine.
  // svelte-ignore state_referenced_locally
  const existing = getItem(id);
  const isNew = !existing;
  const start: Item = existing ? $state.snapshot(existing) : blankItem();

  // Form fields are strings so half-typed numbers ("3.", "-") don't get clobbered.
  let name = $state(start.name);
  let category = $state<string>(start.category);
  let kind = $state<string>(start.kind);
  let growthMin = $state(String(start.growthMin));
  let growthMax = $state(String(start.growthMax));
  let monthly = $state(String(start.monthly));
  let snapshots = $state<Snapshot[]>(start.snapshots);
  let showErrors = $state(false);

  const num = (s: string) => (s.trim() == "" ? NaN : Number(s));
  const minN = $derived(num(growthMin));
  const maxN = $derived(num(growthMax));
  const monthlyN = $derived(monthly.trim() == "" ? 0 : num(monthly));
  const errors = $derived({
    growthMin: !Number.isFinite(minN),
    growthMax: !Number.isFinite(maxN) || maxN < minN,
    monthly: !Number.isFinite(monthlyN) || monthlyN < 0,
  });
  const valid = $derived(!errors.growthMin && !errors.growthMax && !errors.monthly);
  const isDebt = $derived(kind == "liability");

  const onCategory = () => {
    kind = categories[category as Category].kind;
  };

  const save = () => {
    if (!valid) {
      showErrors = true;
      return;
    }
    saveItem({
      id: start.id,
      name: name.trim(),
      category: category as Category,
      kind: kind as Kind,
      growthMin: minN,
      growthMax: maxN,
      monthly: monthlyN,
      snapshots: sortedSnapshots({ snapshots } as Item),
    });
    snackbar(isNew ? "Item added" : "Changes saved");
    if (isNew) go("items");
    else back("items");
  };

  const remove = () => {
    const removed = getItem(start.id);
    deleteItem(start.id);
    go("items");
    if (removed)
      snackbar("Item deleted", { Undo: () => saveItem(removed) }, false, 6000);
  };

  // Dialog for adding a known value
  let dialogOpen = $state(false);
  let draftDate = $state(todayIso());
  let draftValue = $state("");
  const draftValueN = $derived(num(draftValue.replace(/[£,\s]/g, "")));
  const draftOk = $derived(/^\d{4}-\d{2}-\d{2}$/.test(draftDate) && Number.isFinite(draftValueN));

  const openDialog = () => {
    draftDate = todayIso();
    draftValue = "";
    dialogOpen = true;
  };
  const addSnapshot = () => {
    if (!draftOk) return;
    // One value per day: a new value on an existing date replaces it.
    snapshots = [
      ...snapshots.filter((s) => s.date != draftDate),
      { id: newId(), date: draftDate, value: Math.abs(draftValueN) },
    ];
    dialogOpen = false;
  };
  const removeSnapshot = (sid: string) => {
    snapshots = snapshots.filter((s) => s.id != sid);
  };

  const ordered = $derived([...snapshots].sort((a, b) => b.date.localeCompare(a.date)));
  const categoryOptions = Object.entries(categories).map(([value, c]) => ({
    value,
    text: c.label,
  }));
  const kindOptions = [
    { value: "asset", text: "Asset (something you own)" },
    { value: "liability", text: "Liability (something you owe)" },
  ];
</script>

<TopAppBar title={isNew ? "New item" : name || "Edit item"} onback={() => back("items")}>
  {#snippet actions()}
    {#if !isNew}
      <Button variant="text" iconType="full" onclick={remove} aria-label="Delete item">
        <Icon icon={iconDelete} />
      </Button>
    {/if}
  {/snippet}
</TopAppBar>

<form
  class="page"
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <div class="fields">
    <TextField label="Name (optional)" bind:value={name} />
    <Select label="Category" options={categoryOptions} bind:value={category} onchange={onCategory} width="100%" />
    <Select label="Type" options={kindOptions} bind:value={kind} width="100%" />
  </div>

  <section>
    <h2>{isDebt ? "Interest rate" : "Expected growth"}</h2>
    <p class="hint">
      {isDebt
        ? "The yearly interest rate range on the balance."
        : "A yearly range, after fees. Use a negative number for a loss."}
    </p>
    <div class="row">
      <TextField
        label="Lowest %"
        bind:value={growthMin}
        inputmode="decimal"
        error={showErrors && errors.growthMin}
      />
      <TextField
        label="Highest %"
        bind:value={growthMax}
        inputmode="decimal"
        error={showErrors && errors.growthMax}
      />
    </div>
    {#if showErrors && errors.growthMax && !errors.growthMin}
      <p class="error">The highest rate can't be lower than the lowest.</p>
    {/if}
  </section>

  <section>
    <h2>{isDebt ? "Monthly repayment" : "Monthly contribution"}</h2>
    <p class="hint">
      {isDebt
        ? "How much you pay off each month, in pounds."
        : "How much you pay in each month, in pounds. Leave at 0 if none."}
    </p>
    <TextField
      label="£ per month"
      bind:value={monthly}
      inputmode="decimal"
      error={showErrors && errors.monthly}
    />
  </section>

  <section>
    <div class="heading-row">
      <h2>Known values</h2>
      <Button variant="text" iconType="left" onclick={openDialog}>
        <Icon icon={iconAdd} />
        Add value
      </Button>
    </div>
    <p class="hint">
      {isDebt ? "Outstanding balances" : "Exact values"} you know on specific dates, such as from a statement.
      Estimates are projected from the most recent one.
    </p>
    {#if ordered.length == 0}
      <p class="none">No values yet. Add at least one to include this item in your net worth.</p>
    {:else}
      <div class="list">
        {#each ordered as snap (snap.id)}
          <ListItem headline={money(snap.value)} supporting={dateLong(snap.date)}>
            {#snippet trailing()}
              <Button
                variant="text"
                iconType="full"
                onclick={() => removeSnapshot(snap.id)}
                aria-label={`Remove value from ${dateLong(snap.date)}`}
              >
                <Icon icon={iconDelete} />
              </Button>
            {/snippet}
          </ListItem>
        {/each}
      </div>
    {/if}
  </section>

  <div class="actions">
    <Button variant="text" onclick={() => back("items")}>Cancel</Button>
    <Button variant="filled" type="submit">{isNew ? "Add item" : "Save"}</Button>
  </div>
</form>

<Dialog headline="Add a known value" bind:open={dialogOpen}>
  <div class="dialog">
    <DateField label="Date" bind:value={draftDate} max={todayIso()} datePickerTitle="Pick a date" />
    <TextField label={isDebt ? "Balance owed (£)" : "Value (£)"} bind:value={draftValue}
      inputmode="decimal"
      onkeydown={(e) => {
        // preventDefault stops the Enter from also "clicking" Add value once focus returns to it.
        if (e.key == "Enter") {
          e.preventDefault();
          addSnapshot();
        }
      }}
    />
  </div>
  {#snippet buttons()}
    <Button variant="text" onclick={() => (dialogOpen = false)}>Cancel</Button>
    <Button variant="text" disabled={!draftOk} onclick={addSnapshot}>Add</Button>
  {/snippet}
</Dialog>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    padding: 0.5rem 1rem 2rem;
  }
  .fields,
  section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h2 {
    @apply --m3-title-medium;
  }
  .hint,
  .none {
    @apply --m3-body-medium;
    color: var(--m3c-on-surface-variant);
    margin-top: -0.5rem;
  }
  .none {
    margin-top: 0;
  }
  .error {
    @apply --m3-body-small;
    color: var(--m3c-error);
    margin-top: -0.25rem;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block: -0.5rem;
  }
  .list {
    display: flex;
    flex-direction: column;
    margin-inline: -1rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .dialog {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
  }
</style>
