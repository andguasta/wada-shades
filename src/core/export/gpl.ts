import type { Exporter, PaletteExport } from './types';

/**
 * GIMP palette (.gpl). One row per base colour, ordered dark to light,
 * so Columns equals the number of shades per scale.
 */
function sanitize(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').trim();
}

export function toGpl(palette: PaletteExport): string {
  const columns = palette.scales[0]?.shades.length ?? 0;
  const lines = ['GIMP Palette', `Name: ${sanitize(palette.title)}`, `Columns: ${columns}`, '#'];
  for (const scale of palette.scales) {
    for (const shade of scale.shades) {
      const [r, g, b] = shade.rgb.map((v) => String(v).padStart(3, ' '));
      lines.push(`${r} ${g} ${b}\t${sanitize(shade.name)}`);
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
