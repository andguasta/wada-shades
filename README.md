# Wada Shades

A static web app that generates lighter and darker shades for the 348 combinations in Sanzo Wada's
*A Dictionary of Colour Combinations*, with a live preview and export to GIMP Palette (`.gpl`).

## Getting started

Requires Node.js 20 or later.

```sh
npm install
npm run dev        # development server
npm test           # core tests
npm run build      # static build in dist/ (relative base, can be hosted anywhere)
npm run preview    # serve the build locally
```

## Usage

1. Pick a combination from the list (filter by number of colours, search by name, number or hex).
2. Set how many **Darker** and **Lighter** steps to generate (0 to 10 on each side), and how far apart they are
   with **Spacing** (see below).
3. Check the preview: Wada's original colour is outlined and never altered. Click a shade to copy its hex.
4. Under each colour, the other combinations that use it are listed: click one to open it with the same step settings.
5. **Export .gpl** downloads the palette of the selected combination.
6. The **S/M/L/XL** control above the original palette sets its height; the browser remembers the choice.

The state lives in the URL (`#c=42&d=2&l=2`, plus `&s=8` for fixed spacing), so a configuration can be bookmarked or shared.
The browser's Back button returns to the previous combination.

### Search by colour

Enter a full hex in the search box (`#3a5f8b`, `3a5f8b` or `#abc`), or choose one with the colour picker next to it.
The app shows the 5 closest Wada colours with their perceptual distance (ΔE OK: Euclidean distance in OKLab ×100;
about 2 is the smallest noticeable difference) and orders the list by closeness.
Click one of the matches to show only the combinations that contain it.

### Colour blindness simulation

The **Vision** control (or the `V` key) shows the whole interface as seen with protanopia (no red cones)
or deuteranopia (no green cones). Together with their milder forms, these cover almost all cases of colour blindness:
about 8% of men and 0.4% of women of European ancestry. The simulation uses the Machado, Oliveira and Fernandes (2009)
matrices at full severity, the worst case, applied in linear RGB (`src/core/vision.ts`).
It only changes the view: displayed hex values, copies and exports always keep the real colours.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `↓` `J` / `↑` `K` | Next / previous combination in the filtered list |
| `D` / `Shift+D` | One more / one fewer darker step |
| `L` / `Shift+L` | One more / one fewer lighter step |
| `S` | Toggle spacing: spread, fixed |
| `[` / `]` | Smaller / larger fixed step |
| `V` | Cycle vision: normal, protan, deutan |
| `E` | Export .gpl |
| `/` | Focus the search |
| `Esc` | Clear the search |
| `?` | Show the shortcuts |

## Data

`src/data/colors.json` comes from [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations)
(MIT, licence in `src/data/`), the same dataset used by
[bravokiloecho/color-combinations-sanzo-wada-public](https://github.com/bravokiloecho/color-combinations-sanzo-wada-public).
Its 159 colours were converted from CMYK with ICC profiles (U.S. Web Coated SWOP v2 → sRGB) and are closer to the printed book
than the original values in [dblodorn/sanzo-wada](https://github.com/dblodorn/sanzo-wada). The file is copied unchanged.

Wada's colour names come from Robert Ridgway's *Color Standards and Color Nomenclature* (1912).
Typos in the dataset are corrected in `NAME_FIXES` (`src/core/data.ts`) rather than in the JSON, so the source stays verifiable:

| Dataset | Corrected |
| --- | --- |
| Rosolanc Purple | Rosolane Purple |
| Pomegranite Purple | Pomegranate Purple |
| Vistoris Lake | Victoria Lake |
| Sulpher Yellow | Sulphur Yellow |
| Krongbergs Green | Kronberg's Green |
| Artemesia Green | Artemisia Green |
| Calamine BLue | Calamine Blue |
| Cerulian Blue | Cerulean Blue |
| Antwarp Blue | Antwerp Blue |
| Vandar Poel's Blue | Vanderpoel's Blue |
| Veronia Purple | Vernonia Purple |
| Eugenia Red \| A, Eugenia Red \| B | Eugenia Red A, Eugenia Red B |
| Grayish Lavender - A, Grayish Lavender - B | Grayish Lavender A, Grayish Lavender B |

Search matches both the corrected and the original name.

## Shade algorithm (`src/core/shades.ts`)

Shades are computed in **OKLCH**, a perceptually uniform colour space:

* **Base colour:** always the dataset's original RGB values, never converted.
* **Lightness:** lighter steps move from the base L towards 0.99 and darker steps towards 0.10.
  How far apart they are depends on the **Spacing** option:
  * **Spread** (default): the room between the base and the limit is split into n + 1 equal parts
    (`L = L_base + (limit − L_base) · i / (n + 1)`). The steps always use the colour's whole range, so few steps are far apart,
    and a colour close to a limit gets small steps on that side.
  * **Fixed**: every step changes lightness by the same amount on every colour, set from 2 to 20 (OKLCH lightness × 100,
    default 8). Good for close, even ramps such as pixel art shading. When a colour has no room for that amount,
    its steps shrink to the spread spacing, so they never pile up at the limit.

  Either way no step reaches pure white or black.
* **Hue:** constant.
* **Chroma:** reduced as `C = C0 · (1 − t²)`, where `t` is how far the step is towards the limit (0 at the base, 1 at the limit),
  since white and black have no chroma; it stays almost full near the base colour.
* **Gamut:** colours outside sRGB are brought back by reducing chroma only, keeping L and H
  (culori's `clampChroma`), then rounded to 8 bits.
* **Edge case:** a colour already past the limit (White, L = 1) has nothing lighter, so those steps stay white.

## `.gpl` format

```
GIMP Palette
Name: Sanzo Wada 042
Columns: 5
#
 69  51   0	Yellow Ocher dark 2
146 112   0	Yellow Ocher dark 1
226 181  64	Yellow Ocher
244 203 106	Yellow Ocher light 1
252 228 171	Yellow Ocher light 2
 24  17  50	Violet dark 2
...
```

One row per colour of the combination, ordered from darkest to lightest (`Columns` = total steps per row).
File name: `sanzo-wada-042-d2-l2.gpl`, or `sanzo-wada-042-d2-l2-step8.gpl` with fixed spacing.

## Project structure

```
src/core/data.ts           dataset, name fixes, the 348 combinations and related combinations
src/core/shades.ts         shade generation
src/core/palette.ts        palette of a combination, title and file name
src/core/nearest.ts        closest-colour search (ΔE OK)
src/core/vision.ts         protanopia and deuteranopia simulation
src/core/export/           pluggable exporters (gpl; other formats such as a hex list go here)
src/main.ts, style.css     user interface
tests/                     Vitest tests for the core
```
