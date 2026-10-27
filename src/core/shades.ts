import { clampChroma, converter } from 'culori';
import type { WadaColor } from './data';

// Shades in OKLCH. The base colour keeps its dataset RGB and is never recomputed.
// Gamut mapping uses clampChroma, which keeps L and H (toGamut drifted hue up to 9°).
export const LIGHT_LIMIT = 0.99;
export const DARK_LIMIT = 0.1;
/** C = C0 * (1 - t^CHROMA_TAPER) */
export const CHROMA_TAPER = 2;
export const MAX_STEPS = 8;

export const MIN_STEP_SIZE = 0.02;
export const MAX_STEP_SIZE = 0.2;
export const DEFAULT_STEP_SIZE = 0.08;

export type Spacing = { mode: 'spread' } | { mode: 'fixed'; size: number };

export const SPREAD: Spacing = { mode: 'spread' };

export const MAX_HUE_SHIFT = 30;
export const LIGHT_HUE_TARGET = 100;
export const DARK_HUE_TARGET = 280;

export interface ScaleOptions {
  spacing: Spacing;
  hueShift: number;
}

export const DEFAULT_OPTIONS: ScaleOptions = { spacing: SPREAD, hueShift: 0 };

export function clampHueShift(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.min(MAX_HUE_SHIFT, Math.max(0, deg));
}

export function rotateHueTowards(hue: number, target: number, maxDeg: number): number {
  const diff = ((target - hue + 540) % 360) - 180; // signed, in (-180, 180]
  const move = Math.sign(diff) * Math.min(Math.abs(diff), maxDeg);
  return (hue + move + 360) % 360;
}

export function clampStepSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_STEP_SIZE;
  return Math.min(MAX_STEP_SIZE, Math.max(MIN_STEP_SIZE, size));
}

export type ShadeKind = 'dark' | 'base' | 'light';

export interface Shade {
  kind: ShadeKind;
  step: number;
  /** The step could not move its full amount: it stopped at the limit. */
  limited: boolean;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export interface ShadeScale {
  base: WadaColor;
  /** Darkest to lightest. */
  shades: Shade[];
}

const toOklch = converter('oklch');
const toRgb = converter('rgb');

export function clampSteps(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_STEPS, Math.max(0, Math.round(n)));
}

function channel(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v * 255)));
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function shadeAt(base: WadaColor, kind: 'dark' | 'light', step: number, count: number, options: ScaleOptions): Shade {
  const lch = toOklch(base.hex);
  if (!lch) throw new Error(`Invalid colour ${base.hex}`);
  const { spacing } = options;
  const target = kind === 'light' ? Math.max(LIGHT_LIMIT, lch.l) : Math.min(DARK_LIMIT, lch.l);
  const room = Math.abs(target - lch.l);
  const wanted = spacing.mode === 'fixed' ? clampStepSize(spacing.size) * step : (room * step) / (count + 1);
  const moved = Math.min(wanted, room);
  // t: 0 at the base, 1 at the limit.
  const t = room > 0 ? moved / room : 0;
  const l = lch.l + (target - lch.l) * t;
  const c = (lch.c ?? 0) * (1 - Math.pow(t, CHROMA_TAPER));
  const shift = clampHueShift(options.hueShift);
  const h =
    lch.h === undefined || shift === 0
      ? lch.h
      : rotateHueTowards(lch.h, kind === 'light' ? LIGHT_HUE_TARGET : DARK_HUE_TARGET, shift * step);
  const mapped = toRgb(clampChroma({ mode: 'oklch', l, c, h }, 'oklch', 'rgb'));
  const rgb: [number, number, number] = [channel(mapped.r), channel(mapped.g), channel(mapped.b)];
  return {
    kind,
    step,
    limited: room === 0 || wanted > room,
    name: `${base.name} ${kind} ${step}`,
    hex: toHex(rgb),
    rgb,
  };
}

export function buildScale(
  base: WadaColor,
  lighter: number,
  darker: number,
  options: ScaleOptions = DEFAULT_OPTIONS,
): ShadeScale {
  const nLight = clampSteps(lighter);
  const nDark = clampSteps(darker);
  const darks: Shade[] = [];
  for (let i = nDark; i >= 1; i--) darks.push(shadeAt(base, 'dark', i, nDark, options));
  const lights: Shade[] = [];
  for (let i = 1; i <= nLight; i++) lights.push(shadeAt(base, 'light', i, nLight, options));
  const baseShade: Shade = {
    kind: 'base',
    step: 0,
    limited: false,
    name: base.name,
    hex: base.hex,
    rgb: [...base.rgb],
  };
  return { base, shades: [...darks, baseShade, ...lights] };
}
