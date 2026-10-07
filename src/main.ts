import './style.css';
import { combinations, getCombination, type Combination } from './core/data';
import { exporters } from './core/export';
import { buildPalette, comboTitle, paletteFileName } from './core/palette';
import { MAX_STEPS, type Shade } from './core/shades';

interface State {
  comboId: number;
  lighter: number;
  darker: number;
  size: number;
  query: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  list: $<HTMLUListElement>('combo-list'),
  count: $<HTMLParagraphElement>('count'),
  search: $<HTMLInputElement>('search'),
  sizeFilter: $<HTMLDivElement>('size-filter'),
  title: $<HTMLHeadingElement>('combo-title'),
  colors: $<HTMLParagraphElement>('combo-colors'),
  lighter: $<HTMLInputElement>('lighter'),
  darker: $<HTMLInputElement>('darker'),
  exportBtn: $<HTMLButtonElement>('export'),
  original: $<HTMLElement>('original'),
  preview: $<HTMLElement>('preview'),
  toast: $<HTMLDivElement>('toast'),
};

const clampSteps = (n: number) => (Number.isFinite(n) ? Math.min(MAX_STEPS, Math.max(0, Math.round(n))) : 0);

function readHash(): Partial<State> {
  const params = new URLSearchParams(location.hash.slice(1));
  const out: Partial<State> = {};
  const c = Number(params.get('c'));
  if (getCombination(c)) out.comboId = c;
  if (params.has('l')) out.lighter = clampSteps(Number(params.get('l')));
  if (params.has('d')) out.darker = clampSteps(Number(params.get('d')));
  return out;
}

const state: State = { comboId: 1, lighter: 2, darker: 2, size: 0, query: '', ...readHash() };

function writeHash() {
  const hash = `#c=${state.comboId}&d=${state.darker}&l=${state.lighter}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
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
  return combo.colors.some((c) => c.name.toLowerCase().includes(q) || c.hex.includes(q));
}

const listItems = new Map<number, HTMLLIElement>();

function renderList() {
  const frag = document.createDocumentFragment();
  for (const combo of combinations) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'combo-item';
    btn.dataset.id = String(combo.id);
    btn.setAttribute('aria-label', `${comboTitle(combo.id)}: ${combo.colors.map((c) => c.name).join(', ')}`);
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
    li.append(btn);
    listItems.set(combo.id, li);
    frag.append(li);
  }
  els.list.append(frag);
}

function applyFilter() {
  let visible = 0;
  for (const combo of combinations) {
    const show = matches(combo);
    listItems.get(combo.id)!.hidden = !show;
    if (show) visible++;
  }
  els.count.textContent = `${visible} of ${combinations.length} combinations`;
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
  const label = document.createElement('span');
  label.className = 'swatch-label';
  label.textContent = shade.kind === 'base' ? 'base' : `${shade.kind === 'dark' ? 'D' : 'L'}${shade.step}`;
  const hex = document.createElement('span');
  hex.className = 'swatch-hex';
  hex.textContent = shade.hex;
  el.append(label, hex);
  return el;
}

function render() {
  const combo = getCombination(state.comboId)!;
  els.lighter.value = String(state.lighter);
  els.darker.value = String(state.darker);
  els.title.textContent = comboTitle(combo.id);
  els.colors.textContent = combo.colors.map((c) => c.name).join(' · ');

  for (const [id, li] of listItems) {
    const btn = li.firstElementChild as HTMLButtonElement;
    if (id === combo.id) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  }

  els.original.replaceChildren(
    ...combo.colors.map((c) => {
      const s = document.createElement('div');
      s.style.background = c.hex;
      return s;
    }),
  );

  const palette = buildPalette(combo, state.lighter, state.darker);
  els.preview.style.setProperty('--cols', String(state.darker + state.lighter + 1));
  els.preview.replaceChildren(
    ...palette.scales.map((scale) => {
      const row = document.createElement('div');
      row.className = 'scale';
      const name = document.createElement('div');
      name.className = 'scale-name';
      name.textContent = scale.base.name;
      const swatches = document.createElement('div');
      swatches.className = 'scale-swatches';
      swatches.append(...scale.shades.map(swatch));
      row.append(name, swatches);
      return row;
    }),
  );
  writeHash();
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
  const text = exporter.serialize(buildPalette(combo, state.lighter, state.darker));
  const url = URL.createObjectURL(new Blob([text], { type: exporter.mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = paletteFileName(combo, state.lighter, state.darker, exporter.extension);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setSteps(key: 'lighter' | 'darker', value: number) {
  state[key] = clampSteps(value);
  render();
}

renderList();
applyFilter();
render();
// Scroll only the list, never the page (scrollIntoView would move the page on mobile).
const current = listItems.get(state.comboId);
if (current) els.list.scrollTop = current.offsetTop - els.list.clientHeight / 2;

els.list.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.combo-item');
  if (!btn) return;
  state.comboId = Number(btn.dataset.id);
  render();
});

els.sizeFilter.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!btn) return;
  state.size = Number(btn.dataset.size);
  applyFilter();
});

els.search.addEventListener('input', () => {
  state.query = els.search.value;
  applyFilter();
});

document.querySelectorAll<HTMLButtonElement>('.stepper button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.target as 'lighter' | 'darker';
    setSteps(key, state[key] + Number(btn.dataset.delta));
  });
});

for (const key of ['lighter', 'darker'] as const) {
  els[key].addEventListener('change', () => setSteps(key, Number(els[key].value)));
}

els.preview.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLButtonElement>('.swatch');
  if (!el?.dataset.hex) return;
  try {
    await navigator.clipboard.writeText(el.dataset.hex);
    toast(`Copied ${el.dataset.hex}`);
  } catch {
    toast(el.dataset.hex);
  }
});

els.exportBtn.addEventListener('click', exportPalette);

window.addEventListener('hashchange', () => {
  Object.assign(state, readHash());
  render();
});
