<script lang="ts">
  import { dateMonthYear, dateShort, formatRange, moneyCompact } from "./format";
  import { parseDate } from "./model";

  type Point = { date: string; low: number; high: number };
  let { points, today }: { points: Point[]; today: string } = $props();

  let width = $state(320);
  const height = 240;
  const pad = { top: 12, right: 12, bottom: 28, left: 56 };

  const t0 = $derived(parseDate(points[0].date));
  const t1 = $derived(parseDate(points[points.length - 1].date));
  const extent = $derived.by(() => {
    let min = Math.min(0, ...points.map((p) => p.low));
    let max = Math.max(0, ...points.map((p) => p.high));
    if (min == max) max = min + 1;
    return { min, max };
  });

  // "Nice" ticks so the axis reads £0, £50K, £100K… rather than odd numbers.
  const ticks = $derived.by(() => {
    const span = extent.max - extent.min;
    const raw = span / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
    const out: number[] = [];
    for (let v = Math.floor(extent.min / step) * step; v <= extent.max + step * 0.001; v += step)
      out.push(v);
    if (out.at(-1)! < extent.max) out.push(out.at(-1)! + step);
    return out;
  });
  const yMin = $derived(ticks[0]);
  const yMax = $derived(ticks.at(-1)!);

  const x = (date: string) =>
    pad.left + ((parseDate(date) - t0) / (t1 - t0 || 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);

  const band = $derived(
    points.map((p) => `${x(p.date)},${y(p.high)}`).join(" L") +
      " L" +
      [...points]
        .reverse()
        .map((p) => `${x(p.date)},${y(p.low)}`)
        .join(" L"),
  );
  const mid = $derived(points.map((p) => `${x(p.date)},${y((p.low + p.high) / 2)}`).join(" L"));

  const xTicks = $derived.by(() => {
    const n = width < 420 ? 3 : 5;
    return Array.from({ length: n }, (_, i) => points[Math.round((i * (points.length - 1)) / (n - 1))].date);
  });
  const showToday = $derived(parseDate(today) > t0 && parseDate(today) < t1);

  let hover = $state<number | undefined>();
  const onmove = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++)
      if (Math.abs(x(points[i].date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    hover = best;
  };
  const hp = $derived(hover == undefined ? undefined : points[hover]);
</script>

<div class="chart" bind:clientWidth={width}>
  <svg
    {width}
    {height}
    role="img"
    aria-label="Estimated net worth range over time"
    onpointermove={onmove}
    onpointerdown={onmove}
    onpointerleave={() => (hover = undefined)}
    onpointercancel={() => (hover = undefined)}
  >
    {#each ticks as t (t)}
      <line class="grid" class:zero={t == 0} x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
      <text class="axis" x={pad.left - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">
        {moneyCompact(t)}
      </text>
    {/each}
    {#each xTicks as d, i (d + i)}
      <text
        class="axis"
        x={x(d)}
        y={height - 8}
        text-anchor={i == 0 ? "start" : i == xTicks.length - 1 ? "end" : "middle"}
      >
        {dateMonthYear(d)}
      </text>
    {/each}

    <path class="band" d={`M${band} Z`} />
    <path class="mid" d={`M${mid}`} />

    {#if showToday}
      <line class="today" x1={x(today)} x2={x(today)} y1={pad.top} y2={height - pad.bottom} />
      <text class="today-label" x={x(today) + 4} y={pad.top + 10}>Today</text>
    {/if}

    {#if hp}
      <line class="cross" x1={x(hp.date)} x2={x(hp.date)} y1={pad.top} y2={height - pad.bottom} />
      <circle class="dot" cx={x(hp.date)} cy={y(hp.high)} r="4" />
      <circle class="dot" cx={x(hp.date)} cy={y(hp.low)} r="4" />
    {/if}
  </svg>

  {#if hp}
    <div
      class="tooltip"
      style:left="{Math.min(Math.max(x(hp.date), 90), width - 90)}px"
      style:top="{Math.max(y(hp.high) - 12, 0)}px"
    >
      <span class="t-date">{dateShort(hp.date)}</span>
      <span class="t-value">{formatRange(hp.low, hp.high)}</span>
    </div>
  {/if}
</div>

<style>
  .chart {
    position: relative;
    width: 100%;
    user-select: none;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--m3c-outline-variant);
    stroke-width: 1;
  }
  .grid.zero {
    stroke: var(--m3c-outline);
  }
  .axis {
    @apply --m3-label-small;
    fill: var(--m3c-on-surface-variant);
    font-variant-numeric: tabular-nums;
  }
  .band {
    fill: --translucent(var(--m3c-primary), 0.22);
    stroke: none;
  }
  .mid {
    fill: none;
    stroke: var(--m3c-primary);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .today {
    stroke: var(--m3c-tertiary);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
  }
  .today-label {
    @apply --m3-label-small;
    fill: var(--m3c-on-surface-variant);
  }
  .cross {
    stroke: var(--m3c-on-surface-variant);
    stroke-width: 1;
  }
  .dot {
    fill: var(--m3c-primary);
    stroke: var(--m3c-surface);
    stroke-width: 2;
  }
  .tooltip {
    position: absolute;
    transform: translate(-50%, -100%);
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.75rem;
    border-radius: var(--m3-shape-small);
    background-color: var(--m3c-inverse-surface);
    color: var(--m3c-inverse-on-surface);
    pointer-events: none;
    white-space: nowrap;
    box-shadow: var(--m3-elevation-2);
  }
  .t-date {
    @apply --m3-label-small;
  }
  .t-value {
    @apply --m3-label-large;
    font-variant-numeric: tabular-nums;
  }
</style>
