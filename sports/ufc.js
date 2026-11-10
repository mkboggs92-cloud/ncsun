/* UFC — adapter for ufc_today.json, ufc_live.json, ufc_backtest.json, ufc_status.json, ufc_paper.json, ufc_dfs.json
   (written by the UFC model's 9 AM / 5 PM runs). Keeps the fight-by-fight card and the DraftKings DFS pool. */
(function () {
  const U = NCSUN.u, { $, esc, fmtU, pct, pct0, sgn, am, toDec, fair, dateTxt, daysTo, whenTxt, addDays, cap, load, copyText } = U;
  const BOOK = { FD: "FanDuel", DK: "DraftKings", CZR: "Caesars", MGM: "BetMGM", DraftKings: "DraftKings", Caesars: "Caesars", BetRivers: "BetRivers", best: "Best book" };
  const MK = { ML: "Moneyline", GTD: "Goes the distance", A_DEC: "Wins by decision", B_DEC: "Wins by decision", "O2.5": "Over 2.5 rounds", "O4.5": "Over 4.5 rounds", A_SUB: "Wins by submission", B_SUB: "Wins by submission" };
  const TIER = { ML: "Moneyline", DEC_A: "Decision · KO fade", DEC_B: "Decision", A_DEC: "Decision", B_DEC: "Decision", GTD: "Goes the distance", "O4.5": "Over 4.5 rounds", A_SUB: "Submission", B_SUB: "Submission" };
  const BADGE = { ML: "ml", DEC_A: "fade", DEC_B: "dec", A_DEC: "dec", B_DEC: "dec", GTD: "gtd" };
  const tierOf = r => r.tier || ((r.mk || "ML") === "ML" ? "ML" : r.mk);
  const barOf = r => (tierOf(r) === "ML" ? 0.05 : 0.05);        // ML: EV >= 5%; props (paper): 5-pt edge (Nov 9)
  const isProp = r => (r.mk || "ML") !== "ML";
  const isWithdrawn = r => r.mth === "superseded";
  const ML_CAP = 2;         // moneylines per event (live.py cap_for("ML")); props are paper only since 2026-11-09
  // worst price that still qualifies: moneylines need EV p*d - 1 >= 5% (rule since Oct 19); props a 5-pt edge
  const minPrice = (p, bar = 0.05, ml = true) => ml ? fair(p / 1.05) : fair(p - bar);   // American odds
  const MON = U.MON;
  const LIGHT = ["flyweight", "bantamweight", "featherweight", "women's strawweight", "women's flyweight", "women's bantamweight", "women's featherweight"];
  const pts = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const money = v => v == null ? "–" : "$" + Math.round(v).toLocaleString("en-US");
  const BK3 = [["FD", "fd"], ["DK", "dk"], ["CZR", "czr"]];
  const short = n => { const t = String(n || "").trim().split(/\s+/); return t.length >= 3 && /^(dos|de|da|del|van|von|la|le|di)$/i.test(t[t.length - 2]) ? t.slice(-2).join(" ") : t[t.length - 1] || "" };
  const pubTxt = (u, full) => !u ? "" : full
    ? `DraftKings public on this side: <b>${u.bets}%</b> of bets · <b>${u.handle}%</b> of money${u.handle - u.bets >= 15 ? " (bigger bettors on it)" : u.bets - u.handle >= 15 ? " (mostly small bets)" : ""} <span class="note">as of ${esc(u.at)} UTC</span>`
    : `DK ${u.bets}% bets · ${u.handle}% $`;
  let sideOf = new Map();   // "date|fighter" -> that fighter's side on the card (prices at the three books)
  function booksNow(r) {
    const side = sideOf.get(r.d + "|" + r.pk); if (!side || isProp(r)) return null;
    const worst = r.p ? minPrice(r.p, barOf(r), !isProp(r)) : null, wd = toDec(worst);
    const cells = BK3.map(([k, f]) => { const o = side[f]; const ok = o != null && (wd == null || toDec(o) >= wd - 1e-9); return { k, o, ok } });
    const live = cells.filter(c => c.o != null), good = live.filter(c => c.ok).sort((a, b) => toDec(b.o) - toDec(a.o));
    return { cells, best: good[0] || null, gone: live.length > 0 && !good.length, worst };
  }
  function toRec(r, paper) {
    const t = tierOf(r), worst = r.p ? minPrice(r.p, barOf(r), !isProp(r)) : null, bn = paper || r.r ? null : booksNow(r);
    const gone = !!(bn && bn.gone);
    let extra = ""; if (bn && bn.best && bn.best.k !== r.bk && toDec(bn.best.o) > toDec(r.o) + 1e-9) extra = `Best now <b>${esc(BOOK[bn.best.k])} ${am(bn.best.o)}</b>`;
    return { d: r.d, ev: r.ev || "UFC", pick: r.lab || r.pk, detail: `${isProp(r) ? esc(r.op) : "vs " + esc(r.op)}${r.div ? " · " + esc(cap(r.div)) : ""}`, mk: MK[r.mk || "ML"] || r.mk, tier: TIER[t] || t,
      o: r.o, bk: BOOK[r.bk] || r.bk, stake: r.su || 1, p: r.p, m: r.m, e: r.e, r: r.r || null, pl: r.r ? (r.u || 0) : null, act: r.mth ? `${r.mth}${r.rnd ? " R" + r.rnd : ""}` : null, clv: isProp(r) ? null : r.clv ?? null,   // CLV on moneylines only (prop CLV starts ~-10% from the vig)
      posted: r.posted || null, paper: !!paper, id: paper ? ["ufc", "paper", r.d, r.lab || r.pk, r.mk, r.bk].join("|") : undefined, limit: gone ? `Price moved past ${am(bn.worst)} everywhere · pick stands at ${am(r.o)}` : worst != null ? `Take ${am(worst)} or better` : null, limitGone: gone, worst, extra, raw: r };
  }
  const SHORT = { Moneyline: "moneyline", "Decision · KO fade": "KO fade", Decision: "decision", "Goes the distance": "distance" };

  // ---------------------------------------------------------------- fight rows (full card)
  function fightRow(f, picks) {
    const pa = f.a.p ?? 0.5, pb = 1 - pa, mk = f.a.mkt, bets = f.bets || [], hasPick = !!(f.a.pick || f.b.pick || bets.length);
    const propPicks = bets.length ? `<small>${bets.map(b => `<span class="badge">Pick · ${esc(TIER[b.tier] || MK[b.mk] || b.mk)} ${am(b.o)}</span>`).join(" ")}</small>` : "";
    const px = s => BK3.filter(([, k]) => s[k] != null).map(([b, k]) => `${b} <b>${am(s[k])}</b>`).join(" · ") || "no line";
    const side = (s, cls) => `<div class="side ${cls}${s.pick ? " pick" : ""}"><span class="nm">${esc(s.n)}${s.pick ? ` <span class="badge">Pick ${am(s.pick.o)}</span>` : ""}</span>
      <span class="px">${px(s)}</span><span class="px">fair ${am(fair(s.p))}</span>${s.pub ? `<span class="px pub" title="DraftKings public: share of bets / share of money">${pubTxt(s.pub)}</span>` : ""}${s.ufc != null ? `<span class="px">${s.ufc} UFC fight${s.ufc === 1 ? "" : "s"}</span>` : ""}</div>`;
    const tags = [f.tf ? "Title fight" : f.rd >= 5 ? "5 rounds" : "3 rounds", cap(f.div), f.debut ? "Debut · no bet" : ""].filter(Boolean).join(" · ");
    const meth = f.pgtd != null ? `<span class="meth"><span>Distance <b>${pct0(f.pgtd)}</b></span>${f.pdec_a != null ? `<span>${esc(short(f.a.n))} dec <b>${pct0(f.pdec_a)}</b></span>` : ""}${f.pdec_b != null ? `<span>${esc(short(f.b.n))} dec <b>${pct0(f.pdec_b)}</b></span>` : ""}</span>`
      : f.ko != null ? `<span class="meth"><span>KO <b>${pct0(f.ko)}</b></span><span>Sub <b>${pct0(f.sub)}</b></span><span>Dec <b>${pct0(f.dec)}</b></span></span>` : "";
    const lean = (f.why_a && f.why_a.length) || (f.why_b && f.why_b.length) ? `<div class="lean">
      <div><i class="dot" style="background:var(--cobalt)"></i><b>${esc(short(f.a.n))}</b><span>${(f.why_a || []).map(x => esc(x.label)).join(" · ") || "–"}</span></div>
      <div><i class="dot" style="background:var(--coral)"></i><b>${esc(short(f.b.n))}</b><span>${(f.why_b || []).map(x => esc(x.label)).join(" · ") || "–"}</span></div></div>` : "";
    return `<div class="fight${hasPick ? " has-pick" : ""}">${side(f.a, "a")}<div class="mid"><span class="pv"><span class="ma">${pct0(pa)}</span><span class="mb">${pct0(pb)}</span></span>
      <span class="pbar" role="img" aria-label="${esc(f.a.n)} ${pct0(pa)}, ${esc(f.b.n)} ${pct0(pb)}${mk != null ? `; market ${pct0(mk)}` : ""}"><i class="a" style="width:calc(${(pa * 100).toFixed(1)}% - 1px)"></i><i class="b" style="flex:1"></i>${mk != null ? `<span class="mk" style="left:${(mk * 100).toFixed(1)}%" title="Market ${pct0(mk)}"></span>` : ""}</span>
      <small>${esc(tags)}</small>${propPicks}${meth}${f.watch ? `<small><span class="badge watch">Prop watch</span></small><span class="meth">${esc(f.watch)}</span>` : ""}</div>${side(f.b, "b")}${lean}</div>`;
  }

  // ---------------------------------------------------------------- DFS (DraftKings classic)
  const fkey = x => [x.name, x.opp].sort().join("|");
  const finOf = x => (x.p_ko || 0) + (x.p_sub || 0);
  const SORTS = { proj: ["Projection", x => x.proj], value: ["Value (pts per $1k)", x => x.value ?? -1], salary: ["Salary", x => x.salary ?? -1], p90: ["Ceiling (90th pct)", x => x.p90], p_win: ["Win chance", x => x.p_win], fin: ["Finish chance", finOf], fight: ["Fight order", null] };
  const SAL = [["all", "Any salary", () => true], ["9", "$9,000+", s => s >= 9000], ["8", "$8,000-8,900", s => s >= 8000 && s < 9000], ["7", "$7,000-7,900", s => s >= 7000 && s < 8000], ["6", "Under $7,000", s => s < 7000]];
  function dfsView(el, data) {
    const slates = ((data && data.slates) || []).filter(s => s && s.pool && s.pool.length);
    if (!slates.length) { el.innerHTML = `<div class="banner"><b>Soon</b><span>No DraftKings slate is loaded yet. Projections show up here about a week before each card, lineups once DraftKings posts salaries.</span></div>`; return }
    let si = slates.findIndex(s => daysTo(s.date) >= 0); if (si < 0) si = slates.length - 1;
    let sortK = "proj", dir = -1, q = "", onlyIn = false, sal = "all"; const open = new Set();
    function lineupCard(s, lu, byId, maxR, shared) {
      const L = (lu.ids || []).map(id => byId.get(id)).filter(Boolean), capv = s.cap || 50000, left = capv - lu.salary;
      const lo = lu.p10 ?? lu.proj, hi = lu.p90 ?? lu.proj, P = v => Math.max(0, Math.min(100, v / maxR * 100)).toFixed(1);
      return `<article class="panel lu" aria-label="${esc(lu.label)}">
        <div class="lu-head"><span class="lu-rank">${lu.rank}</span><div class="lu-title"><h2>${esc(lu.label || "Lineup " + lu.rank)}</h2><span>${L.length} fighters · one per fight</span></div>
          <div class="lu-proj"><b>${lu.proj.toFixed(1)}</b><small>projected pts</small></div></div>
        <div class="lu-meta"><div><small class="subh">Salary used</small><b>${money(lu.salary)}</b><div class="meter" role="img" aria-label="${money(lu.salary)} of ${money(capv)}"><i style="width:${Math.min(100, lu.salary / capv * 100).toFixed(1)}%"></i></div><span>${money(left)} left of ${money(capv)}</span></div>
          <div><small class="subh">Likely range</small><b>${lo.toFixed(0)} to ${hi.toFixed(0)}</b><div class="rng" role="img" aria-label="10th to 90th percentile ${lo.toFixed(0)} to ${hi.toFixed(0)}, projection ${lu.proj.toFixed(0)}"><i style="left:${P(lo)}%;width:${(P(hi) - P(lo)).toFixed(1)}%"></i><em style="left:${P(lu.proj)}%"></em></div><span>8 in 10 simulated nights</span></div></div>
        <div class="lu-list">${L.map(x => `<div class="lu-row"><span class="sal">${money(x.salary)}</span><span class="who"><b>${esc(x.name)}${shared.has(x.id) ? '<span class="both">both</span>' : ""}</b><span>vs ${esc(x.opp)} · ${am(x.ml)} · ${pct0(x.p_win)} to win</span></span><span class="pp"><b>${x.proj.toFixed(1)}</b><span>${x.p10.toFixed(0)}-${x.p90.toFixed(0)}</span></span></div>`).join("")}</div>
        <div class="lu-foot">${lu.note ? `<p class="note">${esc(lu.note)}</p>` : '<span style="flex:1"></span>'}<button class="ghost" data-copy="${lu.rank}">Copy names</button>${lu.ids.every(id => (byId.get(id) || {}).dk_id) ? `<button class="ghost" data-csv="${lu.rank}">DK upload CSV</button>` : ""}</div></article>`;
    }
    function poolRows(s) {
      const live = s.salaries === "live", order = new Map(); s.pool.forEach((x, i) => { const k = fkey(x); if (!order.has(k)) order.set(k, order.size) });
      const qq = q.trim().toLowerCase(), sf = (SAL.find(x => x[0] === sal) || SAL[0])[2];
      let rows = s.pool.filter(x => (!qq || x.name.toLowerCase().includes(qq) || String(x.opp).toLowerCase().includes(qq)) && (!onlyIn || (x.in || []).length) && (!live || sal === "all" || (x.salary != null && sf(x.salary))));
      if (sortK === "fight") rows = rows.slice().sort((a, b) => order.get(fkey(a)) - order.get(fkey(b)) || b.proj - a.proj);
      else { const f = SORTS[sortK][1]; rows = rows.slice().sort((a, b) => dir * (f(a) - f(b)) || b.proj - a.proj) }
      const topV = live ? new Set(s.pool.slice().sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 5).map(x => x.id)) : new Set();
      const th = (k, lbl, cls = "") => `<th class="${cls}" data-k="${k}" ${sortK === k ? `aria-sort="${dir < 0 ? "descending" : "ascending"}"` : ""} scope="col"><button class="sortb" type="button">${lbl}</button></th>`;
      if (!rows.length) return '<p class="note">No fighters match.</p>';
      return `<table class="pool"><thead><tr><th class="l" scope="col">Fighter</th>${th("salary", "Salary")}${th("proj", "Proj")}${th("p90", "Range", "c-rng")}${live ? th("value", "Value") : ""}${th("p_win", "Win")}${th("fin", "Finish", "c-fin")}<th class="c-ml" scope="col">ML</th></tr></thead><tbody>
        ${rows.map(x => { const o = open.has(x.id), inn = x.in || []; return `<tr class="fx${inn.length ? " in1" : ""}" data-id="${esc(x.id)}" tabindex="0" aria-expanded="${o}">
          <td class="nm"><b>${esc(x.name)}${inn.map(n => `<span class="lt" title="In lineup ${n}">L${n}</span>`).join("")}</b><span>vs ${esc(x.opp)}${x.rounds >= 5 ? " · 5 rds" : ""}</span></td>
          <td class="mono">${x.salary != null ? `<span class="sl">${money(x.salary)}</span><span class="ss">${(x.salary / 1000).toFixed(1)}k</span>` : "TBD"}</td><td class="mono"><b>${x.proj.toFixed(1)}</b></td>
          <td class="c-rng mono">${x.p10.toFixed(0)}-${x.p90.toFixed(0)}</td>${live ? `<td class="mono${topV.has(x.id) ? " hi" : ""}">${x.value != null ? x.value.toFixed(2) : "–"}</td>` : ""}
          <td>${pct0(x.p_win)}</td><td class="c-fin">${pct0(finOf(x))}</td><td class="c-ml mono">${am(x.ml)}</td></tr>
          ${o ? `<tr class="det"><td colspan="${live ? 8 : 7}">${detail(x)}</td></tr>` : ""}` }).join("")}</tbody></table>`;
    }
    function detail(x) {
      const seg = (v, c) => `<i style="width:${(v * 100).toFixed(1)}%;background:${c}"></i>`, lose = Math.max(0, 1 - x.p_win);
      const f = (lbl, v, sub) => `<div><small>${lbl}</small><b>${v}</b>${sub ? `<span class="note" style="margin:0">${sub}</span>` : ""}</div>`;
      return `<div class="det-g">
        <div style="grid-column:1/-1"><small>How he wins</small><div class="mbar" role="img" aria-label="KO ${pct0(x.p_ko)}, submission ${pct0(x.p_sub)}, decision ${pct0(x.p_dec)}, loses ${pct0(lose)}">${seg(x.p_ko, "var(--coral)")}${seg(x.p_sub, "var(--sun)")}${seg(x.p_dec, "var(--cobalt)")}${seg(lose, "var(--line)")}</div>
          <span class="note" style="margin:0"><b style="color:var(--coral-ink);font:inherit">KO ${pct0(x.p_ko)}</b> · Sub ${pct0(x.p_sub)} · <b style="color:var(--cobalt);font:inherit">Dec ${pct0(x.p_dec)}</b> · loses ${pct0(lose)} · wins in round 1 ${pct0(x.p_r1)}</span></div>
        ${f("If he wins", x.pts_win != null ? x.pts_win.toFixed(1) + " pts" : "–")}${f("If he loses", x.pts_loss != null ? x.pts_loss.toFixed(1) + " pts" : "–")}
        ${f("Minutes", x.mins != null ? x.mins.toFixed(1) : "–", `of ${(x.rounds || 3) * 5} scheduled`)}${f("Sig. strikes", x.sig != null ? x.sig.toFixed(1) : "–")}
        ${f("Takedowns", x.td != null ? x.td.toFixed(1) : "–")}${f("Control", x.ctrl != null ? x.ctrl.toFixed(1) + " min" : "–")}${f("Knockdowns", x.kd != null ? x.kd.toFixed(2) : "–")}
        ${f("Moneyline", am(x.ml), esc(x.fight || ""))}</div>
        ${x.pts_win != null && x.pts_loss != null ? `<p class="note">Projection: ${pct0(x.p_win)} × ${x.pts_win.toFixed(1)} + ${pct0(lose)} × ${x.pts_loss.toFixed(1)} ≈ <b>${(x.p_win * x.pts_win + lose * x.pts_loss).toFixed(1)}</b>. Volumes are expected totals across the whole simulated fight.</p>` : ""}`;
    }
    function explain(s) {
      const rules = data.rules && data.rules.length ? data.rules : null;
      return `<div class="grid2">
        <div class="panel flat prose"><h3>How it's scored</h3><p>${esc(data.scoring || "DraftKings MMA classic")}: pick 6 fighters under a ${money(s.cap || 50000)} cap. Fighters score for what they do in the cage (significant strikes, takedowns, control time, knockdowns, reversals) plus a win bonus that is biggest for an early finish and smallest for a decision. A loser still scores his volume.</p>
          ${rules ? `<div class="tbl"><table class="rules"><thead><tr><th class="l">Action</th><th>Points</th></tr></thead><tbody>${rules.map(r => `<tr><td class="l">${esc(r[0])}</td><td class="mono">${esc(r[1])}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>
        <div class="panel flat prose"><h3>How it's projected</h3>${(data.how && data.how.length ? data.how : [
          "Win chance is the same market-blended number as the fight card. The prop model splits it into KO, submission and decision and by round, which sets the win bonus.",
          "Strikes, takedowns, control time and knockdowns come from each fighter's rates, scaled by how long the fight is expected to last. A quick finish means a big bonus but little volume.",
          "Projection = win chance × points in a win + loss chance × points in a loss. The range is the 10th to 90th percentile of simulated scores: MMA scores are lumpy, so ranges are wide.",
          "Lineups are the highest projected totals under the cap, never both fighters from one fight. Value is projected points per $1,000 of salary."]).map(p => `<p>${esc(p)}</p>`).join("")}</div></div>`;
    }
    function draw() {
      const s = slates[si], live = s.salaries === "live", byId = new Map(s.pool.map(x => [x.id, x])), lus = live ? (s.lineups || []) : [];
      const maxR = Math.max(1, ...lus.map(l => l.p90 ?? l.proj)) * 1.04;
      const cnt = new Map(); lus.forEach(l => (l.ids || []).forEach(id => cnt.set(id, (cnt.get(id) || 0) + 1))); const shared = new Set([...cnt].filter(([, n]) => n > 1).map(([id]) => id));
      const nf = new Set(s.pool.map(fkey)).size;
      el.innerHTML = `${slates.length > 1 ? `<div class="slates" role="group" aria-label="Slate">${slates.map((x, i) => `<button class="chip" data-slate="${i}" aria-pressed="${i === si}"><b>${esc(x.event)}</b><small>${esc(dateTxt(x.date))} · ${x.salaries === "live" ? "salaries live" : "salaries pending"}</small></button>`).join("")}</div>` : ""}
        <div class="sec-h"><h2>${esc(s.event)}</h2><span class="note">${esc(dateTxt(s.date))}${whenTxt(s.date) ? " · " + whenTxt(s.date) : ""} · ${nf} fights · ${s.pool.length} fighters</span></div>
        ${live && lus.length ? `<div class="lus">${lus.map(l => lineupCard(s, l, byId, maxR, shared)).join("")}</div>`
          : live ? `<div class="banner"><b>Building</b><span>Salaries are posted. Lineups appear here after the next model run.</span></div>`
          : `<div class="banner"><b>Pending</b><span>DraftKings hasn't posted salaries for this card yet. Projections are below; the two lineups appear here as soon as salaries post.</span></div>`}
        <div class="panel poolp"><div class="lab-head"><h2>Player pool</h2><span class="note">Tap a fighter for his method split and stat line</span></div>
          <div class="pool-ctl"><label class="f">Fighter<input type="search" id="dfs-q" placeholder="Search a fighter" value="${esc(q)}"></label>
            <label class="f">Sort by<select id="dfs-sort">${Object.entries(SORTS).filter(([k]) => live || k !== "value").map(([k, v]) => `<option value="${k}" ${k === sortK ? "selected" : ""}>${v[0]}</option>`).join("")}</select></label>
            ${live ? `<label class="f">Salary<select id="dfs-sal">${SAL.map(x => `<option value="${x[0]}" ${x[0] === sal ? "selected" : ""}>${x[1]}</option>`).join("")}</select></label>` : ""}
            ${lus.length ? `<button class="ghost toggle" id="dfs-in" aria-pressed="${onlyIn}">In a lineup</button>` : ""}</div>
          <div class="tbl" id="dfs-pool">${poolRows(s)}</div>
          <p class="note">${live ? "Value is projected points per $1,000 of salary; the five best are green. " : ""}Range is the 10th to 90th percentile. Finish is his chance to win by KO or submission. ML is the DraftKings moneyline where posted.</p></div>
        ${explain(s)}<p class="note">Projections updated ${esc(data.updated || "–")} ET. For entertainment; DFS contests are games of skill with real money at risk.</p>`;
      const pool = $("#dfs-pool", el), redraw = () => pool.innerHTML = poolRows(s);
      $("#dfs-q", el).addEventListener("input", e => { q = e.target.value; redraw() });
      $("#dfs-sort", el).addEventListener("change", e => { sortK = e.target.value; dir = -1; redraw() });
      const ss = $("#dfs-sal", el); if (ss) ss.addEventListener("change", e => { sal = e.target.value; redraw() });
      const ib = $("#dfs-in", el); if (ib) ib.onclick = () => { onlyIn = !onlyIn; ib.setAttribute("aria-pressed", onlyIn); redraw() };
      el.querySelectorAll("[data-slate]").forEach(b => b.onclick = () => { si = +b.dataset.slate; open.clear(); if (slates[si].salaries !== "live" && sortK === "value") sortK = "proj"; draw() });
      el.querySelectorAll("[data-csv]").forEach(b => b.onclick = () => { const lu = lus.find(l => String(l.rank) === b.dataset.csv); if (!lu) return;
        const csv = "F,F,F,F,F,F\n" + lu.ids.map(id => byId.get(id).dk_id).join(",") + "\n";
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `dk_lineup_${s.date}_${lu.rank}.csv`; document.body.appendChild(a); a.click(); a.remove(); });
      el.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { const lu = lus.find(l => String(l.rank) === b.dataset.copy); if (!lu) return;
        copyText(`${s.event} · DraftKings classic · ${lu.label}\n` + lu.ids.map(id => byId.get(id)).filter(Boolean).map(x => `${x.name} (${money(x.salary)})`).join("\n") + `\nSalary ${money(lu.salary)} · projected ${lu.proj.toFixed(1)}`, b, "Copy names") });
      const sel = $("#dfs-sort", el);
      pool.addEventListener("click", e => {
        const h = e.target.closest("th[data-k]"); if (h) { const k = h.dataset.k; if (sortK === k) dir = -dir; else { sortK = k; dir = -1 } sel.value = k; redraw(); return }
        const tr = e.target.closest("tr.fx"); if (tr) { const id = tr.dataset.id; open.has(id) ? open.delete(id) : open.add(id); redraw(); const n = pool.querySelector(`tr.fx[data-id="${CSS.escape(id)}"]`); if (n) n.focus({ preventScroll: true }) }
      });
      pool.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr.fx")) { e.preventDefault(); e.target.click() } });
    }
    draw();
  }

  // ---------------------------------------------------------------- live-record panels (ported from the standalone UFC tab)
  const clvTxt = c => c == null ? "–" : (c > 0 ? "+" : "") + (c * 100).toFixed(1) + "%";
  const pctS = v => v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(100 * v).toFixed(1) + "%";
  // mean, n and standard error (CLV is judged by mean / SE, review 2026-11-09)
  const mse = a => { const x = a.filter(v => v != null && isFinite(v)); if (!x.length) return null; const m = x.reduce((p, q) => p + q, 0) / x.length;
    const sd = x.length > 1 ? Math.sqrt(x.reduce((p, q) => p + (q - m) * (q - m), 0) / (x.length - 1)) : null; return { n: x.length, m, se: sd == null ? null : sd / Math.sqrt(x.length) } };
  const evOf = r => r.p != null && r.dec ? r.p * r.dec - 1 : null;       // posted expected value of a moneyline
  const isV2 = r => String(r.mk || "").startsWith("V2_");
  const isGraded = r => r.r === "W" || r.r === "L";
  const bydate = (a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0;
  // paper prop tiers (Nov 9 audit #3: the rule's one prop per fight is logged as PAPER_<tier>; debut fights get _DEBUT)
  const TT = { PAPER_GTD: "Goes the distance", PAPER_DEC_A: "Decision · KO fade", PAPER_DEC_B: "Decision" };
  const ttOf = t => { t = String(t || ""); const d = t.endsWith("_DEBUT"), b = d ? t.slice(0, -6) : t; return TT[b] ? TT[b] + (d ? " · debut" : "") : null };
  const paperTier = r => (r.tier && String(r.tier).startsWith("PAPER_") && r.tier !== "PAPER" ? r.tier : r.mk === "GTD" ? "PAPER_GTD" : tierOf(r));
  // status pill in the engine's .tag style: g = fine / too early, a = review, r = pause (or "rule fires"), n = collecting
  const pill = (s, txt, title) => `<span class="tag${s === "g" ? " w" : s === "r" ? " l" : s === "n" ? " small" : ""}"${s === "a" ? ' style="color:var(--coral-ink)"' : ""}${title ? ` title="${esc(title)}"` : ""}>${esc(txt)}</span>`;
  const WRAP = 'style="white-space:normal;min-width:150px"';
  const head2 = (h, note) => `<div class="lab-head"><h2>${h}</h2>${note ? `<span class="note">${note}</span>` : ""}</div>`;

  // Closing-line value: the headline for the live record. Units cannot tell a 3% edge from zero for decades of bets;
  // moneyline CLV can in a few dozen. Consensus (de-vigged BestFightOdds close), same book (cb) and Pinnacle (cs).
  function clvPanel(rows) {
    const ml = rows.filter(r => !isProp(r) && isGraded(r)), pr = rows.filter(r => isProp(r) && isGraded(r));
    const C = mse(ml.map(r => r.clv)), B = mse(ml.map(r => r.cb)), P = mse(ml.map(r => r.cs));
    const tile = (lbl, s, what) => `<div><small>${lbl}</small><b class="${!s ? "" : s.m >= 0 ? "pos" : "neg"}">${s ? clvTxt(s.m) : "–"}</b><span>${s ? `n = ${s.n}${s.se != null ? ` · SE ${(100 * s.se).toFixed(1)}%` : ""}${s.se ? ` · ${(s.m / s.se).toFixed(1)} SE from 0` : ""}` : "no closes yet"}</span><span style="display:block">${what}</span></div>`;
    const z = C && C.se ? C.m / C.se : 0, n = C ? C.n : 0;
    const verdict = !C ? "Closing lines appear after each card is graded." : n < 20 ? `Early: ${n} moneyline${n === 1 ? "" : "s"} with a close. Read the sign and the SE, not the units.`
      : z > 2 ? "Moneyline picks are beating the close by more than 2 SE: the edge is showing where it should." : z < -2 ? "Moneyline picks are getting worse prices than the close by more than 2 SE: the model is behind the market."
      : C.m >= 0 ? "Positive but within 2 SE of zero. Keep watching." : "Negative but within 2 SE of zero. Keep watching.";
    const g = ml.filter(r => r.clv != null).slice().sort(bydate).slice(-40), W = 100, H = 56, bw = W / Math.max(g.length, 12), mx = Math.max(0.1, ...g.map(r => Math.abs(r.clv)));
    const bars = g.map((r, i) => { const h = Math.abs(r.clv) / mx * (H / 2 - 4), y = r.clv > 0 ? H / 2 - h : H / 2;
      return `<rect x="${(i * bw + bw * 0.15).toFixed(2)}" y="${y.toFixed(2)}" width="${(bw * 0.7).toFixed(2)}" height="${Math.max(h, 1).toFixed(2)}" rx="1" fill="${r.clv > 0 ? "var(--win)" : "var(--loss)"}"><title>${esc(r.lab || r.pk)} ${clvTxt(r.clv)}</title></rect>` }).join("");
    const PC = mse(pr.map(r => r.cb)), pm = mse(pr.map(r => r.mv));
    return `<div class="panel" id="ufc-clvp" style="display:grid;gap:12px">${head2("Beating the <em>close</em>", "moneyline closing-line value · the headline number for the live record · price taken × fair closing chance − 1")}
      <div class="kpis">${tile("vs consensus close", C, "de-vigged BestFightOdds close")}${tile("vs same book's close", B, "the close where the pick was posted")}${tile("vs Pinnacle close", P, "the sharpest close")}</div>
      ${bars ? `<div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="56" role="img" aria-label="CLV of the last ${g.length} moneyline picks"><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>${bars}</svg><p class="note">Each bar is one moneyline pick, oldest to newest · above the line = beat the consensus close</p></div>` : ""}
      <p style="margin:0"><b>${esc(verdict)}</b></p>
      <div class="banner" style="max-width:none"><b style="flex:none">How to judge this</b><span>Judge the record by moneyline CLV, not units. At about 75 moneylines a year, even a real +3% edge loses money in roughly 35-40% of seasons, and units can't separate a 3% edge from zero for decades; CLV can within a few dozen bets. CLV more than 2 SE above zero is evidence of an edge; below zero after 20 bets means review, after 40 means pause (tripwires below). Same-book CLV is the honest "could I have done better by waiting" number; Pinnacle is the sharpest market.</span></div>
      ${PC || pm ? `<p class="note">Props (paper from Nov 9; earlier staked props stay on the record): same-book CLV ${PC ? `${clvTxt(PC.m)} (n = ${PC.n})` : "–"}${pm ? ` · fair line moved ${pm.m >= 0 ? "+" : "−"}${Math.abs(pm.m).toFixed(1)} pts our way on average (n = ${pm.n})` : ""}. Price-vs-close-fair CLV on longshot props starts around −10% from the book's margin alone, so same-book CLV and line move are the reads there.</p>` : ""}</div>`;
  }

  // Tripwires (Oct 26 review). Only bets posted under the rules of Oct 19 or later count (rv). Green = fine or too early,
  // amber = review the model, red = pause that market. From ufc_live.json (clv, mv, u, rv).
  const TRIP_FROM = "2026-10-19";
  function tripPanel(rows) {
    const g = rows.filter(r => r.rv && r.rv >= TRIP_FROM && isGraded(r)).sort(bydate);
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const ml = g.filter(r => !isProp(r)), mlc = ml.filter(r => r.clv != null), pm = g.filter(r => isProp(r) && r.mv != null);
    const c = avg(mlc.map(r => r.clv)), nC = mlc.length, nML = ml.length, uML = ml.reduce((a, r) => a + (r.u || 0), 0);
    const mv = avg(pm.map(r => r.mv)), nP = pm.length;
    let cum = 0, pk = 0, dd = 0; g.forEach(r => { cum += r.u || 0; pk = Math.max(pk, cum); dd = Math.max(dd, pk - cum) });
    const T = [];
    { let s = "g", why = nC < 20 ? `too early to call (${nC} of 20 bets)` : "average CLV is zero or better";
      if (nC >= 40 && c < 0) { s = "r"; why = "average CLV below zero after 40+ bets" }
      else if (nC >= 20 && c < -0.01) { s = "r"; why = "average CLV below −1% after 20+ bets" }
      else if (nC >= 20 && c < 0) { s = "a"; why = "average CLV below zero after 20+ bets" }
      T.push(["Moneyline CLV", c == null ? "–" : clvTxt(c), nC, s, why, "Review below 0 after 20 bets. Pause below 0 after 40, or below −1% after 20."]) }
    { const q = Math.sqrt(nML), rl = -1.15 * q, pl = -1.65 * q; let s = "g", why = nML ? `inside the normal range (review line ${rl.toFixed(1)}u)` : "no graded moneylines yet";
      if (nML && uML < pl && c != null && c <= 0) { s = "r"; why = `below ${pl.toFixed(1)}u with CLV not positive` }
      else if (nML && uML < rl) { s = "a"; why = `below the review line of ${rl.toFixed(1)}u` }
      T.push(["Moneyline units", nML ? fmtU(uML) : "–", nML, s, why, "Review below −1.15 × √bets units. Pause below −1.65 × √bets units when CLV is 0 or worse."]) }
    { let s = "g", why = nP < 15 ? `too early to call (${nP} of 15 bets)` : "closing fair lines moved our way on average";
      if (nP >= 30 && mv <= 0) { s = "r"; why = "fair line didn't move our way after 30+ bets" }
      else if (nP >= 15 && mv <= 0) { s = "a"; why = "fair line didn't move our way after 15+ bets" }
      T.push(["Props line move", mv == null ? "–" : `${mv > 0 ? "+" : mv < 0 ? "−" : ""}${Math.abs(mv).toFixed(1)} pts`, nP, s, why, "Closing fair minus fair when posted. Review at 0 or worse after 15 bets, pause after 30."]) }
    { const s = dd >= 25 ? "r" : dd >= 15 ? "a" : "g";
      T.push(["Drawdown", dd ? `−${dd.toFixed(1)}u` : "0u", g.length, s, s === "g" ? "below 15 units from the peak" : `${dd.toFixed(1)} units below the peak`, "Review at 15 units below the peak, pause at 25."]) }
    const LBL = { g: "OK", a: "Review", r: "Pause" }, worst = T.some(t => t[3] === "r") ? "r" : T.some(t => t[3] === "a") ? "a" : "g";
    return `<div class="panel flat" id="ufc-trip" style="display:grid;gap:10px">${head2("Tripwires", `bets posted under the Oct 19 rules or later · ${g.length} graded · overall ${pill(worst, LBL[worst])}`)}
      <div class="tbl"><table style="min-width:600px"><thead><tr><th class="l">Check</th><th>Now</th><th>Bets</th><th class="l">Status</th><th class="l">Rule</th></tr></thead><tbody>
      ${T.map(([nm, v, k, s, why, rule]) => `<tr><td class="l"><b>${esc(nm)}</b></td><td class="mono">${esc(v)}</td><td>${k}</td><td class="l" ${WRAP}>${pill(s, LBL[s], why)}<br><span class="note">${esc(why)}</span></td><td class="l" ${WRAP}><span class="note">${esc(rule)}</span></td></tr>`).join("")}</tbody></table></div>
      <p class="note">Set before the results come in, so a bad run can't talk us into or out of anything. Amber means look for a cause; red means stop betting that market until it's understood.</p></div>`;
  }

  // Pre-registered checks (review 2026-11-09): decided before the data comes in; progress computed from the exports.
  function preregPanel(live, paper) {
    const ml = live.filter(r => !isProp(r) && isGraded(r)), N = ml.length;
    const lo = ml.filter(r => evOf(r) != null && evOf(r) < 0.07), hi = ml.filter(r => evOf(r) != null && evOf(r) >= 0.07);
    const L = mse(lo.map(r => r.cb)), Hh = mse(hi.map(r => r.cb));
    const pp = (paper || []).filter(r => !isWithdrawn(r) && isGraded(r));
    const CP = mse(pp.filter(r => !isProp(r) && !isV2(r)).map(r => r.clv));
    const byT = new Map(); pp.filter(isProp).forEach(r => { const t = ttOf(paperTier(r)) || TIER[paperTier(r)] || MK[r.mk] || r.mk; const k = /submission/i.test(t) ? "Submission" : t; if (!byT.has(k)) byT.set(k, []); byT.get(k).push(r) });
    const sb = s => s ? `${clvTxt(s.m)} (n = ${s.n})` : "–";
    const T = [];
    { const ok = N >= 40, fire = ok && L && L.n >= 15 && L.m < 0;
      T.push(["Moneyline EV buckets", `${N} of 40 graded moneylines`, `posted EV under 7%: same-book CLV ${sb(L)} · 7%+: ${sb(Hh)}`,
        !ok ? pill("n", "Collecting") : fire ? pill("r", "Raise bar to 7%") : pill("g", "Keep 5% bar"),
        "At 40 graded moneylines, split by posted EV (5-7% vs over 7%). Raise the bar to 7% only if the 5-7% bucket's same-book CLV is below 0 with at least 15 bets."]) }
    { const n = CP ? CP.n : 0, ok = n >= 20, fire = ok && CP.m >= 0.015;
      T.push(["Moneyline cap 2 → 3", `${n} of 20 capped paper moneylines with a close`, `consensus CLV ${sb(CP)}`,
        !ok ? pill("n", "Collecting") : fire ? pill("r", "Lift cap to 3") : pill("g", "Keep cap at 2"),
        "Moneylines blocked only by the 2-per-card cap are logged on paper. Lift the cap to 3 only if their CLV is +1.5% or better over at least 20."]) }
    const tiers = [...byT.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => [k, mse(v.map(r => r.cb))]);
    T.push(["Props back to staked", tiers.length ? tiers.map(([k, s]) => `${esc(k)}: ${s ? s.n : 0} of 30`).join(" · ") : "0 of 30",
      tiers.length ? tiers.map(([k, s]) => `${esc(k)} ${sb(s)}`).join(" · ") : "no graded paper props yet",
      tiers.some(([, s]) => s && s.n >= 30 && s.m >= 0) ? pill("r", "A tier qualifies") : tiers.some(([, s]) => s && s.n >= 30) ? pill("g", "Stay paper") : pill("n", "Collecting"),
      "Every prop is paper only from Nov 9. A prop tier is staked again only after its paper picks show same-book CLV of 0 or better over 30 graded picks."]);
    return `<div class="panel flat" id="ufc-prereg" style="display:grid;gap:10px">${head2("Pre-registered checks", "rules written down before the results · progress from the published files")}
      <div class="tbl"><table style="min-width:720px"><thead><tr><th class="l">Check</th><th class="l">Progress</th><th class="l">Now</th><th class="l">Status</th><th class="l">Rule</th></tr></thead><tbody>
      ${T.map(([nm, prog, now, s, rule]) => `<tr><td class="l"><b>${esc(nm)}</b></td><td class="l" ${WRAP}>${prog}</td><td class="l" ${WRAP}><span class="note">${now}</span></td><td class="l">${s}</td><td class="l" ${WRAP}><span class="note">${esc(rule)}</span></td></tr>`).join("")}</tbody></table></div>
      <p class="note">Posted EV is model chance × posted decimal price − 1 (picks posted before the 5% EV rule fall in the under-7% bucket). Same-book CLV is the close at the book the pick was posted at. Nothing here changes automatically: when a check fires, the rule change is made by hand with a new rule version.</p></div>`;
  }

  // Mark's own bets (output/my_bets.csv): the price actually taken next to the posted one. Only when something is logged.
  function minePanel(rows) {
    rows = rows.filter(r => r.my).sort(bydate).reverse(); if (!rows.length) return "";
    const Mm = mse(rows.filter(r => r.my.clv != null).map(r => r.my.clv)), D = mse(rows.map(r => r.my.dp));
    return `<div class="panel flat" id="ufc-mine" style="display:grid;gap:10px">${head2("Your bets vs posted", `from output/my_bets.csv · ${rows.length} logged · taken vs posted ${D ? pctS(D.m) : "–"} on average${Mm ? ` · CLV at your prices ${clvTxt(Mm.m)} (n = ${Mm.n})` : ""}`)}
      <div class="tbl"><table style="min-width:820px"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Posted</th><th class="l">You</th><th>Taken vs posted</th><th>CLV posted</th><th>CLV yours</th><th>Same book, yours</th><th>Units yours</th></tr></thead><tbody>
      ${rows.map(r => { const m = r.my; return `<tr><td class="mono">${esc(r.d)}</td><td class="l"><b>${esc(r.lab || r.pk)}</b></td><td class="l">${esc(BOOK[r.bk] || r.bk)} <b class="mono">${am(r.o)}</b><br><span class="note">${esc(r.posted || "")}</span></td><td class="l">${esc(BOOK[m.bk] || m.bk || "")} <b class="mono">${am(m.o)}</b><br><span class="note">${esc(m.t || "")}${m.hrs != null ? ` · ${m.hrs >= 0 ? "+" : ""}${m.hrs.toFixed(0)}h` : ""}</span></td><td class="mono ${sgn(m.dp || 0)}">${pctS(m.dp)}</td><td class="mono">${clvTxt(r.clv)}</td><td class="mono ${sgn(m.clv || 0)}">${clvTxt(m.clv)}</td><td class="mono">${clvTxt(m.cb)}</td><td class="mono ${sgn(m.u || 0)}">${m.u != null ? fmtU(m.u) : "open"}</td></tr>` }).join("")}</tbody></table></div>
      <p class="note">Taken vs posted is your decimal price over the posted one, minus 1. The record above is graded at the posted price; this table is your own. Posted prices last a median of about a day at Caesars, so bet the same half-day or not at all.</p></div>`;
  }

  // Public vs money (Oct 26): DraftKings ticket % and handle % from the last snapshot before each fight (ufc_public.json).
  // Tracking only: nothing here changes a bet. The "no public picks" rule is a shadow rule on trial.
  function publicPanel(P) {
    if (!P || !P.n_fights) return `${head2("Public vs money", "DraftKings splits appear once logged fights are graded")}`;
    const B = P.buckets || {}, roiTxt = v => (v >= 0 ? "+" : "−") + Math.abs(100 * v).toFixed(1) + "%";
    const rowB = (lbl, sub, b) => !b || !b.n ? "" : `<tr><td class="l" ${WRAP}><b>${lbl}</b><br><span class="note">${sub}</span></td><td class="mono">${b.n}</td><td class="mono">${b.w}-${b.l}</td><td class="mono">${pct0(b.win)}</td><td class="mono">${pct0(b.fair)}</td><td class="mono ${sgn(b.roi)}">${roiTxt(b.roi)}</td><td class="mono ${sgn(b.u)}">${fmtU(b.u)}</td></tr>`;
    const pk = P.picks || [], g = pk.filter(isGraded), on = g.filter(r => r.public), off = g.filter(r => !r.public);
    const sumU = x => x.reduce((a, r) => a + (r.u || 0), 0);
    const rec = x => { const w = x.filter(r => r.r === "W").length, c = x.filter(r => r.clv != null), cm = c.length ? c.reduce((a, r) => a + r.clv, 0) / c.length : null; return `${w}-${x.length - w}${cm == null ? "" : ` · CLV ${clvTxt(cm)}`}` };
    const K = P.kalshi || {}, T = P.veto_tix || 70, tot = sumU(g), vet = sumU(off);
    return `${head2("Public vs <em>money</em>", `DraftKings tickets % and money % · last snapshot before each fight · ${P.n_fights} graded fights · tracking only`)}
      <div class="kpis"><div><small>Favorite's share of tickets</small><b>${P.fav_tix != null ? Math.round(P.fav_tix) + "%" : "–"}</b><span>vs ${P.fav_cash != null ? Math.round(P.fav_cash) + "%" : "–"} of the money</span></div>
        <div><small>Our MLs, public on us (${T}%+ tickets)</small><b class="${sgn(sumU(on))}">${on.length ? fmtU(sumU(on)) : "–"}</b><span>${on.length ? rec(on) : "none graded"}</span></div>
        <div><small>Our MLs, everything else</small><b class="${sgn(vet)}">${off.length ? fmtU(vet) : "–"}</b><span>${off.length ? rec(off) : "none graded"}</span></div>
        <div><small>Shadow rule: skip public picks</small><b class="${sgn(vet - tot)}">${g.length ? (vet - tot >= 0 ? "+" : "−") + Math.abs(vet - tot).toFixed(1) + "u" : "–"}</b><span>vs the actual record, on ${on.length} skipped pick${on.length === 1 ? "" : "s"}</span></div></div>
      <div class="tbl"><table style="min-width:620px"><thead><tr><th class="l">Backing…</th><th>Fights</th><th>W-L</th><th>Won</th><th>Close said</th><th>ROI at DK</th><th>Units</th></tr></thead><tbody>
        ${rowB("The public", "side with most tickets", B.tickets)}${rowB("The money", "side with most handle", B.money)}
        ${rowB("Money over tickets by 10+", "bigger bettors' side (mostly underdogs)", B.sharp)}${rowB("Tickets over money by 10+", "small bettors' side (mostly favorites)", B.square)}
        ${rowB("Against a 70%+ ticket crowd", "fading lopsided public", B.fade70)}${rowB("Every favorite", "for reference", B.fav)}</tbody></table></div>
      ${pk.length ? `<details class="more"><summary>Our moneylines and the public<span>${pk.length} pick${pk.length === 1 ? "" : "s"} · tickets and money on our side</span></summary><div class="inner"><div class="tbl"><table style="min-width:560px"><thead><tr><th class="l">Date</th><th class="l">Our moneyline</th><th>Price</th><th>Tickets on us</th><th>Money on us</th><th>Result</th><th>Units</th></tr></thead><tbody>${pk.slice().sort((a, b) => a.d < b.d ? 1 : -1).map(r => `<tr><td class="mono">${esc(r.d)}</td><td class="l"><b>${esc(r.pk)}</b>${r.public ? ' <span class="tag small">public</span>' : ""}</td><td class="mono">${am(r.o)}</td>${r.tix == null ? `<td class="mono" colspan="2"><span class="note">too early${r.hrs != null ? ` (${Math.round(r.hrs)}h out)` : ""}</span></td>` : `<td class="mono">${r.tix}%</td><td class="mono">${r.cash}%</td>`}<td>${r.r ? `<span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span>` : '<span class="tag small">Open</span>'}</td><td class="${sgn(r.u || 0)}">${r.r ? fmtU(r.u || 0) : "–"}</td></tr>`).join("")}</tbody></table></div></div></details>` : ""}
      <p class="note">Snapshots taken more than ${P.early_hours || 48} hours before a fight, or with tickets or money at exactly 0% or 100%, are too thin to mean anything: they show as "too early" and are left out of the groups${P.n_early ? ` (${P.n_early} graded fight${P.n_early > 1 ? "s" : ""} left out)` : ""}. "Close said" is how often that side should have won at the de-vigged DraftKings price. So far every group has won about as often as the closing line said, so the ROI gaps are mostly the book's margin plus noise: with 25–50 fights a group's ROI is uncertain by roughly ±15–40%. The public is on the favorite in about 9 of 10 fights, and our moneylines are usually favorites, so most of them are "public picks". The shadow rule skips any moneyline with ${T}%+ of DraftKings tickets on it; it is tracked here and not applied. In Kalshi's 2025–26 trade data, model picks with the crowd on them returned ${K.on_roi != null ? roiTxt(K.on_roi) : "–"} (${K.on_n || 0} picks) against ${K.off_roi != null ? roiTxt(K.off_roi) : "–"} (${K.off_n || 0}) otherwise, with no significant difference. A rule like this only gets adopted if it holds up over about 100 picks.</p>`;
  }

  // Backtest headline (Nov 9 review): realised vs CLV-implied ROI, the gap in SE, price bands, what a season looks like.
  function btSummary(S) {
    const A = S.ml, E = S.expect || { lo: 0.03, hi: 0.05 }, yr = e => (S.years || []).find(y => Math.abs(y.edge - e) < 1e-9), y3 = yr(0.03), y2 = yr(0.02), R = S.red_corner || {};
    const P = v => v == null ? "–" : (v >= 0 ? "+" : "−") + Math.abs(100 * v).toFixed(1) + "%";
    const band = b => !b || !b.n ? "" : `<tr><td class="l" ${WRAP}><b>${esc(b.lab)}</b></td><td>${b.n}</td><td class="mono ${sgn(b.u)}">${fmtU(b.u)}</td><td class="mono ${sgn(b.roi)}">${P(b.roi)}</td><td class="mono">${P(b.roi_clv)}</td><td class="mono">${pct0(b.hit)} vs ${pct0(b.hit_close)}</td><td class="mono">${b.z != null ? b.z.toFixed(1) : "–"}</td></tr>`;
    return `<div class="panel" id="ufc-btsum" style="display:grid;gap:12px;margin-top:12px">${head2("Backtest vs the <em>close</em>", `${A.n} moneylines · realised ROI against what the closing line said to expect`)}
      <div class="kpis"><div><small>Realised ROI</small><b class="${sgn(A.roi)}">${P(A.roi)}</b><span>${fmtU(A.u)} · luck included</span></div>
        <div><small>CLV-implied ROI</small><b class="${sgn(A.roi_clv)}">${P(A.roi_clv)}</b><span>what the close says to expect</span></div>
        <div><small>Won vs close said</small><b>${pct0(A.hit)}</b><span>close said ${pct0(A.hit_close)}${A.z_hit != null ? ` · ${A.z_hit.toFixed(1)} SE` : ""}</span></div>
        <div><small>Honest expectation</small><b>${P(E.lo).replace(".0", "")} to ${P(E.hi).replace(".0", "")}</b><span>per moneyline bet, live</span></div></div>
      <ul class="prose" style="max-width:none;margin:0">
        <li>The realised ROI (${P(A.roi)}, ${fmtU(A.u)} on ${A.n} moneylines) ran <b>${A.z != null ? A.z.toFixed(1) : "about 4"} standard errors above its own closing-line value</b> (CLV-implied ${P(A.roi_clv)}, gap ${P(A.gap)}): its picks won ${pct0(A.hit)} when the consensus close said ${pct0(A.hit_close)}.</li>
        <li><b>About ${Math.round(100 * (R.units_share || 0.5))}% of its units came from a red-corner calibration term</b>${R.no_intercept_bets ? `; with that term at zero it is ${R.no_intercept_bets} bets and about +${Math.round(R.no_intercept_units)} units` : ""}. Live uses it only when the corner is known.</li>
        <li><b>Judge the live record by CLV, not units.</b> At about ${S.bets_per_year || 75} moneylines a year, a real 3% edge makes ${y3 ? `${fmtU(y3.u)} ± ${y3.sd.toFixed(1)}u` : "about +2u ± 6u"} a season: a <b>${y3 && y2 ? `${Math.round(100 * y3.p_lose)}-${Math.round(100 * y2.p_lose)}%` : "35-40%"} chance of a losing year</b> (2-3% edge)${y3 ? `, and a bad year (1 in 20) of ${y3.p5.toFixed(0)}u` : ""}.</li></ul>
      <div class="tbl"><table style="min-width:640px"><thead><tr><th class="l">Price band</th><th>Bets</th><th>Units</th><th>Realised ROI</th><th>CLV-implied</th><th>Won vs close said</th><th>Gap (SE)</th></tr></thead><tbody>${(S.bands || []).map(band).join("")}${band(Object.assign({}, A, { lab: "All moneylines" }))}</tbody></table></div>
      <p class="note">CLV-implied ROI is what a flat 1-unit bettor should expect if the de-vigged consensus closing line is right: average of closing chance × price − 1. Favourites' realised ROI sits close to a market-wide favourite-longshot residual; most of the excess comes from ${(S.bands || [])[1] ? S.bands[1].n + " bets" : "the bets"} priced 1.70 to 5.00, which won far more often than the close said. The ride and slice lab below show realised units, luck included.${S.source ? ` Source: ${esc(S.source)}.` : ""}</p></div>`;
  }
  let btSum = null;   // ufc_backtest.json summary, set by loadRecord
  const fillBtSum = () => { const e = document.getElementById("ufc-btsum-slot"); if (e && btSum && btSum.ml && !e.childElementCount) e.innerHTML = btSummary(btSum) };

  // status steps the pipeline flags stale (age_h over its own limit): the engine's health line shows ok=false steps and
  // an old "updated" stamp, not per-step staleness, so add those to its Stale text
  function staleSteps(status) {
    if (!status) return "";
    const st = Object.entries(status).filter(([, v]) => v && typeof v === "object" && v.stale === true && v.ok !== false);
    if (!st.length) return "";
    const ages = st.map(([, v]) => v.age_h).filter(v => v != null), lo = Math.min(...ages), hi = Math.max(...ages);
    return `${st.map(([k]) => k).join(", ")} ${st.length === 1 ? "hasn't" : "haven't"} run recently${ages.length ? ` (last ${Math.round(lo) === Math.round(hi) ? Math.round(hi) : Math.round(lo) + "-" + Math.round(hi)} h ago)` : ""}`;
  }

  const M = x => `<div class="mbox"><math display="block">${x}</math></div>`;
  NCSUN.register({
    id: "ufc", icon: '<svg viewBox="0 0 24 24"><path d="M8.5 3h7l5 5v8l-5 5h-7l-5-5V8z"/><path d="M9 14.5c0-2 1.3-3 3-3s3 1 3 3v2H9z"/><path d="M12 8.5v3"/></svg>', name: "UFC", short: "UFC", tag: "Fights",
    kicker: "UFC · moneylines and props", h1: "Fight <em>night</em>",
    lede: "Moneylines only, 1 unit each; props are tracked on paper (not bet) since Nov 9. Take the listed price or better, the same half-day it posts. Posted picks stand and are graded at the price they locked.",
    defaultTime: "18:00", durationH: 7, seasonLabel: "2026",
    groupings: ["event", "tier", "book"], defaultGroup: "event", groupName: "By card", tierOrder: ["Moneyline", "Decision · KO fade", "Decision", "Goes the distance"],
    minN: 50, defaultDim: "tier", searchHint: "Search a fighter",
    clv: { fmt: c => c == null ? "–" : (c > 0 ? "+" : "") + (c * 100).toFixed(1) + "%", label: "moneylines, avg vs close", title: "Average fair closing probability times price taken, minus 1" },
    car: '<circle cx="-12" cy="-19" r="5.5" fill="#F4DDB8" stroke="var(--ink)" stroke-width="1.6"/><path d="M-17 -21 Q-12 -24 -7 -21" fill="none" stroke="var(--coral)" stroke-width="1.6"/>',
    labels: { card: "Fight card", live: "2026 live", record: "Backtest" }, stops: ["card", "dfs", "live", "record", "how", "hood"],
    liveKicker: "Since October 2026 · real picks only",
    liveGroup: { label: "Card by card", col: "Card", key: r => r.d + "|" + r.ev, name: r => `${r.ev} · ${dateTxt(r.d)}`, short: r => (r.raw.tier === "GTD" ? "Distance" : short(String(r.raw.pk).replace(/ by (decision|submission|ko\/tko)$/i, "")) + (isProp(r.raw) ? " dec" : " ML")) },
    liveEmpty: "The record starts with the first locked pick and grows after each event.",
    recordHead: { kicker: "Out-of-sample backtest · 2023 to 2026", label: "2023-2026",
      lede: "Each year was predicted by models trained only on earlier fights, and every blend is fit only on earlier years, so bets start in 2023. Moneylines only (props are paper and not shown here), graded at FanDuel's (or BetMGM's, before it left BestFightOdds) opening price, at most 2 per card, 1 unit each. Simulated results, not a live record.",
      extra: `<div id="ufc-btsum-slot"></div><div class="panel flat prose" style="margin-top:12px"><h3>What to expect live</h3><p>This backtest is not an expectation. Every qualifying moneyline (330 bets before the 2-per-card cap) returned +21.8%, but measured against the closing line the same bets were worth about <b>+2.6%</b>: they won 76% of the time where the close said 66%, about 4 standard errors of luck. Most of the units came from 88 bets priced +100 or longer, and about half from a red-corner term in the model's calibration. Honest expectation: <b>about +3% to +5% per moneyline bet</b>. Props showed no edge live (every prop with a closing line got a worse price than the close), so they are paper only until a paper tier beats its book's close over 30 graded picks. At about 75 moneylines a year, even a real 3% edge loses money in roughly 35-40% of seasons, so judge the live record by closing-line value, not units.</p></div>` },
    dims: {
      mk: { n: "Market", f: r => MK[r.mk || "ML"] || r.mk, order: ["Moneyline", "Wins by decision", "Goes the distance", "Over 2.5 rounds"] },
      tier: { n: "Bet type", f: r => TIER[tierOf(r)] || tierOf(r), order: ["Moneyline", "Decision · KO fade", "Decision", "Goes the distance"] },
      season: { n: "Season", f: r => r.d.slice(0, 4) },
      side: { n: "Favorite / dog", f: r => r.dec < 2 ? "Favorite" : "Underdog", order: ["Favorite", "Underdog"] },
      price: { n: "Price", f: r => r.o <= -300 ? "-300 or shorter" : r.o <= -200 ? "-299 to -200" : r.o <= -140 ? "-199 to -140" : r.o < 100 ? "-139 to -101" : r.o <= 150 ? "+100 to +150" : r.o <= 400 ? "+151 to +400" : "+401 or longer", order: ["-300 or shorter", "-299 to -200", "-199 to -140", "-139 to -101", "+100 to +150", "+151 to +400", "+401 or longer"] },
      edge: { n: "Edge", f: r => r.e < 4 ? "3-4 pts" : r.e < 6 ? "4-6 pts" : r.e < 9 ? "6-9 pts" : "9+ pts", order: ["3-4 pts", "4-6 pts", "6-9 pts", "9+ pts"] },
      gender: { n: "Division", f: r => String(r.div || "").startsWith("women") ? "Women's" : "Men's", order: ["Men's", "Women's"] },
      weight: { n: "Weight group", f: r => { const d = String(r.div || ""); return d.includes("heavy") ? "Light heavy + heavy" : (d.includes("middle") || d.includes("welter")) ? "Welter + middle" : d.includes("light") ? "Lightweight" : LIGHT.includes(d) ? "Fly to feather" : "Catchweight" }, order: ["Fly to feather", "Lightweight", "Welter + middle", "Light heavy + heavy", "Catchweight"] },
      div: { n: "Weight class", f: r => cap(r.div || "Unknown") },
      rounds: { n: "Scheduled rounds", f: r => (r.tf ? "Title fight" : r.rd >= 5 ? "5-round main event" : "3 rounds"), order: ["3 rounds", "5-round main event", "Title fight"] },
      exp: { n: "UFC experience", f: r => r.nf <= 2 ? "Least-experienced has 1-2 UFC fights" : r.nf <= 5 ? "3-5 fights" : "6+ fights", order: ["Least-experienced has 1-2 UFC fights", "3-5 fights", "6+ fights"] },
      ending: { n: "How it ended", f: r => ({ KO: "KO/TKO", SUB: "Submission", DEC: "Decision" }[r.mth] || "Other"), order: ["KO/TKO", "Submission", "Decision", "Other"] },
      book: { n: "Book", f: r => BOOK[r.bk] || r.bk },
      clv: { n: "Vs closing line", f: r => r.clv == null ? "No close" : r.clv > 0 ? "Beat the close" : "Worse than close", order: ["Beat the close", "Worse than close", "No close"] },
      month: { n: "Month", f: r => MON[+r.d.slice(5, 7) - 1], order: MON },
    },
    filters: ["tier", "season", "side", "price", "edge", "gender", "weight", "rounds", "exp", "ending", "book"],
    badge: r => r.paper ? `<span class="tbadge paper">Paper · ${esc(r.tier)}</span>` : `<span class="tbadge ${BADGE[tierOf(r.raw)] || ""}">${esc(r.tier)}</span>`,
    cells: r => [["Bet at", am(r.o), r.bk], ["Fair", r.p ? am(fair(r.p)) : "–", r.p ? pct0(r.p) + " to win" : "not priced"], ["Edge", r.e != null ? (r.e > 0 ? "+" : "") + r.e.toFixed(1) : "–", r.e != null && r.raw.dec ? `pts over ${pct0(1 / r.raw.dec)}` : "", (r.e || 0) > 0 ? "pos" : ""], ["Market", r.m != null ? am(fair(r.m)) : "–", r.m != null ? pct0(r.m) + " fair" : "no fair line"], ["Worst price", r.worst != null ? am(r.worst) : "–", "still a bet"]],
    details: r => { const bn = r.r || r.paper ? null : booksNow(r.raw); let h = r.raw.pub ? `<p class="pubsplit">${pubTxt(r.raw.pub, true)}</p>` : "";
      if (bn) h += `<div class="booksnow"><span class="subh">Prices at the last run</span><div class="bk3">${bn.cells.map(c => `<div class="${c.o == null ? "" : c.ok ? "ok" : "past"}${BOOK[c.k] === r.bk ? " mine" : ""}"><small>${esc(BOOK[c.k])}</small><b>${am(c.o)}</b><span>${c.o == null ? "no line" : c.ok ? "still a bet" : "past worst"}${BOOK[c.k] === r.bk ? " · posted here" : ""}</span></div>`).join("")}</div></div>`;
      return h },
    why: r => { const w = r.raw.why; if (!w || !w.items || !w.items.length) return null; const t = tierOf(r.raw), dec = t === "DEC_A" || t === "DEC_B"; let foot = "";
      if (w.p != null) foot += `Model <b>${pct0(w.p)}</b>${w.base != null && Math.abs(w.base - 0.5) > 0.001 ? ` <span>(base ${pct0(w.base)})</span>` : ""}`;
      if (r.m != null) foot += ` · Market <b>${pct0(r.m)}</b>`;
      if (r.p != null && r.raw.dec) foot += ` · Blended <b>${pct0(r.p)}</b> vs ${pct0(1 / r.raw.dec)} at the price`;
      if (dec && w.ko != null) foot += `<br>${w.fade != null ? `<b>KO fade</b>: model has the KO at <b>${pct0(w.ko)}</b>, ${pts(w.fade * 100)} pts below the market` : `Model KO chance <b>${pct0(w.ko)}</b>${t === "DEC_A" ? " · 5+ pts below the market (KO fade)" : ""}`}`;
      return { head: "Why the model likes it", sub: "points for / against", items: w.items.map(x => ({ label: x.label, v: x.v, pts: x.pts, txt: pts(x.pts) })), foot } },
    groupHead: (r, rs) => { const d = r.d, nML = rs.filter(x => !x.paper && !isProp(x.raw)).length; const bits = [dateTxt(d) + (whenTxt(d) ? " · " + whenTxt(d) : ""), `${nML} of ${ML_CAP} moneyline slots`];   // rule 2026-11-09: moneylines only, 2 per event
      return `<div class="slip-ev"><h2>${esc(r.ev)}</h2><span class="note">${esc(bits.join(" · "))}</span></div>` },
    async load() {
      const [today, live, status, paper] = await Promise.all([load("ufc_today.json"), load("ufc_live.json"), load("ufc_status.json"), load("ufc_paper.json")]);
      const T = today || { events: [], picks: [] }, evs = (T.events || []).slice().sort((a, b) => a.d < b.d ? -1 : 1);
      sideOf = new Map(); evs.forEach(e => (e.fights || []).forEach(f => { sideOf.set(e.d + "|" + f.a.n, f.a); sideOf.set(e.d + "|" + f.b.n, f.b) }));
      const picks = (T.picks || []).filter(r => !isWithdrawn(r)).map(r => toRec(r, false));
      const openPaper = (paper || []).filter(r => !r.r && !isWithdrawn(r)).map(r => toRec(r, true));
      const lv = (live || []).filter(r => !isWithdrawn(r) && ["W", "L", "D", "NC", "Void"].includes(r.r)).map(r => toRec(r, false));
      const by = {}; picks.forEach(r => { by[r.tier] = (by[r.tier] || 0) + 1 });
      const nx = evs[0];
      const meta = {
        kicker: nx ? `Next up: ${dateTxt(nx.d)} · ${nx.ev}` : null, copyTitle: "picks",
        summary: Object.entries(by).map(([k, v]) => `${v} ${SHORT[k] || k.toLowerCase()}${v > 1 && !/s$/.test(SHORT[k] || k) && (SHORT[k] || "") !== "KO fade" ? "s" : ""}`).join(" · "),
        emptyHead: "No picks", empty: `Nothing on the upcoming cards clears the rule right now.${nx ? ` Next card: ${esc(nx.ev)}, ${esc(dateTxt(nx.d))}.` : ""} Moneyline picks usually show up 1 to 3 weeks before an event. Props are tracked on paper only.`,
        health: NCSUN.health(status, T.updated, 36, "Runs 9 AM and 5 PM ET"), next: nx ? `${nx.ev.replace(/^UFC /, "UFC ").split(":")[0]} ${whenTxt(nx.d)}` : "", cadence: "9 AM and 5 PM ET",
        events: evs, openPaper, paperAll: paper || [],
      };
      meta.health.what = "Prices updated";
      const ss = staleSteps(status); if (ss) meta.health.stale = meta.health.stale ? meta.health.stale + "; " + ss : ss;
      meta.liveRaw = lv.map(r => r.raw); meta.openRaw = picks.map(r => r.raw);
      return { today: picks.concat(openPaper), live: lv, meta };
    },
    async loadRecord() { const bt = await load("ufc_backtest.json"); const rows = Array.isArray(bt) ? bt : (bt && bt.bets) || [];   // Nov 9: {"bets","summary"}
      btSum = bt && !Array.isArray(bt) ? bt.summary : null; fillBtSum();
      return rows.filter(r => !isWithdrawn(r)).map(r => toRec(r, false)) },
    afterCard(el, d) {
      const m = d.meta, picks = d.today.filter(r => !r.paper), sp = NCSUN.byId.ufc; let html = "";
      if (m.openPaper.length) html += `<details class="more"><summary>Paper tracked (${m.openPaper.length})<span>angles logged and graded for the record, never staked</span></summary><div class="inner"><div class="slip">${m.openPaper.map(r => NCSUN.betCard(r)).join("")}</div></div></details>`;
      html += m.events.length ? `<div class="sec-h"><h2>Full card</h2><span class="note">Every fight with a line: prices, model chances, method splits, what the model weighs</span></div>` + m.events.map(e => { const np = picks.filter(p => p.d === e.d).length;
        return `<details class="more"><summary>${esc(e.ev)}<span>${esc(dateTxt(e.d))} · ${e.fights.length} fight${e.fights.length === 1 ? "" : "s"} with a line${np ? ` · ${np} pick${np > 1 ? "s" : ""}` : ""}</span></summary><div class="inner"><div class="fightcard">${e.fights.map(f => fightRow(f, picks)).join("")}</div></div></details>` }).join("")
        + `<div class="legend"><span><i style="background:var(--cobalt)"></i>Red corner</span><span><i style="background:var(--coral)"></i>Blue corner</span><span><span class="tick"></span>Market's fair chance</span><span>Bars are the model blended with the market. "Fair" is the break-even price at that chance. Method splits are model-only, for reference. Highlighted fights have a pick.</span></div>`
        : `<div class="banner"><b>Quiet</b><span>No UFC lines are posted for the next 45 days yet.</span></div>`;
      html += `<div id="ufc-teaser"></div>`;
      el.innerHTML = html;
      load("ufc_dfs.json").then(dd => { const sl = ((dd && dd.slates) || []).filter(s => s && s.pool && s.pool.length && daysTo(s.date) >= 0).sort((a, b) => a.date < b.date ? -1 : 1)[0]; if (!sl) return;
        const lu = sl.salaries === "live" && sl.lineups && sl.lineups[0];
        $("#ufc-teaser", el).innerHTML = `<div class="teaser"><span class="tbadge">DFS</span>${lu ? `<span>Best DraftKings lineup for <b>${esc(sl.event)}</b></span><span class="big">${lu.proj.toFixed(1)}</span><span>projected pts · ${money(lu.salary)}</span>` : `<span>DraftKings projections for <b>${esc(sl.event)}</b> are up. Lineups post when salaries do.</span>`}<button class="ghost" data-go="ufc-dfs">See lineups</button></div>` });
    },
    afterLive(el, d) {
      const pAll = d.meta.paperAll, pw = pAll.filter(isWithdrawn).length, paper = pAll.filter(r => !isWithdrawn(r)).sort((a, b) => a.d < b.d ? 1 : -1), g = paper.filter(r => r.r === "W" || r.r === "L").map(r => toRec(r, true)), s = NCSUN.stats(g);
      const wd = (d.live || []).length ? 0 : 0;
      // CLV is the headline (top of the view); tripwires, pre-registered checks, your bets and public splits follow the record
      const liveRaw = d.meta.liveRaw || [];
      el.insertAdjacentHTML("afterbegin", clvPanel(liveRaw));
      el.insertAdjacentHTML("beforeend", tripPanel(liveRaw) + preregPanel(liveRaw, pAll) + minePanel(liveRaw.concat(d.meta.openRaw || [])) + `<div class="panel flat" id="ufc-public" style="display:grid;gap:10px" hidden></div>`);
      load("ufc_public.json").then(P => { const pp = $("#ufc-public", el); if (P && pp) { pp.innerHTML = publicPanel(P); pp.hidden = false } });
      el.insertAdjacentHTML("beforeend",`<div class="panel flat" style="display:grid;gap:10px"><h3>Paper tracked, not bet</h3><p class="note" style="font-size:14px;max-width:72ch">Every prop since Nov 9 (goes the distance, decisions), plus over 4.5 rounds in 5-round fights and submissions against opponents who have been submitted before. Graded at 1 unit for the record only.${g.length ? ` So far <b>${s.w}-${s.l}, ${fmtU(s.u)}</b>.` : " Nothing graded yet."}${pw ? ` ${pw} withdrawn paper pick${pw > 1 ? "s" : ""} hidden.` : ""}</p>
        ${paper.length ? `<div class="tbl"><table class="log"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Fight</th><th>Price</th><th>Result</th><th>Units</th></tr></thead><tbody>${paper.slice(0, 40).map(r => `<tr><td class="mono">${r.d}</td><td class="l"><b>${esc(r.lab || r.pk)}</b></td><td class="l">${esc(r.op)}</td><td class="mono">${am(r.o)}</td><td>${r.r ? `<span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span>` : '<span class="tag small">Open</span>'}</td><td class="${sgn(r.u || 0)}">${r.r ? fmtU(r.u || 0) : "–"}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`);
    },
    extras: { dfs: { label: "DFS", kicker: "DraftKings · UFC classic", h1: "DFS <em>lineups</em>", lede: "The two best 6-fighter lineups under the salary cap, built from the same fight model as the bets. Below them, every fighter on the slate, sortable.", draw: el => { el.innerHTML = '<p class="note">Loading the slate…</p>'; load("ufc_dfs.json").then(dd => dfsView(el, dd)) } } },
    how: `<div><div class="kicker">The theory</div><h1>Beat the <em>opener</em>. Judge by the <em>close</em>.</h1>
      <p class="lede">UFC moneylines are softest when a book first hangs them and get sharper as money comes in, so the model prices fights against opening lines and bets a moneyline only when its expected value is at least 5%. Everything else, props included, is logged on paper and graded like a bet, but not staked. The test of the whole thing is whether posted prices beat the closing line.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Every fight, every fighter</h3><p>Round-by-round UFCStats box scores since 1994, each fighter's full pro record from Sherdog (regional shows included), and FightMatrix's pre-fight ratings and rankings: 57,000 bouts across 24,000 fighters. Everything is built from fights before the one being priced.</p></div>
      <div class="panel stop"><h3>Ratings</h3><p>Our own Bradley-Terry rating, solved over the whole web of who beat whom and refit monthly, plus FightMatrix's three rating systems and division rank going into each fight. Taking FightMatrix, the graph rating and the Sherdog records out together cuts the moneyline backtest from 330 bets and +72 units to 232 bets and +13. Measured against the closing line, though, none of them adds anything the close doesn't already know.</p></div>
      <div class="panel stop"><h3>Two models</h3><p>A win model (LightGBM plus logistic regression on about 85 inputs, calibrated on earlier years) and a prop model that reads how each fighter wins and loses: KO, submission and decision rates over his whole career, how fast, how recently, durability, striking, age and reach. Every fight is fed both ways, so the corner never matters. Only the win model's picks are staked.</p></div>
      <div class="panel stop"><h3>Market blend</h3><p>Neither model is bet raw. Each is blended with the book's own price, with weights fit on earlier years for that book and how long the line has been up. The model earns weight only where it beats the market on its own.</p></div>
      <div class="panel stop"><h3>The card</h3><p>Moneylines need at least 5% expected value at +400 or shorter (10% if first qualifying inside 72 hours), with two or more books pricing the fight and no debutants. At most 2 moneylines per event, 1 unit each. Props are paper only since Nov 9: every prop with a closing line got a worse price than the close.</p></div>
      <div class="panel stop"><h3>Posted picks stand</h3><p>Picks lock the first time they qualify, at FanDuel, DraftKings or Caesars, whichever pays best. Once posted they are graded at that price even if the line or the model moves. Only a cancelled fight or a replacement opponent withdraws one.</p></div>
    </div>
    <div class="grid2">
      <div class="panel flat prose"><h3>What it doesn't bet</h3><ul>
        <li>Fights with a UFC debutant: too little to go on.</li>
        <li>Props of any kind since Nov 9. The prop rule still runs: one prop per fight (goes the distance first, else the best decision pick) with at least a 5-point edge at +1000 or shorter, logged on paper and graded as if staked. A prop type is staked again only after its paper picks beat their own book's closing price (CLV of 0 or better) over 30 graded picks.</li>
        <li>KO and submission props. Books mark them up 12% to 35% over fair, more than the model ever disagrees with the market. Over 10,000 angle and matchup combinations were checked; none beat FanDuel's vig.</li>
        <li>Unders and early-round totals. Every pocket tested lost or broke even.</li>
        <li>A third moneyline on one event: extra qualifiers are logged on paper.</li></ul></div>
      <div class="panel flat prose"><h3>How the backtest stayed honest</h3><ul>
        <li>Walk-forward: each year predicted by models trained only on earlier years.</li>
        <li>Graded at real prices with juice: FanDuel/BetMGM openers for moneylines, FanDuel/DraftKings/Caesars closing prices for props. Every blend and calibration is fit only on earlier years.</li>
        <li>Moneyline picks beat the closing line by about 2.5% on average, far less than the realised return: see "Backtest vs the close" on the backtest tab.</li>
        <li>Placebo checks: shuffled ratings and a shuffled prop model each lost their edge.</li>
        <li>Flat 1 unit on every bet. Live: moneylines 1 unit; props paper only since Nov 9.</li></ul></div>
    </div>
    <div class="panel flat prose"><h3>Paper tracked, not bet</h3><p>The prop rule's one pick per fight, moneylines blocked only by the 2-per-event cap, and two angles that looked good in the backtest: over 4.5 rounds in 5-round fights at FanDuel (113 bets, +18%) and submissions where the model beats FanDuel's price by 3+ points against an opponent who has been submitted before (151 bets, +40%, statistically thin). Live, their prices have so far been worse than the close. All are logged on the live tab and graded, never staked; the pre-registered checks there say what would change that.</p></div>
    <div class="panel flat prose"><h3>What to expect live</h3><p>Not the backtest. Its moneylines returned +21.8%, but against the closing line the same bets were worth about +2.5%, and the thresholds and caps were chosen on the seasons they were tested on. Honest expectation: <b>about +3% to +5% per moneyline bet</b>. At about 75 bets a year that is a few units with a swing of about 6 either way, so even a real edge loses money in roughly one season in three. Units can't settle it for decades; closing-line value can in a few dozen bets, so judge the record by whether posted prices beat the close. Opening lines move fast: if a pick's price is gone, the "take or better" number on each bet tells you where it stops being a bet.</p></div>`,
    hood: `<div><div class="kicker">Under the hood · model specification</div><h1>The <em>engine</em> room</h1>
      <p class="lede">Every equation behind the card. Everything is point-in-time: a fight's inputs use only fights completed before it, and each backtest year is scored by models that never saw it.</p></div>
    <div class="hood">
      <div class="panel eq"><h3>01 · Removing the vig</h3>
        <p>Two-way markets (moneyline, goes the distance, round totals) use power de-vigging: find the exponent <i>k</i> that makes the implied probabilities sum to one.</p>
        ${M(`<msubsup><mi>π</mi><mi>a</mi><mi>k</mi></msubsup><mo>+</mo><msubsup><mi>π</mi><mi>b</mi><mi>k</mi></msubsup><mo>=</mo><mn>1</mn><mo>,</mo><mspace width=".6em"/><msub><mi>m</mi><mi>a</mi></msub><mo>=</mo><msubsup><mi>π</mi><mi>a</mi><mi>k</mi></msubsup><mo>,</mo><mspace width=".6em"/><mi>π</mi><mo>=</mo><mn>1</mn><mo>/</mo><mi>d</mi>`)}
        <p class="note">The six method props (each fighter by KO, submission, decision) use Shin's method, then each fighter's three outcomes are rescaled to sum to his moneyline win probability. That beat proportional and power de-vigging on 2021-26 log-loss.</p></div>

      <div class="panel eq"><h3>02 · Graph ratings</h3>
        <p>A ridge-penalized Bradley-Terry fit over every pro bout, weighted by recency (3-year half-life) and result type:</p>
        ${M(`<munder><mo>min</mo><mi>θ</mi></munder><mo>−</mo><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>w</mi><mi>j</mi></msub><mi>log</mi><mi>σ</mi><mo>(</mo><msub><mi>θ</mi><mrow><mi>w</mi><mo>(</mo><mi>j</mi><mo>)</mo></mrow></msub><mo>−</mo><msub><mi>θ</mi><mrow><mi>l</mi><mo>(</mo><mi>j</mi><mo>)</mo></mrow></msub><mo>)</mo><mo>+</mo><mi>λ</mi><msup><mrow><mo>‖</mo><mi>θ</mi><mo>‖</mo></mrow><mn>2</mn></msup><mo>,</mo><mspace width=".6em"/><msub><mi>w</mi><mi>j</mi></msub><mo>=</mo><msup><mn>2</mn><mrow><mo>−</mo><msub><mi>age</mi><mi>j</mi></msub><mo>/</mo><mn>3</mn></mrow></msup><mo>·</mo><msub><mi>c</mi><mi>j</mi></msub>`)}
        <p class="note">λ = 0.3; c = 1 for finishes, 0.7 for decisions, 0.42 for split and majority decisions. Refit at the start of each month. FightMatrix's pre-fight Elo, modified Elo and Glicko ratings and log division rank enter alongside it as differences between the fighters.</p></div>

      <div class="panel eq"><h3>03 · Win model</h3>
        <p>Each fight is fed both ways. With <i>P</i> swapping the corners and negating every difference feature, training uses {(x, y), (Px, 1 − y)}:</p>
        ${M(`<mi>q</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><mn>0.6</mn><mspace width=".2em"/><msub><mi>q</mi><mtext>LGB</mtext></msub><mo>(</mo><mi>x</mi><mo>)</mo><mo>+</mo><mn>0.4</mn><mspace width=".2em"/><msub><mi>q</mi><mtext>LR</mtext></msub><mo>(</mo><mi>x</mi><mo>)</mo>`)}
        <div class="tbl"><table><thead><tr><th>Hyperparameter (LightGBM)</th><th>Value</th></tr></thead><tbody>
          <tr><td>Trees · learning rate</td><td class="mono">600 · 0.015</td></tr>
          <tr><td>Leaves · min samples per leaf</td><td class="mono">12 · 60</td></tr>
          <tr><td>Row · column subsample</td><td class="mono">0.8 · 0.5</td></tr>
          <tr><td>L2 · L1 penalty</td><td class="mono">5 · 0.5</td></tr></tbody></table></div>
        <p class="note">The logistic half is L2-penalized (C = 0.05) with no intercept, which on mirrored data makes it exactly corner-symmetric.</p></div>

      <div class="panel eq"><h3>04 · Prop model</h3>
        <p>Separate LightGBM and logistic models for each target: each fighter wins by KO, submission or decision, the fight is finished, ends before 7:30, ends before 12:30. Their logits are averaged:</p>
        ${M(`<msub><mi>q</mi><mi>t</mi></msub><mo>=</mo><mi>σ</mi><mrow><mo>(</mo><mfrac><mrow><mtext>logit</mtext><msubsup><mi>q</mi><mi>t</mi><mtext>LGB</mtext></msubsup><mo>+</mo><mtext>logit</mtext><msubsup><mi>q</mi><mi>t</mi><mtext>LR</mtext></msubsup></mrow><mn>2</mn></mfrac><mo>)</mo></mrow>`)}
        <p class="note">Key inputs: each fighter's career KO / submission / decision rates for wins and losses (shrunk to league means, plain and time-decayed), early-finish and round-1 rates, KO losses in the last 3 years, last-two-fight results, knockdown and striking rates, age, reach and the moneyline.</p></div>

      <div class="panel eq"><h3>05 · Market blend</h3>
        <p>Every model probability <i>q</i> is blended with the market's fair probability <i>m</i>:</p>
        ${M(`<mtext>logit</mtext><mspace width=".2em"/><mi>p</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub><mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><mspace width=".2em"/><mtext>logit</mtext><mspace width=".2em"/><mi>m</mi><mo>+</mo><msub><mi>b</mi><mn>2</mn></msub><mspace width=".2em"/><mtext>logit</mtext><mspace width=".2em"/><mi>q</mi><mo>,</mo><mspace width=".8em"/><mi>b</mi><mo>∼</mo><mi>N</mi><mo>(</mo><mo>(</mo><mn>0</mn><mo>,</mo><mn>1</mn><mo>,</mo><mn>0</mn><mo>)</mo><mo>,</mo><mtext>diag</mtext><mo>(</mo><mn>.15</mn><mo>,</mo><mn>.25</mn><mo>,</mo><mn>.25</mn><msup><mo>)</mo><mn>2</mn></msup><mo>)</mo>`)}
        <p class="note">The prior centers on "trust the market," so the model only earns weight it shows out of sample. Moneyline blends are fit per book and per line age (open, 1-3 days, 3 days out, day before, close) with no intercept: an intercept there is a red-corner effect, unknown when lines first post. Prop blends are fit per market. In the backtest, each year's blend is fit only on earlier years.</p></div>

      <div class="panel eq"><h3>06 · The KO fade (a past finding)</h3>
        <p>For a decision pick on fighter <i>i</i>, compare the prop model's KO probability with the market's de-vigged KO price:</p>
        ${M(`<msub><mi>Δ</mi><mtext>KO</mtext></msub><mo>=</mo><msubsup><mi>q</mi><mi>i</mi><mtext>KO</mtext></msubsup><mo>−</mo><msubsup><mi>m</mi><mi>i</mi><mtext>KO</mtext></msubsup><mspace width="1.2em"/><mtext>KO fade</mtext><mo>⇔</mo><msub><mi>Δ</mi><mtext>KO</mtext></msub><mo>≤</mo><mo>−</mo><mn>0.05</mn>`)}
        <p class="note">In the 2021-26 backtest at closing prices, decision picks with a KO fade returned about +50 to +60% and those without +9 to +20%: the market seemed to hand too much of the win to the knockout. It did not hold up at prices that could actually be bet, so since Oct 19 every prop type needs the same 5-point edge, and since Nov 9 all props are paper only. The fade is still recorded on every paper decision pick (KO fade vs plain decision) so the paper record can test it again.</p></div>

      <div class="panel eq"><h3>07 · Decision rule and card</h3>
        ${M(`<msub><mtext>bet</mtext><mtext>ML</mtext></msub><mo>⇔</mo><mi>p</mi><mi>d</mi><mo>−</mo><mn>1</mn><mo>≥</mo><mn>.05</mn><mo>,</mo><mspace width=".4em"/><mi>d</mi><mo>≤</mo><mn>5</mn>`)}
        ${M(`<msub><mtext>paper</mtext><mtext>prop</mtext></msub><mo>⇔</mo><mi>p</mi><mo>−</mo><mfrac><mn>1</mn><mi>d</mi></mfrac><mo>≥</mo><mn>.05</mn><mo>,</mo><mspace width=".4em"/><mi>d</mi><mo>≤</mo><mn>11</mn>`)}
        <p class="note">Moneylines need expected value p·d − 1 of at least 5% (10% if a pick first qualifies inside 72 hours), d ≤ 5 (+400), at least two books pricing the fight, and no debutants; at most 2 moneylines per event, 1 unit each. Props need a 5-point edge over the price at d ≤ 11 (+1000), one per fight (goes the distance first, then the best EV), and are paper only since Nov 9: a prop type is staked again only after its paper picks show same-book CLV ≥ 0 over 30 graded picks. Picks lock the first time they qualify and stand; earlier locks count toward the caps.</p></div>

      <div class="panel eq"><h3>08 · Staking, grading and CLV</h3>
        <p>Profit per unit at decimal price <i>d</i>, and closing-line value with the de-vigged closing probability <i>c</i>:</p>
        ${M(`<mi>π</mi><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mi>s</mi><mo>(</mo><mi>d</mi><mo>−</mo><mn>1</mn><mo>)</mo></mtd><mtd><mtext>win</mtext></mtd></mtr><mtr><mtd><mo>−</mo><mi>s</mi></mtd><mtd><mtext>loss</mtext></mtd></mtr></mtable></mrow><mspace width="1.4em"/><mtext>CLV</mtext><mo>=</mo><mi>c</mi><mo>·</mo><mi>d</mi><mo>−</mo><mn>1</mn>`)}
        <p class="note">Draws, no contests and cancelled fights are void. Staking is flat: 1 unit a moneyline; props are paper only. Units are too noisy to judge a 3-5% edge for years, so the live tab leads with CLV. Bigger stakes on the strongest picks (1.5u) added about 3 points of ROI in the backtest but nearly doubled the worst drawdown; quarter Kelly made more units only by risking twice as much.</p></div>
    </div>`,
  });
})();
