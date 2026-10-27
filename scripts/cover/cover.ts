import { getCombination } from '../../src/core/data';
import { buildScale, type ScaleOptions } from '../../src/core/shades';

export const COMBINATIONS = [270, 108, 42, 17, 300, 7, 251, 159, 97, 214, 330, 126, 65, 289, 181, 23, 344, 148];

export const LIGHTER = 2;
export const DARKER = 2;
export const OPTIONS: ScaleOptions = { spacing: { mode: 'spread' }, hueShift: 6 };

const grid = document.getElementById('grid')!;
for (const id of COMBINATIONS) {
  const combo = getCombination(id);
  if (!combo) throw new Error(`Unknown combination ${id}`);
  const tile = document.createElement('div');
  tile.className = 'tile';
  for (const color of combo.colors) {
    const col = document.createElement('div');
    col.className = 'col';
    for (const shade of [...buildScale(color, LIGHTER, DARKER, OPTIONS).shades].reverse()) {
      const block = document.createElement('div');
      block.style.background = shade.hex;
      if (shade.kind === 'base') block.className = 'base';
      col.append(block);
    }
    tile.append(col);
  }
  const num = document.createElement('p');
  num.className = 'num';
  num.textContent = String(id).padStart(3, '0');
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.append(tile, num);
  grid.append(cell);
}
// make-cover.mjs waits for this.
document.body.dataset.ready = 'true';
