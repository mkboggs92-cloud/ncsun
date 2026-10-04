/* UFC tab for "Nothing Can Stop Us Now". Self-contained: mounts into #ufc, reuses the page's design tokens and
   classes, and reads ufc_today.json, ufc_live.json, ufc_backtest.json and ufc_status.json published beside the page.
   Those files are rewritten by the UFC model's daily run; this script never changes. */
(function () {
  const root = document.getElementById("ufc");
  if (!root) return;
  const css = `
#ufc .ufc-views{display:grid;gap:22px}
#ufc .summary{margin-top:14px}
#ufc .kpis.open{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
#ufc .kpis.open b{font-size:26px}
#ufc .kpis .types{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px;font-size:12px;opacity:.9}
#ufc .tickets{grid-template-columns:repeat(auto-fill,minmax(min(430px,100%),1fr))}
#ufc .ticket .main{gap:7px}
#ufc .ticket .head{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#ufc .tbadge{display:inline-flex;align-items:center;gap:5px;font:800 10px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;padding:5px 8px;border-radius:999px;border:1.5px solid var(--ink);background:var(--panel2);color:var(--ink)}
#ufc .tbadge.ml{background:var(--cobalt);color:var(--cobalt-ink);border-color:var(--cobalt)}
#ufc .tbadge.fade{background:var(--sun);color:var(--sun-ink);border-color:var(--sun-ink)}
#ufc .tbadge.gtd{background:transparent;color:var(--coral-ink);border-color:var(--coral-ink)}
#ufc .tbadge.paper{background:transparent;border-style:dashed;color:var(--ink2);border-color:var(--ink2)}
#ufc .units{margin-left:auto;font:400 15px/1 var(--display);color:var(--ink)}
#ufc .units small{font:800 9.5px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);margin-left:3px}
#ufc .ticket .pick{font-size:21px}
#ufc .ticket .game{font-size:13px}
#ufc .pricegrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;background:var(--panel2);border-radius:10px;padding:8px 10px}
#ufc .pricegrid div{display:grid;gap:2px;min-width:0}
#ufc .pricegrid div.worst{display:none}
#ufc .pricegrid small{font:800 9.5px/1.1 var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ufc .pricegrid b{font-family:var(--mono);font-size:14px;font-weight:500;color:var(--ink);white-space:nowrap}
#ufc .pricegrid b.pos{color:var(--win)}
#ufc .pricegrid span{font-size:11px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ufc .why{display:grid;gap:4px;margin-top:2px}
#ufc .why h4{margin:0 0 2px;font:800 10.5px/1 var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--ink2);display:flex;justify-content:space-between;gap:8px}
#ufc .why h4 span{font-weight:600;letter-spacing:0;text-transform:none;font-size:11.5px}
#ufc .why .row{display:grid;grid-template-columns:minmax(0,1fr) 120px 40px;gap:8px;align-items:center;font-size:12.5px;line-height:1.3}
#ufc .why .lbl{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ufc .why .lbl small{color:var(--ink2);font-size:11px;font-family:var(--mono);margin-left:5px}
#ufc .why .bar{position:relative;height:10px;background:var(--panel2);border-radius:3px}
#ufc .why .bar::before{content:"";position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--ink2);opacity:.6}
#ufc .why .bar i{position:absolute;top:0;bottom:0;background:var(--win);border-radius:0 4px 4px 0;left:50%}
#ufc .why .bar i.neg{background:var(--loss);border-radius:4px 0 0 4px;left:auto;right:50%}
#ufc .why .val{font-family:var(--mono);font-size:12px;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
#ufc .why .foot{font-size:11.5px;color:var(--ink2);margin-top:3px}
#ufc .why .foot b{color:var(--ink);font-weight:700}
#ufc .ticket.paper{border-style:dashed;box-shadow:none;background:transparent}
#ufc .ticket.paper .stub{border-left-style:dashed;background:transparent}
#ufc .ticket.paper .pick{color:var(--ink2)}
#ufc .fightcard{display:grid;gap:0}
#ufc .ev-head{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;margin-bottom:6px}
#ufc .fight{display:grid;grid-template-columns:minmax(0,1fr) minmax(200px,260px) minmax(0,1fr);gap:8px 14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
#ufc .fight:last-child{border-bottom:0;padding-bottom:4px}
#ufc .fight.has-pick{background:linear-gradient(90deg,color-mix(in srgb,var(--sun) 22%,transparent),transparent 40%,transparent 60%,color-mix(in srgb,var(--sun) 22%,transparent));margin-inline:-18px;padding-inline:18px;border-radius:10px}
#ufc .side{display:grid;gap:3px;min-width:0;align-content:start}
#ufc .side.b{text-align:right;justify-items:end}
#ufc .side .nm{font-weight:800;font-size:15.5px;line-height:1.2;overflow-wrap:anywhere;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#ufc .side.b .nm{justify-content:flex-end}
#ufc .side .px{font-family:var(--mono);font-size:12px;color:var(--ink2);white-space:nowrap}
#ufc .side .px b{color:var(--ink);font-weight:500}
#ufc .side.pick .nm{color:var(--cobalt)}
#ufc .side.fav .nm{color:var(--ink)}
#ufc .mid{display:grid;justify-items:stretch;gap:5px;min-width:0}
#ufc .pv{display:flex;justify-content:space-between;font:800 13px/1 var(--body);font-variant-numeric:tabular-nums}
#ufc .pv .ma{color:var(--cobalt)} #ufc .pv .mb{color:var(--coral-ink)}
#ufc .pbar{position:relative;display:flex;height:12px;border-radius:6px;overflow:visible;border:1.5px solid var(--ink);background:var(--panel2)}
#ufc .pbar i{display:block;height:100%}
#ufc .pbar i.a{background:var(--cobalt);border-radius:4px 0 0 4px}
#ufc .pbar i.b{background:var(--coral);border-radius:0 4px 4px 0;margin-left:2px}
#ufc .pbar .mk{position:absolute;top:-6px;bottom:-6px;width:2px;background:var(--ink);transform:translateX(-50%)}
#ufc .pbar .mk::after{content:"";position:absolute;left:50%;top:-4px;width:0;height:0;border:4px solid transparent;border-top-color:var(--ink);transform:translateX(-50%)}
#ufc .mid small{font:700 10px/1.3 var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);text-align:center;display:flex;flex-wrap:wrap;justify-content:center;gap:4px}
#ufc .meth{display:flex;justify-content:center;gap:4px 10px;flex-wrap:wrap;font-size:11.5px;color:var(--ink2);text-align:center}
#ufc .meth b{color:var(--ink);font-weight:700}
#ufc .lean{grid-column:1 / -1;display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:12px;color:var(--ink2);margin-top:-4px}
#ufc .lean div{min-width:0;display:flex;gap:6px;align-items:baseline}
#ufc .lean div:last-child{text-align:right;justify-content:flex-end}
#ufc .lean b{flex:none;font-weight:800;color:var(--ink)}
#ufc .lean .dot{width:8px;height:8px;margin:0;flex:none;align-self:center}
#ufc .lean span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#ufc .badge{display:inline-block;font:800 10px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;background:var(--sun);color:var(--sun-ink);padding:4px 6px;border-radius:999px;border:1.5px solid var(--ink)}
#ufc .badge.watch{background:var(--panel);color:var(--ink2);border-style:dashed;border-color:var(--ink2)}
#ufc .status{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--ink2);margin-top:10px}
#ufc .status b{color:var(--ink)}
#ufc .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}
#ufc .legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--ink2);align-items:center}
#ufc .legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:5px}
#ufc .legend .tick{display:inline-block;width:2px;height:12px;background:var(--ink);vertical-align:-2px;margin-right:7px}
@media (max-width:640px){
  #ufc .fight{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 10px;padding:14px 0}
  #ufc .fight.has-pick{margin-inline:-14px;padding-inline:14px;background:color-mix(in srgb,var(--sun) 16%,transparent)}
  #ufc .mid{order:-1;grid-column:1 / -1}
  #ufc .side .nm{font-size:14.5px} #ufc .side .px{font-size:11.5px;white-space:normal}
  #ufc .lean{grid-template-columns:1fr;gap:3px} #ufc .lean div:last-child{text-align:left;justify-content:flex-start}
  #ufc .pricegrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px}
  #ufc .pricegrid div.market{display:none} #ufc .pricegrid div.worst{display:grid}
  #ufc .ticket{grid-template-columns:1fr} #ufc .ticket .stub,#ufc .ticket .notch{display:none}
  #ufc .why .row{grid-template-columns:minmax(0,1fr) 72px 36px;font-size:12px}
  #ufc .ticket .pick{font-size:19px}
}
#ufc .slip{display:grid;gap:10px}
#ufc .slip-ev{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:8px 0 0}
#ufc .slip-ev h2{font-size:20px}
#ufc details.bet{background:var(--panel);border:2px solid var(--ink);border-radius:12px;box-shadow:3px 3px 0 var(--ink)}
#ufc details.bet.paper{border-style:dashed;box-shadow:none}
#ufc details.bet>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto auto;gap:6px 14px;align-items:center;padding:12px 14px;min-height:56px}
#ufc details.bet>summary::-webkit-details-marker{display:none}
#ufc details.bet>summary::after{content:"+";display:grid;place-items:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--ink);font-weight:800}
#ufc details.bet[open]>summary::after{content:"−"}
#ufc .bet .u{font:400 24px/1 var(--display);min-width:46px;text-align:center}
#ufc .bet .u small{display:block;margin-top:3px;font:800 9px/1.2 var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2)}
#ufc .bet .what{display:grid;gap:4px;min-width:0;justify-items:start}
#ufc .bet .what b{font:400 17px/1.1 var(--display);text-transform:uppercase;overflow-wrap:anywhere}
#ufc .bet .what>span:last-child{font-size:12.5px;color:var(--ink2)}
#ufc .bet .px2{display:grid;justify-items:end;gap:2px;font-family:var(--mono);font-size:13px;white-space:nowrap}
#ufc .bet .px2 b{font-size:18px}
#ufc .bet .px2 span{color:var(--ink2);font-size:11.5px}
#ufc .bet .body{padding:12px 14px 14px;display:grid;gap:12px;border-top:1px dashed var(--line)}
#ufc details.more{border:2px solid var(--line);border-radius:12px;background:var(--panel)}
#ufc details.more>summary{cursor:pointer;list-style:none;padding:14px 16px;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font:800 13px/1.2 var(--body);letter-spacing:.06em;text-transform:uppercase}
#ufc details.more>summary::-webkit-details-marker{display:none}
#ufc details.more>summary::before{content:"+";display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--coral);color:#fff}
#ufc details.more[open]>summary::before{content:"−"}
#ufc details.more>summary span{font:500 12.5px/1.3 var(--body);letter-spacing:0;text-transform:none;color:var(--ink2)}
#ufc details.more>.inner{padding:0 16px 16px;display:grid;gap:18px}
#ufc .slipsum{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline;font-size:14px;color:var(--ink2)}
#ufc .slipsum b{font:400 26px/1 var(--display);color:var(--ink)}
@media (max-width:640px){#ufc details.bet>summary{grid-template-columns:auto 1fr;padding:10px 12px}#ufc details.bet>summary::after{display:none}#ufc .bet .px2{grid-column:2;justify-items:start;grid-auto-flow:column;gap:10px;align-items:baseline}#ufc details.more>.inner{padding:0 10px 12px}}

`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const $ = s => root.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtU = v => (v > 0 ? "+" : "") + v.toFixed(1) + "u";
  const pct = v => (v * 100).toFixed(1) + "%";
  const sgn = v => v > 0 ? "pos" : (v < 0 ? "neg" : "");
  const am = o => o == null ? "–" : (o > 0 ? "+" + o : String(o));
  const BOOK = { FD: "FanDuel", DK: "DraftKings", CZR: "Caesars", MGM: "BetMGM", DraftKings: "DraftKings", Caesars: "Caesars", BetRivers: "BetRivers", best: "Best book" };
  const MK = { ML: "Moneyline", GTD: "Goes the distance", A_DEC: "Wins by decision", B_DEC: "Wins by decision", "O2.5": "Over 2.5 rounds", "O4.5": "Over 4.5 rounds", A_SUB: "Wins by submission", B_SUB: "Wins by submission" };
  const TIER = { ML: "Moneyline", DEC_A: "Decision · KO fade", DEC_B: "Decision", A_DEC: "Decision", B_DEC: "Decision", GTD: "Goes the distance", "O4.5": "Over 4.5 rounds", A_SUB: "Submission", B_SUB: "Submission" };
  const tierOf = r => r.tier || ((r.mk || "ML") === "ML" ? "ML" : r.mk);
  const barOf = r => ({ GTD: 0.05, DEC_B: 0.05 }[tierOf(r)] ?? 0.03);
  const isProp = r => (r.mk || "ML") !== "ML";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fair = p => { if (!p) return null; const d = 1 / p; return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)) };
  const minPrice = (p, bar = 0.03) => fair(p - bar);          // worst price that still clears the edge bar
  const dateTxt = d => { const x = new Date(d + "T12:00:00"); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getDay()] + ", " + MON[x.getMonth()] + " " + x.getDate() };
  const cap = s => String(s || "").replace(/\b\w/g, c => c.toUpperCase());
  const LIGHT = ["flyweight", "bantamweight", "featherweight", "women's strawweight", "women's flyweight", "women's bantamweight", "women's featherweight"];

  const DIMS = {
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
  };
  const FILTERS = ["tier", "season", "side", "price", "edge", "gender", "weight", "rounds", "exp", "ending", "book"];

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
    const nar = innerWidth < 600, W = nar ? 360 : 760, H = nar ? 250 : 270, L = nar ? 40 : 50, R = nar ? 12 : 18, T = nar ? 44 : 40, B = nar ? 30 : 34, fs = nar ? 12 : 11, n = rows.length;
    let c = 0; const ys = rows.map(r => (c += r.u || 0));
    const ymin = Math.min(0, ...ys), ymax = Math.max(1, ...ys), span = ymax - ymin || 1, lines = nar ? 4 : 7, step = [2, 5, 10, 20, 25, 50, 100, 200].find(x => span / x <= lines) || 500;
    const x = i => L + i / (n - 1) * (W - L - R), y = v => T + (ymax - v) / span * (H - T - B);
    let g = ""; for (let v = Math.ceil(ymin / step) * step; v <= ymax; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === 0 ? 'stroke-width="2"' : 'stroke-dasharray="2 5"'}/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="${fs}" fill="var(--ink2)">${v > 0 ? "+" : ""}${v}u</text>`;
    let s = "", prev = null; rows.forEach((r, i) => { const yr = r.d.slice(0, 4); if (yr !== prev) { s += `<line x1="${x(i)}" x2="${x(i)}" y1="${T - 10}" y2="${H - B}" stroke="var(--line)"/><text x="${x(i) + 4}" y="${H - B + 19}" font-size="${fs}" font-weight="700" fill="var(--ink2)">${nar ? yr.slice(2) : yr}</text>`; prev = yr } });
    let pk = 0, pi = 0, dd = 0, di0 = 0, di1 = 0; ys.forEach((v, i) => { if (v > pk) { pk = v; pi = i } if (pk - v > dd) { dd = pk - v; di0 = pi; di1 = i } });
    const k = Math.max(1, Math.floor(n / (nar ? 90 : 140))), pts = []; for (let i = 0; i < n; i += k) pts.push([x(i), y(ys[i])]); if (pts[pts.length - 1][0] !== x(n - 1)) pts.push([x(n - 1), y(ys[n - 1])]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
    let ties = ""; if (!nar) for (let i = 1; i < pts.length; i += 2) { const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len * 6, ny = dx / len * 6; ties += `<line x1="${(b[0] + nx).toFixed(1)}" y1="${(b[1] + ny).toFixed(1)}" x2="${(b[0] - nx).toFixed(1)}" y2="${(b[1] - ny).toFixed(1)}" stroke="var(--track)" stroke-width="1.6" opacity=".5"/>` }
    let ddm = ""; if (dd >= 3) { const x0 = x(di0), x1 = x(di1), y0 = y(ys[di0]), y1 = y(ys[di1]), lx = Math.min(Math.max((x0 + x1) / 2, L + 60), W - R - 60);
      ddm = `<g aria-hidden="true"><line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="var(--loss)" stroke-dasharray="3 3"/><line x1="${x1}" x2="${x1}" y1="${y0}" y2="${y1}" stroke="var(--loss)" stroke-width="2"/><circle cx="${x1}" cy="${y1}" r="3.5" fill="var(--loss)"/><text x="${lx}" y="${Math.min(H - B - 6, y1 + 18)}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="var(--loss)">Worst drawdown −${dd.toFixed(1)}u</text></g>` }
    const end = pts[pts.length - 1], pre = pts[Math.max(0, pts.length - 3)], ang = Math.atan2(end[1] - pre[1], end[0] - pre[0]) * 180 / Math.PI, last = ys[n - 1], base = y(Math.max(ymin, 0));
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative units, ${fmtU(last)}; worst drawdown ${dd.toFixed(1)} units">${g}${s}
     <path d="${path} L${end[0]} ${base} L${pts[0][0]} ${base} Z" fill="var(--cobalt)" opacity=".10"/>
     ${ties}<path d="${path}" fill="none" stroke="var(--track)" stroke-width="${nar ? 2.6 : 3.2}" stroke-linejoin="round"/>${ddm}
     <g transform="translate(${end[0].toFixed(1)} ${end[1].toFixed(1)}) rotate(${ang.toFixed(1)})"><rect x="-24" y="-14" width="24" height="10" rx="3" fill="var(--coral)" stroke="var(--ink)" stroke-width="2"/><circle cx="-19" cy="-2" r="2.6" fill="var(--ink)"/><circle cx="-5" cy="-2" r="2.6" fill="var(--ink)"/><circle cx="-12" cy="-19" r="5.5" fill="var(--ball)" stroke="var(--ink)" stroke-width="1.6"/></g>
     <text x="${(end[0] - 8).toFixed(1)}" y="${Math.max(16, end[1] - 30).toFixed(1)}" text-anchor="end" font-size="${nar ? 14 : 15}" font-weight="800" fill="var(--ink)">${fmtU(last)}</text></svg>`;
  }

  function kpis(el, s, label) {
    el.innerHTML = `<div><small>Bets</small><b>${s.n.toLocaleString()}</b><span>${label}</span></div><div><small>Record</small><b>${s.w}-${s.l}</b><span>${pct(s.wp)} win rate${s.v ? ` · ${s.v} void` : ""}</span></div>
     <div><small>Units</small><b class="${s.u >= 0 ? "pos" : "neg"}">${fmtU(s.u)}</b><span>${s.u >= 0 ? "+" : "−"}$${Math.abs(Math.round(s.u * 100)).toLocaleString()} at $100/unit</span></div>
     <div><small>ROI</small><b class="${s.roi >= 0 ? "pos" : "neg"}">${s.roi >= 0 ? "+" : ""}${(s.roi * 100).toFixed(1)}%</b><span>per unit risked</span></div><div><small>Vs close</small><b>${clvTxt(s.clv)}</b><span>avg price edge</span></div>`;
  }

  function lab(el, all, idp, label) {
    const F = {}; FILTERS.forEach(d => F[d] = new Set());
    const opts = Object.entries(DIMS).map(([k, d]) => `<option value="${k}">${d.n}</option>`).join("");
    el.innerHTML = `<div class="kpis" id="${idp}-k"></div>
    <div class="panel"><div class="lab-head"><h2>The ride</h2><span class="note" id="${idp}-sub"></span></div><div id="${idp}-chart"></div></div>
    <div class="panel lab"><div class="lab-head"><h2>Slice lab</h2><div class="active" id="${idp}-active"></div></div>
     <details class="filters" ${matchMedia("(max-width:640px)").matches ? "" : "open"}><summary><h3>Filters</h3><span class="note">Tap chips to narrow every number on this page. Chips in the same group add together.</span></summary>
      <div class="fgrid">${FILTERS.map(d => `<div class="fgroup"><h4>${DIMS[d].n}</h4><div class="chips">${groupBy(all, d).map(([k, v]) => `<button class="chip" data-d="${d}" data-v="${esc(k)}" aria-pressed="false">${esc(k)}<small>${v.length}</small></button>`).join("")}</div></div>`).join("")}</div></details>
     <div class="lab-controls">
       <label class="f" for="${idp}-a">Break down by<select id="${idp}-a">${opts}</select></label>
       <label class="f" for="${idp}-b">Then by<select id="${idp}-b"><option value="">Nothing</option>${opts}</select></label>
       <div class="viewtog" role="group" aria-label="View"><button id="${idp}-vt" aria-pressed="true">Table</button><button id="${idp}-vh" aria-pressed="false">Heatmap</button></div>
       <button class="ghost" id="${idp}-clear">Clear filters</button>
     </div>
     <div class="tbl" id="${idp}-out"></div><p class="note">Rows under 50 bets are marked small. Treat them as noise until they grow.</p></div>
    <div class="panel"><div class="lab-head"><h2>Bet log</h2><label class="f" for="${idp}-q">Fighter<input id="${idp}-q" type="search" placeholder="Search a fighter"></label></div><div class="tbl" id="${idp}-log"></div></div>`;
    const a = $(`#${idp}-a`), b = $(`#${idp}-b`), vt = $(`#${idp}-vt`), vh = $(`#${idp}-vh`), q = $(`#${idp}-q`); a.value = "tier"; let heat = false, page = 0;
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
      $(`#${idp}-log`).innerHTML = `<table class="log"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Opponent</th><th>Price</th><th class="l">Book</th><th>Model</th><th>Edge</th><th class="l">Ended</th><th>Result</th><th>Units</th></tr></thead><tbody>${v.map(r => `<tr><td class="mono">${r.d}</td><td class="l"><b>${esc(r.lab || r.pk)}</b></td><td class="l">${esc(r.op)}</td><td class="mono">${am(r.o)}</td><td class="l">${esc(r.bk)}</td><td>${pct(r.p)}</td><td>${r.e.toFixed(1)}</td><td class="l">${esc(DIMS.ending.f(r))}${r.rnd ? " R" + r.rnd : ""}</td><td><span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span></td><td class="${sgn(r.u)}">${fmtU(r.u)}</td></tr>`).join("")}</tbody></table>
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
    vh.onclick = () => { heat = true; vh.setAttribute("aria-pressed", "true"); vt.setAttribute("aria-pressed", "false"); if (!b.value) b.value = a.value === "season" ? "tier" : "season"; draw() };
    let nar = innerWidth < 600; addEventListener("resize", () => { const n2 = innerWidth < 600; if (n2 !== nar) { nar = n2; coaster($(`#${idp}-chart`), filtered()) } });
    draw();
  }

  // ---------------------------------------------------------------- tickets + "why"
  const SHORT = { Moneyline: "ML", "Decision · KO fade": "KO fade", Decision: "decision", "Goes the distance": "distance" };
  const BADGE = { ML: "ml", DEC_A: "fade", DEC_B: "dec", A_DEC: "dec", B_DEC: "dec", GTD: "gtd" };
  const pct0 = v => v == null ? "–" : Math.round(v * 100) + "%";
  const pts = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  function whyChart(w, r) {
    if (!w || !w.items || !w.items.length) return "";
    const max = Math.max(1, ...w.items.map(x => Math.abs(x.pts)));
    const rows = w.items.map(x => { const wd = Math.abs(x.pts) / max * 50; return `<div class="row"><div class="lbl" title="${esc(x.label)}${x.v ? " · " + esc(x.v) : ""}">${esc(x.label)}${x.v ? `<small>${esc(x.v)}</small>` : ""}</div><div class="bar" aria-hidden="true"><i class="${x.pts < 0 ? "neg" : ""}" style="width:${wd.toFixed(1)}%"></i></div><div class="val ${x.pts > 0 ? "pos" : x.pts < 0 ? "neg" : ""}">${pts(x.pts)}</div></div>` }).join("");
    const t = tierOf(r), dec = t === "DEC_A" || t === "DEC_B";
    let foot = "";
    if (w.p != null) foot += `Model <b>${pct0(w.p)}</b>${w.base != null && Math.abs(w.base - 0.5) > 0.001 ? ` <span>(base ${pct0(w.base)})</span>` : ""}`;
    if (r.m != null) foot += ` · Market <b>${pct0(r.m)}</b>`;
    if (r.p != null) foot += ` · Blended <b>${pct0(r.p)}</b> vs ${pct0(1 / r.dec)} at the price`;
    if (dec && w.ko != null) foot += `<br>${w.fade != null ? `<b>KO fade</b>: model has the KO at <b>${pct0(w.ko)}</b>, ${pts(w.fade * 100)} pts below the market` : `Model KO chance <b>${pct0(w.ko)}</b>${t === "DEC_A" ? " · 5+ pts below the market (KO fade)" : ""}`}`;
    const sr = `Reasons, in probability points: ${w.items.map(x => `${x.label} ${pts(x.pts)}`).join(", ")}`;
    return `<div class="why" role="img" aria-label="${esc(sr)}"><h4>Why the model likes it<span>points for / against</span></h4>${rows}${foot ? `<div class="foot">${foot}</div>` : ""}</div>`;
  }
  function ticket(r, showRes, paper) {
    const su = paper ? 0 : (r.su || 1), t = tierOf(r), worst = r.p ? minPrice(r.p, barOf(r)) : null;
    const badge = paper ? `<span class="tbadge paper">Paper · ${esc(TIER[t] || MK[r.mk] || t)}</span>` : `<span class="tbadge ${BADGE[t] || ""}">${esc(TIER[t] || t)}</span>`;
    const res = showRes && r.r ? `<span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${r.r === "W" ? "Won" : r.r === "L" ? "Lost" : esc(r.r)}</span>` : "";
    return `<article class="ticket${paper ? " paper" : ""}"><span class="notch t"></span><span class="notch b"></span><div class="main">
      <div class="head">${badge}${res}<span class="units">${paper ? "0" : su}<small>unit${su === 1 ? "" : "s"}</small></span></div>
      <div class="pick">${esc(r.lab || r.pk)}</div>
      <div class="game">${isProp(r) ? esc(r.op) : "vs " + esc(r.op)}${r.div ? " · " + esc(cap(r.div)) : ""} · ${esc(dateTxt(r.d))}${r.ev ? " · " + esc(r.ev) : ""}</div>
      <div class="pricegrid"><div><small>Bet at</small><b>${am(r.o)}</b><span>${esc(BOOK[r.bk] || r.bk)}</span></div>
        <div><small>Fair</small><b>${r.p ? am(fair(r.p)) : "–"}</b><span>${r.p ? pct0(r.p) + " to win" : "not priced"}</span></div>
        <div><small>Edge</small><b class="${(r.e || 0) > 0 ? "pos" : ""}">${r.e != null ? (r.e > 0 ? "+" : "") + r.e.toFixed(1) : "–"}</b><span>${r.e != null ? `pts over ${pct0(1 / r.dec)}` : "not priced"}</span></div>
        <div class="market"><small>Market</small><b>${r.m != null ? am(fair(r.m)) : "–"}</b><span>${r.m != null ? pct0(r.m) + " fair" : "no fair line"}</span></div>
        <div class="worst"><small>Worst price</small><b>${worst != null ? am(worst) : "–"}</b><span>still a bet</span></div></div>
      ${whyChart(r.why, r)}</div>
      <div class="stub"><div><b class="lim">${worst != null ? am(worst) : "–"}</b><small>Worst price</small></div></div></article>`;
  }

  function betRow(r, paper) {
    const su = paper ? 0 : (r.su || 1), t = tierOf(r), worst = r.p ? minPrice(r.p, barOf(r)) : null;
    const badge = paper ? `<span class="tbadge paper">Paper</span>` : `<span class="tbadge ${BADGE[t] || ""}">${esc(TIER[t] || t)}</span>`;
    const top = r.why && r.why.items ? r.why.items.filter(x => x.pts > 0).slice(0, 2).map(x => x.label).join(" · ") : "";
    return `<details class="bet${paper ? " paper" : ""}"><summary>
      <span class="u">${paper ? "–" : su}<small>${paper ? "paper" : "unit" + (su === 1 ? "" : "s")}</small></span>
      <span class="what">${badge}<b>${esc(r.lab || r.pk)}</b><span>${isProp(r) ? esc(r.op) : "vs " + esc(r.op)}${top ? " · " + esc(top) : ""}</span></span>
      <span class="px2"><b>${am(r.o)}</b><span>${esc(BOOK[r.bk] || r.bk)}</span>${worst != null ? `<span>take ${am(worst)} or better</span>` : ""}</span>
    </summary><div class="body">
      <div class="pricegrid"><div><small>Bet at</small><b>${am(r.o)}</b><span>${esc(BOOK[r.bk] || r.bk)}</span></div>
        <div><small>Fair</small><b>${r.p ? am(fair(r.p)) : "–"}</b><span>${r.p ? pct0(r.p) + " to win" : "not priced"}</span></div>
        <div><small>Edge</small><b class="${(r.e || 0) > 0 ? "pos" : ""}">${r.e != null ? (r.e > 0 ? "+" : "") + r.e.toFixed(1) : "–"}</b><span>${r.e != null && r.dec ? `pts over ${pct0(1 / r.dec)}` : ""}</span></div>
        <div class="market"><small>Market</small><b>${r.m != null ? am(fair(r.m)) : "–"}</b><span>${r.m != null ? pct0(r.m) + " fair" : "no fair line"}</span></div>
        <div class="worst"><small>Worst price</small><b>${worst != null ? am(worst) : "–"}</b><span>still a bet</span></div></div>
      ${whyChart(r.why, r)}<p class="note">${esc(dateTxt(r.d))}${r.ev ? " · " + esc(r.ev) : ""}${r.posted ? " · locked " + esc(r.posted) : ""}</p></div></details>`;
  }

  // ---------------------------------------------------------------- fight rows
  const short = n => { const t = String(n || "").trim().split(/\s+/); return t.length >= 3 && /^(dos|de|da|del|van|von|la|le|di)$/i.test(t[t.length - 2]) ? t.slice(-2).join(" ") : t[t.length - 1] || "" };
  function fightRow(f) {
    const pa = f.a.p ?? 0.5, pb = 1 - pa, mk = f.a.mkt, bets = f.bets || [], hasPick = !!(f.a.pick || f.b.pick || bets.length);
    const propPicks = bets.length ? `<small>${bets.map(b => `<span class="badge">Pick · ${esc(TIER[b.tier] || MK[b.mk] || b.mk)} ${am(b.o)}</span>`).join(" ")}</small>` : "";
    const side = (s, cls) => `<div class="side ${cls}${s.pick ? " pick" : ""}${(cls === "a" ? pa : pb) >= 0.5 ? " fav" : ""}"><span class="nm">${esc(s.n)}${s.pick ? ` <span class="badge">Pick ${am(s.pick.o)}</span>` : ""}</span>
      <span class="px">FD <b>${am(s.fd)}</b>${s.dk != null ? ` · DK <b>${am(s.dk)}</b>` : ""}${s.czr != null ? ` · CZR <b>${am(s.czr)}</b>` : ""}</span><span class="px">fair ${am(fair(s.p))}</span>${s.ufc != null ? `<span class="px">${s.ufc} UFC fight${s.ufc === 1 ? "" : "s"}</span>` : ""}</div>`;
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

  const M = x => `<div class="mbox"><math display="block">${x}</math></div>`;
  root.innerHTML = `
  <nav class="stops" role="tablist" aria-label="UFC sections">
    <button role="tab" data-uv="today" aria-selected="true"><i>1</i>Fight card</button>
    <button role="tab" data-uv="live" aria-selected="false" tabindex="-1"><i>2</i>2026 live</button>
    <button role="tab" data-uv="backtest" aria-selected="false" tabindex="-1"><i>3</i>Backtest</button>
    <button role="tab" data-uv="how" aria-selected="false" tabindex="-1"><i>4</i>How it works</button>
    <button role="tab" data-uv="hood" aria-selected="false" tabindex="-1"><i>5</i>Under the hood</button>
  </nav>

  <section class="view" data-uview="today">
    <div><div class="kicker" id="ufc-kicker">UFC · moneylines and props</div><h1>Fight <em>night</em></h1>
      <p class="lede" id="ufc-lede">Picks lock the first time they clear the rule and are graded at that price. Moneylines post 1 to 3 weeks out; props about 3 days before an event.</p>
      <div class="status" id="ufc-status"></div></div>
    <div id="ufc-summary"></div>
    <div id="ufc-picks"></div>
    <details class="more" id="ufc-more-card"><summary>Full fight card<span>every fight with a line: prices, model chances, method splits, what the model weighs</span></summary><div class="inner"><div id="ufc-cards" class="ufc-views"></div></div></details>
  </section>

  <section class="view" data-uview="live" hidden>
    <div><div class="kicker">Since October 2026 · real picks only</div><h1>2026 <em>live</em></h1>
      <p class="lede">Every pick posted here, graded at the book and price shown when it locked, 1 unit each. Nothing from the backtest is mixed in.</p></div>
    <div id="ufc-live" class="ufc-views"></div>
    <div class="panel flat" id="ufc-paper" style="display:grid;gap:10px"></div>
  </section>

  <section class="view" data-uview="backtest" hidden>
    <div><div class="kicker">Out-of-sample backtest · 2021 to 2026</div><h1>The <em>ride</em> so far</h1>
      <p class="lede">Each year was predicted by models trained only on earlier fights. Moneylines are graded at FanDuel's (or BetMGM's, before it left BestFightOdds) opening price; props at the best closing price of FanDuel, DraftKings and Caesars. Blends use only earlier years, so bets start in 2023. The card rule is applied in the order live picks lock: moneylines first (at most 2), then props, at most 5 a card, 1 unit each. Simulated results, not a live record.</p></div>
    <div id="ufc-bt" class="ufc-views"></div>
  </section>

  <section class="view" data-uview="how" hidden>
    <div><div class="kicker">The theory</div><h1>Beat the <em>opener</em>. Fade the <em>knockout</em>.</h1>
      <p class="lede">UFC moneylines are softest when a book first hangs them and get sharper as money comes in, so the model prices fights against opening lines. Prop markets have a different weakness: they overprice knockouts and underprice fights that go long, above all a favorite winning a decision.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Every fight, every fighter</h3><p>Round-by-round UFCStats box scores since 1994, each fighter's full pro record from Sherdog (regional shows included), and FightMatrix's pre-fight ratings and rankings: 57,000 bouts across 24,000 fighters. Everything is built from fights before the one being priced.</p></div>
      <div class="panel stop"><h3>Ratings</h3><p>Our own Bradley-Terry rating, solved over the whole web of who beat whom and refit monthly, plus FightMatrix's three rating systems and division rank going into each fight. Adding FightMatrix cut the win model's error noticeably and lifted the moneyline backtest from +12% to +13.5%.</p></div>
      <div class="panel stop"><h3>Two models</h3><p>A win model (LightGBM plus logistic regression on about 85 inputs) and a prop model that reads how each fighter wins and loses: KO, submission and decision rates over his whole career, how fast, how recently, durability, striking, age and reach. Every fight is fed both ways, so the corner never matters.</p></div>
      <div class="panel stop"><h3>Market blend</h3><p>Neither model is bet raw. Each is blended with the book's own price, with weights fit out of sample for that book and how long the line has been up. The model earns weight only where it beats the market on its own.</p></div>
      <div class="panel stop"><h3>The card</h3><p>Moneyline picks need 3 points of edge at +400 or shorter. Decision picks need 3 points when the model also rates that fighter's KO chance 5+ points below the market (a "KO fade"), otherwise 5. Goes-the-distance needs 5. At most 5 bets a card: no more than 2 moneylines (they lock weeks early) and 3 of any prop type, best first. Every bet is 1 unit.</p></div>
    </div>
    <div class="grid2">
      <div class="panel flat prose"><h3>What it doesn't bet</h3><ul>
        <li>Fights with a UFC debutant: too little to go on.</li>
        <li>KO and submission props. Books mark them up 12% to 35% over fair, more than the model ever disagrees with the market. Over 10,000 angle and matchup combinations were checked; none beat FanDuel's vig.</li>
        <li>Unders and early-round totals. Every pocket tested lost or broke even.</li>
        <li>More than 5 bets on one card, even when more qualify.</li></ul></div>
      <div class="panel flat prose"><h3>How the backtest stayed honest</h3><ul>
        <li>Walk-forward: each year predicted by models trained only on earlier years.</li>
        <li>Graded at real prices with juice: FanDuel/BetMGM openers for moneylines, FanDuel/DraftKings/Caesars closing prices for props. Every blend is fit only on earlier years.</li>
        <li>Moneyline picks beat the closing line by about 3.5% on average.</li>
        <li>Placebo checks: shuffled ratings and a shuffled prop model each lost their edge.</li>
        <li>Every year from 2021 to 2026 was profitable under the card rule.</li></ul></div>
    </div>
    <div class="panel flat prose"><h3>Paper tracked, not bet</h3><p>Two angles that looked good but don't have enough history yet: over 4.5 rounds in 5-round fights at FanDuel (113 bets, +18%, every year positive), and submissions where the model beats FanDuel's price by 3+ points against an opponent who has been submitted before (151 bets, +40%, but statistically thin). They're logged on the live tab and graded, but never staked.</p></div>
    <div class="panel flat prose"><h3>What to expect live</h3><p>The thresholds, the KO-fade cutoff and the card caps were chosen on the same seasons they were tested on, so expect live results well below the backtest's +35%. Books can also close the decision bias at any time. Opening lines move fast: if a pick's price is gone, the worst-price number on each ticket tells you where it stops being a bet.</p></div>
  </section>

  <section class="view" data-uview="hood" hidden>
    <div><div class="kicker">Under the hood · model specification</div><h1>The <em>engine</em> room</h1>
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
        <p class="note">The prior centers on "trust the market," so the model only earns weight it shows out of sample. Moneyline blends are fit per book and per line age (open, 1-3 days, 3 days out, day before, close); prop blends per market. In the backtest, each year's blend is fit only on earlier years.</p></div>

      <div class="panel eq"><h3>06 · The KO fade</h3>
        <p>For a decision pick on fighter <i>i</i>, compare the prop model's KO probability with the market's de-vigged KO price:</p>
        ${M(`<msub><mi>Δ</mi><mtext>KO</mtext></msub><mo>=</mo><msubsup><mi>q</mi><mi>i</mi><mtext>KO</mtext></msubsup><mo>−</mo><msubsup><mi>m</mi><mi>i</mi><mtext>KO</mtext></msubsup><mspace width="1.2em"/><mtext>KO fade</mtext><mo>⇔</mo><msub><mi>Δ</mi><mtext>KO</mtext></msub><mo>≤</mo><mo>−</mo><mn>0.05</mn>`)}
        <p class="note">The market gets the win probability right but splits it wrong: it hands too much to the KO and too little to the decision. Over 2021-26 decision picks with a KO fade returned about +50 to +60%; those without, +9 to +20%.</p></div>

      <div class="panel eq"><h3>07 · Decision rule and card</h3>
        ${M(`<mtext>bet</mtext><mo>⇔</mo><mi>p</mi><mo>−</mo><mfrac><mn>1</mn><mi>d</mi></mfrac><mo>≥</mo><msub><mi>τ</mi><mtext>type</mtext></msub><mo>,</mo><mspace width=".6em"/><msub><mi>τ</mi><mtext>ML</mtext></msub><mo>=</mo><msub><mi>τ</mi><mtext>KO fade</mtext></msub><mo>=</mo><mn>.03</mn><mo>,</mo><mspace width=".4em"/><msub><mi>τ</mi><mtext>DEC</mtext></msub><mo>=</mo><msub><mi>τ</mi><mtext>GTD</mtext></msub><mo>=</mo><mn>.05</mn>`)}
        <p class="note">Price caps: d ≤ 5 (+400) for moneylines, d ≤ 11 (+1000) for props. No debutants. Per card, rank KO fades first, then by expected value p·d − 1; keep at most 5, at most 2 moneylines and 3 of any other type. Every bet is 1 unit. Picks lock the first time they qualify; earlier locks count toward the caps.</p></div>

      <div class="panel eq"><h3>08 · Staking, grading and CLV</h3>
        <p>Profit per unit at decimal price <i>d</i>, and closing-line value with the de-vigged closing probability <i>c</i>:</p>
        ${M(`<mi>π</mi><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mi>s</mi><mo>(</mo><mi>d</mi><mo>−</mo><mn>1</mn><mo>)</mo></mtd><mtd><mtext>win</mtext></mtd></mtr><mtr><mtd><mo>−</mo><mi>s</mi></mtd><mtd><mtext>loss</mtext></mtd></mtr></mtable></mrow><mspace width="1.4em"/><mtext>CLV</mtext><mo>=</mo><mi>c</mi><mo>·</mo><mi>d</mi><mo>−</mo><mn>1</mn>`)}
        <p class="note">Draws, no contests and cancelled fights are void. Staking is flat: 1 unit a bet. Bigger stakes on the strongest picks (1.5u) added about 3 points of ROI in the backtest but nearly doubled the worst drawdown; quarter Kelly made more units only by risking twice as much.</p></div>
    </div>
  </section>`;

  // ---------------------------------------------------------------- routing (mirrors the college page: #ufc, #ufc-live, ...)
  const VIEWS = ["today", "live", "backtest", "how", "hood"], onShow = {};
  let cur = "today";
  function show(v, push) {
    cur = v;
    root.querySelectorAll("nav.stops button").forEach(b => { const on = b.dataset.uv === v; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && push) b.scrollIntoView({ block: "nearest", inline: "nearest" }) });
    root.querySelectorAll("[data-uview]").forEach(s => s.hidden = s.dataset.uview !== v);
    if (push) history.replaceState(null, "", v === "today" ? "#ufc" : "#ufc-" + v);
    if (onShow[v]) onShow[v]();
  }
  const tl = root.querySelector("nav.stops");
  tl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => show(b.dataset.uv, true)));
  tl.addEventListener("keydown", e => { const t = [...tl.querySelectorAll('[role="tab"]')], i = t.indexOf(document.activeElement); if (i < 0) return;
    const j = e.key === "ArrowRight" ? (i + 1) % t.length : e.key === "ArrowLeft" ? (i - 1 + t.length) % t.length : e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : -1; if (j < 0) return; e.preventDefault(); t[j].focus(); t[j].click() });
  function route() {
    const h = (location.hash || "").slice(1);
    if (h === "ufc" || h.startsWith("ufc-")) {
      document.querySelectorAll(".seg button").forEach(b => { const on = b.dataset.model === "ufc"; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1 });
      const nc = document.getElementById("ncaab"); if (nc) nc.hidden = true; root.hidden = false;
      const v = h.slice(4); show(VIEWS.includes(v) ? v : "today");
    }
  }
  addEventListener("hashchange", route);

  // ---------------------------------------------------------------- data (backtest is the heavy file: load it on demand)
  const getJSON = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const bydate = (a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0;
  let btDone = false; onShow.backtest = () => { if (btDone) return; btDone = true; $("#ufc-bt").innerHTML = '<p class="note">Loading the graded backtest…</p>';
    getJSON("ufc_backtest.json").then(bt => { bt = (bt || []).sort(bydate); if (bt.length) lab($("#ufc-bt"), bt, "ubt", "2021-2026"); else $("#ufc-bt").innerHTML = '<div class="banner"><b>Loading</b><span>Backtest file not published yet.</span></div>' }) };
  let liveDone = false; onShow.live = () => { if (liveDone) return; liveDone = true;
    Promise.all([getJSON("ufc_live.json"), getJSON("ufc_paper.json")]).then(([live, paper]) => {
      live = (live || []).filter(r => ["W", "L", "D", "NC", "Void"].includes(r.r)).sort(bydate);
      if (live.length) lab($("#ufc-live"), live, "ulv", "since Oct 2026");
      else getJSON("ufc_today.json").then(t => { const n = ((t && t.picks) || []).length; $("#ufc-live").innerHTML = `<div class="banner"><b>Boarding</b><span>No graded picks yet. The record starts with the first locked pick and grows after each event.${n ? ` ${n} pick${n > 1 ? "s are" : " is"} locked and waiting on the fight card.` : ""}</span></div>` });
      paper = (paper || []).sort(bydate).reverse(); const g = paper.filter(r => r.r === "W" || r.r === "L"), s = stats(g);
      $("#ufc-paper").innerHTML = `<h3>Paper tracked, not bet</h3><p class="note" style="font-size:14px;max-width:72ch">Over 4.5 rounds in 5-round fights, and submissions against opponents who have been submitted before. Graded at 1 unit for the record only.${g.length ? ` So far ${s.w}-${s.l}, ${fmtU(s.u)}.` : " Nothing graded yet."}</p>
        ${paper.length ? `<div class="tbl"><table class="log"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Fight</th><th>Price</th><th>Result</th><th>Units</th></tr></thead><tbody>${paper.slice(0, 40).map(r => `<tr><td class="mono">${r.d}</td><td class="l"><b>${esc(r.lab || r.pk)}</b></td><td class="l">${esc(r.op)}</td><td class="mono">${am(r.o)}</td><td>${r.r ? `<span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span>` : '<span class="tag small">Open</span>'}</td><td class="${sgn(r.u || 0)}">${r.r ? fmtU(r.u || 0) : "–"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
    }) };
  route(); if (onShow[cur]) onShow[cur]();

  Promise.all([getJSON("ufc_today.json"), getJSON("ufc_status.json"), getJSON("ufc_paper.json")]).then(([today, status, paper]) => {
    today = today || { events: [], picks: [] };
    const upd = today.updated ? new Date(today.updated.replace(" ", "T")) : null;
    const hrs = upd ? (Date.now() - upd.getTime()) / 3.6e6 : null;
    const fails = status ? Object.entries(status).filter(([k, v]) => v && v.ok === false).map(([k]) => k) : [];
    const color = hrs == null || hrs > 36 || fails.length ? "var(--loss)" : "var(--win)";
    $("#ufc-status").innerHTML = `<span><span class="dot" style="background:${color}"></span>Prices updated <b>${upd ? upd.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "not yet"}</b></span>
      ${hrs != null && hrs > 36 ? `<span><b>Stale:</b> the laptop run hasn't reported in ${Math.round(hrs)} hours</span>` : ""}${fails.length ? `<span><b>Last run had a problem:</b> ${esc(fails.join(", "))}</span>` : ""}<span>Runs 9 AM and 5 PM ET</span>`;
    const picks = (today.picks || []).slice().sort(bydate);
    const openPaper = (paper || []).filter(r => !r.r).sort(bydate);
    const evs = today.events || [];
    if (evs.length) $("#ufc-kicker").textContent = `Next up: ${dateTxt(evs[0].d)} · ${evs[0].ev}`;
    if (picks.length) {
      const by = {}; picks.forEach(r => { const t = TIER[tierOf(r)] || tierOf(r); by[t] = (by[t] || 0) + 1 });
      const units = picks.reduce((a, r) => a + (r.su || 1), 0), cards = new Set(picks.map(r => r.d)).size;
      $("#ufc-lede").innerHTML = `Take the listed price or better. Skip a pick if it has moved past its worst price.`;
      $("#ufc-summary").innerHTML = `<div class="slipsum"><span><b>${picks.length}</b> bet${picks.length === 1 ? "" : "s"}</span><span><b>${units % 1 ? units.toFixed(1) : units}u</b> at risk</span><span>${Object.entries(by).map(([k, v]) => `${v} ${esc(SHORT[k] || k.toLowerCase())}`).join(" · ")}</span><span>Tap a bet for the prices and why the model likes it.</span></div>`;
    } else $("#ufc-summary").innerHTML = "";
    // group open picks by event, like the college card groups by book
    const groups = new Map(); picks.forEach(p => { const k = `${p.d}|${p.ev || "UFC"}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p) });
    $("#ufc-picks").innerHTML = (picks.length
      ? `<div class="slip">${[...groups.entries()].map(([k, g]) => { const [d, ev] = k.split("|"); return `<div class="slip-ev"><h2>${esc(ev)}</h2><span class="note">${esc(dateTxt(d))} · ${g.length} bet${g.length > 1 ? "s" : ""} · ${g.reduce((a, r) => a + (r.su || 1), 0)}u</span></div>${g.map(r => betRow(r)).join("")}` }).join("")}</div>`
      : `<div class="banner"><b>No picks</b><span>Nothing on the upcoming cards clears the rule right now. Moneyline picks usually show up 1 to 3 weeks before an event, props about 3 days out.</span></div>`)
      + (openPaper.length ? `<details class="more" style="margin-top:14px"><summary>Paper tracked (${openPaper.length})<span>angles logged and graded for the record, never staked</span></summary><div class="inner"><div class="slip">${openPaper.map(r => betRow(r, true)).join("")}</div></div></details>` : "");
    $("#ufc-cards").innerHTML = evs.length ? evs.map(e => `<div class="panel"><div class="ev-head"><h2>${esc(e.ev)}</h2><span class="note">${esc(dateTxt(e.d))} · ${e.fights.length} fight${e.fights.length === 1 ? "" : "s"} with a line</span></div>
      <div class="fightcard">${e.fights.map(fightRow).join("")}</div></div>`).join("") + `<div class="legend"><span><i style="background:var(--cobalt)"></i>Red corner</span><span><i style="background:var(--coral)"></i>Blue corner</span><span><span class="tick"></span>Market's fair chance</span><span>Bars are the model blended with the market. "Fair" is the break-even price at that chance. Method splits are model-only, for reference. Under each fight: what the model weighs most for either side.</span></div>`
      : `<div class="banner"><b>Quiet</b><span>No UFC lines are posted for the next 45 days yet.</span></div>`;
  });
})();
