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
4. Sotto ogni colore ci sono le altre combinazioni che lo usano: un clic apre la combinazione mantenendo i passi impostati.
5. **Export .gpl** scarica la palette della combinazione selezionata.
6. Il selettore **S/M/L/XL** sopra la palette originale ne regola l'altezza; la scelta viene ricordata dal browser.

### Ricerca per colore

Inserendo un hex completo nella ricerca (`#3a5f8b`, `3a5f8b` o `#abc`), oppure scegliendolo con il selettore colore accanto,
l'app mostra i 5 colori di Wada più vicini con la loro distanza percettiva (ΔE OK, cioè la distanza euclidea in OKLab ×100;
circa 2 è la minima differenza percepibile) e ordina la lista per vicinanza.
Un clic su uno dei colori trovati limita la lista alle combinazioni che lo contengono.

### Scorciatoie da tastiera

| Tasto | Azione |
| --- | --- |
| `↓` `J` / `↑` `K` | Combinazione successiva / precedente nella lista filtrata |
| `D` / `Shift+D` | Un passo scuro in più / in meno |
| `L` / `Shift+L` | Un passo chiaro in più / in meno |
| `E` | Export .gpl |
| `/` | Vai alla ricerca |
| `Esc` | Azzera la ricerca |
| `?` | Mostra le scorciatoie |

Lo stato è nell'URL (`#c=42&d=2&l=2`), quindi una configurazione si può salvare o condividere.
Il tasto Indietro del browser torna alla combinazione precedente.

## Dati

`src/data/colors.json` proviene da [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations)
(MIT, licenza in `src/data/`). È lo stesso dataset usato da bravokiloecho/color-combinations-sanzo-wada-public:
159 colori convertiti da CMYK con profili ICC (U.S. Web Coated SWOP v2 → sRGB), più fedeli alla stampa
rispetto ai valori originali di dblodorn/sanzo-wada. Il file è copiato senza modifiche.

I nomi di Wada derivano da *Color Standards and Color Nomenclature* di Robert Ridgway (1912).
I refusi del dataset sono corretti in `NAME_FIXES` (`src/core/data.ts`), non nel JSON, quindi la fonte resta verificabile:

| Dataset | Corretto |
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

La ricerca trova i colori sia con il nome corretto sia con quello originale.

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
src/core/data.ts           dataset, correzioni dei nomi, 348 combinazioni e combinazioni correlate
src/core/shades.ts         generazione delle tinte
src/core/palette.ts        palette di una combinazione, titolo e nome file
src/core/nearest.ts        ricerca dei colori più vicini (ΔE OK)
src/core/export/           exporter intercambiabili (gpl; altri formati, es. lista hex, si aggiungono qui)
src/main.ts, style.css     interfaccia
tests/                     test Vitest del core
```
