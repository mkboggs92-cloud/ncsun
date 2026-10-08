/* College football — hand picks, not model output. Adapter for cfb_picks.json and cfb_totals.json (rebuilt from the
   "Nothing Can Stop Us Now Bets" Google Sheet by cfb_sync.py). Every pick is 1 unit, graded at -110 unless a price is listed. */
(function () {
  const U = NCSUN.u, { $, esc, fmtU, pct, sgn, lnTxt, payout, load } = U;
  const isT = r => r.mk === "Total";
  const graded = r => r.r === "W" || r.r === "L" || r.r === "P";
  // Older seasons (2022-23) were logged as free text, so the text is shown as written. From 2024 the sheet has Away / Home / Line / O/U columns.
  const pickTxt = r => r.lab ? r.lab : isT(r) ? `${r.ou || "Total"} ${r.tot ?? ""}`.trim() : r.pk || `${r.aw} / ${r.hm}`;
  const gameTxt = r => r.aw && r.hm ? (r.lab ? `${r.aw} vs ${r.hm}` : `${r.aw} at ${r.hm}`) : "";
  const extraTxt = r => r.lab ? "" : [r.ln != null ? `Line ${lnTxt(r.ln)}` : "", r.tot != null ? `O/U ${r.tot}` : ""].filter(Boolean).join(" · ");
  function toRec(r, i) {
    const o = r.o ?? -110;
    return { d: null, season: String(r.s), ord: (r.wn ?? 99) * 1000 + i, ev: gameTxt(r) || r.wk || "", pick: pickTxt(r), detail: [extraTxt(r), r.c].filter(Boolean).join(" · "), mk: isT(r) ? "Total" : "Side", tier: isT(r) ? "Total" : "Side",
      o, bk: r.o != null ? "listed" : "standard -110", stake: 1, r: graded(r) ? r.r : null, pl: r.r === "W" ? payout(o) : r.r === "L" ? -1 : graded(r) ? 0 : null, id: ["cfb", r.s, r.wk, pickTxt(r), gameTxt(r)].join("|"), raw: r };
  }
  const SI = {}; let WT = { seasons: {} }, seasons = [], cur = null, ALL = [];
  function seasonTiles(rows, focus, onPick) {
    const S = NCSUN.stats, R = NCSUN.recTxt;
    return `<div class="seasons">` + `<button class="season" data-s="" aria-pressed="${focus == null}"><small>All seasons</small><b>${R(S(rows))}</b><span>${pct(S(rows).wp)} · ${fmtU(S(rows).u)}</span></button>` + seasons.map(s => { const st = S(rows.filter(r => r.season === String(s))); const sheet = SI[s] && SI[s].rec;
      return `<button class="season" data-s="${s}" aria-pressed="${focus === s}"><small>${s}${s === cur ? " · live" : ""}</small><b>${R(st)}</b><span>${pct(st.wp)} · ${fmtU(st.u)}${sheet && sheet.replace(/-0$/, "") !== R(st) ? ` · sheet says ${esc(sheet)}` : ""}</span></button>` }).join("") + `</div>`;
  }
  function drawTotals(el) {
    const S = WT.seasons || {}, ys = Object.keys(S).sort((a, b) => b - a);
    if (!ys.length) { el.innerHTML = '<div class="banner"><b>Coming soon</b><span>Win-total bets haven\'t synced yet.</span></div>'; return }
    let sel = ys[0];
    const settled = b => b.status === "Cashed" || b.status === "Dead" || b.status === "Push";
    const pl = b => b.status === "Cashed" ? (b.pay || 0) - (b.bet || 0) : b.status === "Dead" ? -(b.bet || 0) : 0;
    const money = v => (v >= 0 ? "+" : "−") + "$" + Math.abs(v).toFixed(2);
    const sum = (bb, f) => bb.reduce((a, b) => a + f(b), 0);
    const rec = bb => { const c = bb.filter(b => b.status === "Cashed").length, d = bb.filter(b => b.status === "Dead").length, p = bb.filter(b => b.status === "Push").length; return `${c}-${d}${p ? "-" + p : ""}` };
    const stCls = s => { const k = String(s || "").toLowerCase(); return k === "cashed" ? "cashed" : k === "dead" ? "dead" : k === "push" ? "push" : k.includes("low") ? "low" : k.includes("high") ? "high" : "" };
    const stTxt = b => b.status === "Cashed" ? "Cashed" : b.status === "Dead" ? "Dead" : b.status === "Push" ? "Push" : b.status ? `${b.status} risk` : "Open";
    const wtRow = b => { const w = b.wins, rem = b.rem, need = b.ln, span = need != null && w != null ? Math.max(need + 1, w + (rem || 0)) : 0;
      const bar = span ? `<span class="wbarx" aria-hidden="true"><i style="width:${w / span * 100}%"></i><em style="left:${need / span * 100}%"></em></span>` : "";
      return `<tr><td><b>${esc(b.tm)}</b><div class="note">$${(b.bet || 0).toFixed(0)} to pay $${(b.pay || 0).toFixed(2)}</div></td><td class="mono">${b.dir ? esc(b.dir) + " " : ""}${b.ln ?? ""}</td>
        <td>${w != null ? `<div>${w} W${rem != null ? ` · ${rem} left` : ""}</div>${bar}` : "–"}</td><td><span class="st ${stCls(b.status)}">${esc(stTxt(b))}</span>${settled(b) && pl(b) ? `<div class="note mono ${sgn(pl(b))}">${money(pl(b))}</div>` : ""}</td></tr>` };
    const futRow = b => `<tr><td><b>${esc(b.tm)}</b>${b.what ? ` <span class="note">${esc(b.what)}</span>` : ""}</td><td class="l note">${esc(b.conf || "")}</td><td><span class="st ${stCls(b.status)}">${esc(stTxt(b))}</span></td><td class="mono">$${(b.bet || 0).toFixed(2)} → $${(b.pay || 0).toFixed(2)}</td><td class="mono ${sgn(pl(b))}">${settled(b) ? money(pl(b)) : ""}</td></tr>`;
    const draw = () => { const all = S[sel] || [], wt = all.filter(b => b.kind === "wt"), fut = all.filter(b => b.kind === "fut"), oth = all.filter(b => b.kind === "other");
      const byC = new Map(); wt.forEach(b => { const c = b.conf || "Other"; if (!byC.has(c)) byC.set(c, []); byC.get(c).push(b) });
      const live = wt.filter(b => !settled(b)), cfb = wt.concat(fut), ov = wt.filter(b => b.dir === "Over"), un = wt.filter(b => b.dir === "Under");
      el.innerHTML = `<div class="seasons">${ys.map(y => { const w = (S[y] || []).filter(b => b.kind === "wt"), n = (S[y] || []).filter(b => b.kind !== "other");
          return `<button class="season" data-y="${y}" aria-pressed="${y === sel}"><small>${y}${w.some(b => !settled(b)) ? " · live" : ""}</small><b>${rec(w)}</b><span>win totals · ${money(sum(n, pl))} CFB</span></button>` }).join("")}</div>
        <div class="kpis"><div><small>Win totals</small><b>${rec(wt)}</b><span>${live.length ? `${live.length} still live` : "cashed-dead-push"}</span></div>
          <div><small>Overs / unders</small><b>${rec(ov)} · ${rec(un)}</b><span>over record · under record</span></div>
          <div><small>CFB profit</small><b class="${sum(cfb, pl) >= 0 ? "pos" : "neg"}">${money(sum(cfb, pl))}</b><span>settled win totals + futures</span></div>
          <div><small>Staked</small><b>$${sum(cfb, b => b.bet || 0).toFixed(0)}</b><span>${cfb.length} college bets</span></div>
          <div><small>Still riding</small><b>$${sum(cfb.filter(b => !settled(b)), b => b.pay || 0).toFixed(0)}</b><span>payout if every live bet cashes</span></div></div>
        <div class="wt-grid">${[...byC.entries()].map(([c, bb]) => `<div class="panel"><div class="lab-head"><h2>${esc(c)}</h2><span class="note">${rec(bb)}</span></div><div class="tbl"><table><thead><tr><th>Team</th><th>Bet</th><th>Wins</th><th>Status</th></tr></thead><tbody>${bb.map(wtRow).join("")}</tbody></table></div></div>`).join("")}</div>
        ${fut.length ? `<div class="panel"><div class="lab-head"><h2>College futures</h2><span class="note">${rec(fut)} · ${money(sum(fut, pl))}</span></div><div class="tbl"><table><thead><tr><th>Bet</th><th class="l">Market</th><th>Status</th><th>Stake → payout</th><th>P/L</th></tr></thead><tbody>${fut.map(futRow).join("")}</tbody></table></div></div>` : ""}
        ${oth.length ? `<details class="filters panel flat"><summary><h3>Other sports on the same tab</h3><span class="note">${oth.length} bets · ${money(sum(oth, pl))} · not counted in the college numbers</span></summary><div class="tbl" style="margin-top:10px"><table><thead><tr><th>Bet</th><th class="l">Group</th><th>Status</th><th>Stake → payout</th><th>P/L</th></tr></thead><tbody>${oth.map(futRow).join("")}</tbody></table></div></details>` : ""}
        <p class="note">Straight from our sheet: green line = over, red = under. Payout includes the stake. "Live" bets show the risk level we've marked; the bar is wins so far against the line (orange tick).</p>` };
    el.addEventListener("click", e => { const b = e.target.closest(".season"); if (!b) return; sel = b.dataset.y; draw() });
    draw();
  }
  NCSUN.register({
    id: "cfb", icon: '<svg viewBox="0 0 24 24"><path d="M4 16.5C4 10 10 4 20 4c0 10-6 16-16 16-.5 0-1 0-1.5-.2A12 12 0 0 1 4 16.5z"/><path d="M8.5 15.5l7-7M10 12l1.5 1.5M12.5 9.5 14 11"/></svg>', name: "College football", short: "CFB", tag: "Football", navName: "Football",
    kicker: "College football · sides and totals", h1: "This <em>week</em>",
    lede: "Hand picks, made together. No model, just film, numbers and arguments. 1 unit each.",
    seasonLabel: "2026",
    groupings: ["event", "tier"], defaultGroup: "event", groupName: "By week", evInSub: true, tierOrder: ["Side", "Total"],
    minN: 30, defaultDim: "season", searchHint: "Search a team",
    car: '<path d="M-17 -19 a5 3.6 0 1 0 10 0 a5 3.6 0 1 0 -10 0 Z" fill="var(--ball)" stroke="var(--ink)" stroke-width="1.6"/>',
    labels: { card: "This week", live: "Season live", record: "All seasons", how: "How we pick" }, stops: ["card", "live", "record", "totals", "how"],
    liveKicker: "Season to date · every joint pick", liveLede: "Every pick we logged this season, graded at -110 for 1 unit. Nothing removed after the fact.",
    liveGroup: { label: "Week by week", col: "Week", key: r => String(r.raw.wn ?? 99).padStart(2, "0"), name: r => r.raw.wk || "?", short: r => r.pick },
    liveEmpty: "No graded picks yet this season.",
    recordHead: { kicker: "Every season on record", h1: "The <em>long</em> haul", lede: "All our joint picks back to the first season we tracked, graded the same way. Tap a season to focus on it." },
    dims: {
      season: { n: "Season", f: r => String(r.s), desc: true },
      wk: { n: "Week", f: r => r.wk || "?", sort: r => r.wn },
      mkt: { n: "Bet type", f: r => isT(r) ? "Total" : "Side", order: ["Side", "Total"] },
      fav: { n: "Pick", f: r => isT(r) ? (r.ou || "Total") : r.ha === "H" ? "Home side" : r.ha === "A" ? "Road side" : "Side (text log)", order: ["Road side", "Home side", "Side (text log)", "Over", "Under", "Total"] },
      size: { n: "Spread size", f: r => { if (isT(r)) return "Total"; const l = r.ln != null ? Math.abs(r.ln) : r.pl != null ? Math.abs(r.pl) : null; if (l == null) return "Not logged"; return l <= 3 ? "3 or less" : l <= 7 ? "3.5-7" : l <= 14 ? "7.5-14" : "14.5+" }, order: ["3 or less", "3.5-7", "7.5-14", "14.5+", "Total", "Not logged"] },
      phase: { n: "Part of season", f: r => r.wn == null ? "Unknown" : r.wn <= 4 ? "Weeks 0-4" : r.wn <= 9 ? "Weeks 5-9" : r.wn <= 15 ? "Week 10+" : "Bowls / playoff", order: ["Weeks 0-4", "Weeks 5-9", "Week 10+", "Bowls / playoff", "Unknown"] },
    },
    filters: ["season", "mkt", "fav", "size", "phase"],
    badge: r => `<span class="tbadge ${r.mk === "Total" ? "gtd" : "ml"}">${esc(r.mk)} · ${esc(r.season)} ${esc(r.raw.wk || "")}</span>`,
    cells: r => [["Graded at", String(r.o), r.bk], ["Stake", "1u", "every pick"]],
    groupKey: r => r.raw.wk || "?",
    groupHead: (r, rs) => { const g = rs.filter(x => x.r), s = NCSUN.stats(g); return `<div class="slip-ev"><h2>${esc(r.raw.wk || "")}</h2><span class="note">${g.length === rs.length && g.length ? `${NCSUN.recTxt(s)} · <b class="${sgn(s.u)}">${fmtU(s.u)}</b>` : `${rs.length - g.length} open · 1 unit each · awaiting results`}</span></div>` },
    async load() {
      const [P, W] = await Promise.all([load("cfb_picks.json"), load("cfb_totals.json")]);
      const PP = P || { picks: [], seasons: {} }; WT = W || { seasons: {} }; Object.assign(SI, PP.seasons || {});
      const recs = (PP.picks || []).map(toRec).sort(NCSUN.byTime); ALL = recs;
      seasons = [...new Set(recs.map(r => +r.season))].sort((a, b) => b - a); cur = seasons[0] || null;
      const curP = recs.filter(r => r.season === String(cur)), open = curP.filter(r => !r.r), gr = curP.filter(r => r.r), s = NCSUN.stats(gr);
      const lastWn = Math.max(-1, ...gr.map(r => r.raw.wn ?? -1)), lastWk = gr.filter(r => r.raw.wn === lastWn);
      const sp = NCSUN.byId.cfb; sp.seasonLabel = String(cur || ""); sp.labels.live = `${cur || "Season"} live`;
      const meta = {
        kicker: `${cur || ""} college football · ${gr.length ? `season ${NCSUN.recTxt(s)}, ${fmtU(s.u)}` : "sides and totals"}`,
        lede: `Hand picks, made together. No model, just film, numbers and arguments. 1 unit each.${PP.updated ? ` Last synced from our sheet ${esc(PP.updated)}.` : ""}`, copyTitle: "card",
        emptyHead: "Between weeks", empty: "No open picks right now. New picks show up here as soon as they're in the sheet.",
        health: { ok: true, what: "Synced from the sheet", at: PP.updated || null, note: "Rebuilt whenever the sheet changes" }, cadence: "synced from the sheet",
      };
      // the week card: open picks plus the most recent graded week
      return { today: open.concat(lastWk), live: curP, meta };
    },
    async loadRecord() { return ALL.length ? ALL : (await NCSUN.data(NCSUN.byId.cfb), ALL) },
    recordDraw(el, rows) {
      let focus = null;
      const draw = () => { el.innerHTML = seasonTiles(rows, focus) + `<div class="stack" data-h></div>`;
        const sub = focus == null ? rows : rows.filter(r => r.season === String(focus));
        NCSUN.lab($("[data-h]", el), sub, "cfb-h", focus == null ? `${seasons.length} seasons` : `${focus} season`, NCSUN.byId.cfb);
        const dn = focus != null && SI[focus] && SI[focus].dnb && SI[focus].dnb.length ? SI[focus].dnb : null;
        if (dn) $("[data-h]", el).insertAdjacentHTML("beforeend", `<div class="panel flat"><h3>${focus} do-not-bet list</h3><div class="dnb" style="margin-top:10px">${dn.map(t => `<span>${esc(t)}</span>`).join("")}</div></div>`) };
      el.addEventListener("click", e => { const b = e.target.closest(".season"); if (!b) return; focus = b.dataset.s ? +b.dataset.s : null; draw() });
      draw();
    },
    extras: { totals: { label: "Win totals", kicker: "Season win totals · $10 a team", h1: "Win <em>totals</em>", lede: "Our preseason over/under bets on team win totals, tracked as the season goes.", draw: el => NCSUN.data(NCSUN.byId.cfb).then(() => drawTotals(el)) } },
    how: el => { el.innerHTML = `<div><div class="kicker">The old-fashioned way</div><h1>No model. <em>Just us.</em></h1>
      <p class="lede">Unlike the model tabs, nothing here comes out of a model. These are picks we argue our way into each week, and log as one card.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Joint picks only</h3><p>This tab logs the card we make together. Our separate picks are tracked on their own and never counted here.</p></div>
      <div class="panel stop"><h3>What we look for</h3><p>Personnel news, line moves, how the game should actually play out, weather and price. Not trends that are already baked into the number.</p></div>
      <div class="panel stop"><h3>1 unit, every time</h3><p>Every pick is 1 unit, graded at -110. You need 52.4% to break even, so that is the bar.</p></div>
      <div class="panel stop"><h3>The do-not-bet list</h3><p>Teams that have burned us enough that we've sworn them off. Shown with each season.</p></div>
    </div><div class="panel flat prose" data-dnb><h3>Do-not-bet lists</h3><p class="note">Loading…</p></div>`;
      NCSUN.data(NCSUN.byId.cfb).then(() => { const dnbAll = Object.entries(SI).filter(([, v]) => v.dnb && v.dnb.length).sort((a, b) => b[0] - a[0]);
        $("[data-dnb]", el).innerHTML = dnbAll.length ? `<h3>Do-not-bet lists</h3>${dnbAll.map(([y, v]) => `<p><b>${y}</b></p><div class="dnb">${v.dnb.map(t => `<span>${esc(t)}</span>`).join("")}</div>`).join("")}` : "<h3>Do-not-bet lists</h3><p class=\"note\">None logged yet.</p>" }) },
  });
})();
