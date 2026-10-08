/* NFL tab for "Nothing Can Stop Us Now". Self-contained: mounts into #nfl, reuses the page's design tokens and
   classes, and reads nfl_today.json, nfl_live.json, nfl_backtest.json and nfl_status.json published beside the page.
   Those files are rewritten by the NFL receiving-props model's runs; this script never changes.
   Every pick is 1 unit. Posted picks stand. Books: DraftKings, FanDuel, Caesars. */
(function () {
  const root = document.getElementById("nfl");
  if (!root) return;
  const css = `
#nfl .ufc-views{display:grid;gap:22px}
#nfl .head-row{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-top:10px}
#nfl .status{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--ink2)}
#nfl .status b{color:var(--ink)}
#nfl .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}

/* ---- bet slip ---- */
#nfl .slip{display:grid;gap:12px}
#nfl .slip-ev{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:10px 0 0}
#nfl .slip-ev h2{font-size:20px;line-height:1.1}
#nfl .slip-ev .note{margin:0}
#nfl .slipsum{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:14px;color:var(--ink2);background:var(--panel);border:2px solid var(--ink);border-radius:var(--r);padding:12px 14px}
#nfl .slipsum b{font:400 26px/1 var(--display);color:var(--ink);margin-right:4px}
#nfl .slipsum .ghost{margin-left:auto}
#nfl .tbadge{display:inline-flex;align-items:center;gap:5px;font:800 10px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;padding:5px 8px;border-radius:999px;border:1.5px solid var(--ink);background:var(--panel2);color:var(--ink)}
#nfl .tbadge.ml{background:var(--cobalt);color:var(--cobalt-ink);border-color:var(--cobalt)}
#nfl .tbadge.fade{background:var(--sun);color:var(--sun-ink);border-color:var(--sun-ink)}
#nfl .tbadge.gtd{background:transparent;color:var(--coral-ink);border-color:var(--coral-ink)}
#nfl .tbadge.paper{background:transparent;border-style:dashed;color:var(--ink2);border-color:var(--ink2)}
#nfl details.bet{background:var(--panel);border:2px solid var(--ink);border-radius:12px;box-shadow:4px 4px 0 var(--ink)}
#nfl details.bet.paper{border-style:dashed;box-shadow:none}
#nfl details.bet>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;padding:12px 14px 10px}
#nfl details.bet>summary::-webkit-details-marker{display:none}
#nfl .bet .what{display:grid;gap:5px;min-width:0;justify-items:start;align-content:start}
#nfl .bet .what b{font:400 20px/1.08 var(--display);text-transform:uppercase;overflow-wrap:anywhere}
#nfl .bet.paper .what b{color:var(--ink2)}
#nfl .bet .sub{font-size:13px;color:var(--ink2);line-height:1.35}
#nfl .bet .px2{display:grid;justify-items:end;align-content:start;gap:4px;text-align:right;white-space:nowrap}
#nfl .bet .px2 b{font:500 24px/1 var(--mono);color:var(--ink)}
#nfl .pubsplit{font-size:12.5px;color:var(--ink2);margin:8px 0 2px}
#nfl .pubsplit b{color:var(--ink)}
#nfl .side .px.pub{opacity:.85}
#nfl .bet .px2 span{font:700 12px/1.2 var(--body);color:var(--ink2)}
#nfl .bet .line{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:12.5px;color:var(--ink2);padding-top:9px;border-top:1px dashed var(--line)}
#nfl .bet .floor{font:700 12.5px/1.2 var(--body);color:var(--ink);background:var(--panel2);border-radius:999px;padding:5px 10px}
#nfl .bet .floor.warn{background:color-mix(in srgb,var(--loss) 14%,var(--panel));color:var(--loss)}
#nfl .bet .tog{margin-left:auto;font:800 11px/1 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--cobalt);display:inline-flex;align-items:center;gap:6px}
#nfl .bet .tog::after{content:"+";display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;border:2px solid currentColor;font-size:13px}
#nfl details.bet[open] .tog::after{content:"−"}
#nfl details.bet[open] .tog .t1,#nfl details.bet:not([open]) .tog .t2{display:none}
#nfl .bet .body{padding:4px 14px 14px;display:grid;gap:14px}
#nfl .pricegrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;background:var(--panel2);border-radius:10px;padding:9px 11px}
#nfl .pricegrid div{display:grid;gap:2px;min-width:0}
#nfl .pricegrid small,#nfl .booksnow small,#nfl .subh{font:800 9.5px/1.1 var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#nfl .pricegrid b{font-family:var(--mono);font-size:14px;font-weight:500;color:var(--ink);white-space:nowrap}
#nfl .pricegrid b.pos{color:var(--win)}
#nfl .pricegrid span{font-size:11px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#nfl .booksnow{display:grid;gap:6px}
#nfl .booksnow .bk3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
#nfl .booksnow .bk3>div{border:1.5px solid var(--line);border-radius:10px;padding:8px 10px;display:grid;gap:2px;min-width:0}
#nfl .booksnow .bk3>div.ok{border-color:var(--win)}
#nfl .booksnow .bk3>div.mine{box-shadow:inset 0 0 0 1.5px var(--win)}
#nfl .booksnow b{font:500 15px/1.1 var(--mono);color:var(--ink)}
#nfl .booksnow span{font-size:11px;color:var(--ink2)}
#nfl .booksnow .ok span{color:var(--win);font-weight:700}
#nfl .booksnow .past span{color:var(--loss);font-weight:700}
#nfl .why{display:grid;gap:4px}
#nfl .why h4{margin:0 0 2px;font:800 10.5px/1 var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--ink2);display:flex;justify-content:space-between;gap:8px}
#nfl .why h4 span{font-weight:600;letter-spacing:0;text-transform:none;font-size:11.5px}
#nfl .why .row{display:grid;grid-template-columns:minmax(0,1fr) 120px 40px;gap:8px;align-items:center;font-size:12.5px;line-height:1.3}
#nfl .why .lbl{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#nfl .why .lbl small{color:var(--ink2);font-size:11px;font-family:var(--mono);margin-left:5px}
#nfl .why .bar{position:relative;height:10px;background:var(--panel2);border-radius:3px}
#nfl .why .bar::before{content:"";position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--ink2);opacity:.6}
#nfl .why .bar i{position:absolute;top:0;bottom:0;background:var(--win);border-radius:0 4px 4px 0;left:50%}
#nfl .why .bar i.neg{background:var(--loss);border-radius:4px 0 0 4px;left:auto;right:50%}
#nfl .why .val{font-family:var(--mono);font-size:12px;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
#nfl .why .foot{font-size:11.5px;color:var(--ink2);margin-top:3px}
#nfl .why .foot b{color:var(--ink);font-weight:700}
#nfl .teaser{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;border:2px dashed var(--ink);border-radius:var(--r);background:var(--panel);padding:12px 14px;font-size:13.5px;color:var(--ink2)}
#nfl .teaser b{color:var(--ink)}
#nfl .teaser .big{font:400 22px/1 var(--display);color:var(--ink)}
#nfl .teaser .ghost{margin-left:auto}

/* ---- full card ---- */
#nfl .fightcard{display:grid;gap:0}
#nfl .fight{display:grid;grid-template-columns:minmax(0,1fr) minmax(200px,260px) minmax(0,1fr);gap:8px 14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
#nfl .fight:last-child{border-bottom:0;padding-bottom:4px}
#nfl .fight.has-pick{background:linear-gradient(90deg,color-mix(in srgb,var(--sun) 22%,transparent),transparent 40%,transparent 60%,color-mix(in srgb,var(--sun) 22%,transparent));margin-inline:-16px;padding-inline:16px;border-radius:10px}
#nfl .side{display:grid;gap:3px;min-width:0;align-content:start}
#nfl .side.b{text-align:right;justify-items:end}
#nfl .side .nm{font-weight:800;font-size:15.5px;line-height:1.2;overflow-wrap:anywhere;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#nfl .side.b .nm{justify-content:flex-end}
#nfl .side .px{font-family:var(--mono);font-size:12px;color:var(--ink2);white-space:nowrap}
#nfl .side .px b{color:var(--ink);font-weight:500}
#nfl .side.pick .nm{color:var(--cobalt)}
#nfl .mid{display:grid;justify-items:stretch;gap:5px;min-width:0}
#nfl .pv{display:flex;justify-content:space-between;font:800 13px/1 var(--body);font-variant-numeric:tabular-nums}
#nfl .pv .ma{color:var(--cobalt)} #nfl .pv .mb{color:var(--coral-ink)}
#nfl .pbar{position:relative;display:flex;height:12px;border-radius:6px;overflow:visible;border:1.5px solid var(--ink);background:var(--panel2)}
#nfl .pbar i{display:block;height:100%}
#nfl .pbar i.a{background:var(--cobalt);border-radius:4px 0 0 4px}
#nfl .pbar i.b{background:var(--coral);border-radius:0 4px 4px 0;margin-left:2px}
#nfl .pbar .mk{position:absolute;top:-6px;bottom:-6px;width:2px;background:var(--ink);transform:translateX(-50%)}
#nfl .pbar .mk::after{content:"";position:absolute;left:50%;top:-4px;width:0;height:0;border:4px solid transparent;border-top-color:var(--ink);transform:translateX(-50%)}
#nfl .mid small{font:700 10px/1.3 var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);text-align:center;display:flex;flex-wrap:wrap;justify-content:center;gap:4px}
#nfl .meth{display:flex;justify-content:center;gap:4px 10px;flex-wrap:wrap;font-size:11.5px;color:var(--ink2);text-align:center}
#nfl .meth b{color:var(--ink);font-weight:700}
#nfl .lean{grid-column:1 / -1;display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:12px;color:var(--ink2);margin-top:-4px}
#nfl .lean div{min-width:0;display:flex;gap:6px;align-items:baseline}
#nfl .lean div:last-child{text-align:right;justify-content:flex-end}
#nfl .lean b{flex:none;font-weight:800;color:var(--ink)}
#nfl .lean .dot{width:8px;height:8px;margin:0;flex:none;align-self:center}
#nfl .lean span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#nfl .badge{display:inline-block;font:800 10px/1 var(--body);letter-spacing:.1em;text-transform:uppercase;background:var(--sun);color:var(--sun-ink);padding:4px 6px;border-radius:999px;border:1.5px solid var(--ink)}
#nfl .badge.watch{background:var(--panel);color:var(--ink2);border-style:dashed;border-color:var(--ink2)}
#nfl .legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--ink2);align-items:center}
#nfl .legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:5px}
#nfl .legend .tick{display:inline-block;width:2px;height:12px;background:var(--ink);vertical-align:-2px;margin-right:7px}
#nfl details.more{border:2px solid var(--line);border-radius:12px;background:var(--panel)}
#nfl details.more>summary{cursor:pointer;list-style:none;padding:14px 16px;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font:800 13px/1.2 var(--body);letter-spacing:.06em;text-transform:uppercase}
#nfl details.more>summary::-webkit-details-marker{display:none}
#nfl details.more>summary::before{content:"+";display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--coral);color:#fff;flex:none}
#nfl details.more[open]>summary::before{content:"−"}
#nfl details.more>summary span{font:500 12.5px/1.3 var(--body);letter-spacing:0;text-transform:none;color:var(--ink2)}
#nfl details.more>.inner{padding:0 16px 16px;display:grid;gap:18px}
#nfl .sec-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin-top:6px}
#nfl .sec-h .note{margin:0}

/* ---- live: card by card ---- */
#nfl .cards-tbl td b{font-weight:800}

@media (max-width:640px){
  #nfl .fight{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 10px;padding:14px 0}
  #nfl .fight.has-pick{margin-inline:-10px;padding-inline:10px;background:color-mix(in srgb,var(--sun) 16%,transparent)}
  #nfl .mid{order:-1;grid-column:1 / -1}
  #nfl .side .nm{font-size:14.5px} #nfl .side .px{font-size:11.5px;white-space:normal}
  #nfl .lean{grid-template-columns:1fr;gap:3px} #nfl .lean div:last-child{text-align:left;justify-content:flex-start}
  #nfl .pricegrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px}
  #nfl .why .row{grid-template-columns:minmax(0,1fr) 72px 36px;font-size:12px}
  #nfl details.bet>summary{padding:11px 12px 9px}
  #nfl .bet .what b{font-size:18px} #nfl .bet .px2 b{font-size:21px}
  #nfl .bet .body{padding:2px 12px 12px}
  #nfl details.more>.inner{padding:0 10px 12px}
  #nfl .slipsum{padding:10px 12px;gap:6px 14px} #nfl .slipsum b{font-size:22px}
  #nfl .lu-proj b{font-size:26px}
  #nfl table.pool .c-fin,#nfl table.pool .c-ml,#nfl table.pool .c-rng{display:none}
  #nfl table.pool th,#nfl table.pool td{padding-inline:4px;font-size:13px}
  #nfl table.pool th{font-size:10px;letter-spacing:.06em}
  #nfl table.pool td.nm{min-width:0;max-width:128px;padding-left:6px}
  #nfl table.pool td.nm b{font-size:13.5px}
  #nfl table.pool .sl{display:none} #nfl table.pool .ss{display:inline}
  #nfl .poolp{padding-inline:10px}
  #nfl .booksnow b{font-size:14px}
}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const $ = s => root.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtU = v => (v > 0 ? "+" : "") + v.toFixed(1) + "u";
  const pct = v => (v * 100).toFixed(1) + "%";
  const pct0 = v => v == null ? "–" : Math.round(v * 100) + "%";
  const sgn = v => v > 0 ? "pos" : (v < 0 ? "neg" : "");
  const am = o => o == null ? "–" : (o > 0 ? "+" + o : String(o));
  const toDec = o => o == null ? null : (o > 0 ? 1 + o / 100 : 1 + 100 / -o);
  const fair = p => { if (!p) return null; const d = 1 / p; return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)) };
  const BOOK = { draftkings: "DraftKings", fanduel: "FanDuel", betmgm: "BetMGM", williamhill_us: "Caesars", betrivers: "BetRivers", espnbet: "ESPN Bet", fanatics: "Fanatics" };
  const MKT = { rec: "Receptions", yds: "Receiving yards", td: "Anytime TD" };
  const POS = { WR: "Wide receivers", TE: "Tight ends", RB: "Running backs" };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateTxt = d => { const x = new Date(String(d).slice(0, 10) + "T12:00:00"); if (isNaN(x)) return ""; return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getDay()] + ", " + MON[x.getMonth()] + " " + x.getDate() };
  const kickTxt = k => { if (!k) return ""; const [h, m] = k.split(":").map(Number); return ((h + 11) % 12 + 1) + ":" + String(m).padStart(2, "0") + (h >= 12 ? " PM" : " AM") + " ET" };
  const BAR = 0.02;                                   // a pick stops being a bet once its edge falls under 2 pts
  const minPrice = p => fair(p - BAR);
  function copyText(t, btn, label) {
    const done = ok => { btn.textContent = ok ? "Copied" : "Copy failed"; setTimeout(() => btn.textContent = label, 1800) };
    const fb = () => { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand("copy") } catch (e) { } a.remove(); return ok };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(() => done(true), () => done(fb())); else done(fb());
  }

  const lineB = r => r.mk === "td" ? "Anytime TD" : r.mk === "rec" ? (r.ln <= 2.5 ? "2.5 or less" : r.ln <= 3.5 ? "3.5" : r.ln <= 4.5 ? "4.5" : "5.5+") : (r.ln < 25 ? "Under 25" : r.ln < 45 ? "25-44.5" : r.ln < 60 ? "45-59.5" : "60+");
  const DIMS = {
    sec: { n: "Section", f: r => r.sec === "td" ? "Anytime TD section" : "Main card", order: ["Main card", "Anytime TD section"] },
    mk: { n: "Market", f: r => MKT[r.mk] || r.mk, order: ["Receptions", "Receiving yards", "Anytime TD"] },
    slate: { n: "Slate", f: r => r.slate, order: ["Sunday day", "Primetime"] },
    pos: { n: "Position", f: r => POS[r.pos] || r.pos, order: ["Wide receivers", "Tight ends", "Running backs"] },
    tier: { n: "Tier", f: r => r.tier ? "Tier " + r.tier : "–", order: ["Tier A", "Tier B", "Tier C"] },
    season: { n: "Season", f: r => String(r.ses) },
    edge: { n: "Edge", f: r => r.e == null ? "–" : r.e < 4 ? "2-4 pts" : r.e < 6 ? "4-6 pts" : r.e < 10 ? "6-10 pts" : "10+ pts", order: ["2-4 pts", "4-6 pts", "6-10 pts", "10+ pts"] },
    price: { n: "Price", f: r => r.o <= -150 ? "-150 or shorter" : r.o <= -120 ? "-149 to -120" : r.o < 100 ? "-119 to -101" : r.o <= 130 ? "+100 to +130" : r.o <= 200 ? "+131 to +200" : r.o <= 300 ? "+201 to +300" : "+301 to +400", order: ["-150 or shorter", "-149 to -120", "-119 to -101", "+100 to +130", "+131 to +200", "+201 to +300", "+301 to +400"] },
    line: { n: "Line", f: lineB, order: ["2.5 or less", "3.5", "4.5", "5.5+", "Under 25", "25-44.5", "45-59.5", "60+", "Anytime TD"] },
    book: { n: "Book", f: r => BOOK[r.bk] || r.bk },
    ha: { n: "Home / away", f: r => String(r.op || "").startsWith("at ") ? "Away" : "Home", order: ["Home", "Away"] },
    phase: { n: "Season phase", f: r => r.wk <= 6 ? "Weeks 1-6" : r.wk <= 12 ? "Weeks 7-12" : r.wk <= 18 ? "Weeks 13-18" : "Playoffs", order: ["Weeks 1-6", "Weeks 7-12", "Weeks 13-18", "Playoffs"] },
    clv: { n: "Vs closing line", f: r => r.clv == null ? "No close" : r.clv > 0 ? "Beat the close" : "Worse than close", order: ["Beat the close", "Worse than close", "No close"] },
    month: { n: "Month", f: r => MON[+r.d.slice(5, 7) - 1], order: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"] },
  };
  const FILTERS = ["sec", "mk", "slate", "pos", "tier", "season", "edge", "price", "line", "ha", "phase", "book"];

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
    let s = "", prev = null; rows.forEach((r, i) => { const yr = String(r.ses || r.d.slice(0, 4)); if (yr !== prev) { s += `<line x1="${x(i)}" x2="${x(i)}" y1="${T - 10}" y2="${H - B}" stroke="var(--line)"/><text x="${x(i) + 4}" y="${H - B + 19}" font-size="${fs}" font-weight="700" fill="var(--ink2)">${nar ? yr.slice(2) : yr}</text>`; prev = yr } });
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
     <g transform="translate(${end[0].toFixed(1)} ${end[1].toFixed(1)}) rotate(${ang.toFixed(1)})"><rect x="-24" y="-14" width="24" height="10" rx="3" fill="var(--coral)" stroke="var(--ink)" stroke-width="2"/><circle cx="-19" cy="-2" r="2.6" fill="var(--ink)"/><circle cx="-5" cy="-2" r="2.6" fill="var(--ink)"/><ellipse cx="-12" cy="-19" rx="6.5" ry="4.6" fill="#8C4A26" stroke="var(--ink)" stroke-width="1.6"/></g>
     <text x="${(end[0] - 8).toFixed(1)}" y="${Math.max(16, end[1] - 30).toFixed(1)}" text-anchor="end" font-size="${nar ? 14 : 15}" font-weight="800" fill="var(--ink)">${fmtU(last)}</text></svg>`;
  }

  function kpis(el, s, label) {
    el.innerHTML = `<div><small>Bets</small><b>${s.n.toLocaleString()}</b><span>${label}</span></div><div><small>Record</small><b>${s.w}-${s.l}</b><span>${pct(s.wp)} win rate${s.v ? ` · ${s.v} push/void` : ""}</span></div>
     <div><small>Units</small><b class="${s.u >= 0 ? "pos" : "neg"}">${fmtU(s.u)}</b><span>${s.u >= 0 ? "+" : "−"}$${Math.abs(Math.round(s.u * 100)).toLocaleString()} at $100/unit</span></div>
     <div><small>ROI</small><b class="${s.roi >= 0 ? "pos" : "neg"}">${s.roi >= 0 ? "+" : ""}${(s.roi * 100).toFixed(1)}%</b><span>per unit risked</span></div><div><small>Vs close</small><b>${clvTxt(s.clv)}</b><span>EV at the closing price</span></div>`;
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
    <div class="panel"><div class="lab-head"><h2>Bet log</h2><label class="f" for="${idp}-q">Player<input id="${idp}-q" type="search" placeholder="Search a player or team"></label></div><div class="tbl" id="${idp}-log"></div></div>`;
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
        return `<table class="heat"><thead><tr><th class="l">${esc(DIMS[A].n)} ↓ · ${esc(DIMS[Bd].n)} →</th>${cb.map(c => `<th style="text-align:center">${esc(c)}</th>`).join("")}</tr></thead><tbody>${ra.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td>${cb.map(c => cell(v.filter(r => DIMS[Bd].f(r) === c))).join("")}</tr>`).join("")}</tbody></table><p class="note">Each cell: ROI, then bets and win rate. Green is profitable, red is losing; deeper color means bigger ROI. Unders are often priced -120 or shorter, so read ROI before win rate.</p>`;
      }
      if (heat && !Bd) return '<p class="note">Pick a second slice under "Then by" to see the heatmap.</p>';
      const g = groupBy(rows, A); let max = 1;
      const blocks = g.map(([k, v]) => { const s = stats(v); max = Math.max(max, Math.abs(s.u)); const subs = Bd ? groupBy(v, Bd).map(([k2, v2]) => { const s2 = stats(v2); max = Math.max(max, Math.abs(s2.u)); return [k2, s2] }) : []; return [k, s, subs] });
      return `<table><thead><tr><th>${esc(DIMS[A].n)}</th><th>Bets</th><th>W-L</th><th>Win%</th><th>Units</th><th>ROI</th><th title="Average fair closing probability times price taken, minus 1 (includes the vig)">CLV</th><th></th></tr></thead><tbody>${blocks.map(([k, s, subs]) => row(k, s, max) + subs.map(([k2, s2]) => row(k2, s2, max, "sub")).join("")).join("")}${row("All filtered bets", stats(rows), max, "tot")}</tbody></table>`;
    }
    function log(rows) {
      const qq = q.value.trim().toLowerCase(); const f = rows.filter(r => !qq || String(r.pk).toLowerCase().includes(qq) || String(r.gm).toLowerCase().includes(qq)).slice().reverse();
      const PER = 30, pages = Math.max(1, Math.ceil(f.length / PER)); page = Math.min(page, pages - 1); const v = f.slice(page * PER, page * PER + PER);
      $(`#${idp}-log`).innerHTML = `<table class="log"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Game</th><th>Price</th><th class="l">Book</th><th>Model</th><th>Edge</th><th class="l">Actual</th><th>Result</th><th>Units</th></tr></thead><tbody>${v.map(r => `<tr><td class="mono">${r.d}</td><td class="l"><b>${esc(r.pk)} · ${esc(r.lab)}</b></td><td class="l">${esc(r.gm)}</td><td class="mono">${am(r.o)}</td><td class="l">${esc(BOOK[r.bk] || r.bk)}</td><td>${pct(r.p)}</td><td>${r.e != null ? r.e.toFixed(1) : "–"}</td><td class="l">${r.act == null ? "–" : r.mk === "td" ? (r.act > 0 ? "Scored" : "No TD") : r.act}</td><td><span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span></td><td class="${sgn(r.u)}">${fmtU(r.u)}</td></tr>`).join("")}</tbody></table>
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
    vh.onclick = () => { heat = true; vh.setAttribute("aria-pressed", "true"); vt.setAttribute("aria-pressed", "false"); if (!b.value) b.value = a.value === "season" ? "mk" : "season"; draw() };
    let nar = innerWidth < 600; addEventListener("resize", () => { const n2 = innerWidth < 600; if (n2 !== nar) { nar = n2; coaster($(`#${idp}-chart`), filtered()) } });
    draw();
  }

  // ---------------------------------------------------------------- bets
  function whyChart(w, r) {
    if (!w || !w.length) return "";
    const max = Math.max(1, ...w.map(x => Math.abs(x.pts)));
    const rows = w.map(x => { const wd = Math.abs(x.pts) / max * 50; return `<div class="row"><div class="lbl" title="${esc(x.label)}${x.v ? " · " + esc(x.v) : ""}">${esc(x.label)}${x.v ? `<small>${esc(x.v)}</small>` : ""}</div><div class="bar" aria-hidden="true"><i style="width:${wd.toFixed(1)}%"></i></div><div class="val pos">${x.pts > 0 ? "+" : ""}${x.pts.toFixed(0)}%</div></div>` }).join("");
    let foot = `Model + market blend <b>${pct0(r.p)}</b>`;
    if (r.m != null) foot += ` · Market <b>${pct0(r.m)}</b>`;
    foot += ` · Break-even at the price <b>${pct0(1 / r.dec)}</b>`;
    return `<div class="why" role="img" aria-label="Main reasons: ${esc(w.map(x => x.label).join(", "))}"><h4>Why the model likes it<span>push on the projection, toward the pick</span></h4>${rows}<div class="foot">${foot}</div></div>`;
  }
  function betRow(r) {
    const worst = r.p ? minPrice(r.p) : null;
    const badge = `<span class="tbadge ${r.mk === "td" ? "fade" : r.tier === "A" ? "ml" : ""}">${esc(MKT[r.mk])}${r.tier ? " · Tier " + esc(r.tier) : ""}</span>`;
    const sub = `${esc(r.pos)} · ${esc(r.tm)} ${esc(r.op)} · ${esc(dateTxt(r.d))}${r.kick ? " " + esc(kickTxt(r.kick)) : ""}`;
    let line = "";
    if (r.r) line += `<span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${r.r === "W" ? "Won" : r.r === "L" ? "Lost" : r.r === "P" ? "Push" : esc(r.r)}${r.act != null ? " · " + (r.mk === "td" ? (r.act > 0 ? "scored" : "no TD") : r.act + (r.mk === "rec" ? " rec" : " yds")) : ""}</span>`;
    else if (worst != null) line += `<span class="floor">Take ${am(worst)} or better</span>`;
    if (r.e != null) line += `<span>Edge <b style="color:var(--win)">+${r.e.toFixed(1)}</b> pts</span>`;
    return `<details class="bet"><summary>
      <span class="what">${badge}<b>${esc(r.pk)} ${esc(r.mk === "td" ? "anytime TD" : r.sd + " " + r.ln)}</b><span class="sub">${r.mk === "td" ? "" : esc(MKT[r.mk].toLowerCase()) + " · "}${sub}</span></span>
      <span class="px2"><b>${am(r.o)}</b><span>${esc(BOOK[r.bk] || r.bk)}</span></span>
      <span class="line">${line}<span class="tog"><span class="t1">Details</span><span class="t2">Hide</span></span></span>
    </summary><div class="body">
      <div class="pricegrid"><div><small>Bet at</small><b>${am(r.o)}</b><span>${esc(BOOK[r.bk] || r.bk)}</span></div>
        <div><small>Fair</small><b>${r.p ? am(fair(r.p)) : "–"}</b><span>${r.p ? pct0(r.p) + " to win" : ""}</span></div>
        <div><small>Edge</small><b class="${(r.e || 0) > 0 ? "pos" : ""}">${r.e != null ? "+" + r.e.toFixed(1) : "–"}</b><span>pts over the market</span></div>
        <div><small>Market</small><b>${r.m != null ? am(fair(r.m)) : "–"}</b><span>${r.m != null ? pct0(r.m) + " no-vig" : ""}</span></div>
        <div><small>Worst price</small><b>${worst != null ? am(worst) : "–"}</b><span>still a bet</span></div></div>
      ${whyChart(r.why, r)}
      <p class="note">${esc(r.gm)}${r.posted ? ` · posted ${esc(r.posted)} ET` : ""} · 1 unit · posted picks stand and are graded at this price, even if the line moves</p></div></details>`;
  }

  // ---------------------------------------------------------------- live: week by week
  function byWeek(el, rows) {
    const g = new Map(); rows.forEach(r => { const k = r.ses + "|" + String(r.wk).padStart(2, "0"); if (!g.has(k)) g.set(k, []); g.get(k).push(r) });
    const ks = [...g.keys()].sort().reverse(), tot = stats(rows);
    el.innerHTML = `<div class="lab-head"><h2>Week by week</h2><span class="note">1 unit a bet, graded at the posted price</span></div>
      <div class="tbl"><table class="cards-tbl"><thead><tr><th class="l">Week</th><th>Bets</th><th>W-L</th><th>Units</th></tr></thead><tbody>
      ${ks.map(k => { const [s, w] = k.split("|"), s2 = stats(g.get(k)); return `<tr><td class="l" style="white-space:normal"><b>${esc(s)} Week ${+w}</b><br><span class="note">${g.get(k).map(r => esc(r.pk.split(" ").slice(-1)[0] + " " + (r.mk === "td" ? "TD" : (r.sd === "under" ? "u" : "o") + r.ln + (r.mk === "rec" ? " rec" : " yds"))) + " " + esc(r.r)).join(", ")}</span></td><td>${s2.n + s2.v}</td><td class="mono">${s2.w}-${s2.l}</td><td class="${sgn(s2.u)}"><b>${fmtU(s2.u)}</b></td></tr>` }).join("")}
      ${ks.length > 1 ? `<tr class="tot"><td>All weeks</td><td>${tot.n + tot.v}</td><td class="mono">${tot.w}-${tot.l}</td><td class="${sgn(tot.u)}">${fmtU(tot.u)}</td></tr>` : ""}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------- slate projections
  function gameBlock(gm, picks) {
    const np = picks.filter(p => p.gm === gm.gm).length;
    return `<details class="more"><summary>${esc(gm.gm)}<span>${esc(dateTxt(gm.d))} ${esc(kickTxt(gm.kick))}${gm.prime ? " · standalone" : ""}${gm.lock && !np ? ` · locks ${esc(gm.lock)}` : ""}${np ? ` · ${np} pick${np > 1 ? "s" : ""}` : ""}</span></summary><div class="inner"><div class="tbl"><table><thead><tr><th class="l">Player</th><th>Pos</th><th>Team</th><th>Proj. rec</th><th>Proj. yds</th><th>Anytime TD</th></tr></thead><tbody>
      ${gm.players.map(p => `<tr><td class="l"><b>${esc(p.n)}</b></td><td>${esc(p.pos)}</td><td>${esc(p.tm)}</td><td class="mono">${p.rec.toFixed(1)}</td><td class="mono">${p.yds.toFixed(1)}</td><td class="mono">${pct0(p.td)} <span class="note">(${am(fair(p.td))})</span></td></tr>`).join("")}</tbody></table></div></div></details>`;
  }

  const M = x => `<div class="mbox"><math display="block">${x}</math></div>`;
  root.innerHTML = `
  <nav class="stops" role="tablist" aria-label="NFL sections">
    <button role="tab" data-nv="today" aria-selected="true"><i>1</i>This week</button>
    <button role="tab" data-nv="live" aria-selected="false" tabindex="-1"><i>2</i>2026 live</button>
    <button role="tab" data-nv="backtest" aria-selected="false" tabindex="-1"><i>3</i>Backtest</button>
    <button role="tab" data-nv="how" aria-selected="false" tabindex="-1"><i>4</i>How it works</button>
    <button role="tab" data-nv="hood" aria-selected="false" tabindex="-1"><i>5</i>Under the hood</button>
  </nav>

  <section class="view" data-nview="today">
    <div><div class="kicker" id="nfl-kicker">NFL · receiving props</div><h1>Under <em>the</em> lights</h1>
      <p class="lede" id="nfl-lede">Receptions, receiving yards and anytime TDs for WRs, TEs and RBs. Every pick is 1 unit. Take the listed price or better. Posted picks stand and are graded at the price they locked.</p>
      <div class="head-row"><div class="status" id="nfl-status"></div></div></div>
    <div id="nfl-picks"></div>
    <div id="nfl-slate" class="ufc-views"></div>
  </section>

  <section class="view" data-nview="live" hidden>
    <div><div class="kicker">Since October 2026 · real picks only</div><h1>2026 <em>live</em></h1>
      <p class="lede">Every pick posted here, graded at the book and price shown when it locked, 1 unit each. Nothing from the backtest is mixed in.</p></div>
    <div class="panel" id="nfl-live-weeks" hidden></div>
    <div id="nfl-live" class="ufc-views"></div>
  </section>

  <section class="view" data-nview="backtest" hidden>
    <div><div class="kicker">Out-of-sample backtest · 2023 to 2025</div><h1>The <em>ride</em> so far</h1>
      <p class="lede">Every week was predicted by models trained only on earlier weeks, then priced at the real sportsbook lines posted about 80 minutes before kickoff (just after inactives), taking only prices from DraftKings, FanDuel and Caesars (every book still counts toward the market's fair price). The card rule is the live one: the 8 biggest edges on the Sunday afternoon slate plus the single best pick in every other game, one pick per player, 1 unit each. The anytime-TD section is separate: every TD yes with 5+% EV at +400 or shorter. Both are included below; use the Section filter to see either on its own. Simulated results, not a live record.</p>
      <div class="panel flat prose" style="margin-top:12px"><h3>Realistic live returns</h3><p><b>Card:</b> the card's shape (blend weight, bet sides, card size) was chosen on 2023-24 and checked on 2025, which came in around +9.5% (+10% across 2023-25) taking only DraftKings, FanDuel and Caesars prices. The model is trained on real game-day inactives, but the backtest only gets what a live run knows about 80 minutes before kickoff. Some feature choices also used these seasons, and part of the under edge comes from books leaning overs more each year, so expect less live: roughly <b>+2% to +7%</b>, about +10u to +35u over a 500-pick season, with a real chance of a losing year. The closing line is a weak yardstick for props (it barely moves after inactives), so the live record is what counts.</p><p><b>Anytime TD section:</b> 156 bets over 2023-25 at an average of about +240, +45% (2023-24 +55%, 2025 +30%). The model is honest up to +400 and too optimistic past it, so longer shots are skipped. At these odds one bet swings about 2 units and the sample is small: the true rate could be anywhere from flat to +40%. Expect roughly <b>3 TD plays a week</b> with big swings either way.</p></div></div>
    <div id="nfl-bt" class="ufc-views"></div>
  </section>

  <section class="view" data-nview="how" hidden>
    <div><div class="kicker">The theory</div><h1>Bet the <em>under</em> on the <em>right</em> guys.</h1>
      <p class="lede">Prop books shade overs, because that's what the public bets: across 2024-25 their no-vig over price ran 3 to 4 points too high. Blindly betting every under only breaks even, though. The edge is in which players: the model finds the unders where usage, role and matchup point lower than the line.</p></div>
    <div class="ridemap">
      <div class="panel stop"><h3>Every snap since 2018</h3><p>nflverse play-by-play, snap counts, injury reports, weekly rosters, depth charts, Next Gen Stats, FTN charting and kickoff weather: about 50,000 player-games, every input built from games before the one being priced.</p></div>
      <div class="panel stop"><h3>Who's actually playing</h3><p>The biggest lever. Who is active today, each player's rank among active teammates, depth-chart order, and how his share has moved in past games when a teammate sat. When a WR1 or RB1 is out, the next man up gets priced, not averaged.</p></div>
      <div class="panel stop"><h3>Three models</h3><p>Receptions: targets × catch rate and a form-anchored count model, with spread that grows with volume. Yards: a Tweedie mean, a calibrated yards distribution and direct over/under classifiers. TDs: separate rushing and receiving TD models plus a goal-line structural model, so RBs get their carries counted.</p></div>
      <div class="panel stop"><h3>Market blend</h3><p>No model is bet raw. Each is blended with the books' no-vig price on the logit scale, 60% market and 40% model for the card. On their own the models lose to the books on receptions and yards; blended, they beat the books in all three markets.</p></div>
      <div class="panel stop"><h3>The card, and the TD section</h3><p>The card: only unders on receptions and yards (overs lost money in every season tested). Two-sided markets only. Rank by edge over the market: 8 picks shared across the Sunday afternoon slate (1 PM and 4 PM games), the single best pick in every other game (TNF, SNF, MNF, Saturday, London), one pick per player, at most 2 per game. Anytime TDs are a separate section with their own record: every TD yes the model prices at 5+% EV, at +400 or shorter, because the model overrates longer shots.</p></div>
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
    <div class="panel flat prose"><h3>What to expect live</h3><p>About 10 picks a week. Unders are usually juiced (-115 to -140), so the win rate needs to be in the mid-50s to profit. Variance is real: 5-week stretches below .500 are normal even with a true edge. If the books stop shading overs, the under edge shrinks; the model tracks that lean every week.</p></div>
  </section>

  <section class="view" data-nview="hood" hidden>
    <div><div class="kicker">Under the hood · model specification</div><h1>The <em>engine</em> room</h1>
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
    </div>
  </section>`;

  // ---------------------------------------------------------------- routing (#nfl, #nfl-live, ...)
  const VIEWS = ["today", "live", "backtest", "how", "hood"], onShow = {};
  let cur = "today";
  function show(v, push) {
    cur = v;
    root.querySelectorAll("nav.stops button").forEach(b => { const on = b.dataset.nv === v; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && push) b.scrollIntoView({ block: "nearest", inline: "nearest" }) });
    root.querySelectorAll("[data-nview]").forEach(s => s.hidden = s.dataset.nview !== v);
    if (push) history.replaceState(null, "", v === "today" ? "#nfl" : "#nfl-" + v);
    if (onShow[v]) onShow[v]();
  }
  const tl = root.querySelector("nav.stops");
  tl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => show(b.dataset.nv, true)));
  tl.addEventListener("keydown", e => { const t = [...tl.querySelectorAll('[role="tab"]')], i = t.indexOf(document.activeElement); if (i < 0) return;
    const j = e.key === "ArrowRight" ? (i + 1) % t.length : e.key === "ArrowLeft" ? (i - 1 + t.length) % t.length : e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : -1; if (j < 0) return; e.preventDefault(); t[j].focus(); t[j].click() });
  function route() {
    const h = (location.hash || "").slice(1);
    if (h === "nfl" || h.startsWith("nfl-")) {
      document.querySelectorAll(".seg button").forEach(b => { const on = b.dataset.model === "nfl"; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1 });
      ["ncaab", "ufc", "cfb"].forEach(id => { const x = document.getElementById(id); if (x) x.hidden = true }); root.hidden = false;
      const v = h.slice(4); show(VIEWS.includes(v) ? v : "today");
    }
  }
  addEventListener("hashchange", route);

  // ---------------------------------------------------------------- data
  const getJSON = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const bydate = (a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.kick || "") < (b.kick || "") ? -1 : 1;
  let btDone = false; onShow.backtest = () => { if (btDone) return; btDone = true; $("#nfl-bt").innerHTML = '<p class="note">Loading the graded backtest…</p>';
    getJSON("nfl_backtest.json").then(bt => { bt = (bt || []).filter(r => r.r === "W" || r.r === "L" || r.r === "P").sort(bydate); if (bt.length) lab($("#nfl-bt"), bt, "nbt", "2023-2025"); else $("#nfl-bt").innerHTML = '<div class="banner"><b>Loading</b><span>Backtest file not published yet.</span></div>' }) };
  let liveDone = false; onShow.live = () => { if (liveDone) return; liveDone = true;
    getJSON("nfl_live.json").then(live => {
      live = (live || []).filter(r => ["W", "L", "P", "Void"].includes(r.r)).sort(bydate);
      if (live.length) { const lw = $("#nfl-live-weeks"); lw.hidden = false; byWeek(lw, live); lab($("#nfl-live"), live, "nlv", "since Oct 2026") }
      else getJSON("nfl_today.json").then(t => { const n = ((t && t.picks) || []).length; $("#nfl-live").innerHTML = `<div class="banner"><b>Boarding</b><span>No graded picks yet. The record starts with the first posted card and grows every week.${n ? ` ${n} pick${n > 1 ? "s are" : " is"} posted and waiting on kickoff.` : ""}</span></div>` });
    }) };
  route(); if (onShow[cur]) onShow[cur]();

  Promise.all([getJSON("nfl_today.json"), getJSON("nfl_status.json")]).then(([today, status]) => {
    today = today || { picks: [], slate: [] };
    const upd = today.updated ? new Date(today.updated.replace(" ", "T")) : null;
    const hrs = upd ? (Date.now() - upd.getTime()) / 3.6e6 : null;
    const fails = status ? Object.entries(status).filter(([k, v]) => v && v.ok === false).map(([k, v]) => `${k}${v.msg ? " (" + v.msg + ")" : ""}`) : [];
    const color = hrs == null || hrs > 72 || fails.length ? "var(--loss)" : "var(--win)";
    $("#nfl-status").innerHTML = `<span><span class="dot" style="background:${color}"></span>Lines updated <b>${upd ? upd.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "not yet"}</b></span>
      ${fails.length ? `<span><b>Last run had a problem:</b> ${esc(fails.join(", "))}</span>` : ""}<span>Picks lock about 80 min before each kickoff, just after inactives${today.next_lock_txt ? ` · next lock <b>${esc(today.next_lock_txt)} ET</b>` : ""}</span>${today.lines ? `<span>${today.lines.toLocaleString()} lines priced</span>` : ""}`;
    if (today.week) $("#nfl-kicker").textContent = `${today.season} · Week ${today.week} · receiving props`;
    const picks = (today.picks || []).slice().map(p => ({ ...p, posted: p.locked || today.posted })).sort(bydate);
    const tdp = picks.filter(p => p.sec === "td"), cardp = picks.filter(p => p.sec !== "td");
    const day = cardp.filter(p => p.slate !== "Primetime"), prime = cardp.filter(p => p.slate === "Primetime");
    let html = "";
    if (picks.length) {
      const by = {}; cardp.forEach(r => { const k = r.mk === "td" ? "anytime TD" : r.mk === "rec" ? "receptions under" : "yards under"; by[k] = (by[k] || 0) + 1 });
      const sec = (t, n, rs) => rs.length ? `<div class="slip-ev"><h2>${esc(t)}</h2><span class="note">${esc(n)}</span></div>` + rs.map(betRow).join("") : "";
      html += `<div class="slip"><div class="slipsum"><span><b>${cardp.length}</b>card pick${cardp.length === 1 ? "" : "s"}</span><span><b>1u</b>each</span><span>${Object.entries(by).map(([k, v]) => `${v} ${esc(k)}`).join(" · ")}</span><button class="ghost" id="nfl-copy">Copy card</button></div>
        ${sec("Sunday card", `${day.length} of 8 slots · biggest edges across the day slate`, day)}${sec("Primetime & standalone", "the single best pick in each game off the Sunday afternoon slate", prime)}</div>
        <div class="slip"><div class="slipsum"><span><b>${tdp.length}</b>anytime TD${tdp.length === 1 ? "" : "s"}</span><span><b>1u</b>each</span><span>separate from the card · every TD yes with 5+% EV at +400 or shorter</span></div>
        ${tdp.length ? sec("Anytime TD section", "tracked on its own record · long shots past +400 are skipped, the model overrates them", tdp) : '<p class="note">No TD plays yet this week. They post with each game\'s window.</p>'}</div>`;
    } else {
      html += `<div class="banner"><b>No picks yet</b><span>Most books post receiving props late in the week, and each game's picks lock about 80 minutes before its kickoff, just after inactives.</span></div>`;
    }
    $("#nfl-picks").innerHTML = html;
    const cp = $("#nfl-copy"); if (cp) cp.onclick = () => {
      const L = [`NFL receiving props · ${today.season} Week ${today.week} · 1 unit each · take the listed price or better`];
      const add = (t, rs) => { if (!rs.length) return; L.push("", t); rs.forEach((r, i) => { const w = r.p ? minPrice(r.p) : null; L.push(`${i + 1}. ${r.pk} ${r.mk === "td" ? "anytime TD" : r.sd + " " + r.ln + " " + (r.mk === "rec" ? "receptions" : "rec yards")} ${am(r.o)} (${BOOK[r.bk] || r.bk})${w != null ? ` · good to ${am(w)}` : ""} · ${r.gm}`) }) };
      add("Sunday card", day); add("Primetime", prime); add("Anytime TD section", tdp); copyText(L.join("\n"), cp, "Copy card") };
    const sl = today.slate || [];
    $("#nfl-slate").innerHTML = sl.length ? `<div class="sec-h"><h2>Full slate</h2><span class="note">Model projections for the top pass-catchers in every game (blend-free, before the market)</span></div>` + sl.map(g => gameBlock(g, picks)).join("")
      : `<div class="banner"><b>Quiet</b><span>No games on the schedule this week yet.</span></div>`;
  });
})();
