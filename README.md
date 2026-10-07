# Wada Shades

Web app statica per generare tinte più chiare e più scure a partire dalle 348 combinazioni di
*A Dictionary of Colour Combinations* di Sanzo Wada, con anteprima ed export in formato GIMP Palette (`.gpl`).

## Uso

```sh
npm install
npm run dev        # sviluppo
npm test           # test del core
npm run build      # build statica in dist/ (base relativa, pubblicabile ovunque)
```

1. Scegli una combinazione dalla lista (filtri per numero di colori, ricerca per nome, hex o numero).
2. Imposta quanti passi **Darker** e **Lighter** generare (da 0 a 10 per lato).
3. Controlla l'anteprima: il colore originale di Wada è evidenziato e non viene mai modificato. Un clic su una tinta ne copia l'hex.
4. **Export .gpl** scarica la palette della combinazione selezionata.

Lo stato è nell'URL (`#c=42&d=2&l=2`), quindi una configurazione si può salvare o condividere.

## Dati

`src/data/colors.json` proviene da [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations)
(MIT, licenza in `src/data/`). È lo stesso dataset usato da bravokiloecho/color-combinations-sanzo-wada-public:
159 colori convertiti da CMYK con profili ICC (U.S. Web Coated SWOP v2 → sRGB), più fedeli alla stampa
rispetto ai valori originali di dblodorn/sanzo-wada. Il file è copiato senza modifiche.

## Algoritmo delle tinte (`src/core/shades.ts`)

Calcolo in **OKLCH**, spazio percettivamente uniforme:

* **Colore base:** usa sempre i valori RGB originali del dataset, senza conversioni.
* **Luminosità:** i passi chiari vanno dalla L del colore base verso 0.99, quelli scuri verso 0.10, a intervalli uguali
  (`t = i / (n + 1)`), quindi nessun passo coincide con bianco o nero puro.
* **Tono:** costante.
* **Croma:** ridotta con `C = C0 · (1 − t²)`, perché bianco e nero non hanno croma; resta quasi piena vicino al colore base.
* **Gamut:** ciò che esce da sRGB viene riportato dentro riducendo solo la croma, a L e H invariati
  (`clampChroma` di culori), poi arrotondato a 8 bit.
* **Caso limite:** un colore già oltre il limite (White, L = 1) non ha tinte più chiare: quei passi restano bianchi.

## Formato `.gpl`

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

Una riga logica per ogni colore della combinazione, ordinata dalla più scura alla più chiara (`Columns` = passi totali).
Nome file: `sanzo-wada-042-d2-l2.gpl`.

## Struttura

```
src/core/data.ts           dataset e costruzione delle 348 combinazioni
src/core/shades.ts         generazione delle tinte
src/core/palette.ts        palette di una combinazione, titolo e nome file
src/core/export/           exporter intercambiabili (gpl; altri formati, es. lista hex, si aggiungono qui)
src/main.ts, style.css     interfaccia
tests/                     test Vitest del core
```
