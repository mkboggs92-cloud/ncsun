/* UFC tab for "Nothing Can Stop Us Now". Self-contained: mounts into #ufc, reuses the page's design tokens and
   classes, and reads ufc_today.json, ufc_live.json, ufc_backtest.json and ufc_status.json published beside the page.
   Those files are rewritten by the UFC model's daily run; this script never changes. */
(function () {
  const root = document.getElementById("ufc");
  if (!root) return;
  const css = `
#ufc .ufc-views{display:grid;gap:22px}
#ufc .fightcard{display:grid;gap:0}
#ufc .ev-head{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;margin-bottom:10px}
#ufc .fight{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
#ufc .fight:last-child{border-bottom:0}
#ufc .side{display:grid;gap:3px;min-width:0}
#ufc .side.b{text-align:right;justify-items:end}
#ufc .side .nm{font-weight:800;font-size:15px;overflow-wrap:anywhere}
#ufc .side .px{font-family:var(--mono);font-size:12px;color:var(--ink2)}
#ufc .side.pick .nm{color:var(--cobalt)}
#ufc .mid{display:grid;justify-items:center;gap:4px;min-width:118px}
#ufc .mid small{font:700 10.5px/1.2 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);text-align:center}
#ufc .pbar{display:flex;width:118px;height:10px;border-radius:5px;overflow:hidden;border:1.5px solid var(--ink)}
#ufc .pbar i{display:block;height:100%}
#ufc .pv{font:800 13px/1 var(--body);font-variant-numeric:tabular-nums}
#ufc .badge{display:inline-block;font:800 10px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;background:var(--sun);color:var(--sun-ink);padding:4px 6px;border-radius:999px;border:1.5px solid var(--ink)}
#ufc .meth{font-size:11.5px;color:var(--ink2)}
#ufc .status{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--ink2)}
#ufc .status b{color:var(--ink)}
#ufc .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}
@media (max-width:560px){#ufc .fight{grid-template-columns:1fr;gap:6px}#ufc .side.b{text-align:left;justify-items:start}#ufc .mid{justify-items:start}}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const $ = s => root.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtU = v => (v > 0 ? "+" : "") + v.toFixed(1) + "u";
  const pct = v => (v * 100).toFixed(1) + "%";
  const sgn = v => v > 0 ? "pos" : (v < 0 ? "neg" : "");
  const am = o => o == null ? "–" : (o > 0 ? "+" + o : String(o));
  const BOOK = { FD: "FanDuel", MGM: "BetMGM", DraftKings: "DraftKings", Caesars: "Caesars", BetRivers: "BetRivers", best: "Best book" };
  const MK = { ML: "Moneyline", GTD: "Goes the distance", A_DEC: "Wins by decision", B_DEC: "Wins by decision", "O2.5": "Over 2.5 rounds" };
  const isProp = r => (r.mk || "ML") !== "ML";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fair = p => { if (!p) return null; const d = 1 / p; return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)) };
  const minPrice = p => fair(p - 0.03);                     // worst price that still clears the 3-point edge
  const dateTxt = d => { const x = new Date(d + "T12:00:00"); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getDay()] + ", " + MON[x.getMonth()] + " " + x.getDate() };
  const cap = s => String(s || "").replace(/\b\w/g, c => c.toUpperCase());
  const LIGHT = ["flyweight", "bantamweight", "featherweight", "women's strawweight", "women's flyweight", "women's bantamweight", "women's featherweight"];

  const DIMS = {
    mk: { n: "Market", f: r => MK[r.mk || "ML"] || r.mk, order: ["Moneyline", "Wins by decision", "Goes the distance", "Over 2.5 rounds"] },
    season: { n: "Season", f: r => r.d.slice(0, 4) },
    side: { n: "Favorite / dog", f: r => r.dec < 2 ? "Favorite" : "Underdog", order: ["Favorite", "Underdog"] },
    price: { n: "Price", f: r => r.o <= -300 ? "-300 or shorter" : r.o <= -200 ? "-299 to -200" : r.o <= -140 ? "-199 to -140" : r.o < 100 ? "-139 to -101" : r.o <= 150 ? "+100 to +150" : "+151 to +400", order: ["-300 or shorter", "-299 to -200", "-199 to -140", "-139 to -101", "+100 to +150", "+151 to +400"] },
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
  };
  const FILTERS = ["mk", "season", "side", "price", "edge", "gender", "weight", "rounds", "exp", "ending", "book"];

  function stats(rows) {
    let w = 0, l = 0, v = 0, u = 0, c = 0, cn = 0, risk = 0;
    for (const r of rows) { if (r.r === "W") w++; else if (r.r === "L") l++; else v++; u += r.u || 0; if (r.r === "W" || r.r === "L") risk += r.su || 1; if (r.clv != null) { c += r.clv; cn++ } }
    const n = w + l; return { n, w, l, v, wp: n ? w / n : 0, u, roi: risk ? u / risk : 0, clv: cn ? c / cn : null };
  }
  const clvTxt = c => c == null ? "–" : (c > 0 ? "+" : "") + (c * 100).toFixed(1) + "%";
  function groupBy(rows, dim) {
    const m = new Map(); for (const r of rows) { const k = DIMS[dim].f(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
    const o = DIMS[dim].order; return [...m.entries()].sort((a, b) => { if (o) { const ia = o.indexOf(a[0]), ib = o.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) } return a[0] < b[0] ? -1 : 1 });
  }

  function coaster(el, rows) {
    if (rows.length < 2) { el.innerHTML = '<p class="note">Not enough graded picks to draw the ride yet.</p>'; return }
    const W = 760, H = 270, L = 50, R = 18, T = 40, B = 34, n = rows.length; let c = 0; const ys = rows.map(r => (c += r.u));
    const ymin = Math.min(0, ...ys), ymax = Math.max(1, ...ys), span = ymax - ymin || 1, step = span > 300 ? 100 : span > 120 ? 50 : span > 40 ? 20 : span > 15 ? 5 : 2;
    const x = i => L + i / (n - 1) * (W - L - R), y = v => T + (ymax - v) / span * (H - T - B);
    let g = ""; for (let v = Math.ceil(ymin / step) * step; v <= ymax; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === 0 ? 'stroke-width="2"' : 'stroke-dasharray="2 5"'}/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink2)">${v > 0 ? "+" : ""}${v}u</text>`;
    let s = "", prev = null; rows.forEach((r, i) => { const yr = r.d.slice(0, 4); if (yr !== prev) { s += `<line x1="${x(i)}" x2="${x(i)}" y1="${T - 10}" y2="${H - B}" stroke="var(--line)"/><text x="${x(i) + 5}" y="${H - B + 20}" font-size="11.5" font-weight="700" fill="var(--ink2)">${yr}</text>`; prev = yr } });
    const k = Math.max(1, Math.floor(n / 140)), pts = []; for (let i = 0; i < n; i += k) pts.push([x(i), y(ys[i])]); if (pts[pts.length - 1][0] !== x(n - 1)) pts.push([x(n - 1), y(ys[n - 1])]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
    let ties = ""; for (let i = 1; i < pts.length; i += 2) { const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len * 6, ny = dx / len * 6; ties += `<line x1="${(b[0] + nx).toFixed(1)}" y1="${(b[1] + ny).toFixed(1)}" x2="${(b[0] - nx).toFixed(1)}" y2="${(b[1] - ny).toFixed(1)}" stroke="var(--track)" stroke-width="1.6" opacity=".5"/>` }
    const end = pts[pts.length - 1], pre = pts[Math.max(0, pts.length - 3)], ang = Math.atan2(end[1] - pre[1], end[0] - pre[0]) * 180 / Math.PI, last = ys[n - 1], base = y(Math.max(ymin, 0));
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative units, ${fmtU(last)}">${g}${s}
     <path d="${path} L${end[0]} ${base} L${pts[0][0]} ${base} Z" fill="var(--cobalt)" opacity=".10"/>
     ${ties}<path d="${path}" fill="none" stroke="var(--track)" stroke-width="3.2" stroke-linejoin="round"/>
     <g transform="translate(${end[0].toFixed(1)} ${end[1].toFixed(1)}) rotate(${ang.toFixed(1)})"><rect x="-24" y="-14" width="24" height="10" rx="3" fill="var(--coral)" stroke="var(--ink)" stroke-width="2"/><circle cx="-19" cy="-2" r="2.6" fill="var(--ink)"/><circle cx="-5" cy="-2" r="2.6" fill="var(--ink)"/><circle cx="-12" cy="-19" r="5.5" fill="var(--ball)" stroke="var(--ink)" stroke-width="1.6"/></g>
     <text x="${(end[0] - 8).toFixed(1)}" y="${Math.max(16, end[1] - 30).toFixed(1)}" text-anchor="end" font-size="15" font-weight="800" fill="var(--ink)">${fmtU(last)}</text></svg>`;
  }

  function kpis(el, s, label) {
    el.innerHTML = `<div><small>Bets</small><b>${s.n.toLocaleString()}</b><span>${label}</span></div><div><small>Record</small><b>${s.w}-${s.l}</b><span>${pct(s.wp)} win rate${s.v ? ` · ${s.v} void` : ""}</span></div>
     <div><small>Units</small><b class="${s.u >= 0 ? "pos" : "neg"}">${fmtU(s.u)}</b><span>${s.u >= 0 ? "+" : "−"}$${Math.abs(Math.round(s.u * 100)).toLocaleString()} at $100/bet</span></div>
     <div><small>ROI</small><b>${(s.roi * 100).toFixed(1)}%</b><span>flat 1 unit a bet</span></div><div><small>Vs close</small><b>${clvTxt(s.clv)}</b><span>avg price edge</span></div>`;
  }

  function lab(el, all, idp, label) {
    const F = {}; FILTERS.forEach(d => F[d] = new Set());
    const opts = Object.entries(DIMS).map(([k, d]) => `<option value="${k}">${d.n}</option>`).join("");
    el.innerHTML = `<div class="kpis" id="${idp}-k"></div>
    <div class="panel"><div class="lab-head"><h2>The ride</h2><span class="note" id="${idp}-sub"></span></div><div id="${idp}-chart"></div></div>
    <div class="panel lab"><div class="lab-head"><h2>Slice lab</h2><div class="active" id="${idp}-active"></div></div>
     <details class="filters" open><summary><h3>Filters</h3><span class="note">Tap chips to narrow every number on this page. Chips in the same group add together.</span></summary>
      <div class="fgrid">${FILTERS.map(d => `<div class="fgroup"><h4>${DIMS[d].n}</h4><div class="chips">${groupBy(all, d).map(([k, v]) => `<button class="chip" data-d="${d}" data-v="${esc(k)}" aria-pressed="false">${esc(k)}<small>${v.length}</small></button>`).join("")}</div></div>`).join("")}</div></details>
     <div class="lab-controls">
       <label class="f" for="${idp}-a">Break down by<select id="${idp}-a">${opts}</select></label>
       <label class="f" for="${idp}-b">Then by<select id="${idp}-b"><option value="">Nothing</option>${opts}</select></label>
       <div class="viewtog" role="group" aria-label="View"><button id="${idp}-vt" aria-pressed="true">Table</button><button id="${idp}-vh" aria-pressed="false">Heatmap</button></div>
       <button class="ghost" id="${idp}-clear">Clear filters</button>
     </div>
     <div class="tbl" id="${idp}-out"></div><p class="note">Rows under 50 bets are marked small. Treat them as noise until they grow.</p></div>
    <div class="panel"><div class="lab-head"><h2>Bet log</h2><label class="f" for="${idp}-q">Fighter<input id="${idp}-q" type="search" placeholder="Search a fighter"></label></div><div class="tbl" id="${idp}-log"></div></div>`;
    const a = $(`#${idp}-a`), b = $(`#${idp}-b`), vt = $(`#${idp}-vt`), vh = $(`#${idp}-vh`), q = $(`#${idp}-q`); a.value = "mk"; let heat = false, page = 0;
    const filtered = () => all.filter(r => FILTERS.every(d => !F[d].size || F[d].has(DIMS[d].f(r))));
    function row(lbl, s, max, cls) {
      const w = Math.min(50, Math.abs(s.u) / max * 50);
      return `<tr class="${cls || ""}"><td>${esc(lbl)}${s.n < 50 && cls !== "tot" ? ' <span class="tag small">small</span>' : ""}</td><td>${s.n}</td><td class="mono">${s.w}-${s.l}</td><td>${pct(s.wp)}</td><td class="${sgn(s.u)}">${fmtU(s.u)}</td><td class="${sgn(s.roi)}">${(s.roi * 100).toFixed(1)}%</td><td>${clvTxt(s.clv)}</td><td><span class="ubar" aria-hidden="true"><i style="left:${s.u >= 0 ? 50 : 50 - w}%;width:${w}%;background:var(${s.u >= 0 ? "--win" : "--loss"})"></i></span></td></tr>`;
    }
    function breakdown(rows) {
      const A = a.value, Bd = b.value && b.value !== a.value ? b.value : "";
      if (!rows.length) return '<p class="note">No bets match these filters.</p>';
      if (heat && Bd) {
        const ra = groupBy(rows, A), cb = groupBy(rows, Bd).map(x => x[0]);
        const cell = rs => { if (!rs.length) return '<td class="c"><span>–</span></td>'; const s = stats(rs); const o = Math.min(70, Math.round(Math.abs(s.roi) * 260 + 8)); return `<td class="c" style="background:color-mix(in srgb,var(${s.roi >= 0 ? "--win" : "--loss"}) ${o}%,var(--panel))" title="${s.w}-${s.l}, ${fmtU(s.u)}"><b>${(s.roi * 100).toFixed(0)}%</b><span>${s.n} bets · ${pct(s.wp)}</span></td>` };
        return `<table class="heat"><thead><tr><th class="l">${esc(DIMS[A].n)} ↓ · ${esc(DIMS[Bd].n)} →</th>${cb.map(c => `<th style="text-align:center">${esc(c)}</th>`).join("")}</tr></thead><tbody>${ra.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td>${cb.map(c => cell(v.filter(r => DIMS[Bd].f(r) === c))).join("")}</tr>`).join("")}</tbody></table><p class="note">Each cell: ROI, then bets and win rate. Green is profitable, red is losing; deeper color means bigger ROI. Moneyline win rates depend on price, so read ROI first.</p>`;
      }
      if (heat && !Bd) return '<p class="note">Pick a second slice under "Then by" to see the heatmap.</p>';
      const g = groupBy(rows, A); let max = 1;
      const blocks = g.map(([k, v]) => { const s = stats(v); max = Math.max(max, Math.abs(s.u)); const subs = Bd ? groupBy(v, Bd).map(([k2, v2]) => { const s2 = stats(v2); max = Math.max(max, Math.abs(s2.u)); return [k2, s2] }) : []; return [k, s, subs] });
      return `<table><thead><tr><th>${esc(DIMS[A].n)}</th><th>Bets</th><th>W-L</th><th>Win%</th><th>Units</th><th>ROI</th><th title="Average fair closing probability times price taken, minus 1">CLV</th><th></th></tr></thead><tbody>${blocks.map(([k, s, subs]) => row(k, s, max) + subs.map(([k2, s2]) => row(k2, s2, max, "sub")).join("")).join("")}${row("All filtered bets", stats(rows), max, "tot")}</tbody></table>`;
    }
    function log(rows) {
      const qq = q.value.trim().toLowerCase(); const f = rows.filter(r => !qq || r.pk.toLowerCase().includes(qq) || r.op.toLowerCase().includes(qq)).slice().reverse();
      const PER = 30, pages = Math.max(1, Math.ceil(f.length / PER)); page = Math.min(page, pages - 1); const v = f.slice(page * PER, page * PER + PER);
      $(`#${idp}-log`).innerHTML = `<table><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Opponent</th><th>Price</th><th class="l">Book</th><th>Model</th><th>Edge</th><th class="l">Ended</th><th>Result</th><th>Units</th></tr></thead><tbody>${v.map(r => `<tr><td class="mono">${r.d}</td><td class="l"><b>${esc(r.lab || r.pk)}</b></td><td class="l">${esc(r.op)}</td><td class="mono">${am(r.o)}</td><td class="l">${esc(r.bk)}</td><td>${pct(r.p)}</td><td>${r.e.toFixed(1)}</td><td class="l">${esc(DIMS.ending.f(r))}${r.rnd ? " R" + r.rnd : ""}</td><td><span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span></td><td class="${sgn(r.u)}">${fmtU(r.u)}</td></tr>`).join("")}</tbody></table>
      <div class="pager"><button class="ghost" id="${idp}-pp" ${page <= 0 ? "disabled" : ""}>Newer</button><span class="note">Page ${page + 1} of ${pages} · ${f.length.toLocaleString()} bets</span><button class="ghost" id="${idp}-pn" ${page >= pages - 1 ? "disabled" : ""}>Older</button></div>`;
      $(`#${idp}-pp`).onclick = () => { page--; log(rows) }; $(`#${idp}-pn`).onclick = () => { page++; log(rows) };
    }
    function draw() {
      const rows = filtered(); kpis($(`#${idp}-k`), stats(rows), label); coaster($(`#${idp}-chart`), rows);
      $(`#${idp}-sub`).textContent = rows.length === all.length ? "Every bet, in date order" : `${rows.length.toLocaleString()} of ${all.length.toLocaleString()} bets match your filters`;
      $(`#${idp}-out`).innerHTML = breakdown(rows);
      const act = FILTERS.flatMap(d => [...F[d]].map(v => `<button class="pill" data-d="${d}" data-v="${esc(v)}" title="Remove this filter">${esc(DIMS[d].n)}: ${esc(v)}</button>`));
      $(`#${idp}-active`).innerHTML = act.length ? act.join("") : '<span class="note">No filters. Showing every bet.</span>';
      el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", F[c.dataset.d].has(c.dataset.v))); page = 0; log(rows);
    }
    el.addEventListener("click", e => { const c = e.target.closest(".chip,.pill"); if (!c) return; const d = c.dataset.d, v = c.dataset.v; F[d].has(v) ? F[d].delete(v) : F[d].add(v); draw() });
    $(`#${idp}-clear`).onclick = () => { FILTERS.forEach(d => F[d].clear()); draw() };
    [a, b].forEach(x => x.addEventListener("change", draw)); q.addEventListener("input", () => { page = 0; log(filtered()) });
    vt.onclick = () => { heat = false; vt.setAttribute("aria-pressed", "true"); vh.setAttribute("aria-pressed", "false"); draw() };
    vh.onclick = () => { heat = true; vh.setAttribute("aria-pressed", "true"); vt.setAttribute("aria-pressed", "false"); if (!b.value) b.value = a.value === "side" ? "season" : "side"; draw() };
    draw();
  }

  function ticket(r) {
    const su = r.su || 1, big = su > 1;
    return `<article class="ticket ${big ? "big" : ""}"><span class="notch t"></span><span class="notch b"></span><div class="main">
      <div class="tier">${esc(dateTxt(r.d))} · ${esc(r.ev || "UFC")}</div><div class="pick">${esc(r.lab || r.pk)}</div><div class="game">${isProp(r) ? esc(r.op) : "vs " + esc(r.op)}${r.div ? " · " + esc(cap(r.div)) : ""}</div>
      <div class="price"><span>${esc(BOOK[r.bk] || r.bk)} ${am(r.o)}</span><span>fair ${am(fair(r.p))}</span><span>take ${am(minPrice(r.p))} or better</span></div>
      <div class="note">${isProp(r) ? "Prop · " : ""}Model ${pct(r.p)}${r.m != null ? " · market " + pct(r.m) : ""} · posted ${esc(r.posted || "")}</div></div>
      <div class="stub"><div><b>${su}U</b><small>+${r.e.toFixed(1)} pts</small></div></div></article>`;
  }

  function fightRow(f) {
    const pa = f.a.p ?? 0.5, pb = 1 - pa;
    const side = (s, cls) => `<div class="side ${cls}${s.pick ? " pick" : ""}"><span class="nm">${esc(s.n)}${s.pick ? ' <span class="badge">Pick</span>' : ""}</span>
      <span class="px">FanDuel ${am(s.fd)}${s.mgm != null ? ` · BetMGM ${am(s.mgm)}` : ""}</span><span class="px">fair ${am(fair(s.p))}${s.ufc != null ? ` · ${s.ufc} UFC fight${s.ufc === 1 ? "" : "s"}` : ""}</span></div>`;
    const tags = [f.tf ? "Title fight" : f.rd >= 5 ? "5 rounds" : "", cap(f.div), f.debut ? "Debut, no bet" : ""].filter(Boolean).join(" · ");
    return `<div class="fight">${side(f.a, "a")}<div class="mid"><span class="pv">${pct(pa)} · ${pct(pb)}</span>
      <span class="pbar" aria-hidden="true"><i style="width:${pa * 100}%;background:var(--cobalt)"></i><i style="width:${pb * 100}%;background:var(--coral)"></i></span>
      <small>${esc(tags)}</small>${f.pgtd != null ? `<span class="meth">Goes the distance ${pct(f.pgtd)}${f.pdec_a != null ? ` · ${esc(f.a.n.split(" ").slice(-1)[0])} dec ${pct(f.pdec_a)}` : ""}${f.pdec_b != null ? ` · ${esc(f.b.n.split(" ").slice(-1)[0])} dec ${pct(f.pdec_b)}` : ""}</span>` : f.ko != null ? `<span class="meth">KO ${pct(f.ko)} · Sub ${pct(f.sub)} · Dec ${pct(f.dec)}</span>` : ""}${f.watch ? `<span class="badge">Prop watch</span><span class="meth">${esc(f.watch)}</span>` : ""}</div>${side(f.b, "b")}</div>`;
  }

  root.innerHTML = `
  <nav class="stops" role="tablist" aria-label="UFC sections">
    <button role="tab" data-uv="cards" aria-selected="true"><i>1</i>Upcoming cards</button>
    <button role="tab" data-uv="live" aria-selected="false"><i>2</i>Live record</button>
    <button role="tab" data-uv="bt" aria-selected="false"><i>3</i>Backtest</button>
    <button role="tab" data-uv="how" aria-selected="false"><i>4</i>How it works</button>
  </nav>
  <section class="view" data-uview="cards">
    <div><div class="kicker">UFC · moneylines and props</div><h1>Fight <em>night</em></h1>
      <p class="lede" id="ufc-lede">Every announced fight with a line, priced by the model. Picks lock the first time they clear the rule and are graded at that price. Books post props about 3 days before an event, so that's when prop picks appear.</p>
      <div class="status" id="ufc-status"></div></div>
    <div id="ufc-picks"></div>
    <div id="ufc-cards" class="ufc-views"></div>
  </section>
  <section class="view" data-uview="live" hidden>
    <div><div class="kicker">Since October 2026 · real picks only</div><h1>Live <em>record</em></h1>
      <p class="lede">Every pick posted here, graded at the book and price shown when it locked. Nothing from the backtest is mixed in.</p></div>
    <div id="ufc-live" class="ufc-views"></div>
  </section>
  <section class="view" data-uview="bt" hidden>
    <div><div class="kicker">Out-of-sample backtest · 2021 to 2026</div><h1>The <em>ride</em> so far</h1>
      <p class="lede">Each year was predicted by models trained only on earlier fights, and bet at the price FanDuel or BetMGM posted when it first opened the fight, whichever was better. Flat 1 unit a bet. Simulated results, not a live record.</p></div>
    <div id="ufc-bt" class="ufc-views"></div>
  </section>
  <section class="view" data-uview="how" hidden>
    <div><div class="kicker">The theory</div><h1>Beat the <em>opener</em>.</h1>
      <p class="lede">UFC lines are softest when a book first hangs them, days or weeks out, and get sharper as money comes in. The model's job is to price a fight better than an opening line, not a closing one. In the fitted blend the model carries about half the weight against an opening line and a fifth against the close.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Every fight, every fighter</h3><p>Round-by-round UFCStats box scores since 1994, plus each fighter's full pro record from Sherdog, regional shows included: 57,000 bouts across 24,000 fighters. Everything is built point-in-time, from fights before the one being priced.</p></div>
      <div class="panel stop"><h3>Graph ratings</h3><p>One Bradley-Terry rating solved over the whole web of who beat whom, refit monthly. Recent fights count more (3-year half-life) and finishes count more than decisions. A win over someone who later proves good gets the credit Elo would miss.</p></div>
      <div class="panel stop"><h3>Win model</h3><p>LightGBM plus a logistic model on 80 inputs: the rating gap, striking and grappling rates, age, layoffs, reach, experience, opponent quality. Each fight is fed both ways, so the corner never matters.</p></div>
      <div class="panel stop"><h3>Market blend</h3><p>The model is never bet raw. It's blended with each book's own line, with weights fit for that book and for how long the line has been up. Fresh lines get more model; fight-week lines get almost none.</p></div>
      <div class="panel stop"><h3>The bet</h3><p>Bet when the blended chance beats the price by 3 points or more, at +400 or shorter, at FanDuel (or BetMGM when BestFightOdds lists it, taking the better price). 1 unit, 1.5 at 8+ points of edge, sharing the 5-bet card cap with props. About 115 qualify a year, roughly 9 in 10 on favorites.</p></div>
    </div>
    <div class="grid2">
      <div class="panel flat prose"><h3>What it doesn't bet</h3><ul>
        <li>Fights with a UFC debutant. With no UFC fights on record the model has too little to go on.</li>
        <li>Longshots past +400.</li>
        <li>KO, submission and round props. They are priced for reference, but no rule has beaten their vig yet.</li></ul></div>
      <div class="panel flat prose"><h3>How the backtest stayed honest</h3><ul>
        <li>Walk-forward: each year predicted by models trained only on earlier years.</li>
        <li>Graded at real FanDuel and BetMGM opening prices from BestFightOdds line histories, with juice.</li>
        <li>Every season from 2021 to 2026 was profitable; ROI ran 4% to 21% a year.</li>
        <li>Picks beat the closing line by 3.5% on average, so the edge is real price value, not luck on results.</li>
        <li>Placebo test: shuffling the graph ratings within each year erased their gain, so the improvement isn't noise.</li></ul></div>
    </div>
    <div class="panel flat prose"><h3>Props: where the edge is</h3><ul>
        <li>The prop market underprices fights that go long, above all the favorite (especially from the red corner) winning a decision. That pattern alone was worth about +18% at FanDuel closing prices from 2021 to 2026.</li>
        <li>A separate prop model reads each fighter's full pro record (how they win and lose, how fast, how recently), striking and durability, age and reach, ratings and the moneyline. In a blend with the closing price it carries 20 to 40% of the weight; the old method model carried almost none.</li>
        <li>Bets: "fighter wins by decision" and "fight goes the distance". A decision bet needs 3+ points of edge when the model also rates that fighter’s KO chance at least 5 points below the market (these returned about +60%), otherwise 5+ points, the same bar as goes-the-distance. Prices up to +1000, locked as soon as the props are posted.</li><li>The card: at most 5 bets per event and 3 of any one type, best first. 1.5 units on KO-fade decisions and on any pick with 8+ points of edge, 1 unit otherwise. Backtest 2021–26: 905 bets, about 3.8 a card, +35% ROI. KO, submission and under props are priced but never bet: no rule beat their vig.</li><li>Timing matters here too: at FanDuel's opening prop prices the red-corner decision bets returned about +41% on 400 bets (every year positive) versus +25% at the close. FanDuel's first prop price lasts a median 26 hours, so the twice-daily run usually catches it.</li>
        <li>Backtest (2021-26, closing prices, best of FanDuel, DraftKings, BetMGM, Caesars and BetRivers): about 170 bets a year, +18% ROI, positive all 6 years; FanDuel alone did about as well. Much of it is the market's decision bias rather than the model, so it can fade if books adjust.</li></ul></div>
    <div class="panel flat prose"><h3>What to expect live</h3><p>The edge threshold, price cap and timing rule were chosen on these same seasons, so expect live results below the backtest. A 12% ROI at about 100 bets a year still produces losing months, and the occasional losing season. Opening lines also move fast: if a pick's price is gone, the "take or better" number tells you where it stops being a bet.</p></div>
  </section>`;

  const views = ["cards", "live", "bt", "how"];
  function show(v) {
    root.querySelectorAll("nav.stops button").forEach(b => b.setAttribute("aria-selected", b.dataset.uv === v));
    root.querySelectorAll("[data-uview]").forEach(s => s.hidden = s.dataset.uview !== v);
    try { localStorage.setItem("ncsun-ufc-view", v) } catch (e) { }
  }
  root.querySelectorAll("nav.stops button").forEach(b => b.addEventListener("click", () => show(b.dataset.uv)));
  try { const v = localStorage.getItem("ncsun-ufc-view"); if (views.includes(v)) show(v) } catch (e) { }

  const getJSON = u => fetch(u, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const bydate = (a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0;
  Promise.all([getJSON("ufc_today.json"), getJSON("ufc_live.json"), getJSON("ufc_backtest.json"), getJSON("ufc_status.json")]).then(([today, live, bt, status]) => {
    today = today || { events: [], picks: [] };
    // status line
    const upd = today.updated ? new Date(today.updated.replace(" ", "T")) : null;
    const hrs = upd ? (Date.now() - upd.getTime()) / 3.6e6 : null;
    const fails = status ? Object.entries(status).filter(([k, v]) => v && v.ok === false).map(([k]) => k) : [];
    const color = hrs == null || hrs > 36 || fails.length ? "var(--loss)" : "var(--win)";
    $("#ufc-status").innerHTML = `<span><span class="dot" style="background:${color}"></span>Prices updated <b>${upd ? upd.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "not yet"}</b></span>
      ${hrs != null && hrs > 36 ? `<span><b>Stale:</b> the laptop run hasn't reported in ${Math.round(hrs)} hours</span>` : ""}${fails.length ? `<span><b>Last run had a problem:</b> ${esc(fails.join(", "))}</span>` : ""}<span>Runs 9 AM and 5 PM ET</span>`;
    // open picks
    const picks = (today.picks || []).slice().sort(bydate);
    $("#ufc-picks").innerHTML = picks.length
      ? `<div class="bookhead"><span class="logo">${picks.length}</span><h2>Open pick${picks.length > 1 ? "s" : ""}</h2><span class="note">1 unit each · locked at the price shown</span></div><div class="tickets">${picks.map(ticket).join("")}</div>`
      : `<div class="banner"><b>No picks</b><span>Nothing on the upcoming cards clears the rule right now. New lines usually post 1 to 3 weeks before an event, and that's when picks show up.</span></div>`;
    // cards
    const evs = today.events || [];
    $("#ufc-cards").innerHTML = evs.length ? evs.map(e => `<div class="panel"><div class="ev-head"><h2>${esc(e.ev)}</h2><span class="note">${esc(dateTxt(e.d))} · ${e.fights.length} fight${e.fights.length === 1 ? "" : "s"} with a line</span></div>
      <div class="fightcard">${e.fights.map(fightRow).join("")}</div></div>`).join("") + `<p class="note">BestFightOdds stopped listing BetMGM in early 2026, so live picks are FanDuel prices. Percentages are the model blended with the market. "Fair" is the price where a bet breaks even at that chance. Method splits are model-only, for reference.</p>`
      : `<div class="banner"><b>Quiet</b><span>No UFC lines are posted for the next 45 days yet.</span></div>`;
    // live
    live = (live || []).filter(r => r.r === "W" || r.r === "L" || r.r === "D" || r.r === "NC").sort(bydate);
    if (live.length) lab($("#ufc-live"), live, "ulv", "since Oct 2026");
    else $("#ufc-live").innerHTML = '<div class="banner"><b>Boarding</b><span>No graded picks yet. The record starts with the first locked pick and grows after each event.</span></div>';
    // backtest
    bt = (bt || []).sort(bydate);
    if (bt.length) lab($("#ufc-bt"), bt, "ubt", "2021-2026");
    else $("#ufc-bt").innerHTML = '<div class="banner"><b>Loading</b><span>Backtest file not published yet.</span></div>';
  });
})();
