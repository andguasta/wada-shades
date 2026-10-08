import { clampChroma, converter } from 'culori';
import type { WadaColor } from './data';

/**
 * Shade generation in OKLCH.
 *
 * Lighter steps move lightness from the base colour towards LIGHT_LIMIT,
 * darker steps towards DARK_LIMIT. Chroma tapers towards zero as lightness
 * approaches the limits (white and black have no chroma), and anything
 * still outside sRGB is gamut mapped by reducing chroma at fixed lightness
 * and hue. The base colour is never recomputed: its original RGB values
 * are used.
 *
 * Two spacings:
 * - spread: the room between the base and the limit is split into n + 1
 *   equal parts, so the steps always use the colour's whole range and
 *   never reach the limit.
 * - fixed: every step changes lightness by the same amount (e.g. 0.08),
 *   whatever the colour; useful for close, even ramps such as pixel art
 *   shading. A step that would pass the limit stops at it, so the steps
 *   after it repeat the same colour.
 * A base already at a limit (e.g. White) has no room on that side: its
 * steps there repeat the base. Steps that could not move by their full
 * amount are flagged as `limited`.
 *
 * Hue is constant unless hueShift is set: then each step rotates hue by
 * that many degrees, highlights towards yellow and shadows towards blue
 * violet, as in pixel art hue shifting. The rotation stops at the target
 * hue, and greys (no hue) are left unchanged.
 */
export const LIGHT_LIMIT = 0.99;
export const DARK_LIMIT = 0.1;
/** Exponent of the chroma taper: C = C0 * (1 - t^CHROMA_TAPER). */
export const CHROMA_TAPER = 2;
export const MAX_STEPS = 8;

/** Fixed step size limits and default, in OKLCH lightness (0 to 1). */
export const MIN_STEP_SIZE = 0.02;
export const MAX_STEP_SIZE = 0.2;
export const DEFAULT_STEP_SIZE = 0.08;

export type Spacing = { mode: 'spread' } | { mode: 'fixed'; size: number };

export const SPREAD: Spacing = { mode: 'spread' };

/** Hue shift limits, in degrees per step. */
export const MAX_HUE_SHIFT = 30;
/** OKLCH hues the shift moves towards: warm yellow for highlights, blue violet for shadows. */
export const LIGHT_HUE_TARGET = 100;
export const DARK_HUE_TARGET = 280;

export interface ScaleOptions {
  spacing: Spacing;
  /** Degrees of hue rotation per step; 0 keeps hue constant. */
  hueShift: number;
}

export const DEFAULT_OPTIONS: ScaleOptions = { spacing: SPREAD, hueShift: 0 };

export function clampHueShift(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.min(MAX_HUE_SHIFT, Math.max(0, deg));
}

/** Rotates hue towards target by at most maxDeg, along the shorter way round. */
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
  /** 0 for the base, 1..n moving away from it. */
  step: number;
  /** True when the step could not move its full amount: it sits at the lightness limit or repeats its neighbour. */
  limited: boolean;
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
  // t: how far towards the limit this step is (0 at the base, 1 at the limit).
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
