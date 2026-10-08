import type { ShadeScale } from '../shades';

export interface PaletteExport {
  /** Palette title, e.g. "Sanzo Wada 042". */
  title: string;
  scales: ShadeScale[];
  /**
   * When set, shorter scales are padded with this colour so every row has
   * the same length and the base colours line up in one column.
   */
  filler?: [number, number, number];
}

/** Turns a palette into a downloadable file. One implementation per format. */
export interface Exporter {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  serialize(palette: PaletteExport): string;
}
