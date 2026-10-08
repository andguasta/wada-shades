import type { Combination } from './data';
import type { PaletteExport } from './export';
import { buildScale, DEFAULT_OPTIONS, type ScaleOptions, type Shade, type ShadeScale } from './shades';
import { sameCounts, stepsLabel, type StepCounts } from './steps';

export function comboTitle(id: number): string {
  return `Sanzo Wada ${String(id).padStart(3, '0')}`;
}

/** One StepCounts per colour of the combination, in order. */
export function buildPalette(
  combo: Combination,
  counts: StepCounts[],
  options: ScaleOptions = DEFAULT_OPTIONS,
): PaletteExport {
  return {
    title: comboTitle(combo.id),
    scales: combo.colors.map((c, i) => {
      const { darker, lighter } = counts[i] ?? counts[0];
      return buildScale(c, lighter, darker, options);
    }),
  };
}

/**
 * Scales padded to a common length so the base colours line up: each row,
 * dark to light, has `darker` cells before the base and `lighter` after it,
 * with null where a colour has fewer steps.
 */
export function alignRows(scales: ShadeScale[]): { darker: number; lighter: number; rows: (Shade | null)[][] } {
  const count = (s: ShadeScale, kind: Shade['kind']) => s.shades.filter((x) => x.kind === kind).length;
  const darker = Math.max(0, ...scales.map((s) => count(s, 'dark')));
  const lighter = Math.max(0, ...scales.map((s) => count(s, 'light')));
  const rows = scales.map((s) => [
    ...Array<null>(darker - count(s, 'dark')).fill(null),
    ...s.shades,
    ...Array<null>(lighter - count(s, 'light')).fill(null),
  ]);
  return { darker, lighter, rows };
}

/**
 * e.g. sanzo-wada-042-d2-l2.gpl; colours with their own counts give
 * -d4.2.1-l2.1.3, fixed spacing adds -step8, hue shift -hue10, and a filler
 * that pads uneven rows -fill.
 */
export function paletteFileName(
  combo: Combination,
  counts: StepCounts[],
  ext: string,
  options: ScaleOptions = DEFAULT_OPTIONS,
  filler = false,
): string {
  const step = options.spacing.mode === 'fixed' ? `-step${Math.round(options.spacing.size * 100)}` : '';
  const hue = options.hueShift > 0 ? `-hue${Math.round(options.hueShift)}` : '';
  const fill = filler && !sameCounts(counts) ? '-fill' : '';
  return `sanzo-wada-${String(combo.id).padStart(3, '0')}-${stepsLabel(counts)}${step}${hue}${fill}.${ext}`;
}
