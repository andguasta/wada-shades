import type { Combination } from './data';
import type { PaletteExport } from './export';
import { buildScale, DEFAULT_OPTIONS, type ScaleOptions } from './shades';

export function comboTitle(id: number): string {
  return `Sanzo Wada ${String(id).padStart(3, '0')}`;
}

export function buildPalette(
  combo: Combination,
  lighter: number,
  darker: number,
  options: ScaleOptions = DEFAULT_OPTIONS,
): PaletteExport {
  return {
    title: comboTitle(combo.id),
    scales: combo.colors.map((c) => buildScale(c, lighter, darker, options)),
  };
}

/** e.g. sanzo-wada-042-d2-l2.gpl; fixed spacing adds -step8, hue shift adds -hue10. */
export function paletteFileName(
  combo: Combination,
  lighter: number,
  darker: number,
  ext: string,
  options: ScaleOptions = DEFAULT_OPTIONS,
): string {
  const step = options.spacing.mode === 'fixed' ? `-step${Math.round(options.spacing.size * 100)}` : '';
  const hue = options.hueShift > 0 ? `-hue${Math.round(options.hueShift)}` : '';
  return `sanzo-wada-${String(combo.id).padStart(3, '0')}-d${darker}-l${lighter}${step}${hue}.${ext}`;
}
