<script module lang="ts">
  export type Segment = { id: string; label: string; low: number; high: number };
</script>

<script lang="ts">
  import { dateShort, money, spread } from "./format";

  let {
    assets,
    liabilities,
    low,
    high,
    date,
    caption = "Net worth",
    active = $bindable(),
  }: {
    assets: Segment[];
    liabilities: Segment[];
    low: number;
    high: number;
    date: string;
    caption?: string;
    active?: string;
  } = $props();

  const SIZE = 240;
  const C = SIZE / 2;
  const OUTER = 118; // outer edge of the asset ring
  const HOLE = 68; // radius kept clear for the centre text
  const RING_GAP = 3; // px between the asset and debt rings
  const GAP = 2.5; // px of surface between neighbouring slices
  const MIN_W = 3; // thinnest a ring may get, so a tiny total stays visible

  const mid = (s: Segment) => (s.low + s.high) / 2;
  const bySize = (list: Segment[]) => [...list].sort((a, b) => mid(b) - mid(a));

  const assetTotal = $derived(assets.reduce((t, s) => t + mid(s), 0));
  const debtTotal = $derived(liabilities.reduce((t, s) => t + mid(s), 0));

  /**
   * Each ring is a full circle whose area is proportional to its total, and together they fill
   * the space between OUTER and HOLE. Slices split their ring by angle, so every slice's area is
   * proportional to its value: equal assets and debts get equal areas.
   */
  const rings = $derived.by(() => {
    const a = Math.max(0, assetTotal);
    const l = Math.max(0, debtTotal);
    // With area k·value per ring: r1² = OUTER² − k·a, r2 = r1 − gap, r3² = r2² − k·l.
    const edges = (k: number) => {
      const r1 = Math.sqrt(Math.max(0, OUTER ** 2 - k * a));
      const r2 = a > 0 && l > 0 ? r1 - RING_GAP : r1;
      const r3 = Math.sqrt(Math.max(0, r2 ** 2 - k * l));
      return { r1, r2, r3 };
    };
    // Find k so the inner edge lands on HOLE (r3 shrinks as k grows).
    let lo = 0;
    let hi = (OUTER ** 2) / Math.max(a + l, 1e-9);
    for (let i = 0; i < 40; i++) {
      const k = (lo + hi) / 2;
      if (edges(k).r3 > HOLE) lo = k;
      else hi = k;
    }
    const { r1, r2, r3 } = edges(lo);
    const ring = (outerEdge: number, innerEdge: number) => {
      const w = Math.max(MIN_W, outerEdge - innerEdge);
      return { r: outerEdge - w / 2, w };
    };
    return { asset: ring(OUTER, r1), debt: ring(r2, r3) };
  });

  type Arc = { seg: Segment; d: string; full: boolean; shade: string };

  /** How far slice i of n fades toward the surface: biggest at full colour, smallest at 60%. */
  const shade = (i: number, n: number) => `${n > 1 ? Math.round((i / (n - 1)) * 60) : 0}%`;

  const point = (r: number, angle: number) =>
    `${(C + r * Math.sin(angle)).toFixed(2)},${(C - r * Math.cos(angle)).toFixed(2)}`;

  /** Slices from 12 o'clock, clockwise (dir 1) or counterclockwise (dir -1), biggest first. */
  const arcs = (list: Segment[], total: number, r: number, dir: 1 | -1): Arc[] => {
    const sorted = bySize(list).filter((s) => mid(s) > 0);
    const gap = GAP / r;
    let start = 0;
    return sorted.map((seg, i) => {
      const sweep = (mid(seg) / total) * Math.PI * 2;
      const from = start;
      start += sweep;
      const s = shade(i, sorted.length);
      if (sorted.length == 1 && sweep >= Math.PI * 2 - 1e-6)
        return { seg, d: "", full: true, shade: s };
      const a0 = from + gap / 2;
      const a1 = Math.max(a0 + 0.001, from + sweep - gap / 2);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const sweepFlag = dir == 1 ? 1 : 0;
      const d = `M${point(r, dir * a0)} A${r},${r} 0 ${large} ${sweepFlag} ${point(r, dir * a1)}`;
      return { seg, d, full: false, shade: s };
    });
  };

  const outer = $derived(arcs(assets, assetTotal, rings.asset.r, 1));
  const inner = $derived(arcs(liabilities, debtTotal, rings.debt.r, -1));

  const activeSeg = $derived(
    [...assets, ...liabilities].find((s) => s.id == active),
  );
  const activeIsDebt = $derived(liabilities.some((s) => s.id == active));
  const share = $derived.by(() => {
    if (!activeSeg) return "";
    const total = activeIsDebt ? debtTotal : assetTotal;
    const pct = Math.round((mid(activeSeg) / total) * 100);
    return `${pct}% of ${activeIsDebt ? "debts" : "assets"}`;
  });

  const summary = $derived(
    `Assets ${money(assetTotal)}: ` +
      bySize(assets)
        .map((s) => `${s.label} ${money(mid(s))}`)
        .join(", ") +
      (liabilities.length
        ? `. Debts ${money(debtTotal)}: ` +
          bySize(liabilities)
            .map((s) => `${s.label} ${money(mid(s))}`)
            .join(", ")
        : ""),
  );
</script>

<!-- Holding a finger on a slice highlights it; don't let that become a long-press menu. -->
<div class="donut" oncontextmenu={(e) => e.preventDefault()}>
  <svg viewBox="0 0 {SIZE} {SIZE}" role="img" aria-label={summary}>
    {#if outer.length == 0 && inner.length == 0}
      <!-- Nothing to show (e.g. filtered to items without values): keep the donut's outline. -->
      <circle class="track" cx={C} cy={C} r={(OUTER + HOLE) / 2} stroke-width={OUTER - HOLE} />
    {/if}

    {#each [{ list: outer, ...rings.asset, cls: "asset" }, { list: inner, ...rings.debt, cls: "debt" }] as ring (ring.cls)}
      {#each ring.list as arc (arc.seg.id)}
        <g
          class="slice {ring.cls}"
          class:dim={activeSeg != undefined && active != arc.seg.id}
          style:--shade={arc.shade}
          role="presentation"
          onpointerenter={() => (active = arc.seg.id)}
          onpointerleave={() => (active = undefined)}
          onpointercancel={() => (active = undefined)}
          onpointerdown={() => (active = arc.seg.id)}
        >
          {#if arc.full}
            <circle class="mark" cx={C} cy={C} r={ring.r} stroke-width={ring.w} />
            <circle class="hit" cx={C} cy={C} r={ring.r} style:stroke-width={Math.max(ring.w, 16)} />
          {:else}
            <path class="mark" d={arc.d} stroke-width={ring.w} />
            <path class="hit" d={arc.d} style:stroke-width={Math.max(ring.w, 16)} />
          {/if}
        </g>
      {/each}
    {/each}
  </svg>

  <div class="centre" aria-live="polite">
    {#if activeSeg}
      <span class="caption">{activeSeg.label}</span>
      {@const sign = activeIsDebt ? "−" : ""}
      <span class="value">{sign}{money(mid(activeSeg))}</span>
      {#if spread(activeSeg.low, activeSeg.high) > 0}
        <span class="caption">±{money(spread(activeSeg.low, activeSeg.high))}</span>
      {/if}
      <span class="caption">{share}</span>
    {:else}
      <span class="caption">{caption}</span>
      <span class="value">{money((low + high) / 2)}</span>
      {#if spread(low, high) > 0}
        <span class="caption">±{money(spread(low, high))}</span>
      {/if}
      <span class="caption">{dateShort(date)}</span>
    {/if}
  </div>
</div>

<style>
  .donut {
    position: relative;
    width: min(100%, 17rem);
    aspect-ratio: 1;
    margin-inline: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .track {
    fill: none;
    stroke: --translucent(var(--m3c-on-surface), 0.08);
  }
  .mark {
    fill: none;
    stroke-linecap: butt;
    transition: opacity var(--m3-easing-fast);
  }
  .asset .mark {
    stroke: color-mix(in oklab, var(--viz-asset), var(--m3c-surface) var(--shade));
  }
  .debt .mark {
    stroke: color-mix(in oklab, var(--viz-debt), var(--m3c-surface) var(--shade));
  }
  .slice.dim .mark {
    opacity: 0.3;
  }
  /* Invisible stroke at least 16px wide, so thin rings are still easy to tap. */
  .hit {
    fill: none;
    stroke: transparent;
    pointer-events: stroke;
    cursor: pointer;
  }

  .centre {
    position: absolute;
    inset: 22%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    text-align: center;
    pointer-events: none;
    color: var(--m3c-on-surface);
  }
  .caption {
    @apply --m3-label-medium;
    color: var(--m3c-on-surface-variant);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value {
    @apply --m3-headline-small;
    font-weight: 500;
    white-space: nowrap;
  }
</style>
