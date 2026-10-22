# Middag — middagsplanlegger

En norsk middagsplanlegger bygget med Next.js App Router, TypeScript og Tailwind CSS 4. Ingen database, innlogging eller API-nøkler trengs.

## Kom i gang

Krever Node.js 22 eller nyere og npm.

```bash
npm ci
npm run dev
```

Åpne utviklingsserveren på port 3000. Produksjon: `npm run build` etterfulgt av `npm start`.

I skymiljøer der standard npm-cache ikke er skrivbar, bruk `npm ci --cache /tmp/funny-npm-cache`.

## Funksjoner

- Ukeplan fra mandag til søndag med søk og kategorier i rettvelgeren.
- Plan, porsjoner og avkrysninger lagres i `localStorage` på samme enhet og nettleser.
- Samlet handleliste summerer ingredienser med samme navn og enhet, og skalerer etter antall personer. Ulike enheter summeres separat; ukjente mengder beholdes som tekst.
- Vis ingredienser, fremgangsmåte og kilde for hver rett.
- Fyll ledige dager med forslag, bytt middager, kopier handlelisten og kryss av varer.
- Responsivt grensesnitt, tastaturbetjening og støtte for redusert bevegelse.

## Hente oppskrifter fra Matprat

Skraperen bruker Playwright/Chromium, venter på oppskriftenes JSON-LD i den rendrede siden og lagrer tittel, ingredienser og fremgangsmåte i `src/data/recipes.json`. Appen leser denne filen direkte; produksjonsappen må bygges på nytt etter oppdateringer.

```bash
# Trengs bare hvis Chromium ikke allerede finnes på maskinen:
npx playwright install chromium

# Hent tre glutenfrie småretter og erstatt oppskriftsfilen:
npm run scrape

# Behold eksisterende oppskrifter og legg til / oppdater Matprat-oppskrifter:
npm run scrape -- --merge

# Finn flere oppskrifter fra Matprats kuraterte glutenfri-side:
npm run scrape -- --discover --limit 8 --merge

# Hent en bestemt oppskrift (flere --url er tillatt):
npm run scrape -- --url https://www.matprat.no/oppskrifter/familien/glutenfrie-pizzasnurrer/ --merge
```

Det er **minst 2 sekunders pause mellom hver sidenavigasjon**, også når forrige side feilet. `robots.txt` kontrolleres først. Oppskrifter godtas bare ved eksplisitt glutenfri tittel, `GlutenFreeDiet`-metadata eller lenke fra Matprats kuraterte glutenfri-side. Scriptet gjetter ikke at en tilfeldig oppskrift er glutenfri. Matprats glutenfri-side har hovedsakelig bakst og småretter; de tre standardadressene er pizzasnurrer, fylte horn og grove pannekaker.

Den medfølgende filen inneholder både egne eksempelmiddager og faktisk innhentede Matprat-oppskrifter, tydelig skilt med kildemetadata og kildevisning i appen. Eksempeloppskrifter utgir seg ikke for å komme fra Matprat. Sjekk alltid ingrediensenes emballasje for gluten og krysskontaminering.

Skraperen håndterer Recipe-arrays, `@graph`, instruksjonsseksjoner, norske desimaltall og vanlige enheter. Ukjente ingrediensformater beholdes uten oppdiktede mengder. Filen skrives atomisk etter vellykket innhenting; ved total feil beholdes den gamle filen. Delvise feil gir exit-kode 1 og lagrer kun vellykkede resultater. `--merge` bevarer i tillegg tidligere oppskrifter. Ingen nettverkstilgang er nødvendig for å kjøre appen med de lagrede dataene.

Systemets `/usr/bin/chromium` brukes automatisk hvis tilgjengelig. Et annet program kan angis med `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. `HTTPS_PROXY`/`https_proxy` støttes. Playwrights forespørselsklient verifiserer TLS med maskinens tillitsoppsett og leverer svarene til Chromium for rendering. TLS-verifisering deaktiveres aldri. Bare Matprat lastes, og bilder, skrifter og tredjepartssporing hoppes over. Nettverkspolicyen må tillate `www.matprat.no` og `matprat.no`. En eventuell Chromium-nedlasting trenger også Playwrights nedlastingsdomener.

## Prosjektstruktur

```text
src/
  app/                  # App Router, layout og globale Tailwind/stiler
  components/planner.tsx # Ukeplan, rettvelger og handleliste
  data/recipes.json     # Lokalt oppskriftsgrunnlag med kilde og tidspunkt
  lib/
    types.ts            # Felles datamodell
    planner.ts          # Summering, formatering og validering av lagrede data
scripts/
  scrape-matprat.ts     # CLI for innhenting med Playwright
  lib/matprat.ts        # Parsing av Matprats strukturerte oppskriftsdata
tests/
  planner.test.ts       # Enhetstester for summering, lagring og skraping
  e2e/planner.spec.ts   # Nettlesertester av brukerflyten
```

## Kontroller

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright-testene starter utviklingsserveren selv når port 3000 er ledig. De tester valg av rett, handleliste, skalering, avkrysning, lagring etter omlasting, tømming, søk, mobilvisning og utilgjengelig nettleserlagring.
