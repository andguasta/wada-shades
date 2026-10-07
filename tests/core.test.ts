import { converter } from 'culori';
import { describe, expect, it } from 'vitest';
import { colors, combinations, getCombination, NAME_FIXES, relatedCombinations } from '../src/core/data';
import { toGpl } from '../src/core/export/gpl';
import { buildPalette, paletteFileName } from '../src/core/palette';
import { nearestColors, parseHexColor } from '../src/core/nearest';
import { buildScale, MAX_STEPS, MAX_STEP_SIZE, MIN_STEP_SIZE } from '../src/core/shades';
import { feColorMatrixValues, simulate } from '../src/core/vision';

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

describe('fixed spacing', () => {
  const fixed = (size: number) => ({ mode: 'fixed', size }) as const;

  it('moves lightness by the fixed amount when the colour has room', () => {
    const violet = colors.find((c) => c.name === 'Violet')!;
    const { shades } = buildScale(violet, 2, 2, fixed(0.08));
    const ls = shades.map((s) => lightness(s.hex));
    // Rounding to 8-bit RGB moves lightness by a few thousandths at most.
    for (const [i, delta] of [[0, -0.16], [1, -0.08], [3, 0.08], [4, 0.16]] as const) {
      expect(ls[i] - ls[2]).toBeCloseTo(delta, 2);
    }
  });

  it('keeps steps closer to the base than spread spacing', () => {
    const violet = colors.find((c) => c.name === 'Violet')!;
    const spread = buildScale(violet, 2, 2).shades.map((s) => lightness(s.hex));
    const close = buildScale(violet, 2, 2, fixed(0.06)).shades.map((s) => lightness(s.hex));
    expect(close[4] - close[2]).toBeLessThan(spread[4] - spread[2]);
    expect(close[2] - close[0]).toBeLessThan(spread[2] - spread[0]);
  });

  it('shrinks steps instead of piling them up when the colour lacks room', () => {
    for (const color of colors) {
      for (const size of [MIN_STEP_SIZE, 0.08, MAX_STEP_SIZE]) {
        const { shades } = buildScale(color, 4, 4, fixed(size));
        expect(shades[4].hex).toBe(color.hex);
        const ls = shades.map((s) => lightness(s.hex));
        for (let i = 1; i < ls.length; i++) {
          if (color.hex === '#ffffff' && i > 4) expect(shades[i].hex).toBe('#ffffff');
          else expect(ls[i]).toBeGreaterThan(ls[i - 1]);
        }
      }
    }
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
    expect(paletteFileName(getCombination(42)!, 2, 3, 'gpl', { mode: 'fixed', size: 0.08 })).toBe(
      'sanzo-wada-042-d3-l2-step8.gpl',
    );
  });
});

describe('nearestColors', () => {
  it('parses full hex colours only', () => {
    expect(parseHexColor('#ABC')).toBe('#aabbcc');
    expect(parseHexColor(' aabbcc ')).toBe('#aabbcc');
    expect(parseHexColor('#aabbcc')).toBe('#aabbcc');
    expect(parseHexColor('abc')).toBeNull();
    expect(parseHexColor('123')).toBeNull();
    expect(parseHexColor('#12345')).toBeNull();
    expect(parseHexColor('blue')).toBeNull();
  });

  it('finds an exact dataset colour first with zero distance', () => {
    for (const color of colors) {
      const [first] = nearestColors(color.hex, 1);
      expect(first.deltaE).toBeCloseTo(0, 6);
      expect(first.color.hex).toBe(color.hex);
    }
  });

  it('returns matches sorted by distance', () => {
    const matches = nearestColors('#3a5f8b', 5);
    expect(matches).toHaveLength(5);
    for (let i = 1; i < matches.length; i++) expect(matches[i].deltaE).toBeGreaterThanOrEqual(matches[i - 1].deltaE);
  });
});

describe('vision simulation', () => {
  it('leaves greys unchanged and keeps normal vision as is', () => {
    for (const mode of ['protan', 'deutan'] as const) {
      for (const v of [0, 64, 128, 200, 255]) expect(simulate([v, v, v], mode)).toEqual([v, v, v]);
    }
    expect(simulate([200, 30, 40], 'normal')).toEqual([200, 30, 40]);
  });

  it('collapses red and green towards the same hue', () => {
    for (const mode of ['protan', 'deutan'] as const) {
      const [r1, g1] = simulate([220, 40, 40], mode);
      const [r2, g2] = simulate([40, 160, 40], mode);
      // Red and green both turn into olive or yellowish tones: red no longer dominates green.
      expect(Math.abs(r1 - g1)).toBeLessThan(60);
      expect(Math.abs(r2 - g2)).toBeLessThan(60);
    }
  });

  it('builds a 20-value feColorMatrix', () => {
    expect(feColorMatrixValues('deutan').split(' ')).toHaveLength(20);
  });
});
