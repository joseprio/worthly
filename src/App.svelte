<script lang="ts">
  import { NavCMLX, NavCMLXItem, Snackbar } from "m3-svelte";
  import iconHome from "@ktibow/iconset-material-symbols/home";
  import iconHomeOutline from "@ktibow/iconset-material-symbols/home-outline";
  import iconWallet from "@ktibow/iconset-material-symbols/account-balance-wallet";
  import iconWalletOutline from "@ktibow/iconset-material-symbols/account-balance-wallet-outline";
  import { href, router } from "./lib/router.svelte";
  import Overview from "./routes/Overview.svelte";
  import Progression from "./routes/Progression.svelte";
  import Items from "./routes/Items.svelte";
  import ItemEditor from "./routes/ItemEditor.svelte";

  const route = $derived(router.route);
  const topLevel = $derived(route.name == "overview" || route.name == "items");
</script>

<div class="shell" class:with-nav={topLevel}>
  <main>
    {#if route.name == "overview"}
      <Overview />
    {:else if route.name == "progression"}
      <Progression />
    {:else if route.name == "items"}
      <Items />
    {:else if route.name == "item"}
      {#key route.id}
        <ItemEditor id={route.id} />
      {/key}
    {/if}
  </main>

  {#if topLevel}
    <div class="nav">
      <NavCMLX variant="compact">
        <NavCMLXItem
          variant="compact"
          href={href("")}
          icon={route.name == "overview" ? iconHome : iconHomeOutline}
          text="Overview"
          selected={route.name == "overview"}
        />
        <NavCMLXItem
          variant="compact"
          href={href("items")}
          icon={route.name == "items" ? iconWallet : iconWalletOutline}
          text="Items"
          selected={route.name == "items"}
        />
      </NavCMLX>
    </div>
  {/if}

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
  .shell.with-nav {
    --m3v-bottom-offset: calc(5rem + env(safe-area-inset-bottom));
  }
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-bottom: var(--m3v-bottom-offset, env(safe-area-inset-bottom));
  }
  .nav {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 2;
    background-color: var(--m3c-surface-container);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .nav > :global(nav) {
    max-width: 40rem;
    margin-inline: auto;
  }
</style>
