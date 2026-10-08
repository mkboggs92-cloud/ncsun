/* UFC — adapter for ufc_today.json, ufc_live.json, ufc_backtest.json, ufc_status.json, ufc_paper.json, ufc_dfs.json
   (written by the UFC model's 9 AM / 5 PM runs). Keeps the fight-by-fight card and the DraftKings DFS pool. */
(function () {
  const U = NCSUN.u, { $, esc, fmtU, pct, pct0, sgn, am, toDec, fair, dateTxt, daysTo, whenTxt, addDays, cap, load, copyText } = U;
  const BOOK = { FD: "FanDuel", DK: "DraftKings", CZR: "Caesars", MGM: "BetMGM", DraftKings: "DraftKings", Caesars: "Caesars", BetRivers: "BetRivers", best: "Best book" };
  const MK = { ML: "Moneyline", GTD: "Goes the distance", A_DEC: "Wins by decision", B_DEC: "Wins by decision", "O2.5": "Over 2.5 rounds", "O4.5": "Over 4.5 rounds", A_SUB: "Wins by submission", B_SUB: "Wins by submission" };
  const TIER = { ML: "Moneyline", DEC_A: "Decision · KO fade", DEC_B: "Decision", A_DEC: "Decision", B_DEC: "Decision", GTD: "Goes the distance", "O4.5": "Over 4.5 rounds", A_SUB: "Submission", B_SUB: "Submission" };
  const BADGE = { ML: "ml", DEC_A: "fade", DEC_B: "dec", A_DEC: "dec", B_DEC: "dec", GTD: "gtd" };
  const tierOf = r => r.tier || ((r.mk || "ML") === "ML" ? "ML" : r.mk);
  const barOf = r => ({ GTD: 0.05, DEC_B: 0.05 }[tierOf(r)] ?? 0.03);
  const isProp = r => (r.mk || "ML") !== "ML";
  const isWithdrawn = r => r.mth === "superseded";
  const minPrice = (p, bar = 0.03) => fair(p - bar);
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
    const worst = r.p ? minPrice(r.p, barOf(r)) : null, wd = toDec(worst);
    const cells = BK3.map(([k, f]) => { const o = side[f]; const ok = o != null && (wd == null || toDec(o) >= wd - 1e-9); return { k, o, ok } });
    const live = cells.filter(c => c.o != null), good = live.filter(c => c.ok).sort((a, b) => toDec(b.o) - toDec(a.o));
    return { cells, best: good[0] || null, gone: live.length > 0 && !good.length, worst };
  }
  function toRec(r, paper) {
    const t = tierOf(r), worst = r.p ? minPrice(r.p, barOf(r)) : null, bn = paper || r.r ? null : booksNow(r);
    const gone = !!(bn && bn.gone);
    let extra = ""; if (bn && bn.best && bn.best.k !== r.bk && toDec(bn.best.o) > toDec(r.o) + 1e-9) extra = `Best now <b>${esc(BOOK[bn.best.k])} ${am(bn.best.o)}</b>`;
    return { d: r.d, ev: r.ev || "UFC", pick: r.lab || r.pk, detail: `${isProp(r) ? esc(r.op) : "vs " + esc(r.op)}${r.div ? " · " + esc(cap(r.div)) : ""}`, mk: MK[r.mk || "ML"] || r.mk, tier: TIER[t] || t,
      o: r.o, bk: BOOK[r.bk] || r.bk, stake: r.su || 1, p: r.p, m: r.m, e: r.e, r: r.r || null, pl: r.r ? (r.u || 0) : null, act: r.mth ? `${r.mth}${r.rnd ? " R" + r.rnd : ""}` : null, clv: r.clv ?? null,
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

  const M = x => `<div class="mbox"><math display="block">${x}</math></div>`;
  NCSUN.register({
    id: "ufc", icon: '<svg viewBox="0 0 24 24"><path d="M8.5 3h7l5 5v8l-5 5h-7l-5-5V8z"/><path d="M9 14.5c0-2 1.3-3 3-3s3 1 3 3v2H9z"/><path d="M12 8.5v3"/></svg>', name: "UFC", short: "UFC", tag: "Fights",
    kicker: "UFC · moneylines and props", h1: "Fight <em>night</em>",
    lede: "Every bet is 1 unit. Take the listed price or better. Posted picks stand and are graded at the price they locked.",
    defaultTime: "18:00", durationH: 7, seasonLabel: "2026",
    groupings: ["event", "tier", "book"], defaultGroup: "event", groupName: "By card", tierOrder: ["Moneyline", "Decision · KO fade", "Decision", "Goes the distance"],
    minN: 50, defaultDim: "tier", searchHint: "Search a fighter",
    clv: { fmt: c => c == null ? "–" : (c > 0 ? "+" : "") + (c * 100).toFixed(1) + "%", label: "avg price edge", title: "Average fair closing probability times price taken, minus 1" },
    car: '<circle cx="-12" cy="-19" r="5.5" fill="#F4DDB8" stroke="var(--ink)" stroke-width="1.6"/><path d="M-17 -21 Q-12 -24 -7 -21" fill="none" stroke="var(--coral)" stroke-width="1.6"/>',
    labels: { card: "Fight card", live: "2026 live", record: "Backtest" }, stops: ["card", "dfs", "live", "record", "how", "hood"],
    liveKicker: "Since October 2026 · real picks only",
    liveGroup: { label: "Card by card", col: "Card", key: r => r.d + "|" + r.ev, name: r => `${r.ev} · ${dateTxt(r.d)}`, short: r => (r.raw.tier === "GTD" ? "Distance" : short(String(r.raw.pk).replace(/ by (decision|submission|ko\/tko)$/i, "")) + (isProp(r.raw) ? " dec" : " ML")) },
    liveEmpty: "The record starts with the first locked pick and grows after each event.",
    recordHead: { kicker: "Out-of-sample backtest · 2023 to 2026", label: "2023-2026",
      lede: "Each year was predicted by models trained only on earlier fights, and every blend is fit only on earlier years, so bets start in 2023. Moneylines are graded at FanDuel's (or BetMGM's, before it left BestFightOdds) opening price; props at the best closing price of FanDuel, DraftKings and Caesars. The card rule is applied in the order live picks lock: at most 5 a card, 2 moneylines, one prop per fight, 1 unit each. Simulated results, not a live record.",
      extra: `<div class="panel flat prose" style="margin-top:12px"><h3>Realistic live returns</h3><p>Backtest ROI runs ahead of what the edge supports: some of it is luck, and the rules were chosen on these same years. The model's own expected value points to roughly <b>+3% to +7% on moneylines</b> and <b>+5% to +20% on props</b>. At about 160 bets a season that is a typical year of +8u to +15u, with a real chance (20-33%) of a losing season. Closing-line value settles the question about 15 times faster than ROI: if live moneyline picks keep beating the close after ~100 bets, the edge is real.</p></div>` },
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
    groupHead: (r, rs) => { const d = r.d, nML = rs.filter(x => !isProp(x.raw)).length, nP = rs.length - nML, dt = daysTo(d); const bits = [dateTxt(d) + (whenTxt(d) ? " · " + whenTxt(d) : ""), `${rs.length} of 5 card slots`]; if (!nP && dt > 3 && dt <= 21) bits.push(`props usually post about ${dateTxt(addDays(d, -3))}`);
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
        emptyHead: "No picks", empty: `Nothing on the upcoming cards clears the rule right now.${nx ? ` Next card: ${esc(nx.ev)}, ${esc(dateTxt(nx.d))}.` : ""} Moneyline picks usually show up 1 to 3 weeks before an event, props about 3 days out.`,
        health: NCSUN.health(status, T.updated, 36, "Runs 9 AM and 5 PM ET"), next: nx ? `${nx.ev.replace(/^UFC /, "UFC ").split(":")[0]} ${whenTxt(nx.d)}` : "", cadence: "9 AM and 5 PM ET",
        events: evs, openPaper, paperAll: paper || [],
      };
      meta.health.what = "Prices updated";
      return { today: picks.concat(openPaper), live: lv, meta };
    },
    async loadRecord() { const bt = await load("ufc_backtest.json"); return (bt || []).filter(r => !isWithdrawn(r)).map(r => toRec(r, false)) },
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
      el.insertAdjacentHTML("beforeend", `<div class="panel flat" style="display:grid;gap:10px"><h3>Paper tracked, not bet</h3><p class="note" style="font-size:14px;max-width:72ch">Over 4.5 rounds in 5-round fights, and submissions against opponents who have been submitted before. Graded at 1 unit for the record only.${g.length ? ` So far <b>${s.w}-${s.l}, ${fmtU(s.u)}</b>.` : " Nothing graded yet."}${pw ? ` ${pw} withdrawn paper pick${pw > 1 ? "s" : ""} hidden.` : ""}</p>
        ${paper.length ? `<div class="tbl"><table class="log"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Fight</th><th>Price</th><th>Result</th><th>Units</th></tr></thead><tbody>${paper.slice(0, 40).map(r => `<tr><td class="mono">${r.d}</td><td class="l"><b>${esc(r.lab || r.pk)}</b></td><td class="l">${esc(r.op)}</td><td class="mono">${am(r.o)}</td><td>${r.r ? `<span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span>` : '<span class="tag small">Open</span>'}</td><td class="${sgn(r.u || 0)}">${r.r ? fmtU(r.u || 0) : "–"}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`);
    },
    extras: { dfs: { label: "DFS", kicker: "DraftKings · UFC classic", h1: "DFS <em>lineups</em>", lede: "The two best 6-fighter lineups under the salary cap, built from the same fight model as the bets. Below them, every fighter on the slate, sortable.", draw: el => { el.innerHTML = '<p class="note">Loading the slate…</p>'; load("ufc_dfs.json").then(dd => dfsView(el, dd)) } } },
    how: `<div><div class="kicker">The theory</div><h1>Beat the <em>opener</em>. Fade the <em>knockout</em>.</h1>
      <p class="lede">UFC moneylines are softest when a book first hangs them and get sharper as money comes in, so the model prices fights against opening lines. Prop markets have a different weakness: they overprice knockouts and underprice fights that go long, above all a favorite winning a decision.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Every fight, every fighter</h3><p>Round-by-round UFCStats box scores since 1994, each fighter's full pro record from Sherdog (regional shows included), and FightMatrix's pre-fight ratings and rankings: 57,000 bouts across 24,000 fighters. Everything is built from fights before the one being priced.</p></div>
      <div class="panel stop"><h3>Ratings</h3><p>Our own Bradley-Terry rating, solved over the whole web of who beat whom and refit monthly, plus FightMatrix's three rating systems and division rank going into each fight. Adding FightMatrix cut the win model's error noticeably and lifted the moneyline backtest from +12% to +13.5%.</p></div>
      <div class="panel stop"><h3>Two models</h3><p>A win model (LightGBM plus logistic regression on about 85 inputs, calibrated on earlier years) and a prop model that reads how each fighter wins and loses: KO, submission and decision rates over his whole career, how fast, how recently, durability, striking, age and reach. Every fight is fed both ways, so the corner never matters.</p></div>
      <div class="panel stop"><h3>Market blend</h3><p>Neither model is bet raw. Each is blended with the book's own price, with weights fit on earlier years for that book and how long the line has been up. The model earns weight only where it beats the market on its own.</p></div>
      <div class="panel stop"><h3>The card</h3><p>Moneylines need 3 points of edge at +400 or shorter. Decisions need 3 points with a "KO fade" (the model rates that fighter's KO chance 5+ points below the market), otherwise 5. Goes-the-distance needs 5. At most 5 bets a card, 2 moneylines, 3 of a prop type and one prop per fight (goes-the-distance first). Every bet is 1 unit.</p></div>
      <div class="panel stop"><h3>Posted picks stand</h3><p>Picks lock the first time they qualify, at FanDuel, DraftKings or Caesars, whichever pays best. Once posted they are graded at that price even if the line or the model moves. Only a cancelled fight or a replacement opponent withdraws one.</p></div>
    </div>
    <div class="grid2">
      <div class="panel flat prose"><h3>What it doesn't bet</h3><ul>
        <li>Fights with a UFC debutant: too little to go on.</li>
        <li>KO and submission props. Books mark them up 12% to 35% over fair, more than the model ever disagrees with the market. Over 10,000 angle and matchup combinations were checked; none beat FanDuel's vig.</li>
        <li>Unders and early-round totals. Every pocket tested lost or broke even.</li>
        <li>Two props on one fight, or more than 5 bets on one card, even when more qualify.</li></ul></div>
      <div class="panel flat prose"><h3>How the backtest stayed honest</h3><ul>
        <li>Walk-forward: each year predicted by models trained only on earlier years.</li>
        <li>Graded at real prices with juice: FanDuel/BetMGM openers for moneylines, FanDuel/DraftKings/Caesars closing prices for props. Every blend and calibration is fit only on earlier years.</li>
        <li>Moneyline picks beat the closing line by about 3.5% on average.</li>
        <li>Placebo checks: shuffled ratings and a shuffled prop model each lost their edge.</li>
        <li>Flat 1 unit on every bet, the same as live.</li></ul></div>
    </div>
    <div class="panel flat prose"><h3>Paper tracked, not bet</h3><p>Two angles that looked good but don't have enough history yet: over 4.5 rounds in 5-round fights at FanDuel (113 bets, +18%, every year positive), and submissions where the model beats FanDuel's price by 3+ points against an opponent who has been submitted before (151 bets, +40%, but statistically thin). They're logged on the live tab and graded, but never staked.</p></div>
    <div class="panel flat prose"><h3>What to expect live</h3><p>The thresholds, the KO-fade cutoff and the card caps were chosen on the same seasons they were tested on, so expect live results well below the backtest. Books can also close the decision bias at any time. Opening lines move fast: if a pick's price is gone, the "take or better" number on each bet tells you where it stops being a bet, and the details show where each of your three books stands.</p></div>`,
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

      <div class="panel eq"><h3>06 · The KO fade</h3>
        <p>For a decision pick on fighter <i>i</i>, compare the prop model's KO probability with the market's de-vigged KO price:</p>
        ${M(`<msub><mi>Δ</mi><mtext>KO</mtext></msub><mo>=</mo><msubsup><mi>q</mi><mi>i</mi><mtext>KO</mtext></msubsup><mo>−</mo><msubsup><mi>m</mi><mi>i</mi><mtext>KO</mtext></msubsup><mspace width="1.2em"/><mtext>KO fade</mtext><mo>⇔</mo><msub><mi>Δ</mi><mtext>KO</mtext></msub><mo>≤</mo><mo>−</mo><mn>0.05</mn>`)}
        <p class="note">The market gets the win probability right but splits it wrong: it hands too much to the KO and too little to the decision. Over 2021-26 decision picks with a KO fade returned about +50 to +60%; those without, +9 to +20%.</p></div>

      <div class="panel eq"><h3>07 · Decision rule and card</h3>
        ${M(`<mtext>bet</mtext><mo>⇔</mo><mi>p</mi><mo>−</mo><mfrac><mn>1</mn><mi>d</mi></mfrac><mo>≥</mo><msub><mi>τ</mi><mtext>type</mtext></msub><mo>,</mo><mspace width=".6em"/><msub><mi>τ</mi><mtext>ML</mtext></msub><mo>=</mo><msub><mi>τ</mi><mtext>KO fade</mtext></msub><mo>=</mo><mn>.03</mn><mo>,</mo><mspace width=".4em"/><msub><mi>τ</mi><mtext>DEC</mtext></msub><mo>=</mo><msub><mi>τ</mi><mtext>GTD</mtext></msub><mo>=</mo><mn>.05</mn>`)}
        <p class="note">Price caps: d ≤ 5 (+400) for moneylines, d ≤ 11 (+1000) for props. No debutants. Per card, rank KO fades first, then by expected value p·d − 1; keep at most 5, at most 2 moneylines, 3 of any other type and one prop per fight (goes-the-distance, then either fighter's decision). Every bet is 1 unit. Picks lock the first time they qualify and stand; earlier locks count toward the caps.</p></div>

      <div class="panel eq"><h3>08 · Staking, grading and CLV</h3>
        <p>Profit per unit at decimal price <i>d</i>, and closing-line value with the de-vigged closing probability <i>c</i>:</p>
        ${M(`<mi>π</mi><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mi>s</mi><mo>(</mo><mi>d</mi><mo>−</mo><mn>1</mn><mo>)</mo></mtd><mtd><mtext>win</mtext></mtd></mtr><mtr><mtd><mo>−</mo><mi>s</mi></mtd><mtd><mtext>loss</mtext></mtd></mtr></mtable></mrow><mspace width="1.4em"/><mtext>CLV</mtext><mo>=</mo><mi>c</mi><mo>·</mo><mi>d</mi><mo>−</mo><mn>1</mn>`)}
        <p class="note">Draws, no contests and cancelled fights are void. Staking is flat: 1 unit a bet. Bigger stakes on the strongest picks (1.5u) added about 3 points of ROI in the backtest but nearly doubled the worst drawdown; quarter Kelly made more units only by risking twice as much.</p></div>
    </div>`,
  });
})();
