// Machado, Oliveira & Fernandes (2009) matrices at severity 1.0, applied in linear RGB.
export type VisionMode = 'normal' | 'protan' | 'deutan';

export const VISION_MODES: VisionMode[] = ['normal', 'protan', 'deutan'];

export const VISION_LABELS: Record<VisionMode, string> = {
  normal: 'Normal vision',
  protan: 'Protanopia (no red cones)',
  deutan: 'Deuteranopia (no green cones)',
};

type Matrix = [number, number, number, number, number, number, number, number, number];

export const VISION_MATRICES: Record<Exclude<VisionMode, 'normal'>, Matrix> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
};

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const toGamma = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
};

export function simulate(rgb: [number, number, number], mode: VisionMode): [number, number, number] {
  if (mode === 'normal') return [...rgb];
  const m = VISION_MATRICES[mode];
  const [r, g, b] = rgb.map(toLinear);
  return [
    toGamma(m[0] * r + m[1] * g + m[2] * b),
    toGamma(m[3] * r + m[4] * g + m[5] * b),
    toGamma(m[6] * r + m[7] * g + m[8] * b),
  ];
}

export function feColorMatrixValues(mode: Exclude<VisionMode, 'normal'>): string {
  const m = VISION_MATRICES[mode];
  return [...m.slice(0, 3), 0, 0, ...m.slice(3, 6), 0, 0, ...m.slice(6, 9), 0, 0, 0, 0, 0, 1, 0].join(' ');
}
