import { differenceEuclidean } from 'culori';
import { colors, type WadaColor } from './data';

export interface ColorMatch {
  color: WadaColor;
  /** ΔE OK ×100; about 2 is barely noticeable. */
  deltaE: number;
}

const deltaEOK = differenceEuclidean('oklab');

// A bare 3-character value is not a colour, so "123" and "bad" stay number and name searches.
export function parseHexColor(input: string): string | null {
  const q = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(q);
  if (m) return '#' + [...m[1]].map((ch) => ch + ch).join('');
  m = /^#?([0-9a-f]{6})$/.exec(q);
  return m ? '#' + m[1] : null;
}

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
