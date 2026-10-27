# Wada Shades

![Shade ramps generated for 18 of Sanzo Wada's colour combinations](docs/cover.png)

Sanzo Wada's *A Dictionary of Colour Combinations* is one of my favourite colour books. It holds 348 small
combinations of two, three or four colours, put together in the 1930s and still surprisingly fresh. I kept going back
to it for pixel art. The colours are beautiful, but each one comes as a single flat swatch, and shading a sprite needs
a few darker and lighter tones around each colour.

So I built this small tool. You pick a combination from the book, and it builds shades around each colour that stay
in the same family. Then it exports the result as a palette I can load straight into Aseprite (or GIMP, or anything
else that reads `.gpl`). Wada's original colours are never changed. They sit in the middle of each ramp exactly as they
are in the dataset.

## Running it

It runs locally in the browser. You need Node.js 20 or newer.

```sh
npm install
npm run dev      # open the URL Vite prints
npm test
npm run build    # static files in dist/, they work from any folder
```

## How I use it

Pick a combination in the sidebar. You can filter it by number of colours and search by name or number. If you paste a
hex code, or pick a colour with the colour picker, the search finds the five closest Wada colours and shows the
combinations that use them.

**Shades** sets how many darker and lighter tones every colour gets (up to 8 on each side). Each colour also has its
own small steppers, so a skin tone can get four shadows while an accent colour gets one. When the counts differ the
toolbar shows *mixed*.

**Spacing** decides how far apart the shades are:

- *Spread* uses the whole room each colour has, from its own lightness up to almost white and down to almost black.
- *Fixed* moves lightness by the same amount every step, on every colour. I use this most for pixel art, because the
  ramps feel even across the palette. When a step would go past white or black it stops there, and the preview marks
  it **LIMIT**.

**Hue shift** is the classic pixel art trick: highlights lean towards warm yellow, shadows towards blue violet. It's
off by default and goes up to 30° per step.

Click any swatch to copy its hex. Below the preview you'll find the other combinations that use the same colours,
which is a nice way to wander through the book.

**Vision** shows the whole interface as someone with protanopia or deuteranopia would see it, to check that the shades
still read as separate tones. It only changes what you see on screen. Copied hex values and exports always use the
real colours.

Everything that affects the palette is kept in the URL, so a link brings back exactly the same setup.

### Shortcuts

| Key | Action |
| --- | --- |
| `↓` `J` / `↑` `K` | Next / previous combination |
| `+` / `-` | One more / one fewer shade on every colour |
| `S` | Switch spacing between spread and fixed |
| `[` / `]` | Smaller / larger fixed step |
| `H` / `Shift+H` | More / less hue shift |
| `V` | Cycle vision: normal, protan, deutan |
| `E` | Export .gpl |
| `/` | Focus the search |
| `Esc` | Clear the search |
| `?` | Show the shortcuts |

## How the shades are made

All the maths happens in [OKLCH](https://bottosson.github.io/posts/oklab/), where equal steps in lightness actually
look equal. That isn't true of RGB or HSL. For each step the tool:

- moves lightness towards 0.99 for lighter shades and towards 0.10 for darker ones;
- lowers chroma as it gets close to those limits (`C = C₀ · (1 − t²)`), because near white and near black there's
  little room for colour. Close to the base colour it stays almost fully saturated;
- optionally rotates the hue a few degrees towards 100° (highlights) or 280° (shadows), never past the target. Greys
  stay grey;
- brings anything outside sRGB back by lowering chroma only, so lightness and hue don't drift. I first tried a
  different gamut mapping and some colours drifted up to 9° in hue.

The colour maths comes from [culori](https://culorijs.org/). The colour blindness simulation uses the matrices from
Machado, Oliveira and Fernandes (2009) at full severity.

## The exported palette

One row per colour, from dark to light:

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

If the colours have different numbers of shades, the rows are written one after another without gaps. Turn on
**Filler** to pad the shorter rows with a colour of your choice (black by default), so the original colours line up in
one column in Aseprite's palette grid. The file name records the settings, for example
`sanzo-wada-042-d2-l2-step8.gpl`.

## Where the colours come from

The colour data is [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations)
(MIT, licence in `src/data/`), copied without changes. It's the same dataset behind
[bravokiloecho's Sanzo Wada site](https://github.com/bravokiloecho/color-combinations-sanzo-wada-public). The CMYK
values were converted with proper ICC profiles, so they are closer to the printed book than the earlier
[dblodorn/sanzo-wada](https://github.com/dblodorn/sanzo-wada) values.

Wada took his colour names from Robert Ridgway's *Color Standards and Color Nomenclature* (1912). A few names in the
dataset have typos, like *Cerulian Blue* or *Pomegranite Purple*. I fix them in the app (`NAME_FIXES` in
`src/core/data.ts`) and leave the JSON alone, so it can still be checked against the source. Search finds both
spellings.

If you love these colours, get the book. Seigensha publishes the English edition, and it's worth having on paper.

The cover image at the top is generated from the app's own data with `npm run cover`.
