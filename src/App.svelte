<script lang="ts">
  import { Snackbar } from "m3-svelte";
  import { router } from "./lib/router.svelte";
  import Overview from "./routes/Overview.svelte";
  import ItemEditor from "./routes/ItemEditor.svelte";

  const route = $derived(router.route);
</script>

<div class="shell" class:with-fab={route.name == "overview"}>
  <main>
    {#if route.name == "overview"}
      <Overview />
    {:else if route.name == "item"}
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
    max-width: 40rem;
    margin-inline: auto;
  }
  .shell.with-fab {
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
