# CLAUDE.md

Guidance for Claude Code working on this repository. The README is the user-facing documentation; this file records
how the project is run, the decisions behind it and the owner's preferences, so they are not re-litigated.

## What this is

Wada Shades: a static web app (Vite + TypeScript, no framework) over the 348 colour combinations of Sanzo Wada's
*A Dictionary of Colour Combinations*. For the selected combination it generates darker and lighter shades per
colour (one global count, or one per colour), previews them and exports the palette as a GIMP `.gpl` file. Main use case of the owner: pixel art shading.

## Commands

```sh
npm install
npm run dev          # Vite dev server
npm test             # Vitest, tests/core.test.ts
npm run typecheck    # tsc --noEmit (TypeScript 7)
npm run build        # typecheck + static build in dist/ (base './')
npm run cover        # regenerate docs/cover.png (see README cover below)
```

Before every push: `npm test`, `npm run build`, and for UI changes a check in a real browser (below).

## Structure

```
src/data/colors.json        dataset, copied verbatim from mattdesl/dictionary-of-colour-combinations (MIT)
src/core/data.ts            colours, NAME_FIXES, the 348 combinations, relatedCombinations()
src/core/shades.ts          shade generation: buildScale(base, lighter, darker, ScaleOptions)
src/core/steps.ts           StepCounts per colour, mixed state, URL parameters (n, d, l)
src/core/palette.ts         buildPalette(), alignRows(), comboTitle(), paletteFileName()
src/core/nearest.ts         hex parsing and closest Wada colours (ΔE OK)
src/core/vision.ts          protan/deutan simulation matrices
src/core/export/            Exporter interface + gpl.ts; new formats register in export/index.ts
src/main.ts, src/style.css  the whole UI (vanilla DOM), index.html markup
scripts/cover/, make-cover.mjs   README cover page and its renderer
tests/core.test.ts          tests for everything in src/core
```

Keep logic in `src/core` (pure, tested) and only DOM code in `main.ts`.

Comments: only the essential ones (why something non-obvious is done, sources, sync reminders). No comments that
restate the code or document obvious fields; the reasoning lives here and in the README.

## Invariants (do not break)

- **The base colour is never altered.** Its swatch, the `.gpl` row and the hex all use the dataset's RGB values, never a
  round-tripped conversion.
- **`colors.json` stays untouched.** Name corrections go in `NAME_FIXES` (`data.ts`), documented in the README table.
  Search matches both `name` and `sourceName`. Wada's names follow Ridgway's *Color Standards and Color Nomenclature*
  (1912), which is the reference for spelling.
- **Shades are computed in OKLCH** with culori. Gamut mapping uses `clampChroma` (keeps L and H exactly);
  `toGamut` was rejected because it drifted hue up to 9°.
- **Spacing modes:** `spread` splits the room to the limit (L 0.99 light, 0.10 dark) into n + 1 parts; `fixed` moves L by
  a constant amount per step. In fixed mode a step past the limit **stops at the limit and later steps repeat that colour**
  (owner's explicit choice, not shrinking). Such steps, and steps of a base already at a limit (White), have
  `limited: true` and show a "LIMIT" badge.
- **Hue shift** is off by default (0); when set, highlights rotate towards OKLCH hue 100° and shadows towards 280°, never
  overshooting, greys unchanged.
- **Colour-blindness simulation** is view only (SVG feColorMatrix filter on `.app`): hex labels, copies and exports keep
  real colours. Only protan and deutan, at full severity, by owner's choice.
- **Steps per colour:** at most 8 per side (`MAX_STEPS`). The toolbar **Shades** stepper sets the same darker and
  lighter count on every colour; each colour has its own darker and lighter steppers. Counts that differ from the
  global value make the palette "mixed": changing Shades then asks for confirmation. A new combination starts with
  the global value on every colour.
- **Preview layout:** one column per colour; the original colours form the middle row (marked 和田 三造 in a left
  gutter), lighter shades above (L1 next to it), darker below. Columns are aligned on that row (`alignRows`).
- **Export:** one `.gpl` for the selected combination; one row per colour, dark to light; names `<Colour> dark 2`,
  `<Colour>`, `<Colour> light 1`. Uneven rows: no padding and no repeated colours by default (`Columns` = longest
  row); the optional filler (black by default, named `Filler`) pads them so the bases share a column. The owner uses
  Aseprite. File name `sanzo-wada-042-d2-l2[-step8][-hue10][-fill].gpl`, per-colour counts as `-d4.2-l2.1`.

## UI conventions

- State that changes the output lives in the URL hash: `c` combination, `d`/`l` steps (one value, or one per colour
  with `n` = global value when mixed), `s` fixed step size (absent = spread), `h` hue shift (absent = 0), `f` filler
  colour (absent = off). Combination changes push history (Back works); other changes replace it.
- Per-browser view preferences (height of the original colours' row) use `localStorage`, wrapped in try/catch. Not in the URL.
- Keyboard shortcuts live in one `keydown` handler in `main.ts`. Any change must be mirrored in the shortcuts dialog
  (`index.html`), control tooltips, and the README table. Shortcuts are ignored while typing in inputs, except Esc.
- Interface text is English with British spelling ("colour"). Light and dark theme via CSS variables in `style.css`;
  toolbar controls share one height (34px) so labels align; check the 390px mobile layout for overflow.

## README cover

`docs/cover.png` is rendered from the project's data by `npm run cover`: combinations and shade settings at the top of
`scripts/cover/cover.ts`, layout in `scripts/cover/index.html`. It uses the installed Chrome, else a Playwright
Chromium, or `COVER_BROWSER`. Fonts are Charter / Georgia and Inter, so output differs slightly between systems.

## Verifying in a browser (cloud container)

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `playwright-core` is a dev dependency. Build, run
`npx vite preview --port 4173` in the background, drive it with a small playwright-core script from the scratchpad, read
screenshots, then stop the server (`fuser -k 4173/tcp`; do not `pkill -f` a pattern that matches your own shell).
`npm run cover` needs `COVER_BROWSER=<that path>` here; on the owner's Mac it uses the installed Chrome.

## Git workflow

- Owner's rule: **push every change to `master`** and to the session's designated work branch.
  Only fast-forward `master` (`git merge-base --is-ancestor origin/master HEAD`, then `git push origin HEAD:master`).
  If `master` has commits not on the branch, stop and ask.
- Commit messages in English, imperative subject, body explaining why.
- The repository was renamed from `color-tool` to `wada-shades`; the package name matches.

## Owner preferences and decided scope

- Communicate concisely and precisely; ask targeted questions when a request is ambiguous. Avoid standalone dashes as
  punctuation in prose. The owner writes in Italian or English; repo content (README, UI, code) is English.
- Not wanted for now: export of several palettes at once, ASE export (never), other export formats (a hex list may come
  later), favourites, per-colour manual edits, filter by book chapter, a usage preview/mockup.
- Under consideration, not built: contrast matrix (WCAG / APCA) between the shades of a palette.
- Publishing (GitHub Pages or other) is on hold; the owner runs the app locally.
- README: written in the owner's first-person voice, personal but technical where it helps (inspired by Wada's book,
  made flexible for shading). Keep credits to other people's work. Trimmed on purpose: no formulas beyond the chroma
  taper, no project structure, URL parameter spec or cover instructions (those live in this file).
- The README cover must be original (generated from the project's data); do not add third-party images without the
  owner confirming the rights.
