# Nothing Can Stop Us Now Betting

Static site (GitHub Pages, deploy from `main` at `/`). No build step: `index.html` loads `app.js`, one module per model under `sports/`, and the JSON files next to it.

## How the site is put together

| Piece | What it is |
|---|---|
| `index.html` | the shell: styles, header (one mascot per ride), Home, and an empty container per model |
| `app.js` | the engine. Normalizes every model's bets into one record, and renders everything from it: Home, the card, live record, backtest, Slice Lab, coaster chart, bet log, bet cards, routing |
| `sports/ncaab.js`, `ufc.js`, `nfl.js`, `cfb.js`, `mlb.js` | one adapter per model: how to read its files, its slicing dimensions, its "why" chart, its extras (UFC full card + DFS, NFL slate projections, CFB win totals), and its How-it-works / Under-the-hood text |
| `activity.json`, `hub_status.json` | written by the hub (below): the Home page's activity log and the hub heartbeat |

Every ride has the same stops: **Card · Live · Backtest (or All seasons) · How it works · Under the hood**, plus any extras the module declares. Hashes: `#ufc`, `#ufc-live`, `#nfl-record`, … Home is `#` or `#home`.

## Data files (unchanged: each model's pipeline writes exactly what it wrote before)

| File | Written by | When |
|---|---|---|
| `ncaab_today.json`, `ncaab_live.json` | PC, `Basketball\ncsun\daily.py` → `publish_site.py` | 4:40 AM on game days |
| `ncaab_backtest.json` | cloud pipeline (`gen_site_json.py`) | when the backtest changes |
| `ufc_today/live/backtest/status/paper/dfs.json` | `ufc_model\v2\ufcmodel\publish_site.py` | 9 AM and 5 PM ET |
| `nfl_today/live/backtest/status.json` | `Basketball\nfl_model\publish_site.py` via `nfl_auto.py` | prep, each lock window, grade |
| `cfb_picks.json`, `cfb_totals.json` | `Basketball\cfb_sync.py` from the "Nothing Can Stop Us Now Bets" Google Sheet | when the sheet changes |
| `activity.json`, `hub_status.json` | `Basketball\ncsun_hub.py` | every 10 min (commits only when something happened, or hourly) |

The UFC publisher's optional `--js` flag used to copy `ufc.js` to the repo root; that file is now `sports/ufc.js` and is edited by hand, so don't use `--js`.

## Adding a model (MLB next spring, or anything else)

Write four files in the generic feed shape and the tab appears on its own (the site probes `<id>_status.json`):

- `<id>_today.json` → `{"updated": "YYYY-MM-DD HH:MM", "picks": [row…]}`
- `<id>_live.json` → `[row…]` (graded picks this season), `<id>_backtest.json` → `[row…]`
- `<id>_status.json` → `{"step": {"ok": true, "at": "…", "msg": ""}}`

A row: `{"d": "2027-04-03", "t": "19:05", "ev": "NYY at BOS", "pick": "Red Sox -130", "detail": "moneyline", "mk": "Moneyline", "tier": "A", "o": -130, "bk": "FanDuel", "p": 0.60, "m": 0.56, "e": 4.1, "why": [{"label": "…", "v": "…", "pts": 2.3}], "posted": "2027-04-03 09:10", "r": "W", "pl": 0.77, "act": "5-3", "clv": null}` (`r`/`pl`/`act` only once graded). `sports/mlb.js` already registers the tab with `NCSUN.generic({...})`; give it real dims and prose when the model is ready. The hub reads the same files with `generic_recs("mlb")`.

## The hub: notifications

`Basketball\ncsun_hub.py` runs every 10 minutes (task "NCSUN hub", registered by `ncsun_hub_register.py`). It reads the files above, keeps `ncsun_hub_state.json`, and sends Pushover pushes (keys in `ncsun_hub_secrets.json`) for: new bets, bets starting, bets graded (batched per model, with the day's record), a model whose run failed or went stale (alerted once, re-alerted after 24 h), a morning digest at 7 AM (what's open, plus anything held overnight) and an evening digest at 11 PM (how the day went). Pushes between 11 PM and 7 AM wait for the morning digest; run alerts go out immediately. `python ncsun_hub.py --dry` shows what it would do without sending, writing or pushing.

## Setup on a new PC

```
git clone https://github.com/<you>/<repo>.git C:\Users\mkbog\Desktop\Basketball\ncsun\site_repo
```
Then `python ncsun_hub_register.py` from the Basketball folder (once), and fill in `ncsun_hub_secrets.json`.

## Changes, Nov 22 2026

- **Alerts are email** (Gmail, the hoops model's credentials). New picks and line changes go out the moment the hub sees them, quiet hours or not; grades that land overnight follow the 7 AM digest in full. Every line says how far it is still a bet; hoops and UFC grades say what we got and where the line closed.
- **Subscribers**: `Basketball\ncsun_subscribers.json` (private, never in this repo), managed with `python ncsun_subs.py add|set|remove|list`. Each person picks sports and `all` (every pick + results) or `digest` (one morning email). They never get run alerts or paper picks.
- **Pick keys are stable** (sport, day, game, selection): a new line, price or book is an "updated" notice.
- **Run problems** alert once per distinct problem; standing ones are listed in the morning digest. A data file that fails to parse is a run problem.
- **`activity.json` is pick events only.** The Home activity log, raw run-problem text, dollar stakes and own slips are drawn only in the owner view: open the site once with `#owner` (`#owner-off` to hide). This changes what is drawn; the files themselves are public.
- **Get picks** page (`#get`): what the site is, how to read a pick, the closing line, and picks by email.
- **Closing line**: every graded hoops and UFC card shows got / closed; hoops Live has a "Beating the close" panel; Home tiles and the trend strip show it. Home's combined track is models only (CFB hand picks shown apart).
- **Guards**: `.git/hooks/pre-commit` (source: `Basketball\ncsun_ops\pre-commit`) refuses broken JSON, NaN and backup files; it is per-clone, so re-install it after a fresh clone with `python ncsun_ops_install.py`. `.github/workflows/watchdog.yml` opens an issue ("NCSUN laptop quiet") when `hub_status.json` is 100+ minutes old.
- **Tab files have masters in the model folders**: `nfl_model\site\sports_nfl.js` → `sports/nfl.js`, `ufc_model\v2\site\sports_ufc.js` → `sports/ufc.js`. Edit the master, or the next model run puts the old one back.
