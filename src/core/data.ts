import rawColors from '../data/colors.json';

export interface WadaColor {
  index: number;
  name: string;
  sourceName: string;
  hex: string;
  rgb: [number, number, number];
  cmyk: [number, number, number, number];
  swatch: number;
  combinations: number[];
}

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

// colors.json stays untouched; spelling follows Ridgway's Color Standards and Color Nomenclature (1912).
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

export function relatedCombinations(color: WadaColor, excludeId?: number): Combination[] {
  return color.combinations
    .filter((id) => id !== excludeId)
    .sort((a, b) => a - b)
    .map((id) => combinationById.get(id)!);
}
