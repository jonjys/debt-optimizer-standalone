# Lånekalkylator PRO — debt-optimizer-standalone

**Live:** https://debt-optimizer-standalone.vercel.app/

Svensk skuldoptimerare: rak/annuitet, manuell kaskad, engångs (skatt), LTV-trappa (apr 2026), baka in blancolån i bolån.

## Status 2026-08-17 — PROD READY

| Feature | Status |
|---------|--------|
| Engine `calculatePayoffSchedule` (Big.js) | ✅ |
| Overview aldrig 0/0 vid skuld > 0 | ✅ |
| Nordea rak 5.95% / Nordax annuitet 9.09% | ✅ |
| BETALA TOTALT (top-up) + live datum | ✅ |
| Extra/mån + engångs med datum | ✅ |
| Manuell reinvest (När Nordea klart) | ✅ |
| Jämför: Idag / Lavin / Snöboll | ✅ |
| Baka in + LTV-trappa + ränteavdrag 30% | ✅ |
| Sticky mobil KPI | ✅ |
| Tom mall + Ladda exempel | ✅ |

### LTV-trappa (bake-in.ts)
- LTV > 70% → 2%/år
- LTV 50–70% → 1%/år
- LTV < 50% → 0%
- Skuldkvotstillägg borttaget apr 2026
- Varning röd >85%, gul vid korsning 70%

## Kör lokalt

```bash
npm install
npm run dev
```

## Arkitektur

```
app/page.tsx                      # PRO UI (Idag / Jämför / Baka in)
lib/debt-optimizer/
  engine.ts                       # calculatePayoffSchedule (orör)
  bake-in.ts                      # Svensk LTV-trappa
  types.ts
  parser.ts
```

## Regler

1. Rör aldrig core engine / Big.js / rak-annuitet-logik utan tester
2. Mobil-först (390px)
3. Manuell reinvest — ingen tyst auto-kaskad

**Ägare:** @jonjys  
**Live:** https://debt-optimizer-standalone.vercel.app/
