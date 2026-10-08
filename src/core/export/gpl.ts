import { alignRows } from '../palette';
import type { Exporter, PaletteExport } from './types';

/**
 * GIMP palette (.gpl). One row per base colour, ordered dark to light.
 * Colours can have different numbers of steps: without a filler the rows are
 * written back to back and Columns is the longest row; with a filler the
 * shorter rows are padded so the base colours line up in one column.
 */
function sanitize(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').trim();
}

export const FILLER_NAME = 'Filler';

function entry([r, g, b]: [number, number, number], name: string): string {
  const [pr, pg, pb] = [r, g, b].map((v) => String(v).padStart(3, ' '));
  return `${pr} ${pg} ${pb}\t${sanitize(name)}`;
}

export function toGpl(palette: PaletteExport): string {
  const { darker, lighter, rows } = alignRows(palette.scales);
  const columns = palette.filler
    ? darker + lighter + 1
    : Math.max(0, ...palette.scales.map((s) => s.shades.length));
  const lines = ['GIMP Palette', `Name: ${sanitize(palette.title)}`, `Columns: ${columns}`, '#'];
  for (const row of rows) {
    for (const shade of row) {
      if (shade) lines.push(entry(shade.rgb, shade.name));
      else if (palette.filler) lines.push(entry(palette.filler, FILLER_NAME));
    }
  }
  return lines.join('\n') + '\n';
}

export const gplExporter: Exporter = {
  id: 'gpl',
  label: 'GIMP palette (.gpl)',
  extension: 'gpl',
  mimeType: 'text/plain',
  serialize: toGpl,
};
