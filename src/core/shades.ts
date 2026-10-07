import { clampChroma, converter } from 'culori';
import type { WadaColor } from './data';

/**
 * Shade generation in OKLCH.
 *
 * Lighter steps move lightness from the base colour towards LIGHT_LIMIT,
 * darker steps towards DARK_LIMIT. Steps are evenly spaced and the limits
 * themselves are never reached, so no step collapses to white or black.
 * Hue is kept constant. Chroma tapers towards zero as lightness approaches
 * the limits (white and black have no chroma), and anything still outside
 * sRGB is gamut mapped by reducing chroma at fixed lightness and hue.
 * The base colour is never recomputed: its original RGB values are used.
 * A base already beyond a limit (e.g. White) yields steps equal to itself
 * on that side, since nothing lighter (or darker) exists.
 */
export const LIGHT_LIMIT = 0.99;
export const DARK_LIMIT = 0.1;
/** Exponent of the chroma taper: C = C0 * (1 - t^CHROMA_TAPER). */
export const CHROMA_TAPER = 2;
export const MAX_STEPS = 10;

export type ShadeKind = 'dark' | 'base' | 'light';

export interface Shade {
  kind: ShadeKind;
  /** 0 for the base, 1..n moving away from it. */
  step: number;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export interface ShadeScale {
  base: WadaColor;
  /** Ordered from darkest to lightest; the base sits between darks and lights. */
  shades: Shade[];
}

const toOklch = converter('oklch');
const toRgb = converter('rgb');

function clampSteps(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_STEPS, Math.max(0, Math.round(n)));
}

function channel(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v * 255)));
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function shadeAt(base: WadaColor, kind: 'dark' | 'light', step: number, count: number): Shade {
  const lch = toOklch(base.hex);
  if (!lch) throw new Error(`Invalid colour ${base.hex}`);
  const target = kind === 'light' ? Math.max(LIGHT_LIMIT, lch.l) : Math.min(DARK_LIMIT, lch.l);
  const t = step / (count + 1);
  const l = lch.l + (target - lch.l) * t;
  const c = (lch.c ?? 0) * (1 - Math.pow(t, CHROMA_TAPER));
  const mapped = toRgb(clampChroma({ mode: 'oklch', l, c, h: lch.h }, 'oklch', 'rgb'));
  const rgb: [number, number, number] = [channel(mapped.r), channel(mapped.g), channel(mapped.b)];
  return {
    kind,
    step,
    name: `${base.name} ${kind} ${step}`,
    hex: toHex(rgb),
    rgb,
  };
}

export function buildScale(base: WadaColor, lighter: number, darker: number): ShadeScale {
  const nLight = clampSteps(lighter);
  const nDark = clampSteps(darker);
  const darks: Shade[] = [];
  for (let i = nDark; i >= 1; i--) darks.push(shadeAt(base, 'dark', i, nDark));
  const lights: Shade[] = [];
  for (let i = 1; i <= nLight; i++) lights.push(shadeAt(base, 'light', i, nLight));
  const baseShade: Shade = {
    kind: 'base',
    step: 0,
    name: base.name,
    hex: base.hex,
    rgb: [...base.rgb],
  };
  return { base, shades: [...darks, baseShade, ...lights] };
}
