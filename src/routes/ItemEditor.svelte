<script lang="ts">
  import {
    Button,
    ConnectedButtons,
    DateField,
    Dialog,
    Icon,
    ListItem,
    Select,
    TextField,
    snackbar,
  } from "m3-svelte";
  import iconAdd from "@ktibow/iconset-material-symbols/add";
  import iconDelete from "@ktibow/iconset-material-symbols/delete-outline";
  import Sheet from "../lib/Sheet.svelte";
  import {
    categories,
    categoriesFor,
    monthsBetween,
    mortgagePayment,
    newId,
    sortedSnapshots,
    todayIso,
    type Category,
    type Item,
    type Kind,
    type RepaymentType,
    type Snapshot,
  } from "../lib/model";
  import { dateLong, money } from "../lib/format";
  import { back } from "../lib/router.svelte";
  import { blankItem, deleteItem, getItem, saveItem } from "../lib/store.svelte";

  let { id }: { id: string } = $props();
  const formId = $props.id();

  // The parent re-creates this component when `id` changes ({#key}), so reading it once is fine.
  // svelte-ignore state_referenced_locally
  const existing = getItem(id);
  const isNew = !existing;
  const start: Item = existing ? $state.snapshot(existing) : blankItem();

  // Form fields are strings so half-typed numbers ("3.", "-") don't get clobbered.
  let name = $state(start.name);
  let kind = $state<Kind>(start.kind);
  let category = $state<string>(start.category);
  let growthMin = $state(String(start.growthMin));
  let growthMax = $state(String(start.growthMax));
  let monthly = $state(String(start.monthly));
  let snapshots = $state<Snapshot[]>(start.snapshots);
  // Mortgage term: with an end date, the repayment is worked out rather than entered.
  let repaymentType = $state<RepaymentType>(start.mortgage?.type ?? "repayment");
  let termEnd = $state(start.mortgage?.termEnd ?? "");
  let overpayment = $state(String(start.mortgage?.overpayment ?? 0));
  let showErrors = $state(false);

  const num = (s: string) => (s.trim() == "" ? NaN : Number(s));
  const minN = $derived(num(growthMin));
  const maxN = $derived(num(growthMax));
  const monthlyN = $derived(monthly.trim() == "" ? 0 : num(monthly));
  const overpaymentN = $derived(overpayment.trim() == "" ? 0 : num(overpayment));
  const isMortgage = $derived(category == "mortgage");
  const hasTerm = $derived(isMortgage && /^\d{4}-\d{2}-\d{2}$/.test(termEnd));
  const errors = $derived({
    growthMin: !Number.isFinite(minN),
    growthMax: !Number.isFinite(maxN) || maxN < minN,
    monthly: !hasTerm && (!Number.isFinite(monthlyN) || monthlyN < 0),
    overpayment: hasTerm && (!Number.isFinite(overpaymentN) || overpaymentN < 0),
  });
  const valid = $derived(!Object.values(errors).some(Boolean));
  const isDebt = $derived(kind == "liability");

  // The required payment at each end of the rate range, from the latest known balance.
  const paymentHint = $derived.by(() => {
    if (!hasTerm) return "";
    const latest = sortedSnapshots({ snapshots } as Item).at(-1);
    if (!latest) return "Add a known balance below to see the monthly payment.";
    const months = monthsBetween(latest.date, termEnd);
    if (months <= 0) return "This term ended before your latest known balance.";
    if (!Number.isFinite(minN) || !Number.isFinite(maxN)) return "";
    const [a, b] = [minN, maxN].map((r) => mortgagePayment(latest.value, r, months, repaymentType));
    const amount = Math.round(a) == Math.round(b) ? money(a) : `${money(a)} to ${money(b)}`;
    return repaymentType == "repayment"
      ? `Required payment about ${amount} a month, from your latest balance.`
      : `Interest about ${amount} a month. The balance is due in full when the term ends.`;
  });
  const repaymentOptions: { value: RepaymentType; text: string }[] = [
    { value: "repayment", text: "Repayment" },
    { value: "interest-only", text: "Interest only" },
  ];

  // Keep the category valid for the chosen type.
  const onKind = () => {
    const allowed = categoriesFor(kind);
    if (!allowed.includes(category as Category)) category = allowed[0];
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
      kind,
      growthMin: minN,
      growthMax: maxN,
      monthly: hasTerm ? start.monthly : monthlyN,
      snapshots: sortedSnapshots({ snapshots } as Item),
      mortgage: hasTerm
        ? { type: repaymentType, termEnd, overpayment: overpaymentN }
        : undefined,
    });
    snackbar(isNew ? "Item added" : "Changes saved");
    back("");
  };

  const remove = () => {
    const removed = getItem(start.id);
    deleteItem(start.id);
    back("");
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
  const categoryOptions = $derived(
    categoriesFor(kind).map((value) => ({ value, text: categories[value].label })),
  );
  const kindOptions: { value: Kind; text: string }[] = [
    { value: "asset", text: "Asset" },
    { value: "liability", text: "Liability" },
  ];
</script>

<Sheet label={isNew ? "New item" : "Edit item"} onclose={() => back("")}>
  {#snippet header()}
    <div class="title-row">
      <h1>{isNew ? "New item" : name || "Edit item"}</h1>
      {#if !isNew}
        <Button variant="text" iconType="full" onclick={remove} aria-label="Delete item">
          <Icon icon={iconDelete} />
        </Button>
      {/if}
    </div>
  {/snippet}

  <form
    id={formId}
    class="page"
    onsubmit={(e) => {
      e.preventDefault();
      save();
    }}
  >
    <div class="fields">
      <div class="kind" role="radiogroup" aria-label="Type">
        <ConnectedButtons>
          {#each kindOptions as k (k.value)}
            <Button variant="tonal" label>
              <input type="radio" name="kind" value={k.value} bind:group={kind} onchange={onKind} />
              {k.text}
            </Button>
          {/each}
        </ConnectedButtons>
        <p class="hint">{isDebt ? "Something you owe." : "Something you own."}</p>
      </div>
      <Select label="Category" options={categoryOptions} bind:value={category} width="100%" />
      <TextField label="Name (optional)" bind:value={name} />
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

    {#if isMortgage}
      <section>
        <h2>Mortgage term</h2>
        <p class="hint">
          With an end date, Worthly works out the monthly payment for you, as your lender does when
          the rate changes.
        </p>
        <div class="toggle" role="radiogroup" aria-label="Repayment type">
          <ConnectedButtons>
            {#each repaymentOptions as o (o.value)}
              <Button variant="tonal" label>
                <input type="radio" name="repayment" value={o.value} bind:group={repaymentType} />
                {o.text}
              </Button>
            {/each}
          </ConnectedButtons>
        </div>
        <DateField label="Term ends" bind:value={termEnd} datePickerTitle="Term end date" />
        {#if paymentHint}
          <p class="computed">{paymentHint}</p>
        {/if}
      </section>
    {/if}

    {#if hasTerm}
      <section>
        <h2>Monthly overpayment</h2>
        <p class="hint">Anything you pay on top of the required payment, in pounds. Leave at 0 if none.</p>
        <TextField
          label="£ per month"
          bind:value={overpayment}
          inputmode="decimal"
          error={showErrors && errors.overpayment}
        />
      </section>
    {:else}
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
    {/if}

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

  </form>

  {#snippet footer()}
    <Button variant="text" onclick={() => back("")}>Cancel</Button>
    <Button variant="filled" type="submit" form={formId}>{isNew ? "Add item" : "Save"}</Button>
  {/snippet}
</Sheet>

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
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 3rem;
  }
  h1 {
    @apply --m3-headline-small;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .kind {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .kind > :global(*:first-child) {
    display: flex;
  }
  .kind > :global(*:first-child > *) {
    flex: 1;
  }
  .kind .hint {
    margin-top: 0;
  }
  .toggle {
    display: flex;
  }
  .toggle > :global(*) {
    flex: 1;
  }
  .toggle > :global(* > *) {
    flex: 1;
  }
  .computed {
    @apply --m3-body-medium;
    padding: 0.75rem 1rem;
    border-radius: var(--m3-shape-medium);
    background-color: var(--m3c-secondary-container);
    color: var(--m3c-on-secondary-container);
  }
  .error {
    @apply --m3-body-small;
    color: var(--m3c-error);
    margin-top: -0.25rem;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  /* m3-svelte fields have min-width: 15rem, too wide for two side by side on a phone. */
  .row > :global(.m3-container) {
    min-width: 0;
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
  .dialog {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
  }
</style>
