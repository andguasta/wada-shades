import './style.css';
import { combinations, getCombination, relatedCombinations, type Combination } from './core/data';
import { exporters } from './core/export';
import { describeDistance, nearestColors, parseHexColor, type ColorMatch } from './core/nearest';
import { alignRows, buildPalette, comboTitle, paletteFileName } from './core/palette';
import {
  clampSteps,
  DEFAULT_STEP_SIZE,
  MAX_STEP_SIZE,
  MAX_STEPS,
  MAX_HUE_SHIFT,
  MIN_STEP_SIZE,
  type ScaleOptions,
  type Shade,
  type Spacing,
} from './core/shades';
import {
  DEFAULT_SHADES,
  formatStepParams,
  isMixed,
  parseStepParams,
  uniformCounts,
  type StepCounts,
} from './core/steps';
import { feColorMatrixValues, VISION_LABELS, VISION_MODES, type VisionMode } from './core/vision';

interface State {
  comboId: number;
  /** Global number of darker and lighter shades; new combinations start with it on every colour. */
  shades: number;
  /** Darker and lighter shades of each colour of the current combination, in order. */
  counts: StepCounts[];
  /** Filler colour (hex without #) padding uneven rows of the export, or null when off. */
  filler: string | null;
  spacingMode: Spacing['mode'];
  /** Fixed step size as OKLCH lightness × 100, kept while spread is active. */
  stepSize: number;
  /** Hue rotation in degrees per step; 0 is off. */
  hueShift: number;
  size: number;
  query: string;
  /** In colour search, the dataset index of the one match the list is narrowed to. */
  matchFocus: number | null;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  list: $<HTMLUListElement>('combo-list'),
  count: $<HTMLParagraphElement>('count'),
  search: $<HTMLInputElement>('search'),
  picker: $<HTMLInputElement>('picker'),
  match: $<HTMLElement>('match'),
  shortcuts: $<HTMLDialogElement>('shortcuts'),
  app: document.querySelector('.app') as HTMLElement,
  vision: $<HTMLDivElement>('vision'),
  visionNote: $<HTMLParagraphElement>('vision-note'),
  sizeFilter: $<HTMLDivElement>('size-filter'),
  title: $<HTMLHeadingElement>('combo-title'),
  colors: $<HTMLParagraphElement>('combo-colors'),
  shades: $<HTMLInputElement>('shades'),
  mixedTag: $<HTMLSpanElement>('mixed-tag'),
  confirm: $<HTMLDivElement>('confirm'),
  confirmText: $<HTMLParagraphElement>('confirm-text'),
  confirmOk: $<HTMLButtonElement>('confirm-ok'),
  confirmCancel: $<HTMLButtonElement>('confirm-cancel'),
  filler: $<HTMLInputElement>('filler'),
  fillerColor: $<HTMLInputElement>('filler-color'),
  spacing: $<HTMLSpanElement>('spacing'),
  stepSize: $<HTMLInputElement>('step-size'),
  hueShift: $<HTMLInputElement>('hue-shift'),
  exportBtn: $<HTMLButtonElement>('export'),
  originalSize: $<HTMLDivElement>('original-size'),
  preview: $<HTMLElement>('preview'),
  grid: $<HTMLDivElement>('shades-grid'),
  related: $<HTMLDivElement>('related'),
  toast: $<HTMLDivElement>('toast'),
  main: document.querySelector('.main') as HTMLElement,
};

const MIN_STEP = Math.round(MIN_STEP_SIZE * 100);
const MAX_STEP = Math.round(MAX_STEP_SIZE * 100);
const clampHue = (n: number) => (Number.isFinite(n) ? Math.min(MAX_HUE_SHIFT, Math.max(0, Math.round(n))) : 0);
const clampStep = (n: number) =>
  Number.isFinite(n) ? Math.min(MAX_STEP, Math.max(MIN_STEP, Math.round(n))) : Math.round(DEFAULT_STEP_SIZE * 100);

const DEFAULT_FILLER = '000000';
const parseFiller = (text: string | null) => (text && /^[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : null);

/** fallbackId: the combination to use when the hash names none. */
function readHash(fallbackId: number): Partial<State> {
  const params = new URLSearchParams(location.hash.slice(1));
  const out: Partial<State> = {};
  const c = Number(params.get('c'));
  out.comboId = getCombination(c) ? c : fallbackId;
  const steps = parseStepParams(
    { n: params.get('n'), d: params.get('d'), l: params.get('l') },
    getCombination(out.comboId)!.colors.length,
  );
  out.shades = steps.shades;
  out.counts = steps.counts;
  // f=<hex> pads uneven export rows with that colour; no f means no filler.
  out.filler = parseFiller(params.get('f'));
  // s=<size> means fixed spacing; no s means spread.
  out.spacingMode = params.has('s') ? 'fixed' : 'spread';
  if (params.has('s')) out.stepSize = clampStep(Number(params.get('s')));
  out.hueShift = params.has('h') ? clampHue(Number(params.get('h'))) : 0;
  return out;
}

const state: State = {
  comboId: 1,
  shades: DEFAULT_SHADES,
  counts: uniformCounts(getCombination(1)!.colors.length, DEFAULT_SHADES),
  filler: null,
  spacingMode: 'spread',
  stepSize: Math.round(DEFAULT_STEP_SIZE * 100),
  hueShift: 0,
  size: 0,
  query: '',
  matchFocus: null,
  ...readHash(1),
};

function scaleOptions(): ScaleOptions {
  const spacing: Spacing =
    state.spacingMode === 'fixed' ? { mode: 'fixed', size: state.stepSize / 100 } : { mode: 'spread' };
  return { spacing, hueShift: state.hueShift };
}

const MATCH_LIMIT = 5;

/** push adds a history entry, so Back returns to the previous combination. */
function writeHash(push = false) {
  const fixed = state.spacingMode === 'fixed' ? `&s=${state.stepSize}` : '';
  const hue = state.hueShift > 0 ? `&h=${state.hueShift}` : '';
  const filler = state.filler ? `&f=${state.filler}` : '';
  const hash = `#c=${state.comboId}&${formatStepParams(state.shades, state.counts)}${fixed}${hue}${filler}`;
  if (location.hash === hash) return;
  if (push) history.pushState(null, '', hash);
  else history.replaceState(null, '', hash);
}

/** Black or white text, whichever reads better on the swatch. */
function inkFor([r, g, b]: [number, number, number]): string {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (y + 0.05) / 0.05 > 1.05 / (y + 0.05) ? '#111' : '#fff';
}

function matches(combo: Combination): boolean {
  if (state.size && combo.colors.length !== state.size) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  if (/^\d+$/.test(q)) return String(combo.id).startsWith(q);
  return combo.colors.some(
    (c) => c.name.toLowerCase().includes(q) || c.sourceName.toLowerCase().includes(q) || c.hex.includes(q),
  );
}

const listItems = new Map<number, HTMLLIElement>();

/** Button with the combination number and its colours; data-id drives navigation. */
function comboButton(combo: Combination, className: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.dataset.id = String(combo.id);
  btn.setAttribute('aria-label', `${comboTitle(combo.id)}: ${combo.colors.map((c) => c.name).join(', ')}`);
  btn.title = combo.colors.map((c) => c.name).join(' · ');
  const num = document.createElement('span');
  num.className = 'combo-num';
  num.textContent = String(combo.id).padStart(3, '0');
  const strip = document.createElement('span');
  strip.className = 'strip';
  for (const c of combo.colors) {
    const s = document.createElement('span');
    s.style.background = c.hex;
    strip.append(s);
  }
  btn.append(num, strip);
  return btn;
}

function renderList() {
  const frag = document.createDocumentFragment();
  for (const combo of combinations) {
    const li = document.createElement('li');
    li.append(comboButton(combo, 'combo-item'));
    listItems.set(combo.id, li);
    frag.append(li);
  }
  els.list.append(frag);
}

function renderMatchPanel(hex: string | null, found: ColorMatch[]) {
  els.match.hidden = !hex;
  if (!hex) {
    els.match.replaceChildren();
    return;
  }
  const head = document.createElement('p');
  head.className = 'match-head';
  const chip = document.createElement('span');
  chip.className = 'match-target';
  chip.style.background = hex;
  head.append('Closest Wada colours to ', chip, ` ${hex}`);
  const list = document.createElement('div');
  list.className = 'match-list';
  for (const { color, deltaE } of found) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'match-item';
    btn.dataset.index = String(color.index);
    btn.setAttribute('aria-pressed', String(state.matchFocus === color.index));
    btn.title = state.matchFocus === color.index ? 'Show all matches again' : `Only combinations with ${color.name}`;
    const sw = document.createElement('span');
    sw.className = 'match-swatch';
    sw.style.background = color.hex;
    const name = document.createElement('span');
    name.className = 'match-name';
    name.textContent = color.name;
    const meta = document.createElement('span');
    meta.className = 'match-meta';
    meta.textContent = `${color.hex} · ΔE ${deltaE.toFixed(1)} · ${describeDistance(deltaE)}`;
    btn.append(sw, name, meta);
    list.append(btn);
  }
  els.match.replaceChildren(head, list);
}

function applyFilter() {
  const hex = parseHexColor(state.query);
  const found = hex ? nearestColors(hex, MATCH_LIMIT) : [];
  if (state.matchFocus !== null && !found.some((m) => m.color.index === state.matchFocus)) state.matchFocus = null;
  renderMatchPanel(hex, found);

  // Colour search: rank of each matched colour, nearest first.
  const rank = new Map<number, number>();
  found.forEach((m, i) => {
    if (state.matchFocus === null || state.matchFocus === m.color.index) rank.set(m.color.index, i);
  });
  const comboRank = (combo: Combination) =>
    Math.min(...combo.colors.map((c) => rank.get(c.index) ?? Infinity));

  const shown: Combination[] = [];
  for (const combo of combinations) {
    const show = hex
      ? (!state.size || combo.colors.length === state.size) && comboRank(combo) < Infinity
      : matches(combo);
    listItems.get(combo.id)!.hidden = !show;
    if (show) shown.push(combo);
  }
  // Order by nearest matched colour in colour search, by number otherwise.
  const ordered = hex ? [...shown].sort((a, b) => comboRank(a) - comboRank(b) || a.id - b.id) : combinations;
  els.list.append(...ordered.map((c) => listItems.get(c.id)!));

  els.count.textContent = `${shown.length} of ${combinations.length} combinations`;
  for (const btn of els.sizeFilter.querySelectorAll<HTMLButtonElement>('button')) {
    btn.setAttribute('aria-checked', String(Number(btn.dataset.size) === state.size));
  }
}

function swatch(shade: Shade): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `swatch swatch-${shade.kind}`;
  el.style.background = shade.hex;
  el.style.color = inkFor(shade.rgb);
  el.dataset.hex = shade.hex;
  el.title = `${shade.name}\n${shade.hex}\nRGB ${shade.rgb.join(' ')}`;
  if (shade.limited) {
    el.classList.add('swatch-limited');
    el.title += '\nNo room for a full step: stopped at the lightness limit (repeats the neighbouring colour).';
  }
  const label = document.createElement('span');
  label.className = 'swatch-label';
  label.textContent = shade.kind === 'base' ? 'base' : `${shade.kind === 'dark' ? 'D' : 'L'}${shade.step}`;
  const hex = document.createElement('span');
  hex.className = 'swatch-hex';
  hex.textContent = shade.hex;
  el.append(label, hex);
  if (shade.limited) {
    const flag = document.createElement('span');
    flag.className = 'swatch-flag';
    flag.textContent = 'limit';
    el.append(flag);
  }
  return el;
}

function relatedFor(color: Combination['colors'][number], comboId: number): HTMLElement {
  const related = relatedCombinations(color, comboId);
  const wrap = document.createElement('div');
  wrap.className = 'related';
  const label = document.createElement('span');
  label.className = 'related-label';
  label.textContent = related.length
    ? `${color.name}: also in ${related.length} ${related.length === 1 ? 'combination' : 'combinations'}`
    : `${color.name}: only in this combination`;
  wrap.append(label);
  if (related.length) {
    const list = document.createElement('div');
    list.className = 'related-list';
    list.append(...related.map((c) => comboButton(c, 'related-item')));
    wrap.append(list);
  }
  return wrap;
}

/** Small stepper for one side of one colour; data-col and data-side drive the handlers. */
function colStepper(i: number, side: keyof StepCounts, colorName: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `col-stepper ${side}`;
  const box = document.createElement('span');
  box.className = 'stepper-box sm';
  const button = (delta: number, text: string, label: string) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.dataset.col = String(i);
    btn.dataset.side = side;
    btn.dataset.delta = String(delta);
    btn.setAttribute('aria-label', `${label} ${side} shades of ${colorName}`);
    return btn;
  };
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = String(MAX_STEPS);
  input.inputMode = 'numeric';
  input.value = String(state.counts[i][side]);
  input.dataset.col = String(i);
  input.dataset.side = side;
  input.setAttribute('aria-label', `${side === 'darker' ? 'Darker' : 'Lighter'} shades of ${colorName}`);
  box.append(button(-1, '−', 'Fewer'), input, button(1, '+', 'More'));
  const label = document.createElement('span');
  label.className = 'col-stepper-label';
  label.textContent = side;
  wrap.append(box, label);
  return wrap;
}

function place(el: HTMLElement, col: number, row: number): HTMLElement {
  el.style.gridColumn = String(col);
  el.style.gridRow = String(row);
  return el;
}

/**
 * Grid rows, top to bottom: names, lighter steppers, lighter shades (highest
 * step first), the original colours, darker shades (D1 first), darker
 * steppers. Column 1 is a gutter that marks the original row.
 */
function renderGrid(combo: Combination) {
  const { scales } = buildPalette(combo, state.counts, scaleOptions());
  const { darker, lighter, rows } = alignRows(scales);
  const n = combo.colors.length;
  const baseRow = 3 + lighter;
  els.grid.style.gridTemplateColumns = `var(--gutter) repeat(${n}, minmax(0, 1fr))`;
  els.grid.style.gridTemplateRows = [
    'auto',
    'auto',
    ...Array<string>(lighter).fill('var(--shade-h)'),
    'var(--base-h)',
    ...Array<string>(darker).fill('var(--shade-h)'),
    'auto',
  ].join(' ');

  const cells: HTMLElement[] = [];
  const mark = document.createElement('div');
  mark.className = 'wada-mark';
  mark.title = 'Wada Sanzō: the original colours, never altered';
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', 'Original colours (Wada Sanzō)');
  const markText = document.createElement('span');
  markText.lang = 'ja';
  markText.textContent = '和田\u2005三造';
  mark.append(markText);
  cells.push(place(mark, 1, baseRow));

  combo.colors.forEach((color, i) => {
    const col = i + 2;
    const name = document.createElement('div');
    name.className = 'col-name';
    name.textContent = color.name;
    cells.push(place(name, col, 1));
    cells.push(place(colStepper(i, 'lighter', color.name), col, 2));
    rows[i].forEach((shade, j) => {
      if (!shade) return;
      // j runs dark to light and the base sits at index `darker`: darks go below it, lights above.
      const el = swatch(shade);
      if (shade.kind === 'base') {
        if (i === 0) el.classList.add('first');
        if (i === n - 1) el.classList.add('last');
      }
      cells.push(place(el, col, baseRow + (darker - j)));
    });
    cells.push(place(colStepper(i, 'darker', color.name), col, baseRow + darker + 1));
  });
  els.grid.replaceChildren(...cells);

  els.related.replaceChildren(
    ...combo.colors.map((color) => {
      const row = document.createElement('div');
      row.className = 'related-row';
      const dot = document.createElement('span');
      dot.className = 'related-dot';
      dot.style.background = color.hex;
      row.append(dot, relatedFor(color, combo.id));
      return row;
    }),
  );
}

function render(push = false) {
  const combo = getCombination(state.comboId)!;
  els.shades.value = String(state.shades);
  els.mixedTag.hidden = !isMixed(state.counts, state.shades);
  els.filler.checked = state.filler !== null;
  if (state.filler) els.fillerColor.value = `#${state.filler}`;
  els.title.textContent = comboTitle(combo.id);
  els.colors.textContent = combo.colors.map((c) => c.name).join(' · ');

  for (const [id, li] of listItems) {
    const btn = li.firstElementChild as HTMLButtonElement;
    if (id === combo.id) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  }

  els.stepSize.value = String(state.stepSize);
  els.hueShift.value = String(state.hueShift);
  els.stepSize.closest('.stepper-box')!.classList.toggle('inactive', state.spacingMode !== 'fixed');
  for (const btn of els.spacing.querySelectorAll<HTMLButtonElement>('button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.spacing === state.spacingMode));
  }

  // The grid is rebuilt: keep focus on the same per-colour control.
  const focused = document.activeElement as HTMLElement | null;
  const focusKey = focused && els.grid.contains(focused) ? focused.dataset : null;
  renderGrid(combo);
  if (focusKey?.col !== undefined) {
    const selector = `[data-col="${focusKey.col}"][data-side="${focusKey.side}"]${
      focusKey.delta ? `[data-delta="${focusKey.delta}"]` : ':not([data-delta])'
    }`;
    els.grid.querySelector<HTMLElement>(selector)?.focus();
  }
  writeHash(push);
}

let toastTimer = 0;
function toast(message: string) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 1600);
}

function exportPalette() {
  const combo = getCombination(state.comboId)!;
  const exporter = exporters[0];
  const palette = buildPalette(combo, state.counts, scaleOptions());
  if (state.filler) palette.filler = hexToRgb(state.filler);
  const text = exporter.serialize(palette);
  const url = URL.createObjectURL(new Blob([text], { type: exporter.mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = paletteFileName(combo, state.counts, exporter.extension, scaleOptions(), state.filler !== null);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function hexToRgb(hex: string): [number, number, number] {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Sets one side of one colour. */
function setCount(col: number, side: keyof StepCounts, value: number) {
  if (!state.counts[col]) return;
  state.counts[col] = { ...state.counts[col], [side]: clampSteps(value) };
  render();
}

function applyShades(value: number) {
  state.shades = clampSteps(value);
  state.counts = uniformCounts(state.counts.length, state.shades);
  render();
}

// Setting every colour at once overwrites per-colour counts: ask first when there are any.
let pendingShades: number | null = null;
/** Where focus returns when the confirmation closes: the control that opened it, if any. */
let confirmOpener: HTMLElement | null = null;

function requestShades(value: number) {
  const next = clampSteps(value);
  if (!isMixed(state.counts, state.shades)) {
    applyShades(next);
    return;
  }
  pendingShades = next;
  const n = state.counts.length;
  els.confirmText.textContent = `Colours have different numbers of shades. Set all ${n} colours to ${next} darker and ${next} lighter ${
    next === 1 ? 'shade' : 'shades'
  }?`;
  els.shades.value = String(next);
  if (els.confirm.hidden) {
    const active = document.activeElement as HTMLElement | null;
    confirmOpener = active && active !== document.body ? active : null;
  }
  els.confirm.hidden = false;
  els.confirmOk.focus();
}

function closeConfirm(apply: boolean) {
  if (els.confirm.hidden) return;
  const value = pendingShades;
  pendingShades = null;
  els.confirm.hidden = true;
  if (apply && value !== null) applyShades(value);
  else els.shades.value = String(state.shades);
  if (confirmOpener?.isConnected) confirmOpener.focus();
  else (document.activeElement as HTMLElement | null)?.blur();
  confirmOpener = null;
}

els.confirmOk.addEventListener('click', () => closeConfirm(true));
els.confirmCancel.addEventListener('click', () => closeConfirm(false));
document.addEventListener('pointerdown', (e) => {
  if (!els.confirm.hidden && !(e.target as HTMLElement).closest('.shades-control')) closeConfirm(false);
});

function setFiller(on: boolean) {
  state.filler = on ? (els.fillerColor.value.slice(1).toLowerCase() || DEFAULT_FILLER) : null;
  render();
}

els.filler.addEventListener('change', () => setFiller(els.filler.checked));
els.fillerColor.addEventListener('input', () => setFiller(true));

function setSpacing(mode: Spacing['mode']) {
  state.spacingMode = mode;
  render();
}

/** Changing the step size implies fixed spacing. */
function setHueShift(value: number) {
  state.hueShift = clampHue(value);
  render();
}

function setStepSize(value: number) {
  state.stepSize = clampStep(value);
  state.spacingMode = 'fixed';
  render();
}

renderList();
applyFilter();
render();
// Scroll only the list, never the page (scrollIntoView would move the page on mobile).
const current = listItems.get(state.comboId);
if (current) els.list.scrollTop = current.offsetTop - els.list.clientHeight / 2;

/** A new combination starts with the global number of shades on every colour. */
function goTo(id: number) {
  const combo = getCombination(id);
  if (id === state.comboId || !combo) return;
  closeConfirm(false);
  state.comboId = id;
  state.counts = uniformCounts(combo.colors.length, state.shades);
  render(true);
}

/** Bring the current combination into view in the sidebar, if the filters show it. */
function revealInList() {
  const li = listItems.get(state.comboId);
  if (!li || li.hidden) return;
  const top = li.offsetTop;
  const bottom = top + li.offsetHeight;
  if (top < els.list.scrollTop || bottom > els.list.scrollTop + els.list.clientHeight) {
    els.list.scrollTop = top - els.list.clientHeight / 2;
  }
}

els.list.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.combo-item');
  if (btn) goTo(Number(btn.dataset.id));
});

els.sizeFilter.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!btn) return;
  state.size = Number(btn.dataset.size);
  applyFilter();
});

function setQuery(query: string) {
  state.query = query;
  state.matchFocus = null;
  const hex = parseHexColor(query);
  if (hex) els.picker.value = hex;
  applyFilter();
  els.list.scrollTop = 0;
}

els.search.addEventListener('input', () => setQuery(els.search.value));

els.picker.addEventListener('input', () => {
  els.search.value = els.picker.value;
  setQuery(els.picker.value);
});

els.match.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.match-item');
  if (!btn) return;
  const index = Number(btn.dataset.index);
  state.matchFocus = state.matchFocus === index ? null : index;
  applyFilter();
  els.list.scrollTop = 0;
});

document.querySelectorAll<HTMLButtonElement>('.stepper-box button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const delta = Number(btn.dataset.delta);
    if (btn.dataset.target === 'step') {
      setStepSize(state.stepSize + delta);
      return;
    }
    if (btn.dataset.target === 'hue') {
      setHueShift(state.hueShift + delta);
      return;
    }
    if (btn.dataset.target === 'shades') requestShades(state.shades + delta);
  });
});

els.stepSize.addEventListener('change', () => setStepSize(Number(els.stepSize.value)));
els.hueShift.addEventListener('change', () => setHueShift(Number(els.hueShift.value)));

els.spacing.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (btn?.dataset.spacing) setSpacing(btn.dataset.spacing as Spacing['mode']);
});

els.shades.addEventListener('change', () => requestShades(Number(els.shades.value)));

els.grid.addEventListener('change', (e) => {
  const input = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-col]');
  if (input) setCount(Number(input.dataset.col), input.dataset.side as keyof StepCounts, Number(input.value));
});

els.preview.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const stepBtn = target.closest<HTMLButtonElement>('button[data-col]');
  if (stepBtn) {
    const col = Number(stepBtn.dataset.col);
    const side = stepBtn.dataset.side as keyof StepCounts;
    setCount(col, side, state.counts[col][side] + Number(stepBtn.dataset.delta));
    return;
  }
  const related = target.closest<HTMLButtonElement>('.related-item');
  if (related) {
    goTo(Number(related.dataset.id));
    revealInList();
    els.main.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    return;
  }
  const el = target.closest<HTMLButtonElement>('.swatch');
  if (!el?.dataset.hex) return;
  try {
    await navigator.clipboard.writeText(el.dataset.hex);
    toast(`Copied ${el.dataset.hex}`);
  } catch {
    toast(el.dataset.hex);
  }
});

els.exportBtn.addEventListener('click', exportPalette);

// Height of the original colours' row: a per-browser preference, kept out of the URL.
const ORIGINAL_HEIGHTS = ['s', 'm', 'l', 'xl'];
const ORIGINAL_HEIGHT_KEY = 'wada-shades:original-height';

function setOriginalHeight(height: string) {
  if (!ORIGINAL_HEIGHTS.includes(height)) return;
  els.preview.dataset.height = height;
  for (const btn of els.originalSize.querySelectorAll<HTMLButtonElement>('button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.height === height));
  }
  try {
    localStorage.setItem(ORIGINAL_HEIGHT_KEY, height);
  } catch {
    // Storage unavailable (private mode, blocked): the choice lasts for this page only.
  }
}

try {
  setOriginalHeight(localStorage.getItem(ORIGINAL_HEIGHT_KEY) ?? 's');
} catch {
  // Keep the default height.
}

els.originalSize.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (btn?.dataset.height) setOriginalHeight(btn.dataset.height);
});

window.addEventListener('hashchange', () => {
  closeConfirm(false);
  Object.assign(state, readHash(state.comboId));
  render();
  revealInList();
});

// Colour vision simulation: an SVG colour-matrix filter over the whole app.
// View only; copied hex values and exports always use the real colours.
(function installVisionFilters() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'vision-filters');
  for (const mode of ['protan', 'deutan'] as const) {
    const filter = document.createElementNS(ns, 'filter');
    filter.id = `vision-${mode}`;
    filter.setAttribute('color-interpolation-filters', 'linearRGB');
    const matrix = document.createElementNS(ns, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    matrix.setAttribute('values', feColorMatrixValues(mode));
    filter.append(matrix);
    svg.append(filter);
  }
  document.body.append(svg);
})();

let vision: VisionMode = 'normal';

function setVision(mode: VisionMode) {
  vision = mode;
  if (mode === 'normal') delete els.app.dataset.vision;
  else els.app.dataset.vision = mode;
  for (const btn of els.vision.querySelectorAll<HTMLButtonElement>('button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.vision === mode));
  }
  els.visionNote.hidden = mode === 'normal';
  els.visionNote.textContent =
    mode === 'normal' ? '' : `Simulating ${VISION_LABELS[mode].toLowerCase()}. Hex values, copies and exports keep the real colours.`;
}

els.vision.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (btn?.dataset.vision) setVision(btn.dataset.vision as VisionMode);
});

// Keyboard shortcuts. Listed in the #shortcuts dialog; keep both in sync.
function visibleIds(): number[] {
  return [...els.list.children]
    .filter((li) => !(li as HTMLLIElement).hidden)
    .map((li) => Number((li.firstElementChild as HTMLElement).dataset.id));
}

function step(delta: 1 | -1) {
  const ids = visibleIds();
  if (!ids.length) return;
  const i = ids.indexOf(state.comboId);
  // Outside the filtered list: start from its first (or last) entry.
  const next = i === -1 ? ids[delta > 0 ? 0 : ids.length - 1] : ids[i + delta];
  if (next === undefined) return;
  goTo(next);
  revealInList();
}

function openShortcuts() {
  if (!els.shortcuts.open) els.shortcuts.showModal();
}

$<HTMLButtonElement>('shortcuts-open').addEventListener('click', openShortcuts);
$<HTMLButtonElement>('shortcuts-close').addEventListener('click', () => els.shortcuts.close());
els.shortcuts.addEventListener('click', (e) => {
  if (e.target === els.shortcuts) els.shortcuts.close(); // click on the backdrop
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || els.shortcuts.open) return;
  const target = e.target as HTMLElement;
  if (!els.confirm.hidden && e.key === 'Escape') {
    closeConfirm(false);
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape' && (target === els.search || state.query)) {
    els.search.value = '';
    setQuery('');
    els.search.blur();
    e.preventDefault();
    return;
  }
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return;

  switch (e.key) {
    case 'ArrowDown':
    case 'j':
      step(1);
      break;
    case 'ArrowUp':
    case 'k':
      step(-1);
      break;
    case '+':
    case '=':
      requestShades(state.shades + 1);
      break;
    case '-':
      requestShades(state.shades - 1);
      break;
    case 'e':
      exportPalette();
      break;
    case 's':
      setSpacing(state.spacingMode === 'fixed' ? 'spread' : 'fixed');
      break;
    case '[':
      setStepSize(state.stepSize - 1);
      break;
    case ']':
      setStepSize(state.stepSize + 1);
      break;
    case 'h':
      setHueShift(state.hueShift + 2);
      break;
    case 'H':
      setHueShift(state.hueShift - 2);
      break;
    case 'v':
      setVision(VISION_MODES[(VISION_MODES.indexOf(vision) + 1) % VISION_MODES.length]);
      break;
    case '/':
      els.search.focus();
      els.search.select();
      break;
    case '?':
      openShortcuts();
      break;
    default:
      return;
  }
  e.preventDefault();
});
