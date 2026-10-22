<script lang="ts">
  import { Button, ConnectedButtons, DateField, TextField } from "m3-svelte";
  import Sheet from "./Sheet.svelte";
  import { newId, todayIso, type Kind, type Snapshot } from "./model";

  // Mounted only while open, so every opening starts from a blank form.
  let {
    kind,
    snapshots,
    onadd,
    onclose,
  }: {
    kind: Kind;
    /** The item's entries so far, to check a payment has a balance to come off. */
    snapshots: Snapshot[];
    onadd: (entry: Snapshot) => void;
    onclose: () => void;
  } = $props();

  const isDebt = $derived(kind == "liability");

  let date = $state(todayIso());
  let value = $state("");
  // An exact value (or balance), or an amount paid in or out.
  let type = $state<"absolute" | "relative">("absolute");
  const relative = $derived(type == "relative");
  const num = (s: string) => (s.trim() == "" ? NaN : Number(s));
  const valueN = $derived(num(value.replace(/[£,\s]/g, "")));
  const dateOk = $derived(/^\d{4}-\d{2}-\d{2}$/.test(date));
  // A payment needs a known balance on or before its date.
  const needsBalance = $derived(
    isDebt && relative && dateOk && !snapshots.some((s) => !s.relative && s.date <= date),
  );
  const ok = $derived(
    dateOk && Number.isFinite(valueN) && !(relative && valueN == 0) && !needsBalance,
  );
  const typeOptions = $derived([
    { value: "absolute", text: isDebt ? "Balance" : "Value" },
    { value: "relative", text: isDebt ? "Payment" : "Fund" },
  ]);

  const add = () => {
    if (!ok) return;
    onadd(
      relative
        ? // Stored by its effect: payments lower a balance, funds raise a value.
          { id: newId(), date, value: isDebt ? -valueN : valueN, relative: true }
        : { id: newId(), date, value: Math.abs(valueN) },
    );
  };
</script>

<Sheet label="Add a known value" {onclose}>
  {#snippet header()}
    <div class="title-row">
      <h2>Add a known value</h2>
    </div>
  {/snippet}
  <div class="fields">
    <div class="toggle" role="radiogroup" aria-label="Entry type">
      <ConnectedButtons>
        {#each typeOptions as o (o.value)}
          <Button variant="tonal" label>
            <input type="radio" name="entry-type" value={o.value} bind:group={type} />
            {o.text}
          </Button>
        {/each}
      </ConnectedButtons>
    </div>
    <p class="hint">
      {#if !relative}
        {isDebt ? "The exact balance owed on that day." : "The exact value on that day."}
      {:else if isDebt}
        A payment off the balance. Use a negative amount for extra borrowing.
      {:else}
        Money paid in. Use a negative amount for a withdrawal.
      {/if}
    </p>
    <DateField label="Date" bind:value={date} max={todayIso()} datePickerTitle="Pick a date" />
    <TextField
      label={relative
        ? isDebt ? "Amount paid (£)" : "Amount paid in (£)"
        : isDebt ? "Balance owed (£)" : "Value (£)"}
      bind:value
      inputmode="decimal"
      data-autofocus
      onkeydown={(e) => {
        // preventDefault stops the Enter from also "clicking" what opened the sheet once focus returns to it.
        if (e.key == "Enter") {
          e.preventDefault();
          add();
        }
      }}
    />
    {#if needsBalance}
      <p class="error">Add a balance on or before this date first, for the payment to come off.</p>
    {/if}
  </div>
  {#snippet footer()}
    <Button variant="text" onclick={onclose}>Cancel</Button>
    <Button variant="filled" disabled={!ok} onclick={add}>Add</Button>
  {/snippet}
</Sheet>

<style>
  .title-row {
    display: flex;
    align-items: center;
    min-height: 3rem;
  }
  h2 {
    @apply --m3-headline-small;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
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
  .hint {
    @apply --m3-body-medium;
    color: var(--m3c-on-surface-variant);
    margin-top: -0.5rem;
  }
  .error {
    @apply --m3-body-small;
    color: var(--m3c-error);
    margin-top: -0.25rem;
  }
</style>
