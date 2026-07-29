# 🍵 Teák – klinikai kártyák / Ceaiuri / Teas / Tees

Egyetlen, önálló HTML-fájl (`index.html`): 34 gyógy-, fűszer-, gyümölcs-, nyugtató-,
ginzeng- és gombatea kártyája, mindegyiknél a hatás, az elkészítés és a mögötte álló
klinikai vizsgálatok eredménye – **PubMed-linkekkel a leírás alatt**.

## Nyelvek

Négy nyelv, a jobb felső sarokban váltható: **HU · RO · EN · DE**

- A választott nyelv megmarad (`localStorage`), és az URL végére is kikerül (`index.html#en`),
  így a link megosztható a kívánt nyelven.
- Első megnyitáskor a böngésző nyelve alapján választ, ha az egyike a négynek – különben magyar.

## Mit tartalmaz

- **34 tea-kártya** – koppintásra megfordul; hátul *Elkészítés* és *Klinikai eredmény*
  (hagyományos használatú növényeknél *Hagyományos használat*).
- **Vizsgálat-linkek a leírás után** – minden felugró ablakban, minden nyelven ott van a
  tudományos háttér: 68 konkrét hivatkozás (vizsgálat típusa, éve, folyóirata), mindegyiknél
  **PubMed + DOI + OpenAlex** link, plusz egy PubMed- és OpenAlex-keresés, amellyel a növény
  teljes szakirodalma megnyitható.
- **A hivatkozások ellenőrizve** – mind a 67 egyedi PMID valódi, a rögzített címek egyeznek a
  PubMed-ben szereplő címekkel, és visszavont közlemény nincs köztük.
- **Szűrés cél szerint** – alvás, emésztés, megfázás, vérnyomás, fájdalom, hangulat,
  nő-egészség, immunitás, vércukor.
- **Keresés** az oldalsávban, tea-név szerint.
- **Források oldal** – a hivatkozott vizsgálatok tömör összefoglalói, linkkel.
- **Nyomtatás / PDF** – az összes tea teljes szöveggel, az aktuális nyelven, a linkekkel együtt.

## Mobil

Telefonon ellenőrizve, automata teszttel (Playwright), **5 képernyőméreten × 4 nyelven**
(320, 375, 390, 768, 1280 px):

- nincs vízszintes görgetés egyetlen nyelven és méreten sem;
- a kártyák magassága a tartalomhoz igazodik, ezért a hosszabb német/román szöveg sem lóg ki;
- a felugró ablak a képernyőn belül marad és végiggörgethető;
- az érintőfelületek legalább ~44 px magasak;
- az oldalsáv menü nyílik/záródik (☰, ×, háttérre koppintás), és nem lóg ki a képernyőről;
- mind a 34 teánál, mind a 4 nyelven van link a leírás alatt.

A teszt újrafuttatható a `scripts/check.mjs` fájllal (Playwright szükséges):

```bash
node scripts/check.mjs /abszolút/út/index.html
```

## Megjelenés

Sötét, színes gradiens háttér + **glass-panel (liquid glass) effekt** minden panelen,
mobilon kisebb blurral (11px) a gyorsaság és olvashatóság érdekében,
desktopon 15px-tel. `-webkit-backdrop-filter` mindenhol beállítva a Safari miatt.

## Fontos

Tájékoztató, tudományos áttekintés – **nem személyre szabott orvosi tanács**.
Meglévő betegség, terhesség/szoptatás vagy gyógyszerszedés esetén, illetve tömény
kivonatok/étrend-kiegészítők előtt orvosi vélemény szükséges. A teák hatása jellemzően
enyhébb, mint a vizsgálatokban használt tömény kivonatoké.
