# Nothing Can Stop Us Now Betting

Static site (GitHub Pages). No build step: `index.html` loads the JSON files next to it.

| File | Written by | When |
|---|---|---|
| `index.html`, `ufc.js`, `cfb.js` | by hand | on design changes |
| `ncaab_backtest.json` | cloud pipeline (`gen_site_json.py`) | when the backtest changes |
| `ncaab_today.json`, `ncaab_live.json` | PC, `publish_site.py` (called by `daily.py`) | every morning |
| `ufc_*.json` | UFC pipeline | fight weeks |
| `cfb_picks.json`, `cfb_totals.json` | PC, `cfb_sync.py` (rebuilds from the "Nothing Can Stop Us Now Bets" Google Sheet) | when the sheet changes |

The College football tab (`#cfb`) is hand picks, not model output. It reads only the joint "Football Betting YYYY" and
"YYYY O/U PICKS" tabs: a green team cell is the side taken, green/red O/U cell is over/under, W/L/P columns are the grade.
`cfb_build.py` refuses to publish if a season's rebuilt record doesn't match the record shown in the sheet.

Setup: Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`.
On the PC: `git clone https://github.com/<you>/<repo>.git C:\Users\mkbog\Desktop\Basketball\ncsun\site_repo`
