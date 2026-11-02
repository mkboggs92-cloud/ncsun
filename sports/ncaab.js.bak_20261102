/* College basketball — adapter for ncaab_today.json, ncaab_live.json, ncaab_backtest.json (written by daily.py / the cloud pipeline). */
(function () {
  const U = NCSUN.u, { esc, fmtU, pct, am, lnTxt, dateTxt, timeTxt, load, etToday } = U;
  const BOOK = { DK: "DraftKings", CZR: "Caesars", FD: "FanDuel" };
  const LEVEL = { P: "P4 / Big East", M: "Mid-major", L: "Low-major" };
  const WHYG = { luck: "Shooting luck", rating: "Rating slide since preseason", match: "Matchup & efficiency", mkt: "Line vs. ratings & sharp books", spot: "Schedule spot" };
  const MON = U.MON, DOW = U.DOW;
  const isT = r => r.mk === "Total";
  const fixT = rows => { (rows || []).forEach(r => { if (r && r.t === "Totals altitude") r.t = "Totals model play" }); return rows };
  const TIERS = ["Totals model play", "Spread tri-agree", "Spread luck + ensemble", "Totals tri-agree"];
  const pickTxt = r => isT(r) ? `${r.side} ${r.ln}` : `${r.tm} ${lnTxt(r.ln)}`;
  const evTxt = r => isT(r) ? `${r.op} at ${r.tm}` : r.ha === "A" ? `${r.tm} at ${r.op}` : r.ha === "N" ? `${r.tm} vs ${r.op}` : `${r.op} at ${r.tm}`;
  const topG = w => { if (!w || !w.g) return null; let k = null; for (const g in w.g) if (k == null || w.g[g] > w.g[k]) k = g; return k };
  let BT = null;   // graded backtest rows, for "similar past picks" and the example card
  const simKey = r => [r.t, r.mk, isT(r) ? r.side : (r.ln < 0 ? "F" : r.ln > 0 ? "D" : "P")].join("|");
  function simTxt(r) { if (!BT) return ""; const k = simKey(r), tg = r.why ? topG(r.why) : null; let w = 0, l = 0;
    for (const b of BT) { if (b.d === r.d || simKey(b) !== k) continue; if (tg && b.why && topG(b.why) !== tg) continue; b.r === "W" ? w++ : l++ }
    const n = w + l; if (!n) return ""; return `Similar past picks: ${w}-${l} (${pct(w / n)}) · n=${n.toLocaleString()}${n < 75 ? " · small sample" : ""}` }

  function toRec(r) {
    const sp = isT(r) ? false : true;
    const limit = r.min != null ? (isT(r) ? `${r.side === "Over" ? "Max" : "Min"} line ${r.min}` : `Worst line ${lnTxt(r.min)}`) : null;
    return { d: r.d, t: r.tip || null, season: r.s, ev: evTxt(r), pick: pickTxt(r), detail: (isT(r) ? "Total" : r.ha === "A" ? "Away" : r.ha === "N" ? "Neutral" : "Home") + (r.tot != null && !isT(r) ? ` · total ${r.tot}` : ""),
      mk: isT(r) ? "Total" : "Spread", tier: r.t, o: r.o, bk: BOOK[r.bk] || r.bk, stake: r.u || 1, r: r.r || null, pl: r.r ? r.p : null, act: r.sc || null, clv: r.clv ?? null,
      limit, worst: r.min != null ? (isT(r) ? String(r.min) : lnTxt(r.min)) : null, extra: r.r ? "" : esc(simTxt(r)), raw: r };
  }
  const to24 = s => { if (!s) return null; const m = String(s).match(/(\d+):(\d+)\s*(am|pm)/i); if (!m) return null; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return `${String(h).padStart(2, "0")}:${m[2]}` };

  NCSUN.register({
    id: "ncaab", icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M6 5.5c3 3.5 3 9.5 0 13M18 5.5c-3 3.5-3 9.5 0 13"/></svg>', name: "College hoops", short: "Hoops", tag: "Hoops", navName: "College hoops",
    kicker: "College basketball · spreads and totals", h1: "Today's <em>card</em>",
    lede: "Flat 1-unit picks on spreads and totals from the luck-fade model. Take the listed number or better; skip a pick if the line has moved past its worst line.",
    defaultTime: "19:00", durationH: 2.5, seasonLabel: "2026-27",
    groupings: ["book", "tier", "event"], defaultGroup: "book", groupName: "By game", evInSub: true, tierOrder: TIERS,
    minN: 75, defaultDim: "tier", searchHint: "Search a team",
    clv: { fmt: c => c == null ? "–" : (c > 0 ? "+" : "") + c.toFixed(2), label: "avg points", title: "Average points vs the closing line" },
    car: '<circle cx="-12" cy="-19" r="5.5" fill="var(--ball)" stroke="var(--ink)" stroke-width="1.6"/>',
    labels: { card: "Today's card", live: "2026-27 live", record: "Backtest" },
    liveGroup: { label: "Day by day", col: "Day", key: r => r.d, name: r => dateTxt(r.d), short: r => r.pick },
    liveEmpty: "The record starts with the first real pick, expected around Nov 21 once teams reach 5 games. Paper-tracked early-season games are logged separately and never counted here.",
    recordHead: { kicker: "Out-of-sample backtest · 2022-23 to 2025-26", label: "4 seasons",
      lede: "Each season was predicted by models trained only on earlier seasons, using what was known at 5am on game day. Spreads and totals share one card: at most 6 picks a weekday and 12 on Saturday, one bet per game, graded at the best 5am price at DraftKings, Caesars or FanDuel. Simulated results, not a live record." },
    dims: {
      mkt: { n: "Market", f: r => isT(r) ? "Totals" : "Spreads", order: ["Spreads", "Totals"] },
      tier: { n: "Tier", f: r => r.t, order: TIERS },
      season: { n: "Season", f: r => r.s },
      fav: { n: "Spread side", f: r => isT(r) ? "Total" : (r.ln < 0 ? "Favorite" : r.ln > 0 ? "Underdog" : "Pick'em"), order: ["Favorite", "Pick'em", "Underdog", "Total"] },
      ou: { n: "Over / under", f: r => isT(r) ? r.side : "Spread", order: ["Over", "Under", "Spread"] },
      line: { n: "Spread size", f: r => { if (isT(r)) return "Total"; const l = r.ln; return l <= -10 ? "Fav 10+" : l <= -5 ? "Fav 5-9.5" : l < 0 ? "Fav 0.5-4.5" : l === 0 ? "Pick'em" : l < 5 ? "Dog 0.5-4.5" : l < 10 ? "Dog 5-9.5" : l < 15 ? "Dog 10-14.5" : "Dog 15+" }, order: ["Fav 10+", "Fav 5-9.5", "Fav 0.5-4.5", "Pick'em", "Dog 0.5-4.5", "Dog 5-9.5", "Dog 10-14.5", "Dog 15+", "Total"] },
      venue: { n: "Home / away", f: r => isT(r) ? (r.ha === "N" ? "Total, neutral" : "Total") : (r.ha === "H" ? "Home" : r.ha === "A" ? "Away" : "Neutral"), order: ["Home", "Away", "Neutral", "Total", "Total, neutral"] },
      lvl: { n: "Team level", f: r => LEVEL[r.ct] || "Unknown", order: [LEVEL.P, LEVEL.M, LEVEL.L] },
      match: { n: "Matchup level", f: r => r.ct === r.co ? "Both " + LEVEL[r.ct] : LEVEL[r.ct] + " vs " + LEVEL[r.co] },
      conf: { n: "Conference game", f: r => r.cg ? "Conference" : "Non-conference", order: ["Conference", "Non-conference"] },
      total: { n: "Game total", f: r => r.tot == null ? "No total" : r.tot <= 130 ? "130 or less" : r.tot <= 140 ? "130.5-140" : r.tot <= 150 ? "140.5-150" : "150.5+", order: ["130 or less", "130.5-140", "140.5-150", "150.5+", "No total"] },
      month: { n: "Month", f: r => MON[+r.d.slice(5, 7) - 1], order: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"] },
      dow: { n: "Day", f: r => DOW[new Date(r.d + "T12:00:00").getDay()], order: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
      tip: { n: "Tip time (ET)", f: r => !r.sl ? "Unknown" : r.sl.startsWith("after") ? "Before 5pm" : r.sl.startsWith("even") ? "5-8:30pm" : "8:30pm+", order: ["Before 5pm", "5-8:30pm", "8:30pm+", "Unknown"] },
      book: { n: "Book", f: r => BOOK[r.bk] || r.bk },
      odds: { n: "Price", f: r => r.o > -110 ? "Better than -110" : r.o === -110 ? "-110" : "Worse than -110", order: ["Better than -110", "-110", "Worse than -110"] },
      gp: { n: "Games played", f: r => r.gp == null ? "Unknown" : r.gp < 10 ? "5-9" : r.gp < 20 ? "10-19" : "20+", order: ["5-9", "10-19", "20+", "Unknown"] },
      clv: { n: "Vs closing line", f: r => r.clv == null ? "No close near tip" : r.clv > 0 ? "Beat the close" : r.clv < 0 ? "Worse than close" : "Tied", order: ["Beat the close", "Tied", "Worse than close", "No close near tip"] },
      move: { n: "Line move after post", f: r => r.mv == null ? "No close near tip" : r.mv >= 1 ? "Toward us 1+" : r.mv > 0 ? "Toward us 0.5" : r.mv === 0 ? "No move" : r.mv > -1 ? "Against 0.5" : "Against 1+", order: ["Toward us 1+", "Toward us 0.5", "No move", "Against 0.5", "Against 1+", "No close near tip"] },
    },
    filters: ["mkt", "tier", "season", "fav", "ou", "venue", "lvl", "conf", "month", "book", "tip"],
    badge: r => `<span class="tbadge ${/model play/.test(r.tier) ? "ml" : /tri-agree/.test(r.tier) ? "fade" : ""}">${esc(r.tier)}</span>`,
    cells: r => { const c = [["Bet at", am(r.o), r.bk]]; if (r.worst != null) c.push([isT(r.raw) ? (r.raw.side === "Over" ? "Max line" : "Min line") : "Worst line", r.worst, "still a bet"]); if (r.raw.tot != null && !isT(r.raw)) c.push(["Game total", String(r.raw.tot), "at post"]); if (r.raw.gp != null) c.push(["Games played", String(r.raw.gp), "by the picked team"]); return c },
    why: r => { const w = r.raw.why; if (!w || !w.txt || !w.txt.length) return null; const g = w.g || {};
      return { head: "Why", sub: "what drove the pick, not how confident the model is", notes: w.txt, items: Object.keys(WHYG).filter(k => g[k] != null).map(k => ({ label: WHYG[k], pts: g[k], txt: (g[k] > 0 ? "+" : "") + g[k].toFixed(2) })), foot: w.con ? `Working against: ${esc(w.con)}` : "" } },
    async load() {
      const [today, live] = await Promise.all([load("ncaab_today.json"), load("ncaab_live.json")]);
      const T = today || { picks: [] }; fixT(T.picks); fixT(live || []);
      const picks = (T.picks || []).map(toRec), lv = (live || []).filter(r => r.r === "W" || r.r === "L").map(toRec);
      const date = T.date || null, posted = T.posted ? `${date} ${to24(T.posted) || "04:40"}` : null;
      const nT = picks.filter(r => r.mk === "Total").length, isToday = date === etToday();
      const meta = {
        kicker: date && picks.length ? `${dateTxt(date)} · college basketball · spreads and totals` : null,
        summary: picks.length ? `${picks.length - nT} ${picks.length - nT === 1 ? "spread" : "spreads"} · ${nT} ${nT === 1 ? "total" : "totals"}` : "",
        copyTitle: date ? `${dateTxt(date)} card` : "card",
        emptyHead: "No picks posted today", empty: "The 2026-27 season opens Nov 1. Picks start once both teams have played 5 games, around Nov 21. Until then the model is tracked on paper.",
        health: { ok: true, what: picks.length ? "Card posted" : "Last card", at: posted, note: "Runs 4:40 AM ET on game days" },
        next: "season opens Nov 1", cadence: "4:40 AM ET on game days",
      };
      // the heavy backtest file: load it when idle, for similar-past-pick lines and the example card
      const sp = NCSUN.byId.ncaab;
      (window.requestIdleCallback || (f => setTimeout(f, 600)))(() => NCSUN.record(sp).then(bt => { BT = bt.map(x => x.raw);
        picks.forEach(r => r.extra = r.r ? "" : esc(simTxt(r.raw)));
        if (!picks.length) { const ex = bt.filter(x => x.raw.d === "2026-02-21"); if (ex.length) { const s = NCSUN.stats(ex);
          meta.exampleHTML = `<div class="banner" style="margin-top:18px"><b>Example</b><span>Here's how a card looks: the ${ex.length} backtest picks from Saturday, Feb 21, 2026. That day went ${s.w}-${s.l}, ${fmtU(s.u)}.</span></div><div style="margin-top:18px">${NCSUN.cardList(ex, "book", sp)}</div>` } }
        if (sp.redrawCard) sp.redrawCard() }));
      return { today: picks, live: lv, meta };
    },
    async loadRecord() { const bt = fixT(await load("ncaab_backtest.json") || []); return bt.map(toRec) },
    how: `<div><div class="kicker">The theory</div><h1>Fade the <em>luck</em>. Trust the <em>model</em>.</h1>
      <p class="lede">Shooting in small samples is mostly noise, but lines are built partly from results. When a team's shot-making runs far ahead of what its shots should produce, it gets overrated, and the model bets against it. Totals are bet only as model plays, when a venue rule and the five-model totals ensemble agree.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Zone luck</h3><p>Actual minus expected points at the rim, from midrange and from three, on offense and defense, season to date. Expected rates shrink toward last season's league average, so a few hot nights barely move it.</p></div>
      <div class="panel stop"><h3>KenPom drift</h3><p>A team's KenPom rating this morning minus its preseason rating. Teams that have jumped furthest since preseason tend to be overrated, so the model fades them too.</p></div>
      <div class="panel stop"><h3>Ensembles</h3><p>Five machine-learning models for spreads (31 variables, each game fed both ways to remove home bias) and five for totals (68 variables: pace, efficiency, luck, KenPom drift, preseason projections, venue and more). Each votes on a side and a strength.</p></div>
      <div class="panel stop"><h3>Model plays</h3><p>Some totals are bet when a venue-based rule and the five-model totals ensemble agree on the over. It has held up out of sample, but we don't claim to know why it works, so we list these as model plays rather than dress them up with a story.</p></div>
      <div class="panel stop"><h3>The card</h3><p>Ranked: totals model plays, spread tri-agree, then spread luck + ensemble. Every pick is 1 unit: the tiers have similar measured edges, so flat staking keeps it simple. Totals tri-agree is tracked on paper, not bet. At most 6 picks a weekday and 12 on Saturday, one bet per game, and only picks with a line at DK, Caesars or FanDuel. When a spread and a totals model play land on the same game, the model play wins.</p></div>
    </div>
    <div class="grid2">
      <div class="panel flat prose"><h3>What it doesn't bet</h3><ul>
        <li>Any game where either team has played fewer than 5 games. Every early-season model and rule tested lost money at real prices.</li>
        <li>Neutral-site games, for the luck tiers (totals model plays can be at neutral venues).</li>
        <li>Ensemble-only spreads and totals with no luck or model-play signal. They don't beat these books.</li>
        <li>Two bets on one game.</li></ul></div>
      <div class="panel flat prose"><h3>How the backtest stayed honest</h3><ul>
        <li>Walk-forward: every season predicted only from earlier seasons.</li>
        <li>Every stat from games before tip-off; KenPom and Barttorvik snapshots dated before each game.</li>
        <li>Graded at the real 5am price and juice, not -110.</li>
        <li>Random sides win about 51% at these prices. With the models retrained on shuffled results the card still hits about 54%, so the luck and model-play rules carry most of the edge and the ensemble adds roughly 3 points on top.</li>
        <li>Picks beat the closing number in every season. Graded at the near-close consensus line the card still wins 55.7%; at the plain 5am consensus and -110, 56.9%.</li>
        <li>Two full audits regraded every pick from the raw odds feed and checked every score against ESPN: zero mismatches. The second one found that 20% of games had never been matched to a line (team-name and home/away quirks in the odds feed); they are now in.</li></ul></div>
    </div>
    <div class="panel flat prose"><h3>What to expect live</h3><p>At 1 unit a pick the backtest went 57.4% over 2,476 bets, +229 units, +9.2% ROI, with a worst drawdown of about 22 units. Tiers, cutoffs and caps were chosen on the same seasons they were tested on, so expect less live: roughly 55% and +4 to +5% ROI, about +25 to +30 units over a 600-bet season, with about a 1-in-6 chance of a losing season. Variance is real: even with a true 57% edge, 100-bet stretches at 50% happen. The live tab is the record that counts.</p></div>`,
    hood: `<div><div class="kicker">Under the hood · model specification</div><h1>The <em>engine</em> room</h1>
      <p class="lede">Every equation, loss function and hyperparameter behind the card. Everything is computed point-in-time: a game's inputs use only information timestamped before 5:00 a.m. ET on game day.</p></div>

    <div class="hood">
      <div class="panel eq"><h3>01 · Point-in-time features</h3>
        <p>Season-to-date team statistics are cumulative sums with the current game removed, so game <i>g</i> never sees its own box score.</p>
        <div class="mbox"><math display="block"><msubsup><mi>S</mi><mrow><mi>t</mi></mrow><mrow><mo>(</mo><mi>g</mi><mo>)</mo></mrow></msubsup><mo>=</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mrow><mi>g</mi><mo>−</mo><mn>1</mn></mrow></munderover><msub><mi>s</mi><mrow><mi>t</mi><mo>,</mo><mi>j</mi></mrow></msub><mspace width="1em"/><mtext>(cumsum − current)</mtext></math></div>
        <p class="note">KenPom ratings come from the dated daily archive; Barttorvik from its time-machine snapshots. League baselines come from the prior season only. Both teams need at least 5 prior games.</p></div>

      <div class="panel eq"><h3>02 · Bayesian-shrunk zone luck</h3>
        <p>For zone <i>z</i> ∈ {rim, mid, three} with <i>m</i> makes on <i>a</i> attempts, expected rate shrinks toward the prior-season league rate with pseudo-count <i>k<sub>z</sub></i>:</p>
        <div class="mbox"><math display="block"><msub><mover><mi>p</mi><mo>^</mo></mover><mi>z</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>m</mi><mi>z</mi></msub><mo>+</mo><msub><mi>k</mi><mi>z</mi></msub><msubsup><mi>p</mi><mi>z</mi><mtext>lg</mtext></msubsup></mrow><mrow><msub><mi>a</mi><mi>z</mi></msub><mo>+</mo><msub><mi>k</mi><mi>z</mi></msub></mrow></mfrac><mspace width="1.2em"/><msub><mi>Λ</mi><mtext>off</mtext></msub><mo>=</mo><munder><mo>∑</mo><mi>z</mi></munder><msub><mi>v</mi><mi>z</mi></msub><mspace width=".2em"/><msub><mi>a</mi><mi>z</mi></msub><mrow><mo>(</mo><mfrac><msub><mi>m</mi><mi>z</mi></msub><msub><mi>a</mi><mi>z</mi></msub></mfrac><mo>−</mo><msub><mover><mi>p</mi><mo>^</mo></mover><mi>z</mi></msub><mo>)</mo></mrow></math></div>
        <p class="note"><i>v<sub>z</sub></i> = point value (2, 2, 3). Offense <i>k</i> = 100 / 150 / 250; defense <i>k</i> = 200 / 400 / 1,500. Net luck = Λ<sub>off</sub> − Λ<sub>def</sub> per game; the game signal is home minus away. Tails are fixed at the 19th / 81st percentiles of a held-out season.</p></div>

      <div class="panel eq"><h3>03 · Rating drift</h3>
        <div class="mbox"><math display="block"><msub><mi>D</mi><mi>t</mi></msub><mo>=</mo><msubsup><mtext>AdjEM</mtext><mi>t</mi><mtext>today</mtext></msubsup><mo>−</mo><msubsup><mtext>AdjEM</mtext><mi>t</mi><mtext>pre</mtext></msubsup><mspace width="1.2em"/><msub><mi>D</mi><mtext>game</mtext></msub><mo>=</mo><msub><mi>D</mi><mtext>home</mtext></msub><mo>−</mo><msub><mi>D</mi><mtext>away</mtext></msub></math></div>
        <p class="note">Faded at the 15% tails. For totals, the analogue is scoring-environment drift (offense + defense efficiency vs preseason) and KenPom's preseason projected total vs the line.</p></div>

      <div class="panel eq"><h3>04 · Mirror augmentation (spreads)</h3>
        <p>Let <i>P</i> swap home and away and negate every directional feature. Training doubles to {(x, y), (Px, −y)}, and predictions are made antisymmetric so the model cannot learn a phantom home bias:</p>
        <div class="mbox"><math display="block"><msub><mi>f</mi><mtext>sym</mtext></msub><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><mfrac><mn>1</mn><mn>2</mn></mfrac><mrow><mo>[</mo><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>−</mo><mi>f</mi><mo>(</mo><mi>P</mi><mi>x</mi><mo>)</mo><mo>]</mo></mrow><mspace width="1em"/><mo>⇒</mo><mspace width="1em"/><msub><mi>f</mi><mtext>sym</mtext></msub><mo>(</mo><mi>P</mi><mi>x</mi><mo>)</mo><mo>=</mo><mo>−</mo><msub><mi>f</mi><mtext>sym</mtext></msub><mo>(</mo><mi>x</mi><mo>)</mo></math></div>
        <p class="note">Target: cover margin <i>y</i> = (home − away) + spread at 5am. Totals target: (home + away) − total at 5am.</p></div>

      <div class="panel eq"><h3>05 · Loss functions</h3>
        <p>Cover margins are heavy-tailed (excess kurtosis ≈ 0.3, σ ≈ 11.1 points), so the regressors use robust losses:</p>
        <div class="mbox"><math display="block"><msub><mi>L</mi><mi>δ</mi></msub><mo>(</mo><mi>r</mi><mo>)</mo><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mfrac><mn>1</mn><mn>2</mn></mfrac><msup><mi>r</mi><mn>2</mn></msup></mtd><mtd><mrow><mo>|</mo><mi>r</mi><mo>|</mo><mo>≤</mo><mi>δ</mi></mrow></mtd></mtr><mtr><mtd><mi>δ</mi><mo>(</mo><mo>|</mo><mi>r</mi><mo>|</mo><mo>−</mo><mfrac><mi>δ</mi><mn>2</mn></mfrac><mo>)</mo></mtd><mtd><mtext>otherwise</mtext></mtd></mtr></mtable></mrow><mspace width="1.4em"/><msub><mi>ρ</mi><mi>τ</mi></msub><mo>(</mo><mi>r</mi><mo>)</mo><mo>=</mo><mi>r</mi><mo>(</mo><mi>τ</mi><mo>−</mo><mn>𝟙</mn><mo>[</mo><mi>r</mi><mo>&lt;</mo><mn>0</mn><mo>]</mo><mo>)</mo></math></div>
        <p class="note">Huber with δ = 12 (LightGBM, XGBoost pseudo-Huber), pinball loss at τ = 0.5 for the median model, binary log-loss for the cover classifier, and ridge regression:</p>
        <div class="mbox"><math display="block"><mover><mi>β</mi><mo>^</mo></mover><mo>=</mo><munder><mo>argmin</mo><mi>β</mi></munder><msubsup><mrow><mo>‖</mo><mi>y</mi><mo>−</mo><mi>X</mi><mi>β</mi><mo>‖</mo></mrow><mn>2</mn><mn>2</mn></msubsup><mo>+</mo><mi>α</mi><msubsup><mrow><mo>‖</mo><mi>β</mi><mo>‖</mo></mrow><mn>2</mn><mn>2</mn></msubsup><mo>,</mo><mspace width=".6em"/><mi>α</mi><mo>∈</mo><mo>{</mo><msup><mn>10</mn><mn>0</mn></msup><mo>,</mo><mo>…</mo><mo>,</mo><msup><mn>10</mn><mn>4.5</mn></msup><mo>}</mo></math></div><p class="note">α chosen by efficient leave-one-out (generalized) cross-validation on the training seasons.</p></div>

      <div class="panel eq"><h3>06 · Gradient-boosted trees</h3>
        <p>Additive trees fit to the loss gradient, heavily regularized for a low signal-to-noise target:</p>
        <div class="mbox"><math display="block"><msub><mi>F</mi><mi>M</mi></msub><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><munderover><mo>∑</mo><mrow><mi>m</mi><mo>=</mo><mn>1</mn></mrow><mi>M</mi></munderover><mi>η</mi><mspace width=".15em"/><msub><mi>h</mi><mi>m</mi></msub><mo>(</mo><mi>x</mi><mo>)</mo><mo>,</mo><mspace width=".8em"/><msub><mi>w</mi><mi>j</mi></msub><mo>=</mo><mo>−</mo><mfrac><mrow><msub><mo>∑</mo><mrow><mi>i</mi><mo>∈</mo><msub><mi>I</mi><mi>j</mi></msub></mrow></msub><msub><mi>g</mi><mi>i</mi></msub></mrow><mrow><msub><mo>∑</mo><mrow><mi>i</mi><mo>∈</mo><msub><mi>I</mi><mi>j</mi></msub></mrow></msub><msub><mi>h</mi><mi>i</mi></msub><mo>+</mo><mi>λ</mi></mrow></mfrac></math></div>
        <div class="tbl"><table><thead><tr><th>Hyperparameter</th><th>Value</th></tr></thead><tbody>
          <tr><td>Trees <i>M</i> · learning rate η</td><td class="mono">400 · 0.02</td></tr>
          <tr><td>Leaves per tree (LightGBM) · max depth (XGBoost)</td><td class="mono">7 · 3</td></tr>
          <tr><td>Min samples per leaf</td><td class="mono">200</td></tr>
          <tr><td>Row subsample · column subsample</td><td class="mono">0.8 · 0.7</td></tr>
          <tr><td>L2 leaf penalty λ</td><td class="mono">10</td></tr></tbody></table></div></div>

      <div class="panel eq"><h3>07 · Ensembles</h3>
        <p>Each model's output is standardized by the spread of its own predictions on the prior season, then averaged:</p>
        <div class="mbox"><math display="block"><msub><mi>z</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>f</mi><mi>i</mi></msub><mo>(</mo><mi>x</mi><mo>)</mo></mrow><msubsup><mi>σ</mi><mi>i</mi><mrow><mo>(</mo><mi>T</mi><mo>−</mo><mn>1</mn><mo>)</mo></mrow></msubsup></mfrac><mspace width="1.2em"/><mi>E</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><mfrac><mn>1</mn><mn>5</mn></mfrac><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mn>5</mn></munderover><msub><mi>z</mi><mi>i</mi></msub></math></div>
        <div class="tbl"><table><thead><tr><th>Market</th><th class="l">Members (loss · feature set)</th></tr></thead><tbody>
          <tr><td>Spreads</td><td class="l">LightGBM Huber · 31 vars; ridge · 10; ridge · 19; LightGBM classifier · 5 luck vars; LightGBM median · 31</td></tr>
          <tr><td>Totals (luck tiers)</td><td class="l">LightGBM Huber · 43; ridge · 12; ridge · 43; LightGBM classifier · 5; LightGBM median · 43</td></tr>
          <tr><td>Totals (model plays)</td><td class="l">LightGBM Huber · 66; ridge · 12; ridge · 66; LightGBM classifier · 9 (luck + venue); LightGBM median · 66. The 66 add venue, FT luck, matchup and volatility features</td></tr></tbody></table></div>
        <p class="note">Nested forward feature selection was tested and lost to the full regularized set (mean out-of-sample correlation 0.056 vs 0.072), so nothing is pruned.</p></div>

      <div class="panel eq"><h3>08 · Decision rule and card</h3>
        <div class="mbox"><math display="block"><mtext>bet</mtext><mo>⇔</mo><mi>sgn</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mi>sgn</mi><mo>(</mo><mo>−</mo><mi>Λ</mi><mo>)</mo><mo>∧</mo><mo>|</mo><mi>E</mi><mo>|</mo><mo>≥</mo><msub><mi>τ</mi><mtext>tier</mtext></msub><mspace width="1.2em"/><mtext>stake</mtext><mo>∈</mo><mo>{</mo><mn>1</mn><mi>u</mi><mo>}</mo></math></div>
        <p class="note">The signal is the faded luck sign −Λ (plus drift or preseason-total agreement for tri-agree tiers, τ = 1 SD for totals) or, for totals model plays, an over signal A = +1 from a venue rule, where only the sign of the totals ensemble E must agree. The trigger is a venue-elevation rule; we don't claim to understand why it works.</p>
        <p>Tiers rank as totals model play › spread tri-agree › spread luck + ensemble; totals tri-agree is tracked on paper only. Picks with no line at DK, Caesars or FanDuel are dropped before the cap. Per day the top <i>K</i> are kept, <i>K</i> = 6 (weekdays) or 12 (Saturday), subject to one bet per game.</p></div>

      <div class="panel eq"><h3>09 · Grading, CLV and nulls</h3>
        <p>Payout per unit from American odds <i>o</i>, and closing-line value in points for a spread bet at line ℓ<sub>b</sub> against close ℓ<sub>c</sub>:</p>
        <div class="mbox"><math display="block"><mi>π</mi><mo>(</mo><mi>o</mi><mo>)</mo><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mi>o</mi><mo>/</mo><mn>100</mn></mtd><mtd><mi>o</mi><mo>&gt;</mo><mn>0</mn></mtd></mtr><mtr><mtd><mn>100</mn><mo>/</mo><mo>|</mo><mi>o</mi><mo>|</mo></mtd><mtd><mi>o</mi><mo>&lt;</mo><mn>0</mn></mtd></mtr></mtable></mrow><mspace width="1.4em"/><mtext>CLV</mtext><mo>=</mo><mi>s</mi><mo>·</mo><mo>(</mo><msub><mi>ℓ</mi><mi>b</mi></msub><mo>−</mo><msub><mi>ℓ</mi><mi>c</mi></msub><mo>)</mo></math></div>
        <p>A slice's edge is scored against the 51% no-skill baseline at best price; with many slices tested, the bar is the 95th percentile of the simulated maximum:</p>
        <div class="mbox"><math display="block"><mi>Z</mi><mo>=</mo><mfrac><mrow><mover><mi>p</mi><mo>^</mo></mover><mo>−</mo><mn>0.51</mn></mrow><msqrt><mrow><mn>0.25</mn><mo>/</mo><mi>n</mi></mrow></msqrt></mfrac><mspace width="1.2em"/><msup><mi>Z</mi><mo>*</mo></msup><mo>=</mo><msub><mi>Q</mi><mn>0.95</mn></msub><mrow><mo>(</mo><munder><mo>max</mo><mi>k</mi></munder><msubsup><mi>Z</mi><mi>k</mi><mtext>null</mtext></msubsup><mo>)</mo></mrow><mo>≈</mo><mn>3.0</mn></math></div>
        <p class="note">Random sides at best price win about 51%. Retraining every model on shuffled results still leaves the card at 53.9-54.2%, which is the edge of the luck and model-play rules alone; the trained ensemble adds about 3 points.</p></div>
    </div>`,
  });
})();
