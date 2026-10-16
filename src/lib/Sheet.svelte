<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { easeEmphasizedAccel, easeEmphasizedDecel, outroClass } from "m3-svelte";

  // A modal bottom sheet for longer content (m3-svelte's BottomSheet caps height and blocks
  // scrolling inside). The body scrolls; dragging the handle or header down dismisses it.
  let {
    label,
    header,
    footer,
    children,
    onclose,
  }: {
    label: string;
    header?: Snippet;
    footer?: Snippet;
    children: Snippet;
    onclose: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  $effect(() => {
    dialog?.showModal();
  });

  // Drag-to-dismiss, tracked from the grab area so it never fights with scrolling the body.
  let drag = $state(0);
  let dragging = $state(false);
  let startY = 0;
  let startTime = 0;
  const ondown = (e: PointerEvent) => {
    if ((e.target as Element).closest("button, a, input, select, textarea")) return;
    dragging = true;
    startY = e.clientY;
    startTime = performance.now();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onmove = (e: PointerEvent) => {
    if (dragging) drag = Math.max(0, e.clientY - startY);
  };
  const onup = () => {
    if (!dragging) return;
    dragging = false;
    const fast = drag / Math.max(1, performance.now() - startTime) > 0.5;
    if (drag > 120 || (fast && drag > 24)) onclose();
    else drag = 0;
  };
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  aria-label={label}
  style:translate={drag ? `0 ${drag}px` : undefined}
  class:dragging
  use:outroClass
  oncancel={(e) => {
    e.preventDefault();
    onclose();
  }}
  onclick={(e) => {
    // A click on the dialog element itself is a click on the scrim around the sheet.
    if (e.target == e.currentTarget) onclose();
  }}
  in:fly={{ y: 480, duration: 400, easing: easeEmphasizedDecel, opacity: 1 }}
  out:fly={{ y: 480, duration: 250, easing: easeEmphasizedAccel, opacity: 1 }}
>
  <div class="inner">
    <!-- Dragging is a shortcut; Escape, the scrim and Cancel close the sheet accessibly. -->
    <div
      class="grab"
      role="presentation"
      onpointerdown={ondown}
      onpointermove={onmove}
      onpointerup={onup}
      onpointercancel={onup}
    >
      <div class="handle" aria-hidden="true"></div>
      {#if header}
        <div class="header">{@render header()}</div>
      {/if}
    </div>
    <div class="body">
      {@render children()}
    </div>
    {#if footer}
      <div class="footer">{@render footer()}</div>
    {/if}
  </div>
</dialog>

<style>
  .sheet {
    /* Anchored to the bottom edge, full width up to a comfortable reading width. */
    margin: auto auto 0;
    width: 100%;
    max-width: 40rem;
    max-height: min(92dvh, 56rem);
    padding: 0;
    border: none;
    border-radius: var(--m3-shape-extra-large) var(--m3-shape-extra-large) 0 0;
    background-color: var(--m3c-surface-container-low);
    color: var(--m3c-on-surface);
    --m3v-background: var(--m3c-surface-container-low);
    overflow: hidden;
    transition: translate var(--m3-easing-fast);
  }
  .sheet.dragging {
    transition: none;
  }
  .sheet[open] {
    display: flex;
  }
  .sheet::backdrop {
    background-color: --translucent(var(--m3c-scrim), 0.32);
    animation: fade 400ms;
  }
  .sheet:global(.leaving)::backdrop {
    background-color: transparent;
    animation: fade-out 250ms;
  }
  .inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
  }
  .grab {
    flex-shrink: 0;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .sheet.dragging .grab {
    cursor: grabbing;
  }
  .handle {
    width: 2rem;
    height: 0.25rem;
    margin: 1.375rem auto 0.875rem;
    border-radius: var(--m3-shape-full);
    background-color: --translucent(var(--m3c-on-surface-variant), 0.4);
  }
  .header {
    padding: 0 0.5rem 0.5rem 1.5rem;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem 1.5rem 1.5rem;
  }
  .footer {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem calc(0.75rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--m3c-outline-variant);
  }
  @keyframes fade {
    from {
      background-color: transparent;
    }
  }
  @keyframes fade-out {
    from {
      background-color: --translucent(var(--m3c-scrim), 0.32);
    }
  }
  @media (forced-colors: active) {
    .handle {
      background-color: canvastext;
    }
  }
</style>
