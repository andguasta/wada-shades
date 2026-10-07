import type { ShadeScale } from '../shades';

export interface PaletteExport {
  /** Palette title, e.g. "Sanzo Wada 042". */
  title: string;
  scales: ShadeScale[];
}

/** Turns a palette into a downloadable file. One implementation per format. */
export interface Exporter {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  serialize(palette: PaletteExport): string;
}
