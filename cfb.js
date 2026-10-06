/* College football tab for "Nothing Can Stop Us Now". Self-contained: mounts into #cfb, reuses the page's design tokens
   and classes, and reads cfb_picks.json and cfb_totals.json published beside the page. Those files are rewritten by
   cfb_sync.py from the Google Sheet; this script never changes week to week.
   These are hand picks made together, not model output. Every pick is 1 unit, graded at -110 unless a price is listed. */
(function () {
  const root = document.getElementById("cfb");
  if (!root) return;
  const css = `
#cfb .wkhead{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin-bottom:12px}
#cfb .wkhead .note{margin:0}
#cfb .ticket .stub b.res{font-size:17px}
#cfb .ticket.w .stub{background:color-mix(in srgb,var(--win) 16%,var(--panel2))}
#cfb .ticket.l .stub{background:color-mix(in srgb,var(--loss) 14%,var(--panel2))}
#cfb .ticket .cmt{font-size:12.5px;color:var(--ink2);border-top:1px dashed var(--line);padding-top:6px;overflow-wrap:anywhere}
#cfb .seasons{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr));gap:12px}
#cfb .season{background:var(--panel);border:2px solid var(--ink);border-radius:12px;padding:12px 14px;display:grid;gap:4px;box-shadow:3px 3px 0 var(--ink);cursor:pointer;text-align:left;color:var(--ink);font:inherit}
#cfb .season[aria-pressed="true"]{background:var(--cobalt);color:var(--cobalt-ink)}
#cfb .season[aria-pressed="true"] small,#cfb .season[aria-pressed="true"] span{color:var(--cobalt-ink)}
#cfb .season small{font:800 11px/1 var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--ink2)}
#cfb .season b{font:400 26px/1.05 var(--display)}
#cfb .season span{font-size:12.5px;color:var(--ink2)}
#cfb .dnb{display:flex;flex-wrap:wrap;gap:6px}
#cfb .dnb span{border:1.5px dashed var(--loss);color:var(--loss);border-radius:999px;padding:4px 10px;font:700 12.5px/1.2 var(--body)}
#cfb .wt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(380px,100%),1fr));gap:18px}
#cfb [data-fview]>div{min-width:0}
#cfb .wt-grid>.panel{min-width:0}
#cfb .wt-grid td{vertical-align:top}#cfb .wt-grid td .note{margin:2px 0 0;font-size:11.5px}
#cfb .st{display:inline-block;font:800 10.5px/1 var(--body);letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:999px;border:1.5px solid currentColor}
#cfb .st.cashed{color:var(--win)} #cfb .st.dead{color:var(--loss)} #cfb .st.low{color:var(--win);border-style:dashed} #cfb .st.high{color:var(--coral-ink);border-style:dashed} #cfb .st.push{color:var(--ink2)}
#cfb .wbarx{position:relative;display:inline-block;margin-top:5px;width:90px;height:8px;border-radius:4px;background:var(--panel2);vertical-align:middle}
#cfb .wbarx i{position:absolute;top:0;bottom:0;left:0;border-radius:4px;background:var(--cobalt)}
#cfb .wbarx em{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--coral)}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const $ = s => root.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtU = v => (v > 0 ? "+" : "") + v.toFixed(1) + "u";
  const pct = v => (v * 100).toFixed(1) + "%";
  const sgn = v => v > 0 ? "pos" : (v < 0 ? "neg" : "");
  const lnTxt = l => l == null ? "" : l === 0 ? "PK" : (l > 0 ? "+" + l : String(l));
  const isT = r => r.mk === "Total";
  const graded = r => r.r === "W" || r.r === "L" || r.r === "P";
  const pay = o => o == null ? 100 / 110 : o > 0 ? o / 100 : 100 / Math.abs(o);
  const units = r => r.r === "W" ? pay(r.o) : r.r === "L" ? -1 : 0;
  // Older seasons (2022-23) were logged as free text ("Penn State v. Ohio State -4.5"), so the text is shown as written.
  // From 2024 the sheet has Away / Home / Line / O/U columns and a green cell marks our side; the line is shown exactly as the sheet lists it.
  const pickTxt = r => r.lab ? r.lab : isT(r) ? `${r.ou || "Total"} ${r.tot ?? ""}`.trim() : r.pk || `${r.aw} / ${r.hm}`;
  const gameTxt = r => r.aw && r.hm ? (r.lab ? `${r.aw} vs ${r.hm}` : `${r.aw} at ${r.hm}`) : "";
  const extraTxt = r => r.lab ? "" : [r.ln != null ? `Line ${lnTxt(r.ln)}` : "", r.tot != null ? `O/U ${r.tot}` : ""].filter(Boolean).join(" · ");

  // ---------------------------------------------------------------- slicing
  const DIMS = {
    season: { n: "Season", f: r => String(r.s) },
    wk: { n: "Week", f: r => r.wk || "?", sort: r => r.wn },
    mkt: { n: "Bet type", f: r => isT(r) ? "Total" : "Side", order: ["Side", "Total"] },
    fav: { n: "Pick", f: r => isT(r) ? (r.ou || "Total") : r.ha === "H" ? "Home side" : r.ha === "A" ? "Road side" : "Side (text log)", order: ["Road side", "Home side", "Side (text log)", "Over", "Under", "Total"] },
    size: { n: "Spread size", f: r => { if (isT(r)) return "Total"; const l = r.ln != null ? Math.abs(r.ln) : r.pl != null ? Math.abs(r.pl) : null; if (l == null) return "Not logged"; return l <= 3 ? "3 or less" : l <= 7 ? "3.5-7" : l <= 14 ? "7.5-14" : "14.5+" },
      order: ["3 or less", "3.5-7", "7.5-14", "14.5+", "Total", "Not logged"] },
    phase: { n: "Part of season", f: r => r.wn == null ? "Unknown" : r.wn <= 4 ? "Weeks 0-4" : r.wn <= 9 ? "Weeks 5-9" : r.wn <= 15 ? "Week 10+" : "Bowls / playoff", order: ["Weeks 0-4", "Weeks 5-9", "Week 10+", "Bowls / playoff", "Unknown"] },
  };
  const FILTER_DIMS = ["season", "mkt", "fav", "size", "phase"];
  function stats(rows) { let w = 0, l = 0, p = 0, u = 0; for (const r of rows) { if (r.r === "W") w++; else if (r.r === "L") l++; else p++; u += units(r) } const n = w + l; return { n: w + l + p, w, l, p, wp: n ? w / n : 0, u, roi: (w + l) ? u / (w + l) : 0 } }
  function groupBy(rows, dim) { const D = DIMS[dim], m = new Map(); for (const r of rows) { const k = D.f(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
    const e = [...m.entries()];
    if (D.order) return e.sort((a, b) => { const ia = D.order.indexOf(a[0]), ib = D.order.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) });
    if (D.sort) return e.sort((a, b) => (D.sort(a[1][0]) ?? 99) - (D.sort(b[1][0]) ?? 99));
    return e.sort((a, b) => a[0] < b[0] ? 1 : -1) }
  const recTxt = s => `${s.w}-${s.l}${s.p ? "-" + s.p : ""}`;

  // ---------------------------------------------------------------- equity curve, drawn as the coaster track
  function coaster(el, rows) {
    if (rows.length < 2) { el.innerHTML = '<p class="note">Not enough graded picks to draw the ride yet.</p>'; return }
    const nar = innerWidth < 600, W = nar ? 360 : 760, H = nar ? 250 : 270, L = nar ? 40 : 50, R = nar ? 12 : 18, T = nar ? 44 : 40, B = nar ? 30 : 34, fs = nar ? 12 : 11, n = rows.length; let c = 0; const ys = rows.map(r => (c += units(r)));
    const ymin = Math.min(0, ...ys), ymax = Math.max(1, ...ys), span = ymax - ymin || 1, lines = nar ? 4 : 7, step = [1, 2, 5, 10, 20, 25, 50].find(x => span / x <= lines) || 100;
    const x = i => L + i / (n - 1) * (W - L - R), y = v => T + (ymax - v) / span * (H - T - B);
    let g = ""; for (let v = Math.ceil(ymin / step) * step; v <= ymax; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === 0 ? 'stroke-width="2"' : 'stroke-dasharray="2 5"'}/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="${fs}" fill="var(--ink2)">${v > 0 ? "+" : ""}${v}u</text>`;
    let s = "", prev = null; rows.forEach((r, i) => { if (r.s !== prev) { s += `<line x1="${x(i)}" x2="${x(i)}" y1="${T - 10}" y2="${H - B}" stroke="var(--line)"/><text x="${x(i) + 4}" y="${H - B + 19}" font-size="${fs}" font-weight="700" fill="var(--ink2)">${nar ? "'" + String(r.s).slice(2) : r.s}</text>`; prev = r.s } });
    let pk = 0, pi = 0, dd = 0, di0 = 0, di1 = 0; ys.forEach((v, i) => { if (v > pk) { pk = v; pi = i } if (pk - v > dd) { dd = pk - v; di0 = pi; di1 = i } });
    const pts = ys.map((v, i) => [x(i), y(v)]), path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
    let ddm = ""; if (dd >= 3) { const x0 = x(di0), x1 = x(di1), y0 = y(ys[di0]), y1 = y(ys[di1]), lx = Math.min(Math.max((x0 + x1) / 2, L + 60), W - R - 60);
      ddm = `<g aria-hidden="true"><line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="var(--loss)" stroke-dasharray="3 3"/><line x1="${x1}" x2="${x1}" y1="${y0}" y2="${y1}" stroke="var(--loss)" stroke-width="2"/><circle cx="${x1}" cy="${y1}" r="3.5" fill="var(--loss)"/><text x="${lx}" y="${Math.min(H - B - 6, y1 + 18)}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="var(--loss)">Worst drawdown −${dd.toFixed(1)}u</text></g>` }
    const end = pts[n - 1], pre = pts[Math.max(0, n - 3)], ang = Math.atan2(end[1] - pre[1], end[0] - pre[0]) * 180 / Math.PI, last = ys[n - 1], base = y(Math.max(ymin, 0));
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative units, ${fmtU(last)}; worst drawdown ${dd.toFixed(1)} units">${g}${s}
     <path d="${path} L${end[0]} ${base} L${pts[0][0]} ${base} Z" fill="var(--cobalt)" opacity=".10"/><path d="${path}" fill="none" stroke="var(--track)" stroke-width="${nar ? 2.6 : 3.2}" stroke-linejoin="round"/>${ddm}
     <g transform="translate(${end[0].toFixed(1)} ${end[1].toFixed(1)}) rotate(${ang.toFixed(1)})"><rect x="-24" y="-14" width="24" height="10" rx="3" fill="var(--coral)" stroke="var(--ink)" stroke-width="2"/><circle cx="-19" cy="-2" r="2.6" fill="var(--ink)"/><circle cx="-5" cy="-2" r="2.6" fill="var(--ink)"/><path d="M-17 -19 a5 3.6 0 1 0 10 0 a5 3.6 0 1 0 -10 0 Z" fill="var(--ball)" stroke="var(--ink)" stroke-width="1.6"/></g>
     <text x="${(end[0] - 8).toFixed(1)}" y="${Math.max(16, end[1] - 30).toFixed(1)}" text-anchor="end" font-size="${nar ? 14 : 15}" font-weight="800" fill="var(--ink)">${fmtU(last)}</text></svg>` }

  function kpis(el, s, label) { el.innerHTML = `<div><small>Picks</small><b>${s.n.toLocaleString()}</b><span>${esc(label)}</span></div><div><small>Record</small><b>${recTxt(s)}</b><span>${pct(s.wp)} win rate${s.p ? `, ${s.p} push${s.p > 1 ? "es" : ""}` : ""}</span></div>
   <div><small>Units</small><b class="${s.u >= 0 ? "pos" : "neg"}">${fmtU(s.u)}</b><span>${s.u >= 0 ? "+" : "−"}$${Math.abs(Math.round(s.u * 100)).toLocaleString()} at $100/unit</span></div>
   <div><small>ROI</small><b class="${s.roi >= 0 ? "pos" : "neg"}">${s.roi >= 0 ? "+" : ""}${(s.roi * 100).toFixed(1)}%</b><span>at -110</span></div><div><small>Break-even</small><b>52.4%</b><span>to beat -110</span></div>` }

  function ticket(r) {
    const res = graded(r) ? r.r : null, cls = res === "W" ? "w" : res === "L" ? "l" : "";
    return `<article class="ticket ${cls}"><span class="notch t"></span><span class="notch b"></span><div class="main"><div class="tier">${esc(isT(r) ? "Total" : "Side")} · ${r.s} ${esc(r.wk || "")}</div><div class="pick">${esc(pickTxt(r))}</div><div class="game">${esc(gameTxt(r))}</div>
     <div class="price">${extraTxt(r) ? `<span>${esc(extraTxt(r))}</span>` : ""}${r.o != null ? `<span>${r.o > 0 ? "+" : ""}${r.o}</span>` : ""}</div>${r.c ? `<div class="cmt">${esc(r.c)}</div>` : ""}</div>
     <div class="stub"><div>${res ? `<b class="res ${res === "W" ? "pos" : res === "L" ? "neg" : ""}">${res === "W" ? "WON" : res === "L" ? "LOST" : "PUSH"}</b><small>${fmtU(units(r))}</small>` : `<b class="lim">1u</b><small>Pending</small>`}</div></div></article>` }

  // ---------------------------------------------------------------- slice lab (same pattern as the hoops and UFC tabs)
  function lab(el, all, idp, label) {
    const F = {}; FILTER_DIMS.forEach(d => F[d] = new Set());
    const dims = FILTER_DIMS.filter(d => groupBy(all, d).length > 1), opts = Object.entries(DIMS).map(([k, d]) => `<option value="${k}">${d.n}</option>`).join("");
    el.innerHTML = `<div class="kpis" id="${idp}-k"></div>
    <div class="panel"><div class="lab-head"><h2>The ride</h2><span class="note" id="${idp}-sub"></span></div><div id="${idp}-chart"></div></div>
    <div class="panel lab"><div class="lab-head"><h2>Slice lab</h2><div class="active" id="${idp}-active"></div></div>
     ${dims.length ? `<details class="filters" ${matchMedia("(max-width:640px)").matches ? "" : "open"}><summary><h3>Filters</h3><span class="note">Tap chips to narrow every number on this page. Chips in the same group add together.</span></summary>
      <div class="fgrid">${dims.map(d => `<div class="fgroup"><h4>${DIMS[d].n}</h4><div class="chips">${groupBy(all, d).map(([k, v]) => `<button class="chip" data-d="${d}" data-v="${esc(k)}" aria-pressed="false">${esc(k)}<small>${v.length}</small></button>`).join("")}</div></div>`).join("")}</div></details>` : ""}
     <div class="lab-controls"><label class="f" for="${idp}-a">Break down by<select id="${idp}-a">${opts}</select></label><button class="ghost" id="${idp}-clear">Clear filters</button></div>
     <div class="tbl" id="${idp}-out"></div><p class="note">Rows under 30 picks are marked small. Treat them as noise until they grow.</p></div>
    <div class="panel"><div class="lab-head"><h2>Pick log</h2><label class="f" for="${idp}-q">Team<input id="${idp}-q" type="search" placeholder="Search a team"></label></div><div class="tbl" id="${idp}-log"></div></div>`;
    const q = el.querySelector(`#${idp}-q`), a = el.querySelector(`#${idp}-a`); a.value = all.some(r => r.s !== all[0].s) ? "season" : "wk"; let page = 0;
    const filtered = () => all.filter(r => FILTER_DIMS.every(d => !F[d].size || F[d].has(DIMS[d].f(r))));
    function row(lbl, s, max, cls) { const w = Math.min(50, Math.abs(s.u) / max * 50); return `<tr class="${cls || ""}"><td>${esc(lbl)}${s.n < 30 && cls !== "tot" ? ' <span class="tag small">small</span>' : ""}</td><td>${s.n}</td><td class="mono">${recTxt(s)}</td><td>${pct(s.wp)}</td><td class="${sgn(s.u)}">${fmtU(s.u)}</td><td class="${sgn(s.roi)}">${(s.roi * 100).toFixed(1)}%</td><td><span class="ubar" aria-hidden="true"><i style="left:${s.u >= 0 ? 50 : 50 - w}%;width:${w}%;background:var(${s.u >= 0 ? "--win" : "--loss"})"></i></span></td></tr>` }
    function breakdown(rows) { if (!rows.length) return '<p class="note">No picks match these filters.</p>'; const g = groupBy(rows, a.value); let max = 1; const b = g.map(([k, v]) => { const s = stats(v); max = Math.max(max, Math.abs(s.u)); return [k, s] });
      return `<table><thead><tr><th>${esc(DIMS[a.value].n)}</th><th>Picks</th><th>W-L</th><th>Win%</th><th>Units</th><th>ROI</th><th></th></tr></thead><tbody>${b.map(([k, s]) => row(k, s, max)).join("")}${row("All filtered picks", stats(rows), max, "tot")}</tbody></table>` }
    function log(rows) { const qq = q.value.trim().toLowerCase(); const f = rows.filter(r => !qq || [r.aw, r.hm, r.pk, r.lab].some(t => t && t.toLowerCase().includes(qq))).slice().reverse();
      const PER = 30, pages = Math.max(1, Math.ceil(f.length / PER)); page = Math.min(page, pages - 1); const v = f.slice(page * PER, page * PER + PER);
      el.querySelector(`#${idp}-log`).innerHTML = `<table class="log"><thead><tr><th class="l">Season</th><th class="l">Pick</th><th class="l">Game</th><th class="l">Week</th><th class="l">Type</th><th class="l">Line</th><th class="l">Note</th><th>Result</th><th>Units</th></tr></thead><tbody>${v.map(r => `<tr><td class="mono">${r.s}</td><td class="l"><b>${esc(pickTxt(r))}</b></td><td class="l">${esc(gameTxt(r))}</td><td class="l">${esc(r.wk || "")}</td><td class="l">${isT(r) ? "Total" : "Side"}</td><td class="l mono">${esc(extraTxt(r))}</td><td class="l">${esc(r.c || "")}</td><td><span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${r.r}</span></td><td class="${sgn(units(r))}">${fmtU(units(r))}</td></tr>`).join("")}</tbody></table>
      <div class="pager"><button class="ghost" id="${idp}-pp" ${page <= 0 ? "disabled" : ""}>Newer</button><span class="note">Page ${page + 1} of ${pages} · ${f.length.toLocaleString()} picks</span><button class="ghost" id="${idp}-pn" ${page >= pages - 1 ? "disabled" : ""}>Older</button></div>`;
      el.querySelector(`#${idp}-pp`).onclick = () => { page--; log(rows) }; el.querySelector(`#${idp}-pn`).onclick = () => { page++; log(rows) } }
    function draw() { const rows = filtered(); kpis(el.querySelector(`#${idp}-k`), stats(rows), label); coaster(el.querySelector(`#${idp}-chart`), rows);
      el.querySelector(`#${idp}-sub`).textContent = rows.length === all.length ? "Every graded pick, in order" : `${rows.length} of ${all.length} picks match your filters`;
      el.querySelector(`#${idp}-out`).innerHTML = breakdown(rows);
      const act = FILTER_DIMS.flatMap(d => [...F[d]].map(v => `<button class="pill" data-d="${d}" data-v="${esc(v)}" title="Remove this filter">${esc(DIMS[d].n)}: ${esc(v)}</button>`));
      el.querySelector(`#${idp}-active`).innerHTML = act.length ? act.join("") : '<span class="note">No filters. Showing every pick.</span>';
      el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", F[c.dataset.d].has(c.dataset.v))); page = 0; log(rows) }
    el.addEventListener("click", e => { const c = e.target.closest(".chip,.pill"); if (!c) return; const d = c.dataset.d, v = c.dataset.v; F[d].has(v) ? F[d].delete(v) : F[d].add(v); draw() });
    el.querySelector(`#${idp}-clear`).onclick = () => { FILTER_DIMS.forEach(d => F[d].clear()); draw() };
    a.addEventListener("change", draw); q.addEventListener("input", () => { page = 0; log(filtered()) });
    let nar = innerWidth < 600; addEventListener("resize", () => { const n2 = innerWidth < 600; if (n2 !== nar) { nar = n2; coaster(el.querySelector(`#${idp}-chart`), filtered()) } });
    draw() }

  // ---------------------------------------------------------------- page skeleton
  root.innerHTML = `
  <nav class="stops" role="tablist" aria-label="College football sections">
    <button role="tab" data-fv="week" aria-selected="true"><i>1</i>This week</button>
    <button role="tab" data-fv="live" aria-selected="false" tabindex="-1"><i>2</i><span id="cfb-live-lbl">Season live</span></button>
    <button role="tab" data-fv="history" aria-selected="false" tabindex="-1"><i>3</i>All seasons</button>
    <button role="tab" data-fv="totals" aria-selected="false" tabindex="-1"><i>4</i>Win totals</button>
    <button role="tab" data-fv="how" aria-selected="false" tabindex="-1"><i>5</i>How we pick</button>
  </nav>
  <section class="view" data-fview="week">
    <div><div class="kicker" id="cfb-kicker">College football · sides and totals</div><h1>This <em>week</em></h1>
      <p class="lede" id="cfb-lede">Hand picks, made together. No model, just film, numbers and arguments. 1 unit each.</p></div>
    <div id="cfb-week"></div>
  </section>
  <section class="view" data-fview="live" hidden>
    <div><div class="kicker">Season to date · every joint pick</div><h1 id="cfb-live-h"><em>Live</em></h1>
      <p class="lede">Every pick we logged this season, graded at -110 for 1 unit. Nothing removed after the fact.</p></div>
    <div id="cfb-live"></div>
  </section>
  <section class="view" data-fview="history" hidden>
    <div><div class="kicker" id="cfb-hist-k">Every season on record</div><h1>The <em>long</em> haul</h1>
      <p class="lede">All our joint picks back to the first season we tracked, graded the same way. Tap a season to focus on it.</p></div>
    <div class="seasons" id="cfb-seasons"></div>
    <div id="cfb-hist" style="display:grid;gap:22px"></div>
  </section>
  <section class="view" data-fview="totals" hidden>
    <div><div class="kicker">Season win totals · $10 a team</div><h1>Win <em>totals</em></h1>
      <p class="lede">Our preseason over/under bets on team win totals, tracked as the season goes.</p></div>
    <div id="cfb-totals"></div>
  </section>
  <section class="view" data-fview="how" hidden>
    <div><div class="kicker">The old-fashioned way</div><h1>No model. <em>Just us.</em></h1>
      <p class="lede">Unlike the hoops and UFC tabs, nothing here comes out of a model. These are picks we argue our way into each week, and log as one card.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Joint picks only</h3><p>This tab logs the card we make together. Our separate picks are tracked on their own and never counted here.</p></div>
      <div class="panel stop"><h3>What we look for</h3><p>Personnel news, line moves, how the game should actually play out, weather and price. Not trends that are already baked into the number.</p></div>
      <div class="panel stop"><h3>1 unit, every time</h3><p>Every pick is 1 unit, graded at -110. You need 52.4% to break even, so that is the bar.</p></div>
      <div class="panel stop"><h3>The do-not-bet list</h3><p>Teams that have burned us enough that we've sworn them off. Shown with each season.</p></div>
    </div>
    <div class="panel flat prose" id="cfb-dnb-all"></div>
  </section>`;

  // ---------------------------------------------------------------- routing (#cfb, #cfb-live, ...)
  const VIEWS = ["week", "live", "history", "totals", "how"], onShow = {};
  function show(v, push) {
    root.querySelectorAll("nav.stops button").forEach(b => { const on = b.dataset.fv === v; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && push) b.scrollIntoView({ block: "nearest", inline: "nearest" }) });
    root.querySelectorAll("[data-fview]").forEach(s => s.hidden = s.dataset.fview !== v);
    if (push) history.replaceState(null, "", v === "week" ? "#cfb" : "#cfb-" + v);
    if (onShow[v]) onShow[v]() }
  const tl = root.querySelector("nav.stops");
  tl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => show(b.dataset.fv, true)));
  tl.addEventListener("keydown", e => { const t = [...tl.querySelectorAll('[role="tab"]')], i = t.indexOf(document.activeElement); if (i < 0) return;
    const j = e.key === "ArrowRight" ? (i + 1) % t.length : e.key === "ArrowLeft" ? (i - 1 + t.length) % t.length : e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : -1; if (j < 0) return; e.preventDefault(); t[j].focus(); t[j].click() });
  function route() { const h = (location.hash || "").slice(1);
    if (h === "cfb" || h.startsWith("cfb-")) {
      document.querySelectorAll(".seg button").forEach(b => { const on = b.dataset.model === "cfb"; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1 });
      ["ncaab", "ufc"].forEach(id => { const x = document.getElementById(id); if (x) x.hidden = true }); root.hidden = false;
      const v = h.slice(4); show(VIEWS.includes(v) ? v : "week") } }
  addEventListener("hashchange", route);

  // ---------------------------------------------------------------- data
  const getJSON = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  Promise.all([getJSON("cfb_picks.json"), getJSON("cfb_totals.json")]).then(([P, WT]) => {
    P = P || { picks: [], seasons: {} }; WT = WT || { seasons: {} };
    const picks = (P.picks || []).map((r, i) => ({ ...r, i })).sort((a, b) => a.s - b.s || (a.wn ?? 99) - (b.wn ?? 99) || a.i - b.i);
    const all = picks.filter(graded), seasons = [...new Set(picks.map(r => r.s))].sort((a, b) => b - a), cur = seasons[0];
    const SI = P.seasons || {};
    if (cur) { $("#cfb-live-lbl").textContent = `${cur} live`; $("#cfb-live-h").innerHTML = `${cur} <em>live</em>` }

    // this week: ungraded picks in the latest week, plus the most recent graded week
    const curP = picks.filter(r => r.s === cur), open = curP.filter(r => !graded(r));
    const lastWn = Math.max(-1, ...curP.filter(graded).map(r => r.wn ?? -1)), lastWk = curP.filter(r => graded(r) && r.wn === lastWn);
    const seasonS = stats(curP.filter(graded));
    $("#cfb-kicker").textContent = `${cur || ""} college football · ${seasonS.n ? `season ${recTxt(seasonS)}, ${fmtU(seasonS.u)}` : "sides and totals"}`;
    let wh = "";
    if (open.length) { const wks = [...new Set(open.map(r => r.wk))];
      wh += `<div><div class="wkhead"><h2>${esc(wks.join(" / "))}</h2><span class="note">${open.length} pick${open.length > 1 ? "s" : ""} · 1 unit each · awaiting results</span></div><div class="tickets">${open.map(ticket).join("")}</div></div>` }
    else wh += `<div class="banner"><b>Between weeks</b><span>No open picks right now. New picks show up here as soon as they're in the sheet${lastWk.length ? "; here's how last week went." : "."}</span></div>`;
    if (lastWk.length) { const s = stats(lastWk);
      wh += `<div><div class="wkhead"><h2>${esc(lastWk[0].wk)} results</h2><span class="note">${recTxt(s)} · <b class="${sgn(s.u)}">${fmtU(s.u)}</b></span></div><div class="tickets">${lastWk.map(ticket).join("")}</div></div>` }
    $("#cfb-week").innerHTML = `<div class="books">${wh}</div>`;
    if (P.updated) $("#cfb-lede").textContent += ` Last synced from our sheet ${P.updated}.`;

    let liveDone = false; onShow.live = () => { if (liveDone) return; liveDone = true; const rows = all.filter(r => r.s === cur);
      if (rows.length) lab($("#cfb-live"), rows, "cfl", `${cur} season`); else $("#cfb-live").innerHTML = '<div class="banner"><b>Boarding</b><span>No graded picks yet this season.</span></div>' };

    let histDone = false; onShow.history = () => { if (histDone) return; histDone = true;
      const rows = all; let focus = null;
      const first = seasons[seasons.length - 1]; if (first) $("#cfb-hist-k").textContent = `Every season on record · ${first} to ${cur}`;
      const cards = () => $("#cfb-seasons").innerHTML = `<button class="season" data-s="" aria-pressed="${focus == null}"><small>All seasons</small><b>${recTxt(stats(rows))}</b><span>${pct(stats(rows).wp)} · ${fmtU(stats(rows).u)}</span></button>` + seasons.map(s => { const st = stats(rows.filter(r => r.s === s)); const sheet = SI[s] && SI[s].rec;
        return `<button class="season" data-s="${s}" aria-pressed="${focus === s}"><small>${s}${s === cur ? " · live" : ""}</small><b>${recTxt(st)}</b><span>${pct(st.wp)} · ${fmtU(st.u)}${sheet && sheet.replace(/-0$/, "") !== recTxt(st) ? ` · sheet says ${esc(sheet)}` : ""}</span></button>` }).join("");
      const drawH = () => { cards(); const sub = focus == null ? rows : rows.filter(r => r.s === focus); lab($("#cfb-hist"), sub, "cfh", focus == null ? `${seasons.length} seasons` : `${focus} season`);
        const dn = focus != null && SI[focus] && SI[focus].dnb && SI[focus].dnb.length ? SI[focus].dnb : null;
        if (dn) $("#cfb-hist").insertAdjacentHTML("beforeend", `<div class="panel flat"><h3>${focus} do-not-bet list</h3><div class="dnb" style="margin-top:10px">${dn.map(t => `<span>${esc(t)}</span>`).join("")}</div></div>`) };
      $("#cfb-seasons").addEventListener("click", e => { const b = e.target.closest(".season"); if (!b) return; focus = b.dataset.s ? +b.dataset.s : null; drawH() });
      drawH() };

    // win totals and futures (the "O/U PICKS" tabs). "pay" is the total payout including the stake.
    let wtDone = false; onShow.totals = () => { if (wtDone) return; wtDone = true; const S = WT.seasons || {}, ys = Object.keys(S).sort((a, b) => b - a);
      if (!ys.length) { $("#cfb-totals").innerHTML = '<div class="banner"><b>Coming soon</b><span>Win-total bets haven\'t synced yet.</span></div>'; return }
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
      const drawWT = () => { const all = S[sel] || [], wt = all.filter(b => b.kind === "wt"), fut = all.filter(b => b.kind === "fut"), oth = all.filter(b => b.kind === "other");
        const byC = new Map(); wt.forEach(b => { const c = b.conf || "Other"; if (!byC.has(c)) byC.set(c, []); byC.get(c).push(b) });
        const live = wt.filter(b => !settled(b)), cfb = wt.concat(fut);
        const ov = wt.filter(b => b.dir === "Over"), un = wt.filter(b => b.dir === "Under");
        $("#cfb-totals").innerHTML = `<div class="seasons">${ys.map(y => { const w = (S[y] || []).filter(b => b.kind === "wt"), n = (S[y] || []).filter(b => b.kind !== "other");
            return `<button class="season" data-y="${y}" aria-pressed="${y === sel}"><small>${y}${w.some(b => !settled(b)) ? " · live" : ""}</small><b>${rec(w)}</b><span>win totals · ${money(sum(n, pl))} CFB</span></button>` }).join("")}</div>
          <div class="kpis" style="margin-top:18px"><div><small>Win totals</small><b>${rec(wt)}</b><span>${live.length ? `${live.length} still live` : "cashed-dead-push"}</span></div>
            <div><small>Overs / unders</small><b>${rec(ov)} · ${rec(un)}</b><span>over record · under record</span></div>
            <div><small>CFB profit</small><b class="${sum(cfb, pl) >= 0 ? "pos" : "neg"}">${money(sum(cfb, pl))}</b><span>settled win totals + futures</span></div>
            <div><small>Staked</small><b>$${sum(cfb, b => b.bet || 0).toFixed(0)}</b><span>${cfb.length} college bets</span></div>
            <div><small>Still riding</small><b>$${sum(cfb.filter(b => !settled(b)), b => b.pay || 0).toFixed(0)}</b><span>payout if every live bet cashes</span></div></div>
          <div class="wt-grid" style="margin-top:18px">${[...byC.entries()].map(([c, bb]) => `<div class="panel"><div class="lab-head"><h2>${esc(c)}</h2><span class="note">${rec(bb)}</span></div><div class="tbl"><table><thead><tr><th>Team</th><th>Bet</th><th>Wins</th><th>Status</th></tr></thead><tbody>${bb.map(wtRow).join("")}</tbody></table></div></div>`).join("")}</div>
          ${fut.length ? `<div class="panel" style="margin-top:18px"><div class="lab-head"><h2>College futures</h2><span class="note">${rec(fut)} · ${money(sum(fut, pl))}</span></div><div class="tbl"><table><thead><tr><th>Bet</th><th class="l">Market</th><th>Status</th><th>Stake → payout</th><th>P/L</th></tr></thead><tbody>${fut.map(futRow).join("")}</tbody></table></div></div>` : ""}
          ${oth.length ? `<details class="filters panel flat" style="margin-top:18px"><summary><h3>Other sports on the same tab</h3><span class="note">${oth.length} bets · ${money(sum(oth, pl))} · not counted in the college numbers</span></summary><div class="tbl" style="margin-top:10px"><table><thead><tr><th>Bet</th><th class="l">Group</th><th>Status</th><th>Stake → payout</th><th>P/L</th></tr></thead><tbody>${oth.map(futRow).join("")}</tbody></table></div></details>` : ""}
          <p class="note">Straight from our sheet: green line = over, red = under. Payout includes the stake. "Live" bets show the risk level we've marked; the bar is wins so far against the line (orange tick).</p>` };
      $("#cfb-totals").addEventListener("click", e => { const b = e.target.closest(".season"); if (!b) return; sel = b.dataset.y; drawWT() });
      drawWT() };

    const dnbAll = Object.entries(SI).filter(([, v]) => v.dnb && v.dnb.length).sort((a, b) => b[0] - a[0]);
    $("#cfb-dnb-all").innerHTML = dnbAll.length ? `<h3>Do-not-bet lists</h3>${dnbAll.map(([y, v]) => `<p><b>${y}</b></p><div class="dnb">${v.dnb.map(t => `<span>${esc(t)}</span>`).join("")}</div>`).join("")}` : "<h3>Do-not-bet lists</h3><p class=\"note\">None logged yet.</p>";

    route();
    const curV = root.querySelector('nav.stops button[aria-selected="true"]'); if (curV && onShow[curV.dataset.fv]) onShow[curV.dataset.fv]();
  });
  route();
})();
