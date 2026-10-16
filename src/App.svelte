<script lang="ts">
  import { Snackbar } from "m3-svelte";
  import { router } from "./lib/router.svelte";
  import Overview from "./routes/Overview.svelte";
  import ItemEditor from "./routes/ItemEditor.svelte";

  const route = $derived(router.route);
</script>

<div class="shell">
  <main>
    <!-- Home stays underneath; adding or editing an item opens as a bottom sheet over it. -->
    <Overview />
    {#if route.name == "item"}
      {#key route.id}
        <ItemEditor id={route.id} />
      {/key}
    {/if}
  </main>

  <Snackbar />
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    /* Two-column layout on wide screens (see Overview). */
    max-width: 72rem;
    margin-inline: auto;
    /* Keeps snackbars above the FAB, as Material 3 specifies. */
    --m3v-bottom-offset: 5.5rem;
  }
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom);
  }
</style>
