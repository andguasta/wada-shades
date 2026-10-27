import { clampSteps } from './shades';

export interface StepCounts {
  darker: number;
  lighter: number;
}

export const DEFAULT_SHADES = 2;

export function uniformCounts(colours: number, shades: number): StepCounts[] {
  const n = clampSteps(shades);
  return Array.from({ length: colours }, () => ({ darker: n, lighter: n }));
}

export function isMixed(counts: StepCounts[], shades: number): boolean {
  return counts.some((c) => c.darker !== shades || c.lighter !== shades);
}

export function sameCounts(counts: StepCounts[]): boolean {
  return counts.every((c) => c.darker === counts[0].darker && c.lighter === counts[0].lighter);
}

function formatList(values: number[]): string {
  return values.every((v) => v === values[0]) ? String(values[0]) : values.join(',');
}

function parseList(text: string | null, colours: number): number[] | null {
  if (text === null) return null;
  const values = text.split(',').map((v) => clampSteps(Number(v)));
  if (values.length === 1) return Array(colours).fill(values[0]);
  return values.length === colours ? values : null;
}

/** `d=2&l=2`, or `n=2&d=4,2,1&l=2,1,3` when mixed. */
export function formatStepParams(shades: number, counts: StepCounts[]): string {
  const d = formatList(counts.map((c) => c.darker));
  const l = formatList(counts.map((c) => c.lighter));
  return isMixed(counts, shades) ? `n=${shades}&d=${d}&l=${l}` : `d=${d}&l=${l}`;
}

// Without `n` the global value is the darker count, so older links (`d=2&l=3`) keep working.
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

export function stepsLabel(counts: StepCounts[]): string {
  const list = (values: number[]) => (values.every((v) => v === values[0]) ? String(values[0]) : values.join('.'));
  return `d${list(counts.map((c) => c.darker))}-l${list(counts.map((c) => c.lighter))}`;
}
