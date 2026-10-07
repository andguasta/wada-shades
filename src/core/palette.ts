import type { Combination } from './data';
import type { PaletteExport } from './export';
import { buildScale } from './shades';

export function comboTitle(id: number): string {
  return `Sanzo Wada ${String(id).padStart(3, '0')}`;
}

export function buildPalette(combo: Combination, lighter: number, darker: number): PaletteExport {
  return {
    title: comboTitle(combo.id),
    scales: combo.colors.map((c) => buildScale(c, lighter, darker)),
  };
}

export function paletteFileName(combo: Combination, lighter: number, darker: number, ext: string): string {
  return `sanzo-wada-${String(combo.id).padStart(3, '0')}-d${darker}-l${lighter}.${ext}`;
}
