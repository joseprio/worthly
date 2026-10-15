<script lang="ts">
  import type { Snippet } from "svelte";
  import { Button, Icon } from "m3-svelte";
  import iconBack from "@ktibow/iconset-material-symbols/arrow-back";

  let {
    title,
    onback,
    actions,
  }: { title: string; onback?: () => void; actions?: Snippet } = $props();

  let scrolled = $state(false);
</script>

<svelte:window onscroll={() => (scrolled = window.scrollY > 0)} />

<header class:scrolled>
  {#if onback}
    <Button variant="text" iconType="full" onclick={onback} aria-label="Back">
      <Icon icon={iconBack} />
    </Button>
  {/if}
  <h1 class:inset={!onback}>{title}</h1>
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    height: 4rem;
    padding: env(safe-area-inset-top) 0.25rem 0;
    background-color: var(--m3c-surface);
    color: var(--m3c-on-surface);
    transition: background-color var(--m3-easing);
  }
  header.scrolled {
    background-color: var(--m3c-surface-container);
  }
  h1 {
    @apply --m3-title-large;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h1.inset {
    padding-inline-start: 0.75rem;
  }
  .actions {
    display: flex;
  }
</style>
