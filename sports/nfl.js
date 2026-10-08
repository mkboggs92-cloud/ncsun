/* NFL receiving props — adapter for nfl_today.json, nfl_live.json, nfl_backtest.json, nfl_status.json (written by nfl_auto.py). */
(function () {
  const U = NCSUN.u, { $, esc, pct0, am, fair, dateTxt, timeTxt, load } = U;
  const BOOK = { draftkings: "DraftKings", fanduel: "FanDuel", betmgm: "BetMGM", williamhill_us: "Caesars", betrivers: "BetRivers", espnbet: "ESPN Bet", fanatics: "Fanatics" };
  const MKT = { rec: "Receptions", yds: "Receiving yards", td: "Anytime TD" };
  const POS = { WR: "Wide receivers", TE: "Tight ends", RB: "Running backs" };
  const MON = U.MON;
  const BAR = 0.02, minPrice = p => fair(p - BAR);
  const lineB = r => r.mk === "td" ? "Anytime TD" : r.mk === "rec" ? (r.ln <= 2.5 ? "2.5 or less" : r.ln <= 3.5 ? "3.5" : r.ln <= 4.5 ? "4.5" : "5.5+") : (r.ln < 25 ? "Under 25" : r.ln < 45 ? "25-44.5" : r.ln < 60 ? "45-59.5" : "60+");
  const actTxt = r => r.act == null ? null : r.mk === "td" ? (r.act > 0 ? "scored" : "no TD") : r.act + (r.mk === "rec" ? " rec" : " yds");
  function toRec(r, posted) {
    const worst = r.p ? minPrice(r.p) : null;
    return { d: r.d, t: r.kick || null, season: String(r.ses), ev: r.gm, pick: `${r.pk} ${r.mk === "td" ? "anytime TD" : r.sd + " " + r.ln}`, detail: `${r.mk === "td" ? "" : MKT[r.mk].toLowerCase() + " · "}${r.pos} · ${r.tm} ${r.op}`,
      mk: MKT[r.mk] || r.mk, tier: r.tier ? `${MKT[r.mk]} · Tier ${r.tier}` : MKT[r.mk], o: r.o, bk: BOOK[r.bk] || r.bk, stake: r.su || 1, p: r.p, m: r.m, e: r.e, r: r.r || null, pl: r.r ? (r.u || 0) : null, act: actTxt(r), clv: r.clv ?? null,
      posted: r.locked || posted || null, limit: worst != null ? `Take ${am(worst)} or better` : null, worst, ord: r.slate === "Primetime" ? 1 : 0, raw: r };
  }
  function gameBlock(gm, picks) {
    const np = picks.filter(p => p.ev === gm.gm).length;
    return `<details class="more"><summary>${esc(gm.gm)}<span>${esc(dateTxt(gm.d))} ${esc(timeTxt(gm.kick))} ET${gm.prime ? " · standalone" : ""}${gm.lock && !np ? ` · locks ${esc(gm.lock)}` : ""}${np ? ` · ${np} pick${np > 1 ? "s" : ""}` : ""}</span></summary><div class="inner"><div class="tbl"><table><thead><tr><th class="l">Player</th><th>Pos</th><th>Team</th><th>Proj. rec</th><th>Proj. yds</th><th>Anytime TD</th></tr></thead><tbody>
      ${gm.players.map(p => `<tr><td class="l"><b>${esc(p.n)}</b></td><td>${esc(p.pos)}</td><td>${esc(p.tm)}</td><td class="mono">${p.rec.toFixed(1)}</td><td class="mono">${p.yds.toFixed(1)}</td><td class="mono">${pct0(p.td)} <span class="note">(${am(fair(p.td))})</span></td></tr>`).join("")}</tbody></table></div></div></details>`;
  }
  const M = x => `<div class="mbox"><math display="block">${x}</math></div>`;
  NCSUN.register({
    id: "nfl", icon: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-35 12 12)"/><path d="M9 15l6-6M10 11.5l1.3 1.3M12.2 9.3l1.3 1.3M7.2 13.2l1.3 1.3"/></svg>', name: "NFL props", short: "NFL", tag: "NFL",
    kicker: "NFL · receiving props", h1: "Under <em>the</em> lights",
    lede: "Receptions, receiving yards and anytime TDs for WRs, TEs and RBs. Every pick is 1 unit. Take the listed price or better. Posted picks stand and are graded at the price they locked.",
    durationH: 3.5, seasonLabel: "2026",
    groupings: ["event", "tier", "book"], defaultGroup: "event", groupName: "By slate", tierOrder: ["Receptions · Tier A", "Receptions · Tier B", "Receiving yards · Tier A", "Receiving yards · Tier B", "Anytime TD"],
    minN: 50, defaultDim: "mk", searchHint: "Search a player or team",
    clv: { fmt: c => c == null ? "–" : (c > 0 ? "+" : "") + (c * 100).toFixed(1) + "%", label: "EV at the closing price", title: "Average fair closing probability times price taken, minus 1 (includes the vig)" },
    car: '<ellipse cx="-12" cy="-19" rx="6.5" ry="4.6" fill="#6B3A1F" stroke="var(--ink)" stroke-width="1.6"/>',
    labels: { card: "This week", live: "2026 live", record: "Backtest" },
    liveKicker: "Since October 2026 · real picks only",
    liveGroup: { label: "Week by week", col: "Week", key: r => r.season + "|" + String(r.raw.wk).padStart(2, "0"), name: r => `${r.season} Week ${r.raw.wk}`, short: r => r.raw.pk.split(" ").slice(-1)[0] + " " + (r.raw.mk === "td" ? "TD" : (r.raw.sd === "under" ? "u" : "o") + r.raw.ln + (r.raw.mk === "rec" ? " rec" : " yds")) },
    liveEmpty: "The record starts with the first posted card and grows every week.",
    recordHead: { kicker: "Out-of-sample backtest · 2023 to 2025", label: "2023-2025",
      lede: "Every week was predicted by models trained only on earlier weeks, then priced at the real sportsbook lines posted about 80 minutes before kickoff (just after inactives), taking only prices from DraftKings, FanDuel and Caesars (every book still counts toward the market's fair price). The card rule is the live one: the 8 biggest edges on the Sunday afternoon slate plus the single best pick in every other game, one pick per player, 1 unit each. Simulated results, not a live record.",
      extra: `<div class="panel flat prose" style="margin-top:12px"><h3>Realistic live returns</h3><p>The card's shape (blend weight, bet sides, card size) was chosen on 2023-24 and checked on 2025. Taking only DraftKings, FanDuel and Caesars prices, 2025 came in around +5% (+13.5% across 2023-25). Some feature choices also used these seasons, and part of the under edge comes from books leaning overs more each year, so expect less live: roughly <b>+2% to +7%</b>, about +10u to +35u over a 500-pick season, with a real chance of a losing year. The closing line is a weak yardstick for props (it barely moves after inactives), so the live record is what counts.</p></div>` },
    dims: {
      mk: { n: "Market", f: r => MKT[r.mk] || r.mk, order: ["Receptions", "Receiving yards", "Anytime TD"] },
      slate: { n: "Slate", f: r => r.slate, order: ["Sunday day", "Primetime"] },
      pos: { n: "Position", f: r => POS[r.pos] || r.pos, order: ["Wide receivers", "Tight ends", "Running backs"] },
      tier: { n: "Tier", f: r => r.tier ? "Tier " + r.tier : "–", order: ["Tier A", "Tier B", "Tier C"] },
      season: { n: "Season", f: r => String(r.ses) },
      edge: { n: "Edge", f: r => r.e == null ? "–" : r.e < 4 ? "2-4 pts" : r.e < 6 ? "4-6 pts" : r.e < 10 ? "6-10 pts" : "10+ pts", order: ["2-4 pts", "4-6 pts", "6-10 pts", "10+ pts"] },
      price: { n: "Price", f: r => r.o <= -150 ? "-150 or shorter" : r.o <= -120 ? "-149 to -120" : r.o < 100 ? "-119 to -101" : r.o <= 130 ? "+100 to +130" : "+131 or longer", order: ["-150 or shorter", "-149 to -120", "-119 to -101", "+100 to +130", "+131 or longer"] },
      line: { n: "Line", f: lineB, order: ["2.5 or less", "3.5", "4.5", "5.5+", "Under 25", "25-44.5", "45-59.5", "60+", "Anytime TD"] },
      book: { n: "Book", f: r => BOOK[r.bk] || r.bk },
      ha: { n: "Home / away", f: r => String(r.op || "").startsWith("at ") ? "Away" : "Home", order: ["Home", "Away"] },
      phase: { n: "Season phase", f: r => r.wk <= 6 ? "Weeks 1-6" : r.wk <= 12 ? "Weeks 7-12" : r.wk <= 18 ? "Weeks 13-18" : "Playoffs", order: ["Weeks 1-6", "Weeks 7-12", "Weeks 13-18", "Playoffs"] },
      clv: { n: "Vs closing line", f: r => r.clv == null ? "No close" : r.clv > 0 ? "Beat the close" : "Worse than close", order: ["Beat the close", "Worse than close", "No close"] },
      month: { n: "Month", f: r => MON[+r.d.slice(5, 7) - 1], order: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"] },
    },
    filters: ["mk", "slate", "pos", "tier", "season", "edge", "price", "line", "ha", "phase", "book"],
    badge: r => `<span class="tbadge ${r.raw.mk === "td" ? "fade" : r.raw.tier === "A" ? "ml" : ""}">${esc(MKT[r.raw.mk])}${r.raw.tier ? " · Tier " + esc(r.raw.tier) : ""}</span>`,
    cells: r => [["Bet at", am(r.o), r.bk], ["Fair", r.p ? am(fair(r.p)) : "–", r.p ? pct0(r.p) + " to win" : ""], ["Edge", r.e != null ? "+" + r.e.toFixed(1) : "–", "pts over the market", (r.e || 0) > 0 ? "pos" : ""], ["Market", r.m != null ? am(fair(r.m)) : "–", r.m != null ? pct0(r.m) + " no-vig" : ""], ["Worst price", r.worst != null ? am(r.worst) : "–", "still a bet"]],
    why: r => { const w = r.raw.why; if (!w || !w.length) return null; let foot = `Model + market blend <b>${pct0(r.p)}</b>`; if (r.m != null) foot += ` · Market <b>${pct0(r.m)}</b>`; if (r.raw.dec) foot += ` · Break-even at the price <b>${pct0(1 / r.raw.dec)}</b>`;
      return { head: "Why the model likes it", sub: "push on the projection, toward the pick", items: w.map(x => ({ label: x.label, v: x.v, pts: x.pts, txt: (x.pts > 0 ? "+" : "") + x.pts.toFixed(0) + "%" })), foot } },
    groupKey: r => r.raw.slate === "Primetime" ? "Primetime & standalone" : "Sunday card",
    groupHead: (r, rs) => `<div class="slip-ev"><h2>${esc(r.raw.slate === "Primetime" ? "Primetime & standalone" : "Sunday card")}</h2><span class="note">${r.raw.slate === "Primetime" ? "the single best pick in each game off the Sunday afternoon slate" : `${rs.length} of 8 slots · biggest edges across the day slate`}</span></div>`,
    async load() {
      const [today, live, status] = await Promise.all([load("nfl_today.json"), load("nfl_live.json"), load("nfl_status.json")]);
      const T = today || { picks: [], slate: [] };
      const picks = (T.picks || []).map(r => toRec(r, T.updated)), lv = (live || []).filter(r => ["W", "L", "P", "Void"].includes(r.r)).map(r => toRec(r));
      const by = {}; picks.forEach(r => { const k = r.raw.mk === "td" ? "anytime TD" : r.raw.mk === "rec" ? "receptions under" : "yards under"; by[k] = (by[k] || 0) + 1 });
      const meta = {
        kicker: T.week ? `${T.season} · Week ${T.week} · receiving props` : null, copyTitle: T.week ? `${T.season} Week ${T.week}` : "card",
        summary: Object.entries(by).map(([k, v]) => `${v} ${k}`).join(" · "),
        emptyHead: "No picks yet", empty: "Most books post receiving props late in the week, and each game's picks lock about 80 minutes before its kickoff, just after inactives.",
        health: NCSUN.health(status, T.updated, 72, `Picks lock about 80 min before each kickoff, just after inactives${T.next_lock_txt ? ` · next lock ${T.next_lock_txt} ET` : ""}${T.lines ? ` · ${T.lines.toLocaleString()} lines priced` : ""}`),
        next: T.next_lock_txt ? `next lock ${T.next_lock_txt}` : "", cadence: "locks 80 min before kickoff", slate: T.slate || [],
      };
      meta.health.what = "Lines updated";
      return { today: picks, live: lv, meta };
    },
    async loadRecord() { const bt = await load("nfl_backtest.json"); return (bt || []).filter(r => r.r === "W" || r.r === "L" || r.r === "P").map(r => toRec(r)) },
    afterCard(el, d) { const sl = d.meta.slate; el.innerHTML = sl.length ? `<div class="sec-h"><h2>Full slate</h2><span class="note">Model projections for the top pass-catchers in every game (blend-free, before the market)</span></div>` + sl.map(g => gameBlock(g, d.today)).join("") : `<div class="banner"><b>Quiet</b><span>No games on the schedule this week yet.</span></div>` },
    how: `<div><div class="kicker">The theory</div><h1>Bet the <em>under</em> on the <em>right</em> guys.</h1>
      <p class="lede">Prop books shade overs, because that's what the public bets: across 2024-25 their no-vig over price ran 3 to 4 points too high. Blindly betting every under only breaks even, though. The edge is in which players: the model finds the unders where usage, role and matchup point lower than the line.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Every snap since 2018</h3><p>nflverse play-by-play, snap counts, injury reports, weekly rosters, depth charts, Next Gen Stats, FTN charting and kickoff weather: about 50,000 player-games, every input built from games before the one being priced.</p></div>
      <div class="panel stop"><h3>Who's actually playing</h3><p>The biggest lever. Who is active today, each player's rank among active teammates, depth-chart order, and how his share has moved in past games when a teammate sat. When a WR1 or RB1 is out, the next man up gets priced, not averaged.</p></div>
      <div class="panel stop"><h3>Three models</h3><p>Receptions: targets × catch rate and a form-anchored count model, with spread that grows with volume. Yards: a Tweedie mean, a calibrated yards distribution and direct over/under classifiers. TDs: separate rushing and receiving TD models plus a goal-line structural model, so RBs get their carries counted.</p></div>
      <div class="panel stop"><h3>Market blend</h3><p>No model is bet raw. Each is blended with the books' no-vig price on the logit scale, 60% market and 40% model for the card. On their own the models lose to the books on receptions and yards; blended, they beat the books in all three markets.</p></div>
      <div class="panel stop"><h3>The card</h3><p>Only unders on receptions and yards, plus anytime TD yeses: overs lost money in every season tested. Two-sided markets only. Rank by edge over the market: 8 picks shared across the Sunday afternoon slate (1 PM and 4 PM games), the single best pick in every other game (TNF, SNF, MNF, Saturday, London), one pick per player, at most 2 per game.</p></div>
      <div class="panel stop"><h3>Posted picks stand</h3><p>Picks post just after inactives (about 80 minutes before kickoff) at whichever of DraftKings, FanDuel or Caesars pays best, and are graded at that price even if the line or the model moves. A player ruled inactive voids the pick, as books do.</p></div>
    </div>
    <div class="grid2">
      <div class="panel flat prose"><h3>What it doesn't bet</h3><ul>
        <li>Overs on receptions and yards. Books already overprice them; the model's best overs still lost after the vig.</li>
        <li>Lines with only one side posted, or a single offshore book.</li>
        <li>Pre-inactives prices. Every pick waits for that game's inactives; a Questionable player whose props get pulled is treated as out and his teammates are re-priced.</li>
        <li>Pockets that only looked good in hindsight: of about 800 slices tested, almost none survived a multiple-testing check.</li></ul></div>
      <div class="panel flat prose"><h3>How the backtest stayed honest</h3><ul>
        <li>Walk-forward: every week predicted by models trained only on earlier weeks.</li>
        <li>Real lines: every graded price is a quote that existed about 80 minutes before kickoff; nothing after kickoff.</li>
        <li>Live-only information: the model sees only what a live run can see. Game-day inactive lists are inferred, not read from hindsight.</li>
        <li>An independent code audit: grading matches play-by-play exactly, and leak tests pass on every input.</li>
        <li>Card rules chosen on 2023-24, checked on 2025.</li></ul></div>
    </div>
    <div class="panel flat prose"><h3>What to expect live</h3><p>About 10 picks a week. Unders are usually juiced (-115 to -140), so the win rate needs to be in the mid-50s to profit. Variance is real: 5-week stretches below .500 are normal even with a true edge. If the books stop shading overs, the under edge shrinks; the model tracks that lean every week.</p></div>`,
    hood: `<div><div class="kicker">Under the hood · model specification</div><h1>The <em>engine</em> room</h1>
      <p class="lede">Every equation behind the card. Everything is point-in-time: a game's inputs use only games completed before it, and every backtest week is scored by models that never saw it.</p></div>
    <div class="hood">
      <div class="panel eq"><h3>01 · Removing the vig</h3>
        <p>Two-way props are de-vigged per book, then the consensus is the median across books at the same line:</p>
        ${M(`<msub><mi>m</mi><mtext>over</mtext></msub><mo>=</mo><mfrac><mrow><mn>1</mn><mo>/</mo><msub><mi>d</mi><mi>o</mi></msub></mrow><mrow><mn>1</mn><mo>/</mo><msub><mi>d</mi><mi>o</mi></msub><mo>+</mo><mn>1</mn><mo>/</mo><msub><mi>d</mi><mi>u</mi></msub></mrow></mfrac>`)}
        <p class="note">Anytime TD is usually yes-only; an 8% hold is removed when no book posts the no side.</p></div>
      <div class="panel eq"><h3>02 · Receptions</h3>
        <p>The mean averages a form-anchored Poisson GBM, a targets × catch-rate decomposition and a smooth Poisson GLM; the count is negative binomial with dispersion that scales with the mean:</p>
        ${M(`<mi>μ</mi><mo>=</mo><mn>.425</mn><msub><mi>μ</mi><mtext>off</mtext></msub><mo>+</mo><mn>.425</mn><msub><mi>T̂</mi></msub><mo>·</mo><msub><mi>ĉ</mi></msub><mo>+</mo><mn>.15</mn><msub><mi>μ</mi><mtext>GLM</mtext></msub><mo>,</mo><mspace width=".6em"/><mi>Y</mi><mo>∼</mo><mtext>NB</mtext><mo>(</mo><mi>μ</mi><mo>,</mo><mi>r</mi><mo>)</mo><mo>,</mo><mspace width=".4em"/><mi>log</mi><mi>r</mi><mo>=</mo><mi>a</mi><mo>+</mo><mi>b</mi><mi>log</mi><mi>μ</mi>`)}</div>
      <div class="panel eq"><h3>03 · Receiving yards</h3>
        <p>Three probability estimates at each line, blended on the logit scale: an empirical yards-to-mean ratio distribution calibrated on walk-forward out-of-fold predictions, a direct P(Y > L) classifier monotone in the line, and a stacked classifier that also sees the predicted mean.</p>
        ${M(`<mtext>logit</mtext><mspace width=".2em"/><mi>p</mi><mo>=</mo><mn>.4</mn><msub><mi>z</mi><mtext>dist</mtext></msub><mo>+</mo><mn>.2</mn><msub><mi>z</mi><mtext>thr</mtext></msub><mo>+</mo><mn>.4</mn><msub><mi>z</mi><mtext>stack</mtext></msub>`)}</div>
      <div class="panel eq"><h3>04 · Anytime TD</h3>
        <p>Separate GBMs for a rushing TD and a receiving TD, combined and blended 50/50 with a penalized logistic model that includes a structural expected-TD rate built from team implied points and red-zone and goal-line shares among today's actives:</p>
        ${M(`<msub><mi>p</mi><mtext>GBM</mtext></msub><mo>=</mo><mn>1</mn><mo>−</mo><mo>(</mo><mn>1</mn><mo>−</mo><msub><mi>p</mi><mtext>rush</mtext></msub><mo>)</mo><mo>(</mo><mn>1</mn><mo>−</mo><msub><mi>p</mi><mtext>rec</mtext></msub><mo>)</mo><mo>(</mo><mn>1</mn><mo>−</mo><msub><mi>p</mi><mtext>other</mtext></msub><mo>)</mo>`)}</div>
      <div class="panel eq"><h3>05 · Next man up</h3>
        <p>Each player's projected target share given today's actives: a league role prior (position × rank among actives) plus his own shrunk with/without-teammate history:</p>
        ${M(`<msub><mi>ŝ</mi><mi>i</mi></msub><mo>=</mo><msub><mi>s</mi><mi>i</mi></msub><mo>·</mo><mo>(</mo><mn>1</mn><mo>+</mo><msub><mi>λ</mi><mrow><mtext>role</mtext></mrow></msub><mo>·</mo><msub><mi>v</mi><mtext>vacated</mtext></msub><mo>)</mo><mo>+</mo><msub><mi>w</mi><mi>i</mi></msub><mo>(</mo><msubsup><mi>s</mi><mi>i</mi><mtext>without</mtext></msubsup><mo>−</mo><msubsup><mi>s</mi><mi>i</mi><mtext>with</mtext></msubsup><mo>)</mo>`)}</div>
      <div class="panel eq"><h3>06 · Market blend</h3>
        ${M(`<mtext>logit</mtext><mspace width=".2em"/><mi>p</mi><mo>=</mo><mi>w</mi><mspace width=".2em"/><mtext>logit</mtext><mspace width=".2em"/><mi>q</mi><mo>+</mo><mo>(</mo><mn>1</mn><mo>−</mo><mi>w</mi><mo>)</mo><mspace width=".2em"/><mtext>logit</mtext><mspace width=".2em"/><mi>m</mi>`)}
        <p class="note">w = 0.4 for the card pool. Chosen on 2023-24 from 0.2 / 0.25 / 0.3 / 0.4.</p></div>
      <div class="panel eq"><h3>07 · Decision rule and card</h3>
        ${M(`<mtext>edge</mtext><mo>=</mo><mi>p</mi><mo>−</mo><msub><mi>m</mi><mtext>side</mtext></msub><mo>,</mo><mspace width=".6em"/><mtext>EV</mtext><mo>=</mo><mi>p</mi><mi>d</mi><mo>−</mo><mn>1</mn><mo>≥</mo><mn>.03</mn>`)}
        <p class="note">Unders on receptions and yards, anytime TD yeses. Two-sided markets only. Rank by edge; post the top 8 across the Sunday afternoon slate and the top 1 in every other game, one per player, at most 2 per game. Each game locks after its own inactives.</p></div>
      <div class="panel eq"><h3>08 · Grading and CLV</h3>
        ${M(`<mi>π</mi><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mi>d</mi><mo>−</mo><mn>1</mn></mtd><mtd><mtext>win</mtext></mtd></mtr><mtr><mtd><mo>−</mo><mn>1</mn></mtd><mtd><mtext>loss</mtext></mtd></mtr></mtable></mrow><mspace width="1.4em"/><mtext>CLV</mtext><mo>=</mo><mi>c</mi><mo>·</mo><mi>d</mi><mo>−</mo><mn>1</mn>`)}
        <p class="note">Pushes and inactive players void. c is the de-vigged closing probability at the same line, so CLV includes the vig; most prop lines don't move between inactives and kickoff.</p></div>
    </div>`,
  });
})();
