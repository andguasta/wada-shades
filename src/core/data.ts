import rawColors from '../data/colors.json';

/** A colour from Sanzo Wada's dictionary (dataset by mattdesl, MIT). */
export interface WadaColor {
  /** Position in the dataset, stable identifier. */
  index: number;
  name: string;
  hex: string;
  rgb: [number, number, number];
  cmyk: [number, number, number, number];
  /** Swatch chapter (0 to 5) the colour belongs to in the book. */
  swatch: number;
  combinations: number[];
}

/** One of the 348 combinations in the book. */
export interface Combination {
  id: number;
  colors: WadaColor[];
}

interface RawColor {
  name: string;
  hex: string;
  rgb: number[];
  cmyk: number[];
  swatch: number;
  combinations: number[];
}

export const colors: WadaColor[] = (rawColors as RawColor[]).map((c, index) => ({
  index,
  name: c.name,
  hex: c.hex.toLowerCase(),
  rgb: [c.rgb[0], c.rgb[1], c.rgb[2]],
  cmyk: [c.cmyk[0], c.cmyk[1], c.cmyk[2], c.cmyk[3]],
  swatch: c.swatch,
  combinations: c.combinations,
}));

/** Combinations sorted by id; colours keep the dataset order. */
export const combinations: Combination[] = (() => {
  const byId = new Map<number, WadaColor[]>();
  for (const color of colors) {
    for (const id of color.combinations) {
      const list = byId.get(id);
      if (list) list.push(color);
      else byId.set(id, [color]);
    }
  }
  return [...byId.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, list]) => ({ id, colors: list }));
})();

export function getCombination(id: number): Combination | undefined {
  return combinations.find((c) => c.id === id);
}
