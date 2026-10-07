import type { Combination } from './data';
import type { PaletteExport } from './export';
import { buildScale, SPREAD, type Spacing } from './shades';

export function comboTitle(id: number): string {
  return `Sanzo Wada ${String(id).padStart(3, '0')}`;
}

export function buildPalette(combo: Combination, lighter: number, darker: number, spacing: Spacing = SPREAD): PaletteExport {
  return {
    title: comboTitle(combo.id),
    scales: combo.colors.map((c) => buildScale(c, lighter, darker, spacing)),
  };
}

/** e.g. sanzo-wada-042-d2-l2.gpl, or sanzo-wada-042-d2-l2-step8.gpl with fixed spacing. */
export function paletteFileName(
  combo: Combination,
  lighter: number,
  darker: number,
  ext: string,
  spacing: Spacing = SPREAD,
): string {
  const suffix = spacing.mode === 'fixed' ? `-step${Math.round(spacing.size * 100)}` : '';
  return `sanzo-wada-${String(combo.id).padStart(3, '0')}-d${darker}-l${lighter}${suffix}.${ext}`;
}
