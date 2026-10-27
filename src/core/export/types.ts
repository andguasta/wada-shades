import type { ShadeScale } from '../shades';

export interface PaletteExport {
  title: string;
  scales: ShadeScale[];
  /** Pads shorter rows so the base colours share a column. */
  filler?: [number, number, number];
}

export interface Exporter {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  serialize(palette: PaletteExport): string;
}
