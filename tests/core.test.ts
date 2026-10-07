import { converter } from 'culori';
import { describe, expect, it } from 'vitest';
import { colors, combinations, getCombination, NAME_FIXES, relatedCombinations } from '../src/core/data';
import { toGpl } from '../src/core/export/gpl';
import { buildPalette, paletteFileName } from '../src/core/palette';
import { buildScale, MAX_STEPS } from '../src/core/shades';

const toOklch = converter('oklch');
const lightness = (hex: string) => toOklch(hex)!.l;

describe('dataset', () => {
  it('has 159 colours and 348 combinations of 2 to 4 colours', () => {
    expect(colors).toHaveLength(159);
    expect(combinations).toHaveLength(348);
    expect(combinations.map((c) => c.id)).toEqual(Array.from({ length: 348 }, (_, i) => i + 1));
    for (const c of combinations) {
      expect(c.colors.length).toBeGreaterThanOrEqual(2);
      expect(c.colors.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('names', () => {
  it('applies every fix to an existing source name and keeps names unique', () => {
    const sourceNames = new Set(colors.map((c) => c.sourceName));
    for (const wrong of Object.keys(NAME_FIXES)) expect(sourceNames.has(wrong)).toBe(true);
    expect(new Set(colors.map((c) => c.name)).size).toBe(colors.length);
    expect(colors.find((c) => c.sourceName === 'Calamine BLue')!.name).toBe('Calamine Blue');
  });
});

describe('relatedCombinations', () => {
  it('lists the other combinations containing the colour', () => {
    for (const combo of combinations) {
      for (const color of combo.colors) {
        const related = relatedCombinations(color, combo.id);
        expect(related).toHaveLength(color.combinations.length - 1);
        for (const r of related) {
          expect(r.id).not.toBe(combo.id);
          expect(r.colors).toContain(color);
        }
        expect(related.map((r) => r.id)).toEqual([...related.map((r) => r.id)].sort((a, b) => a - b));
      }
    }
  });
});

describe('buildScale', () => {
  it('keeps the base colour exactly and orders shades dark to light', () => {
    for (const color of colors) {
      const { shades } = buildScale(color, 3, 3);
      expect(shades).toHaveLength(7);
      const base = shades[3];
      expect(base.kind).toBe('base');
      expect(base.hex).toBe(color.hex);
      expect(base.rgb).toEqual(color.rgb);
      const ls = shades.map((s) => lightness(s.hex));
      // Strictly monotonic, except a white base which has nothing lighter.
      for (let i = 1; i < ls.length; i++) {
        if (color.hex === '#ffffff' && i > 3) expect(shades[i].hex).toBe('#ffffff');
        else expect(ls[i]).toBeGreaterThan(ls[i - 1]);
      }
    }
  });

  it('produces valid sRGB channels and matching hex', () => {
    for (const color of colors) {
      for (const s of buildScale(color, 4, 4).shades) {
        for (const v of s.rgb) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(255);
        }
        expect(s.hex).toBe('#' + s.rgb.map((v) => v.toString(16).padStart(2, '0')).join(''));
      }
    }
  });

  it('keeps hue close to the base for chromatic colours', () => {
    const hueDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
    for (const color of colors) {
      const base = toOklch(color.hex)!;
      if ((base.c ?? 0) < 0.04) continue;
      for (const s of buildScale(color, 2, 2).shades) {
        const lch = toOklch(s.hex)!;
        if ((lch.c ?? 0) < 0.03) continue;
        expect(hueDiff(lch.h!, base.h!)).toBeLessThan(3);
      }
    }
  });

  it('supports zero steps and clamps out of range counts', () => {
    expect(buildScale(colors[0], 0, 0).shades).toHaveLength(1);
    expect(buildScale(colors[0], 99, -3).shades).toHaveLength(MAX_STEPS + 1);
  });
});

describe('gpl export', () => {
  it('serializes a combination as a GIMP palette', () => {
    const combo = getCombination(1)!;
    const text = toGpl(buildPalette(combo, 2, 2));
    const lines = text.trimEnd().split('\n');
    expect(lines.slice(0, 4)).toEqual(['GIMP Palette', 'Name: Sanzo Wada 001', 'Columns: 5', '#']);
    const rows = lines.slice(4);
    expect(rows).toHaveLength(combo.colors.length * 5);
    for (const row of rows) expect(row).toMatch(/^[ \d]{3} [ \d]{3} [ \d]{3}\t\S.*$/);
    const [r, g, b] = combo.colors[0].rgb;
    expect(rows[2]).toBe(
      `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${combo.colors[0].name}`,
    );
  });

  it('builds a descriptive file name', () => {
    expect(paletteFileName(getCombination(42)!, 2, 3, 'gpl')).toBe('sanzo-wada-042-d3-l2.gpl');
  });
});
