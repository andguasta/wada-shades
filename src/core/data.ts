import rawColors from '../data/colors.json';

/** A colour from Sanzo Wada's dictionary (dataset by mattdesl, MIT). */
export interface WadaColor {
  /** Position in the dataset, stable identifier. */
  index: number;
  /** Corrected name (see NAME_FIXES). */
  name: string;
  /** Name exactly as in the source dataset. */
  sourceName: string;
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

/**
 * Spelling fixes applied on top of the untouched source dataset.
 * Wada's names come from Robert Ridgway's "Color Standards and Color
 * Nomenclature" (1912); misspellings are restored to Ridgway's spelling,
 * and the A/B variants use one consistent suffix format.
 */
export const NAME_FIXES: Readonly<Record<string, string>> = {
  'Eugenia Red | A': 'Eugenia Red A',
  'Eugenia Red | B': 'Eugenia Red B',
  'Grayish Lavender - A': 'Grayish Lavender A',
  'Grayish Lavender - B': 'Grayish Lavender B',
  'Rosolanc Purple': 'Rosolane Purple',
  'Pomegranite Purple': 'Pomegranate Purple',
  'Vistoris Lake': 'Victoria Lake',
  'Sulpher Yellow': 'Sulphur Yellow',
  'Krongbergs Green': "Kronberg's Green",
  'Artemesia Green': 'Artemisia Green',
  'Calamine BLue': 'Calamine Blue',
  'Cerulian Blue': 'Cerulean Blue',
  'Antwarp Blue': 'Antwerp Blue',
  "Vandar Poel's Blue": "Vanderpoel's Blue",
  'Veronia Purple': 'Vernonia Purple',
};

export const colors: WadaColor[] = (rawColors as RawColor[]).map((c, index) => ({
  index,
  name: NAME_FIXES[c.name] ?? c.name,
  sourceName: c.name,
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

const combinationById = new Map(combinations.map((c) => [c.id, c]));

export function getCombination(id: number): Combination | undefined {
  return combinationById.get(id);
}

/** The other combinations that use this colour, sorted by id. */
export function relatedCombinations(color: WadaColor, excludeId?: number): Combination[] {
  return color.combinations
    .filter((id) => id !== excludeId)
    .sort((a, b) => a - b)
    .map((id) => combinationById.get(id)!);
}
