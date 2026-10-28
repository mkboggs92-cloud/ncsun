/* NFL receiving props — adapter for nfl_today.json, nfl_live.json, nfl_backtest.json, nfl_status.json, nfl_monitor.json
   (written by nfl_auto.py). [R3-3 2026-10-24] phone-first: the week's lock windows, honest numbers first, one plain
   sentence for every exception (no pick / missed / withdrawn / thin market / paper), the Week-10 review in words. */
(function () {
  const U = NCSUN.u, { $, esc, pct0, am, fair, dateTxt, timeTxt, load } = U;
  const BOOK = { draftkings: "DraftKings", fanduel: "FanDuel", betmgm: "BetMGM", williamhill_us: "Caesars", betrivers: "BetRivers", espnbet: "ESPN Bet", fanatics: "Fanatics" };
  const MKT = { rec: "Receptions", yds: "Receiving yards", td: "Anytime TD" };
  const MKS = { rec: "rec", yds: "yds" };                                   // short market in the pick headline
  const POS = { WR: "Wide receivers", TE: "Tight ends", RB: "Running backs" };
  const MON = U.MON, DOW = U.DOW || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const toDec = U.toDec || (o => o == null ? null : (o > 0 ? 1 + o / 100 : 1 + 100 / -o));
  const BAR = 0.02;
  // the worst price that is still a bet: 2 pts of win chance below the number we show, never better than the posted price
  const minPrice = (p, dec) => { if (!p || p - BAR <= 0) return null; const d = Math.min(1 / (p - BAR), dec || Infinity); return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)) };
  const lineB = r => r.mk === "td" ? "Anytime TD" : r.mk === "rec" ? (r.ln <= 2.5 ? "2.5 or less" : r.ln <= 3.5 ? "3.5" : r.ln <= 4.5 ? "4.5" : "5.5+") : (r.ln < 25 ? "Under 25" : r.ln < 45 ? "25-44.5" : r.ln < 60 ? "45-59.5" : "60+");
  const actTxt = r => r.act == null ? null : r.mk === "td" ? (r.act > 0 ? "scored" : "no TD") : r.act + (r.mk === "rec" ? " rec" : " yds");
  // [F5 2026-10-19] stake, warning flags, slot accounting and the live monitor, all in the tab's own text
  const uTxt = x => x === 0.5 ? "½u" : x === 0.25 ? "¼u" : (+x).toString() + "u";
  const n1 = x => x == null ? "–" : (Math.abs(x) >= 10 ? Math.round(x) : (+x).toFixed(1));
  const UNIT = { rec: "catches", yds: "yds" };
  const plural = (n, s, p) => n === 1 ? s : (p || s + "s");
  function flags(raw) {           // [{k,...}] from publish (cx.fl); older rows: thin / early from nb / wk
    const f = (raw.cx && raw.cx.fl) ? raw.cx.fl.slice() : [];
    const has = k => f.some(x => x.k === k);
    if (!raw.cx && raw.nb != null && raw.mk !== "td" && raw.nb <= 2) f.push({ k: "thin", n: raw.nb });
    if (!raw.cx && (raw.wk || 99) <= 6 && !has("early")) f.push({ k: "early" });
    return f;
  }
  const FLAG = {
    exit: () => "Left last game hurt",
    missed: x => x.n ? `Back after ${x.n} missed` : "Back from missed games",
    rookie: x => x.w != null ? "Rookie · priced near market" : "Rookie",
    fewgames: x => `${x.n != null ? x.n : "Few"} NFL games${x.w != null ? " · priced near market" : ""}`,
    newteam: x => x.w != null ? "New team · priced near market" : "New team",
    thin: x => `Thin market · ${x.n} book${x.n === 1 ? "" : "s"}`,
    early: () => "Early season",
  };
  // [R3-3] one plain sentence per flag, shown above the "why" bars: what it means for the bet
  const FLAG_NOTE = {
    thin: x => `Thin market: only ${x.n} ${x.n === 1 ? "book posts" : "books post"} both sides at this line, so the market price it is judged against is less certain.`,
    early: () => "Early season: in Weeks 1-6 the model is held close to the market, so edges are small.",
    rookie: x => x.w != null ? "Rookie: little NFL history, so this line is priced mostly at the market." : "Rookie: little NFL history behind the projection.",
    fewgames: x => `Only ${x.n != null ? x.n : "a few"} NFL games${x.w != null ? ": priced mostly at the market." : " behind the projection."}`,
    newteam: x => `New team: his old usage may not carry over${x.w != null ? ", so this line is priced mostly at the market." : "."}`,
    exit: () => "Left his last game hurt: the low projection leans on that short game. Check he is active and not limited.",
    missed: x => `Back from ${x.n ? x.n + " " : ""}missed games: the usage inputs are older than usual.`,
  };
  let SLOTS = null;               // this week's slot accounting (nfl_today.json "slots"), set in load()
  let STAKE = null;               // this week's stake in units (nfl_today.json "stake", else the picks', else the monitor's)
  function slotNote(n, prime) {
    const S = SLOTS || {}, part = [];
    const e = prime ? S.prime_early : S.early, v = prime ? S.prime_veto : S.veto, w = prime ? S.prime_withdrawn : S.withdrawn;
    if (e) part.push(`${e} ${prime ? "game" + (e > 1 ? "s" : "") + " left without a pick" : "left empty"} by the early-season rule`);
    if (v) part.push(`${v} ${prime ? "game" + (v > 1 ? "s" : "") + " without a pick after" : "left empty by"} the news check`);
    const wr = (prime ? S.prime_withdrawn_replaced : S.withdrawn_replaced) || 0;
    if (w) part.push(wr >= w ? `${w} withdrawn and replaced` : wr ? `${w} withdrawn (${wr} replaced)` : `${w} withdrawn`);
    if (!prime) {
      const k = S.k || 8, open = k - n - (e || 0) - (v || 0) - (w || 0) + wr;
      if (open > 0) part.push(S.day_open ? `${open} more can lock before later kickoffs` : `${open} unfilled: not enough bets cleared the bar`);
    }
    return part;
  }
  // nfl_monitor.json -> one plain-English line. [R3-3] it says what the number decides (the Week-10 stake), shows how
  // much evidence is behind it, and never presents an "on track" rule as a decision: only the hard stop acts before
  // the review week; the action Mark follows is monitor.decision.action (F5's line said "rule says: back to 1u" on
  // Oct 26 while the decision was "stay at 0.5u")
  function monBlock(Mn) {
    if (!Mn || !Mn.overall) return null;
    const sn = (Mn.since && Mn.since.lines && Mn.since.lines.n) || 0, blk = sn >= 300 ? Mn.since : Mn.overall, L = blk.lines || {};
    if (!L.n || L.beta == null) return null;
    const bw = Mn.by_week || [], span = sn >= 300 ? `since Week ${Mn.from_week}` : bw.length ? `Week${bw.length > 1 ? "s" : ""} ${bw[0].week}${bw.length > 1 ? "-" + bw[bw.length - 1].week : ""}` : "so far";
    const nw = L.n_weeks || null, se = L.beta_se != null ? Math.round(L.beta_se * 100) : null;
    const pct = Math.max(0, Math.min(100, Math.round(L.beta * 100)));
    const R = Mn.rule || {}, rw = Mn.review_week || R.review_week || 10, D = Mn.decision || {};
    const need = Math.round((R.beta_up != null ? R.beta_up : 0.5) * 100);
    const review = D.bet_week == null || D.bet_week >= rw;
    const met = (R.rules || []).filter(x => x.met), stop = met.find(x => x.id === "stop"), on = met.filter(x => x.id !== "stop").map(x => x.then);
    const how = L.beta >= 0.95 ? "the model's disagreements with the market have held up about as well as it claimed" : `the model has been right about ${pct}% of its disagreements with the market`;
    const ev = [nw ? `${nw} ${plural(nw, "week")} of games` : "", se != null ? `±${se} pts` : ""].filter(Boolean).join(", ");
    const act = stop ? "the hard-stop rule has fired" : on.length && !review ? `on track for "${on[on.length - 1]}" at the Week ${rw} review, not decided yet` : on.length ? `rule says: ${on[on.length - 1]}` : `about ${need}% is needed for stakes to go back to 1u at the Week ${rw} review`;
    return { line: `Live check (${span}, ${L.n.toLocaleString()} lines${ev ? "; " + ev : ""}): ${how}; ${act}.`, pct, need, rw, review };
  }
  function toRec(r, posted) {
    // [R3-3] the worst price that is still a bet is judged by the number we show (honest win chance when present)
    const worst = (r.ph ?? r.p) && !r.paper ? minPrice(r.ph ?? r.p, r.dec || toDec(r.o)) : null;
    // [R2 F2 #14] paper picks (Week-10 rule tripped): shown, stake 0, labelled. `paper` is NOT set on this record on
    // purpose: app.js drops `r.paper` records from the open picks, and paper picks should stay visible as a record.
    // [R3-3] the headline carries the market ("under 2.5 rec"): it is what gets typed into the book. On an open pick
    // with an honest win chance, that replaces the raw edge chip (raw.e still feeds the Edge slices and Details).
    const honest = r.ph != null && !r.r, dec = r.dec || toDec(r.o);
    return { d: r.d, t: r.kick || null, season: String(r.ses), ev: r.gm,
      pick: `${r.pk} ${r.mk === "td" ? "anytime TD" : r.sd + " " + r.ln + " " + MKS[r.mk]}${r.paper ? " (paper)" : ""}`,
      detail: `${r.pos} · ${r.tm} ${r.op}`,
      mk: MKT[r.mk] || r.mk, tier: r.tier ? `${MKT[r.mk]} · Tier ${r.tier}` : MKT[r.mk], o: r.o, bk: BOOK[r.bk] || r.bk, stake: r.su ?? 1, p: r.p, m: r.m,
      e: honest ? null : r.e, ph: r.ph ?? null, evh: r.evh ?? null, r: r.r || null, pl: r.r ? (r.u || 0) : null, act: actTxt(r), clv: r.clv ?? null,
      posted: r.locked || posted || null, limit: r.paper ? "Paper pick: tracked, not bet" : worst != null ? `Take ${am(worst)} or better` : null, worst,
      extra: honest && dec ? `Win chance <b>${pct0(r.ph)}</b> · needs ${pct0(1 / dec)}` : null,
      ord: r.slate === "Primetime" ? 1 : 0, raw: r };
  }
  function gameBlock(gm, picks) {
    const np = picks.filter(p => p.ev === gm.gm).length;
    return `<details class="more"><summary>${esc(gm.gm)}<span>${esc(dateTxt(gm.d))} ${esc(timeTxt(gm.kick))} ET${gm.prime ? " · standalone" : ""}${gm.lock && !np ? ` · locks ${esc(gm.lock)}` : ""}${np ? ` · ${np} pick${np > 1 ? "s" : ""}` : ""}</span></summary><div class="inner"><div class="tbl"><table><thead><tr><th class="l">Player</th><th>Pos</th><th>Team</th><th>Proj. rec</th><th>Proj. yds</th><th>Anytime TD</th></tr></thead><tbody>
      ${gm.players.map(p => `<tr><td class="l"><b>${esc(p.n)}</b></td><td>${esc(p.pos)}</td><td>${esc(p.tm)}</td><td class="mono">${p.rec.toFixed(1)}</td><td class="mono">${p.yds.toFixed(1)}</td><td class="mono">${pct0(p.td)} <span class="note">(${am(fair(p.td))})</span></td></tr>`).join("")}</tbody></table></div></div></details>`;
  }
  // ---------------------------------------------------------------- [R3-3] the week's lock windows, in one list
  const PRIME_NAME = { "09:30": "London", "20:20": "SNF" };
  const etNow = () => { const p = {}; new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).forEach(x => p[x.type] = x.value); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` };
  const addMin = (d, t, k) => { const [y, mo, da] = d.split("-").map(Number), [h, mi] = t.split(":").map(Number); const x = new Date(Date.UTC(y, mo - 1, da, h, mi) + k * 6e4); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")} ${String(x.getUTCHours()).padStart(2, "0")}:${String(x.getUTCMinutes()).padStart(2, "0")}` };
  const dow = d => { const x = new Date(d + "T12:00:00"); return isNaN(x) ? "" : DOW[x.getDay()] };
  /** Every lock window this week from the slate: its games, lock and kick, and what happened (picks / no pick / missed /
      upcoming). nfl_today.json "windows" (when the runner publishes it) is authoritative; without it, a passed window
      with no picks is read from nfl_status.tick (a tick inside the lock period that locked 0 picks). */
  function windows(T, status) {
    const picks = T.picks || [], now = etNow(), missed = new Set(T.missed || []), WS = T.windows || null;
    const tick = (status && status.tick) || {}, tickAt = String(tick.at || "").slice(0, 16), zero = /^0 .*picks locked/.test(String(tick.msg || ""));
    const byKey = new Map();
    for (const g of T.slate || []) {
      const k = g.d + " " + g.kick; if (!byKey.has(k)) byKey.set(k, { d: g.d, kick: g.kick, games: [], prime: !!g.prime, lock: g.lock });
      byKey.get(k).games.push(g.gm);
    }
    return [...byKey.values()].sort((a, b) => (a.d + a.kick) < (b.d + b.kick) ? -1 : 1).map(w => {
      const mine = picks.filter(p => p.d === w.d && w.games.includes(p.gm));
      const kickAt = `${w.d} ${w.kick}`, lockAt = addMin(w.d, w.kick, -85), lockEnd = addMin(w.d, w.kick, -25);
      const ws = WS ? WS.find(x => x.d === w.d && x.kick === w.kick) : null;
      const kickTxt = `${dow(w.d)} ${timeTxt(w.kick)}`, ranZero = tickAt >= lockAt && tickAt <= kickAt && zero;
      let st, txt;
      if (mine.length) { st = "picked"; const pa = mine.filter(p => p.paper).length, gr = mine.filter(p => p.r);
        txt = `${mine.length} ${plural(mine.length, "pick")}${pa ? ` (${pa} paper)` : ""}${gr.length ? ` · ${gr.filter(p => p.r === "W").length}-${gr.filter(p => p.r === "L").length}` : ""}` }
      else if (missed.has(kickTxt) || (ws && ws.status === "missed")) { st = "missed"; txt = "missed: the runner was offline, no pick" }
      else if (ws && ws.status === "done") { st = "none"; txt = "no pick: nothing cleared the bar" }
      else if (ws && ws.status === "failed") { st = "none"; txt = "no pick: the run failed" }
      else if (now < lockAt) { st = "upcoming"; txt = "picks post a few minutes after the lock" }
      else if (now <= lockEnd) { st = "locking"; txt = ranZero ? "no pick: nothing cleared the bar" : "locking now: picks post once inactives are in" }
      else { st = "none"; txt = ranZero ? "no pick: nothing cleared the bar" : "no pick posted" }
      const name = w.prime ? w.games.join(", ") + (PRIME_NAME[w.kick] && w.games.length === 1 ? ` (${PRIME_NAME[w.kick]})` : "") : `${w.games.length} ${plural(w.games.length, "game")}`;
      return Object.assign(w, { st, txt, name, kickTxt, lockTxt: w.lock || `${dow(w.d)} ${timeTxt(addMin(w.d, w.kick, -80).slice(11))}`, isNext: false });
    });
  }
  function windowsHTML(W, stake) {
    if (!W.length) return "";
    const nx = W.find(w => w.st === "upcoming" || w.st === "locking"); if (nx) nx.isNext = true;
    const row = w => `<div class="dayhead" data-st="${w.st}"><b>${esc(w.lockTxt)}</b><span>${esc(w.name)} · kick ${esc(timeTxt(w.kick))}</span><em class="${w.isNext ? "pos" : w.st === "missed" ? "neg" : ""}">${esc(w.isNext ? "next · " + w.txt : w.txt)}</em></div>`;
    return `<div class="panel flat"><div class="lab-head"><h2>Lock times</h2><span class="note">${esc(stake != null && stake !== 1 ? `${uTxt(stake)} a pick this week · ` : "")}picks post about 5 min after each lock, then a push</span></div><div class="dayblk" style="margin-top:10px">${W.map(row).join("")}</div></div>`;
  }
  // ---------------------------------------------------------------- [R3-3] the record tab's review panel (words, not β)
  function reviewHTML(Mn, live, week) {
    const mb = monBlock(Mn);
    const secOf = r => r.raw.sec || (r.raw.mk === "td" ? "td" : "card");
    const st = rows => { let w = 0, l = 0, u = 0, k = 0; rows.forEach(r => { if (r.r === "W") w++; else if (r.r === "L") l++; u += r.pl || 0; if (r.r === "W" || r.r === "L") k += r.stake }); return { w, l, u, k } };
    const fmt = s => `${s.w}-${s.l} · <b class="${s.u < 0 ? "neg" : "pos"}">${s.u >= 0 ? "+" : ""}${s.u.toFixed(2)}u</b> on ${s.k}u staked`;
    const g = live.filter(r => r.r === "W" || r.r === "L" || r.r === "P"), card = g.filter(r => secOf(r) === "card"), td = g.filter(r => secOf(r) === "td");
    const R = (Mn && Mn.rule) || {}, D = (Mn && Mn.decision) || {}, rw = (Mn && Mn.review_week) || R.review_week || 10, fw = (Mn && Mn.from_week) || R.from_week || 7;
    const togo = week ? rw - week : null, since = (Mn && Mn.since && Mn.since.card) || {};
    const rules = (R.rules || []).map(x => {
      const t = x.id === "up" ? `<b>Back to 1u</b> if the live check reaches ${Math.round((R.beta_up ?? 0.5) * 100)}% and the pool is in profit since Week ${fw}.`
        : x.id === "paper" ? `<b>Paper-trade</b> (track, don't bet) if the live check falls to ${Math.round((R.beta_down ?? 0.1) * 100)}% or the card is down ${Math.abs(R.card_down_u ?? 10)}u (counted at 1u a pick) since Week ${fw}.`
          : x.id === "stop" ? `<b>Hard stop</b> at ${Math.abs(R.hard_stop_u ?? 15)}u down (at 1u a pick) since Week ${fw}, any time.` : `<b>${esc(x.then)}</b> when ${esc(x.when)}.`;
      const early = D.bet_week != null && D.bet_week < rw && x.id !== "stop";   // only the hard stop acts before the review
      return `<li>${t}${x.met ? (early ? ' <span class="tag small">on track, decided at the review</span>' : ' <span class="tag l">met now</span>') : ""}</li>`;
    }).join("");
    const stakeTxt = STAKE != null && STAKE !== 1 ? `<b>${uTxt(STAKE)} a pick</b> this week (Weeks ${fw}-${rw - 1}).` : "<b>1u a pick</b>.";
    const when = togo == null ? "" : togo > 0 ? ` The review is ${togo} ${plural(togo, "week")} away, after Week ${rw - 1} grades.` : " The review week is here.";
    return `<div class="panel flat prose"><h3>The Week ${rw} review</h3>
      <p>${stakeTxt}${when}${D.action ? ` Right now the rule says: <b>${esc(D.action)}</b>.` : ""}</p>
      ${mb ? `<p>${esc(mb.line)}</p>` : ""}
      ${since.n ? `<p>Card since Week ${fw}: ${since.w}-${since.l}, ${since.units >= 0 ? "+" : ""}${(+since.units).toFixed(2)}u (${since.units_1u >= 0 ? "+" : ""}${(+since.units_1u).toFixed(2)} at 1u a pick), which is what the triggers count.</p>` : ""}
      ${rules ? `<ul>${rules}</ul>` : ""}
      <h3 style="margin-top:14px">Two records, kept apart</h3>
      <p>Card: ${fmt(st(card))}.<br>Anytime-TD section: ${fmt(st(td))}.<br>Together: ${fmt(st(g))}. The headline numbers above mix both; the Week ${rw} rule counts the card.</p></div>`;
  }
  const M = x => `<div class="mbox"><math display="block">${x}</math></div>`;
  NCSUN.register({
    id: "nfl", icon: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-35 12 12)"/><path d="M9 15l6-6M10 11.5l1.3 1.3M12.2 9.3l1.3 1.3M7.2 13.2l1.3 1.3"/></svg>', name: "NFL props", short: "NFL", tag: "NFL",
    kicker: "NFL · receiving props", h1: "Under <em>the</em> lights",
    lede: "Receptions, receiving-yards and anytime-TD props for WRs, TEs and RBs. 1 unit a pick (½ unit in Weeks 7-9 while the live record builds; each pick shows its stake). Take the listed price or better: every pick shows the worst price that is still a bet. Posted picks stand and are graded at the price they locked.",
    durationH: 3.5, seasonLabel: "2026",
    groupings: ["event", "tier", "book"], defaultGroup: "event", groupName: "By slate", tierOrder: ["Receptions · Tier A", "Receptions · Tier B", "Receiving yards · Tier A", "Receiving yards · Tier B", "Anytime TD"],
    minN: 50, defaultDim: "mk", searchHint: "Search a player or team",
    clv: { fmt: c => c == null ? "–" : (c > 0 ? "+" : "") + (c * 100).toFixed(1) + "%", label: "EV at the closing price", title: "Average fair closing probability times price taken, minus 1 (includes the vig)" },
    car: '<ellipse cx="-12" cy="-19" rx="6.5" ry="4.6" fill="#6B3A1F" stroke="var(--ink)" stroke-width="1.6"/>',
    labels: { card: "This week", live: "2026 live", record: "Backtest" },
    liveKicker: "Since October 2026 · real picks only",
    // [R3-3] app.js's default lede said "1 unit each"; the stake is per pick (½u in Weeks 7-9) and two records are kept
    liveLede: "Every pick posted here, graded at the book, price and stake it locked (1u; ½u in Weeks 7-9). The card and the anytime-TD section are counted apart at the bottom of this page. Nothing from the backtest is mixed in.",
    // the next four are read only once app.js carries R3-3's optional edits (/tmp/r3_3/app_js.patch); harmless before
    finishedText: "Finished · graded when the play-by-play lands", trendLabel: "2026 card so far",
    headline: r => (r.raw.sec || (r.raw.mk === "td" ? "td" : "card")) === "card",
    liveGroup: { label: "Week by week", col: "Week", note: "graded at the posted price and stake (½u in Weeks 7-9); card and TD section together", key: r => r.season + "|" + String(r.raw.wk).padStart(2, "0"), name: r => `${r.season} Week ${r.raw.wk}${r.stake !== 1 ? " · " + uTxt(r.stake) + " picks" : ""}`, short: r => r.raw.pk.split(" ").slice(-1)[0] + " " + (r.raw.mk === "td" ? "TD" : (r.raw.sd === "under" ? "u" : "o") + r.raw.ln + (r.raw.mk === "rec" ? " rec" : " yds")) },
    liveEmpty: "The record starts with the first posted card and grows every week.",
    recordHead: { kicker: "Out-of-sample backtest · 2023 to 2025", label: "2023-2025",
      lede: "Every week was predicted by models trained only on earlier weeks, then priced at the real sportsbook lines posted about 80 minutes before kickoff (just after inactives), taking only prices from DraftKings, FanDuel and Caesars (every book still counts toward the market's fair price). The card rule is the live one: the 8 biggest edges on the Sunday afternoon slate plus the single best pick in every other game, one pick per player, 1 unit each. Simulated results, not a live record.",
      extra: `<div class="panel flat prose" style="margin-top:12px"><h3>What to really expect</h3><p>These backtest numbers are <b>in-sample</b>: the card rules were refined over many rounds of research with all three seasons visible, so the headline overstates what to expect. The honest forward estimate is about <b>+6% on the card</b> (90% range −4% to +16%) and about +3% across every qualifying bet, from Week 7 on. Weeks 1-6 run about even with the market, and the anytime-TD section's in-sample return is far above its forward estimate (about +4%). Even at a true +6%, a full season has roughly a 1-in-4 chance of losing. Judge it on many weeks, not a few: the 2026 live tab's Week-10 review is where that judgement is made.</p></div>` },
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
      stake: { n: "Stake", f: r => r.paper ? "Paper (0u)" : uTxt(r.su ?? 1) + " picks", order: ["1u picks", "½u picks", "Paper (0u)"] },
      sec: { n: "Section", f: r => (r.sec || (r.mk === "td" ? "td" : "card")) === "td" ? "Anytime TD section" : "Card", order: ["Card", "Anytime TD section"] },
    },
    filters: ["mk", "sec", "slate", "pos", "tier", "season", "edge", "price", "line", "ha", "phase", "book", "stake"],
    badge: r => `<span class="tbadge ${r.raw.mk === "td" ? "fade" : r.raw.tier === "A" ? "ml" : ""}">${esc(MKT[r.raw.mk])}${r.raw.tier ? " · Tier " + esc(r.raw.tier) : ""}</span>` +
      (r.raw.paper ? ' <span class="tbadge" style="border-style:dashed;background:transparent">Paper · 0u</span>' : r.stake !== 1 ? ` <span class="tbadge">${uTxt(r.stake)}</span>` : "") +
      flags(r.raw).filter(x => FLAG[x.k]).map(x => ` <span class="tbadge gtd">${esc(FLAG[x.k](x))}</span>`).join(""),
    // [R3-3] Details grid, bettor first: price · worst price · stake, then the honest numbers, then the raw ones
    cells: r => {
      const R = r.raw, dec = R.dec || toDec(r.o), be = dec ? pct0(1 / dec) : "–";
      const c = [["Bet at", am(r.o), r.bk], ["Worst price", r.worst != null ? am(r.worst) : "–", R.paper ? "paper: not bet" : "still a bet"],
        ["Stake", R.paper ? "0u" : uTxt(r.stake), R.paper ? "paper: tracked only" : r.stake !== 1 ? "this week (Wks 7-9)" : "flat, every pick"]];
      if (r.ph != null) c.push(["Win chance", pct0(r.ph), "honest, fitted", dec && r.ph > 1 / dec ? "pos" : "neg"]);
      else if (r.p) c.push(["Win chance", pct0(r.p), "model + market blend"]);
      c.push(["Break-even", be, `to profit at ${am(r.o)}`]);
      if (r.m != null) c.push(["Market", pct0(r.m), "no-vig consensus"]);
      if (r.evh != null) c.push(["EV", (r.evh > 0 ? "+" : "") + r.evh.toFixed(1) + "%", "honest, per 1u", r.evh > 0 ? "pos" : "neg"]);
      if (R.e != null) c.push(["Edge", (R.e > 0 ? "+" : "") + R.e.toFixed(1), r.ph != null ? "pts · raw, ranks card" : "pts over the market", R.e > 0 ? "pos" : ""]);
      if (r.ph != null && r.p) c.push(["Blend", pct0(r.p), `${R.cx && R.cx.w != null ? Math.round(R.cx.w * 100) : 40}% model · raw`]);
      if (R.nb != null && R.mk !== "td") c.push(["Market depth", String(R.nb) + (R.nb === 1 ? " book" : " books"), R.nb <= 2 ? "thin market" : "two-sided at this line", R.nb <= 2 ? "neg" : ""]);
      if ((R.wk || 99) <= 6) c.push(["Season phase", "Early", "≈ market in wks 1-6"]);
      return c;
    },
    why: r => {
      const R = r.raw, cx = R.cx || {}, w = (R.why || []).filter(x => !(["WR", "TE"].includes(R.pos) && /carr/.test(x.label || "")));
      const mkt = !!(w.length && w[0].ref === "mkt"), side = R.mk === "td" ? "yes" : R.sd, dec = R.dec || toDec(r.o);
      let sub;
      if (R.mk === "td") sub = cx.pm != null && cx.pk != null ? `model ${pct0(cx.pm)} vs books ${pct0(cx.pk)} to score` : (r.m != null ? `market ${pct0(r.m)} to score` : "");
      else sub = cx.mu != null ? `model ${n1(cx.mu)} ${UNIT[R.mk]} · line ${R.ln}${cx.mm != null ? ` · books imply ${n1(cx.mm)}` : ""}` : `line ${R.ln}`;
      const notes = flags(R).filter(x => FLAG_NOTE[x.k]).map(x => FLAG_NOTE[x.k](x));
      if (!w.length && !sub && !notes.length) return null;
      // [R3-3] honest first; the raw model % and the 40% blend are named as raw: live, the market has been right
      // about most of their disagreements (the live check in the lede)
      const K = (cx.pk ?? r.m) != null ? `market <b>${pct0(cx.pk ?? r.m)}</b>` : "", BE = dec ? `break-even <b>${pct0(1 / dec)}</b>` : "";
      const lead = R.mk === "td" ? "Scores" : side === "under" ? "Under" : "Over";
      let foot;
      if (r.ph != null) foot = `${lead}: honest win chance <b>${pct0(r.ph)}</b>${r.evh != null ? ` (EV ${r.evh > 0 ? "+" : ""}${r.evh.toFixed(1)}%)` : ""} · ${[BE, K].filter(Boolean).join(" · ")}. Raw: model ${cx.pm != null ? pct0(cx.pm) : "–"}, blend ${pct0(r.p)}${cx.w != null ? ` (${Math.round(cx.w * 100)}% model)` : ""}; both overstate it.`;
      else foot = `${lead}: ${[`bet at <b>${pct0(r.p)}</b>${cx.w != null ? ` (${Math.round(cx.w * 100)}% model)` : ""}`, K, BE, cx.pm != null ? `raw model ${pct0(cx.pm)}` : ""].filter(Boolean).join(" · ")}`;
      foot += w.length ? (mkt ? `<br>Bars: what the model sees vs players it projects at the books' number (him vs typical).` : `<br>Bars: push on the projection vs an average player (posted before Week 7).`) : "";
      return { head: R.mk === "td" ? "Why the TD" : `Why the ${side}`, sub, notes, items: w.map(x => ({ label: x.label, v: x.v, pts: x.pts, txt: (x.pts > 0 ? "+" : "") + x.pts.toFixed(0) + "%" })), foot };
    },
    groupKey: r => r.raw.slate === "Primetime" ? "Primetime & standalone" : "Sunday card",
    groupHead: (r, rs) => { const pr = r.raw.slate === "Primetime", sec = rs.filter(x => (x.raw.sec || "card") === "card"), extra = slotNote(sec.length, pr);
      return `<div class="slip-ev"><h2>${esc(pr ? "Primetime & standalone" : "Sunday card")}</h2><span class="note">${pr ? ["the single best pick in each game off the Sunday afternoon slate", ...extra].map(esc).join(" · ") : [`${sec.length} of ${(SLOTS && SLOTS.k) || 8} slots`, ...extra, "biggest edges across the day slate"].map(esc).join(" · ")}</span></div>` },
    async load() {
      const [today, live, status, mon] = await Promise.all([load("nfl_today.json"), load("nfl_live.json"), load("nfl_status.json"), load("nfl_monitor.json")]);
      const T = today || { picks: [], slate: [] };
      const picks = (T.picks || []).map(r => toRec(r, T.updated)), lv = (live || []).filter(r => ["W", "L", "P", "Void"].includes(r.r)).map(r => toRec(r));
      const by = {}; picks.forEach(r => { const k = r.raw.mk === "td" ? "anytime TD" : r.raw.mk === "rec" ? "receptions under" : "yards under"; by[k] = (by[k] || 0) + 1 });
      const paper = picks.some(r => r.raw.paper);
      // [R3-3] this week's stake: published by the runner, else the posted picks', else the monitor's standing decision
      const stakes = [...new Set(picks.filter(r => !r.raw.paper).map(r => r.stake))].sort();
      STAKE = T.stake != null ? +T.stake : stakes.length === 1 ? stakes[0] : stakes.length ? null
        : (mon && mon.decision && mon.decision.stay_stake != null && /stay/.test(String(mon.decision.action || "")) ? +mon.decision.stay_stake : null);
      let W = []; try { W = windows(T, status) } catch (e) { console.error("nfl windows", e) }   // never let the day plan take the tab down
      const nx = W.find(w => w.st === "upcoming" || w.st === "locking");
      const nextTxt = nx ? `Next: ${nx.name} locks ${nx.lockTxt} (kick ${nx.kickTxt}).` : "";
      const over = W.length && !nx && picks.every(r => r.r);     // every window has passed and every pick is graded
      const meta = {
        kicker: T.week ? `${T.season} · Week ${T.week} · receiving props` : null, copyTitle: T.week ? `${T.season} Week ${T.week}` : "card",
        summary: Object.entries(by).map(([k, v]) => `${v} ${k}`).join(" · "),
        emptyHead: over ? `Week ${T.week || ""} is done`.replace("  ", " ") : "No picks yet",
        empty: over ? "Next week's slate and projections post Wednesday morning, after the retrain; the first lock is usually Thursday evening."
          : `${nextTxt ? nextTxt + " " : ""}Each game's picks lock about 80 minutes before its kickoff, just after inactives, and post about 5 minutes later with a push. Every lock time this week is listed below.`,
        health: NCSUN.health(status, T.updated, 72, `Locks about 80 min before kickoff, after inactives${T.next_lock_txt ? ` · next lock ${T.next_lock_txt} ET` : ""}${T.lines ? ` · ${T.lines.toLocaleString()} lines priced` : ""}`),
        next: T.next_lock_txt ? `next lock ${T.next_lock_txt}` : "", cadence: "locks 80 min before kickoff", slate: T.slate || [], windows: W, mon, week: T.week || null,
      };
      meta.health.what = "Lines updated";
      // [F5 2026-10-19] the stake, slot accounting, withdrawals, missed locks and the live check live in the tab's
      // own text; meta.stake is read by app.js where it used to hard-code "1u each"
      SLOTS = T.slots || null;
      if (paper) {                            // [R2 F2 #14] paper mode: 0u, say why
        meta.stake = "0u (paper: tracked, not bet)";
        meta.summary = ["Paper trading: picks are tracked, not bet (the Week-10 rule tripped)", meta.summary].filter(Boolean).join(" · ");
      } else {
        meta.stake = !stakes.length ? null : stakes.length === 1 ? `${uTxt(stakes[0])} each` : `${stakes.map(uTxt).join(" or ")} (each pick shows its stake)`;
        if (meta.stake && meta.stake !== "1u each") meta.summary = [meta.stake, meta.summary].filter(Boolean).join(" · ");
      }
      // [R3-3] the lede, top to bottom: exceptions (withdrawn / missed / no pick), the live check, the two records,
      // then one stake-aware line of rules (the static lede in register() is the fallback before load)
      const wd = T.withdrawn || [], top = [];
      if (T.notice) top.push(esc(T.notice) + (wd.length && !/graded|record/i.test(T.notice) ? " Withdrawn picks are not graded or counted in the record." : ""));
      else if (wd.length) { const nm = wd.slice(0, 3).map(x => `${x.pk} ${String(x.lab || "").toLowerCase()}`).join("; ") + (wd.length > 3 ? ` and ${wd.length - 3} more` : ""), why = String(wd[0].why || "").trim();
        top.push(esc(`Withdrawn before kickoff, don't bet: ${nm}.${why ? " " + why.charAt(0).toUpperCase() + why.slice(1).replace(/\.?$/, ".") : ""} Not graded or counted in the record; the other picks stand.`)) }
      (T.missed || []).forEach(m => top.push(esc(`No pick for the ${m} game: the runner was offline when it locked.`)));
      W.filter(w => w.st === "none" && /nothing cleared/.test(w.txt)).forEach(w => top.push(esc(`No pick for ${w.kickTxt} ${w.name}: nothing cleared the bar.`)));
      const mb = monBlock(mon);
      if (mb) top.push(`<span class="note">${esc(mb.line)}</span>`);
      const secOf = r => r.raw.sec || (r.raw.mk === "td" ? "td" : "card"), g = lv.filter(r => r.r === "W" || r.r === "L");
      const cardG = g.filter(r => secOf(r) === "card"), tdG = g.filter(r => secOf(r) === "td");
      const recTxt = rows => { const w = rows.filter(r => r.r === "W").length, l = rows.filter(r => r.r === "L").length, u = rows.reduce((a, r) => a + (r.pl || 0), 0); return `${w}-${l} ${u >= 0 ? "+" : ""}${u.toFixed(2)}u` };
      if (g.length && tdG.length) top.push(`<span class="note">2026 record: card ${recTxt(cardG)} (what the Week-10 rule counts) · anytime-TD section ${recTxt(tdG)}.</span>`);
      const stakeLine = paper ? "Paper mode: picks are tracked at 0u and not bet until the stake is switched back on by hand."
        : STAKE != null && STAKE !== 1 ? `${uTxt(STAKE)} a pick this week (Weeks 7-9, while the live record builds).` : "1 unit a pick.";
      top.push(`<span class="note">Receptions, receiving-yards and anytime-TD props for WRs, TEs and RBs. ${stakeLine} Take the listed price or better: each pick shows the worst price that is still a bet. Posted picks stand and are graded at the price they locked.</span>`);
      meta.lede = top.join("<br>");
      return { today: picks, live: lv, meta };
    },
    async loadRecord() { const bt = await load("nfl_backtest.json"); return (bt || []).filter(r => r.r === "W" || r.r === "L" || r.r === "P").map(r => toRec(r)) },
    afterCard(el, d) { const sl = d.meta.slate, W = d.meta.windows || [];
      let wh = ""; try { wh = windowsHTML(W, STAKE) } catch (e) { console.error("nfl lock times", e) }
      el.innerHTML = wh + (sl.length ? `<div class="sec-h"><h2>Full slate</h2><span class="note">Model projections for the top pass-catchers in every game (blend-free, before the market): a sanity check, not bets</span></div>` + sl.map(g => gameBlock(g, d.today)).join("") : `<div class="banner"><b>Quiet</b><span>No games on the schedule this week yet.</span></div>`) },
    afterLive(el, d) { const m = d.meta || {}; try { el.insertAdjacentHTML("beforeend", reviewHTML(m.mon, d.live, m.week)) } catch (e) { console.error("nfl review panel", e) } },
    how: `<div><div class="kicker">The theory</div><h1>Bet the <em>under</em> on the <em>right</em> guys.</h1>
      <p class="lede">Prop books shade overs, because that's what the public bets: across 2024-25 their no-vig over price ran 3 to 4 points too high. Blindly betting every under only breaks even, though. The edge is in which players: the model finds the unders where usage, role and matchup point lower than the line.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Every snap since 2018</h3><p>nflverse play-by-play, snap counts, injury reports, weekly rosters, depth charts, Next Gen Stats, FTN charting and kickoff weather: about 50,000 player-games, every input built from games before the one being priced.</p></div>
      <div class="panel stop"><h3>Who's actually playing</h3><p>The biggest lever. Who is active today, each player's rank among active teammates, depth-chart order, and how his share has moved in past games when a teammate sat. When a WR1 or RB1 is out, the next man up gets priced, not averaged.</p></div>
      <div class="panel stop"><h3>Three models</h3><p>Receptions: targets × catch rate and a form-anchored count model, with spread that grows with volume. Yards: a Tweedie mean, a calibrated yards distribution and direct over/under classifiers. TDs: separate rushing and receiving TD models plus a goal-line structural model, so RBs get their carries counted.</p></div>
      <div class="panel stop"><h3>Market blend</h3><p>No model is bet raw. Each is blended with the books' no-vig price on the logit scale, 60% market and 40% model for the card. On their own the models lose to the books on receptions and yards; blended, they beat the books in all three markets. The win chance shown on each pick uses a more cautious weight fitted to real results (the "honest" number), because live the market has been right about most of the model's disagreements so far.</p></div>
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
        <p class="note">w = 0.4 for the card pool. Chosen on 2023-24 from 0.2 / 0.25 / 0.3 / 0.4. The honest win chance shown on each pick uses w = 0.30 (receptions, yards) and 0.40 (TD), fitted by log loss on real lines; selection is unchanged.</p></div>
      <div class="panel eq"><h3>07 · Decision rule and card</h3>
        ${M(`<mtext>edge</mtext><mo>=</mo><mi>p</mi><mo>−</mo><msub><mi>m</mi><mtext>side</mtext></msub><mo>,</mo><mspace width=".6em"/><mtext>EV</mtext><mo>=</mo><mi>p</mi><mi>d</mi><mo>−</mo><mn>1</mn><mo>≥</mo><mn>.03</mn>`)}
        <p class="note">Unders on receptions and yards, anytime TD yeses. Two-sided markets only. Rank by edge; post the top 8 across the Sunday afternoon slate and the top 1 in every other game, one per player, at most 2 per game. Each game locks after its own inactives.</p></div>
      <div class="panel eq"><h3>08 · Grading and CLV</h3>
        ${M(`<mi>π</mi><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mi>d</mi><mo>−</mo><mn>1</mn></mtd><mtd><mtext>win</mtext></mtd></mtr><mtr><mtd><mo>−</mo><mn>1</mn></mtd><mtd><mtext>loss</mtext></mtd></mtr></mtable></mrow><mspace width="1.4em"/><mtext>CLV</mtext><mo>=</mo><mi>c</mi><mo>·</mo><mi>d</mi><mo>−</mo><mn>1</mn>`)}
        <p class="note">Pushes and inactive players void. c is the de-vigged closing probability at the same line, so CLV includes the vig; most prop lines don't move between inactives and kickoff.</p></div>
    </div>`,
  });
})();
