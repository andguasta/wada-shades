import { clampSteps } from './shades';

/**
 * Number of shades per colour.
 *
 * The global "shades" value sets the same number of darker and lighter steps
 * on every colour; each colour can then be changed on its own. Colours whose
 * counts differ from the global value make the palette "mixed".
 */
export interface StepCounts {
  darker: number;
  lighter: number;
}

export const DEFAULT_SHADES = 2;

export function uniformCounts(colours: number, shades: number): StepCounts[] {
  const n = clampSteps(shades);
  return Array.from({ length: colours }, () => ({ darker: n, lighter: n }));
}

/** True when some colour does not have `shades` steps on both sides. */
export function isMixed(counts: StepCounts[], shades: number): boolean {
  return counts.some((c) => c.darker !== shades || c.lighter !== shades);
}

/** True when every colour has the same darker count and the same lighter count. */
export function sameCounts(counts: StepCounts[]): boolean {
  return counts.every((c) => c.darker === counts[0].darker && c.lighter === counts[0].lighter);
}

/** One value when all colours agree, else one value per colour: "2" or "4,2,1". */
function formatList(values: number[]): string {
  return values.every((v) => v === values[0]) ? String(values[0]) : values.join(',');
}

/** A single value applies to every colour; a list must have one value per colour. */
function parseList(text: string | null, colours: number): number[] | null {
  if (text === null) return null;
  const values = text.split(',').map((v) => clampSteps(Number(v)));
  if (values.length === 1) return Array(colours).fill(values[0]);
  return values.length === colours ? values : null;
}

/**
 * URL hash parameters for the step counts: `d=2&l=2` when every colour has
 * the global value, else `n=<global>&d=4,2,1&l=2,1,3`.
 */
export function formatStepParams(shades: number, counts: StepCounts[]): string {
  const d = formatList(counts.map((c) => c.darker));
  const l = formatList(counts.map((c) => c.lighter));
  return isMixed(counts, shades) ? `n=${shades}&d=${d}&l=${l}` : `d=${d}&l=${l}`;
}

/**
 * Reads what formatStepParams writes. Without `n` the global value is the
 * darker count, so older links (`d=2&l=3`) keep working. A list whose length
 * does not match the combination falls back to the global value.
 */
export function parseStepParams(
  params: { n: string | null; d: string | null; l: string | null },
  colours: number,
): { shades: number; counts: StepCounts[] } {
  const darker = parseList(params.d, colours);
  const lighter = parseList(params.l, colours);
  const shades = clampSteps(Number(params.n ?? darker?.[0] ?? DEFAULT_SHADES));
  const counts = Array.from({ length: colours }, (_, i) => ({
    darker: darker?.[i] ?? shades,
    lighter: lighter?.[i] ?? shades,
  }));
  return { shades, counts };
}

/** File name part: "d2-l2", or "d4.2.1-l2.1.3" when the colours differ. */
export function stepsLabel(counts: StepCounts[]): string {
  const list = (values: number[]) => (values.every((v) => v === values[0]) ? String(values[0]) : values.join('.'));
  return `d${list(counts.map((c) => c.darker))}-l${list(counts.map((c) => c.lighter))}`;
}
