import { differenceEuclidean } from 'culori';
import { colors, type WadaColor } from './data';

export interface ColorMatch {
  color: WadaColor;
  /** Perceptual distance ΔE OK (Euclidean in OKLab), scaled ×100; about 2 is barely noticeable. */
  deltaE: number;
}

const deltaEOK = differenceEuclidean('oklab');

/**
 * Returns a normalised "#rrggbb" when the input is a full hex colour:
 * "#abc", "#aabbcc" or "aabbcc". A bare 3-character value is not accepted,
 * so short numbers and words keep working as number and name searches.
 */
export function parseHexColor(input: string): string | null {
  const q = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(q);
  if (m) return '#' + [...m[1]].map((ch) => ch + ch).join('');
  m = /^#?([0-9a-f]{6})$/.exec(q);
  return m ? '#' + m[1] : null;
}

/** The Wada colours closest to hex, nearest first. */
export function nearestColors(hex: string, limit = 5): ColorMatch[] {
  return colors
    .map((color) => ({ color, deltaE: deltaEOK(hex, color.hex) * 100 }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, limit);
}

export function describeDistance(deltaE: number): string {
  if (deltaE < 2) return 'almost identical';
  if (deltaE < 5) return 'very close';
  if (deltaE < 10) return 'close';
  return 'distant';
}
