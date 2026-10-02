# Nothing Can Stop Us Now Betting

Static site (GitHub Pages). No build step: `index.html` loads the JSON files next to it.

| File | Written by | When |
|---|---|---|
| `index.html`, `ufc.js` | by hand | on design changes |
| `ncaab_backtest.json` | cloud pipeline (`gen_site_json.py`) | when the backtest changes |
| `ncaab_today.json`, `ncaab_live.json` | PC, `publish_site.py` (called by `daily.py`) | every morning |
| `ufc_*.json` | UFC pipeline | fight weeks |

Setup: Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`.
On the PC: `git clone https://github.com/<you>/<repo>.git C:\Users\mkbog\Desktop\Basketball\ncsun\site_repo`
