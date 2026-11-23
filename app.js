/* Nothing Can Stop Us Now — site engine.
   One engine, every model plugs in with NCSUN.register({...}) from sports/<id>.js.
   Each model's JSON files stay exactly as its pipeline writes them; an adapter per sport turns them into one
   normalized bet record, and everything on the page (home, card, live, record, lab, chart, log) renders from that.

   Normalized record (what every renderer sees):
     id       stable id  "sport|date|pick|market|book"            posted  "YYYY-MM-DD HH:MM" ET or null
     sport    sport id                                             d       event date "YYYY-MM-DD" (CFB: null)
     ev       event / game name                                   t       event time "HH:MM" ET or null
     pick     headline ("Maryland +3.5", "Matheus Camilo")         detail  one line under the headline
     mk       market label   tier  tier label                      o       American odds   bk  book label
     stake    units risked (1)                                     p, m, e model prob, market prob, edge pts (nullable)
     r        "W" | "L" | "P" | "Void" | null                      pl      units won / lost (null until graded)
     act      actual result text ("77-75", "5 rec", "DEC R3")      start   Date (ET) the event starts, or null
     status   posted | live | finished | graded | void             season  label for the coaster
     raw      the original row (sport modules read sport-specific fields from here)
*/
(function () {
  "use strict";
  const NCSUN = window.NCSUN = { sports: [], byId: {} };
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtU = v => (v > 0 ? "+" : "") + (v || 0).toFixed(1) + "u";
  const pct = v => (v * 100).toFixed(1) + "%";
  const pct0 = v => v == null ? "–" : Math.round(v * 100) + "%";
  const sgn = v => v > 0 ? "pos" : (v < 0 ? "neg" : "");
  const am = o => o == null ? "–" : (o > 0 ? "+" + o : String(o));
  const lnTxt = l => l == null ? "" : l === 0 ? "PK" : (l > 0 ? "+" + l : String(l));
  const toDec = o => o == null ? null : (o > 0 ? 1 + o / 100 : 1 + 100 / -o);
  const fair = p => { if (!p || p <= 0 || p >= 1) return null; const d = 1 / p; return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)) };
  const payout = o => o == null ? 100 / 110 : o > 0 ? o / 100 : 100 / Math.abs(o);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ET = "America/New_York";
  // "now" and "today" in Eastern time, since every pipeline posts in ET
  const etParts = (dt = new Date()) => { const p = {}; new Intl.DateTimeFormat("en-US", { timeZone: ET, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(dt).forEach(x => p[x.type] = x.value); return p };
  const etToday = () => { const p = etParts(); return `${p.year}-${p.month}-${p.day}` };
  const etOffsetMs = () => { const p = etParts(), asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); return asUTC - Math.floor(Date.now() / 60000) * 60000 };
  // a wall-clock "YYYY-MM-DD HH:MM" in ET -> real Date
  const etDate = (d, t) => { if (!d) return null; const [y, mo, da] = d.split("-").map(Number), [h, mi] = (t || "12:00").split(":").map(Number); if (!y || !mo || !da) return null; return new Date(Date.UTC(y, mo - 1, da, h || 0, mi || 0) - etOffsetMs()) };
  const dateTxt = d => { if (!d) return ""; const x = new Date(String(d).slice(0, 10) + "T12:00:00"); return isNaN(x) ? "" : `${DOW[x.getDay()]}, ${MON[x.getMonth()]} ${x.getDate()}` };
  const timeTxt = t => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return ((h + 11) % 12 + 1) + ":" + String(m).padStart(2, "0") + (h >= 12 ? " PM" : " AM") };
  const stampTxt = s => { if (!s) return ""; if (!/^\d{4}-\d{2}-\d{2}/.test(String(s))) return String(s); const [d, t] = String(s).split(/[ T]/); return dateTxt(d) + (t && /^\d{2}:\d{2}/.test(t) ? " " + timeTxt(t.slice(0, 5)) : "") };
  const daysTo = d => { if (!d) return null; const t = new Date(etToday() + "T12:00:00"); return Math.round((new Date(d + "T12:00:00") - t) / 864e5) };
  const whenTxt = d => { const n = daysTo(d); return n == null ? "" : n < 0 ? (n === -1 ? "yesterday" : `${-n} days ago`) : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days` };
  const addDays = (d, k) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10) };
  const cap = s => String(s || "").replace(/\b\w/g, c => c.toUpperCase());
  const plural = (n, s, p) => n === 1 ? s : (p || s + "s");
  const getJSON = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const cache = {}; const load = u => cache[u] || (cache[u] = getJSON(u));
  const reduced = () => matchMedia("(prefers-reduced-motion:reduce)").matches;
  function copyText(t, btn, label) {
    const done = ok => { btn.textContent = ok ? "Copied" : "Copy failed"; setTimeout(() => btn.textContent = label, 1800) };
    const fb = () => { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand("copy") } catch (e) { } a.remove(); return ok };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(() => done(true), () => done(fb())); else done(fb());
  }
  // Owner view: open the site once with #owner to see the owner-only parts on this device (activity log, raw run
  // problems, dollar stakes, own slips); #owner-off hides them again. It only changes what is drawn, nothing is secret.
  try { const h0 = location.hash.slice(1); if (h0 === "owner" || h0 === "owner-off") { localStorage.setItem("ncsun_owner", h0 === "owner" ? "1" : ""); history.replaceState(null, "", location.pathname + location.search) }
    NCSUN.owner = localStorage.getItem("ncsun_owner") === "1" } catch (e) { NCSUN.owner = false }
  document.documentElement.classList.toggle("owner", !!NCSUN.owner);
  NCSUN.u = { $, esc, fmtU, pct, pct0, sgn, am, lnTxt, toDec, fair, payout, MON, DOW, dateTxt, timeTxt, stampTxt, daysTo, whenTxt, addDays, cap, plural, etToday, etDate, load, copyText };

  // ------------------------------------------------------------------ records
  const GRADED = ["W", "L", "P"], VOID = ["Void", "void", "D", "NC", "V"];
  function finish(rec, sp) {
    rec.sport = sp.id; rec.stake = rec.stake ?? 1;
    rec.start = rec.start === undefined ? (rec.d ? etDate(rec.d, rec.t || sp.defaultTime || "12:00") : null) : rec.start;
    rec.hours = rec.hours ?? sp.durationH ?? 3;
    rec.season = rec.season ?? (rec.d ? rec.d.slice(0, 4) : "");
    rec.id = rec.id || [sp.id, rec.d, rec.pick, rec.mk, rec.bk].join("|");
    rec.status = statusOf(rec); return rec;
  }
  function statusOf(rec) {
    if (rec.r != null && VOID.includes(rec.r)) return "void";
    if (rec.r != null && GRADED.includes(rec.r)) return "graded";
    if (!rec.start) return "posted";
    const now = Date.now(), s = rec.start.getTime();
    if (now < s) return "posted";
    if (now < s + rec.hours * 36e5) return "live";
    return "finished";
  }
  NCSUN.finish = finish;

  // ------------------------------------------------------------------ stats, grouping
  function stats(rows) {
    let w = 0, l = 0, p = 0, v = 0, u = 0, risk = 0, c = 0, cn = 0;
    for (const r of rows) { if (r.r === "W") w++; else if (r.r === "L") l++; else if (r.r === "P") p++; else v++; u += r.pl || 0; if (r.r === "W" || r.r === "L") risk += r.stake ?? 1; if (r.clv != null) { c += r.clv; cn++ } }
    const n = w + l; return { n, w, l, p, v, wp: n ? w / n : 0, u, roi: risk ? u / risk : 0, clv: cn ? c / cn : null };
  }
  const recTxt = s => `${s.w}-${s.l}${s.p ? "-" + s.p : ""}`;
  function groupBy(rows, dim) {
    const m = new Map(); for (const r of rows) { const k = dim.f(r.raw, r); if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
    const e = [...m.entries()], o = dim.order;
    if (o) return e.sort((a, b) => { const ia = o.indexOf(a[0]), ib = o.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) });
    if (dim.sort) return e.sort((a, b) => (dim.sort(a[1][0].raw) ?? 99) - (dim.sort(b[1][0].raw) ?? 99));
    return e.sort((a, b) => dim.desc ? (a[0] < b[0] ? 1 : -1) : (a[0] < b[0] ? -1 : 1));
  }
  NCSUN.stats = stats; NCSUN.recTxt = recTxt;

  // ------------------------------------------------------------------ coaster chart (equity curve as the ride track)
  function coaster(el, rows, sp) {
    if (rows.length < 2) { el.innerHTML = '<p class="note">Not enough graded picks to draw the ride yet.</p>'; return }
    const nar = innerWidth < 600, W = nar ? 360 : 760, H = nar ? 280 : 310, L = nar ? 40 : 50, R = nar ? 16 : 22, T = nar ? 70 : 76, B = nar ? 30 : 34, fs = nar ? 12 : 11, n = rows.length;
    let c = 0; const ys = rows.map(r => (c += r.pl || 0));
    const ymin = Math.min(0, ...ys), ymax = Math.max(1, ...ys), span = ymax - ymin || 1, lines = nar ? 4 : 7, step = [1, 2, 5, 10, 20, 25, 50, 100, 200].find(x => span / x <= lines) || 500;
    const Y = [0].concat(ys), N = n + 1, x = i => L + i / (N - 1) * (W - L - R), y = v => T + (ymax - v) / span * (H - T - B);
    let g = ""; for (let v = Math.ceil(ymin / step) * step; v <= ymax; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === 0 ? 'stroke-width="2"' : 'stroke-dasharray="2 5"'}/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="${fs}" fill="var(--ink2)">${v > 0 ? "+" : ""}${v}u</text>`;
    let s = "", prev = null; if (sp) rows.forEach((r, i) => { const yr = String(r.season || ""); if (yr !== prev) { s += `<line x1="${x(i)}" x2="${x(i)}" y1="${T - 10}" y2="${H - B}" stroke="var(--line)"/><text x="${x(i) + 4}" y="${H - B + 19}" font-size="${fs}" font-weight="700" fill="var(--ink2)">${esc(nar ? yr.slice(2) : yr)}</text>`; prev = yr } });
    let pk = 0, pi = 0, dd = 0, di0 = 0, di1 = 0; Y.forEach((v, i) => { if (v > pk) { pk = v; pi = i } if (pk - v > dd) { dd = pk - v; di0 = pi; di1 = i } });
    const k = Math.max(1, Math.floor(n / (nar ? 90 : 140))), pts = []; for (let i = 0; i < N; i += k) pts.push([x(i), y(Y[i])]); if (pts[pts.length - 1][0] !== x(N - 1)) pts.push([x(N - 1), y(Y[N - 1])]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
    let ties = ""; if (!nar) for (let i = 1; i < pts.length; i += 2) { const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len * 6, ny = dx / len * 6; ties += `<line x1="${(b[0] + nx).toFixed(1)}" y1="${(b[1] + ny).toFixed(1)}" x2="${(b[0] - nx).toFixed(1)}" y2="${(b[1] - ny).toFixed(1)}" stroke="var(--track)" stroke-width="1.6" opacity=".5"/>` }
    let ddm = ""; if (dd >= 3) { const x0 = x(di0), x1 = x(di1), y0 = y(Y[di0]), y1 = y(Y[di1]), lx = Math.min(Math.max((x0 + x1) / 2, L + 60), W - R - 60);
      ddm = `<g aria-hidden="true"><line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="var(--loss)" stroke-dasharray="3 3"/><line x1="${x1}" x2="${x1}" y1="${y0}" y2="${y1}" stroke="var(--loss)" stroke-width="2"/><circle cx="${x1}" cy="${y1}" r="3.5" fill="var(--loss)"/><text x="${lx}" y="${Math.min(H - B - 6, y1 + 18)}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="var(--loss)">Worst drawdown −${dd.toFixed(1)}u</text></g>` }
    const end = pts[pts.length - 1], last = ys[n - 1], base = y(Math.max(ymin, 0)), cid = "clip" + Math.random().toString(36).slice(2, 8);
    const sc = nar ? 0.68 : 0.78, mid = sp ? sp.id : (NCSUN.homeMascot || "ncaab");
    const bets = n <= 120 ? rows.map((r, i) => `<circle class="bt ${r.r === "W" ? "w" : r.r === "L" ? "l" : "p"}" cx="${x(i + 1).toFixed(1)}" cy="${y(Y[i + 1]).toFixed(1)}" r="${nar ? 3.2 : 4}"><title>${esc(r.pick)} · ${r.r} ${fmtU(r.pl || 0)}</title></circle>`).join("") : "";
    el.innerHTML = `<div class="ridewrap"><svg class="ride" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative units, ${fmtU(last)}; worst drawdown ${dd.toFixed(1)} units">${g}${s}
     <defs><clipPath id="${cid}"><rect class="reveal" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
     <g clip-path="url(#${cid})"><path class="area" d="${path} L${end[0]} ${base} L${pts[0][0]} ${base} Z" fill="var(--cobalt)" opacity=".10"/>
     <g class="ties">${ties}</g><path class="track" d="${path}" fill="none" stroke="var(--track)" stroke-width="${nar ? 2.6 : 3.2}" stroke-linejoin="round"/><g class="bets">${bets}</g></g>
     <g class="ddm">${ddm}</g>
     <g class="car">${mascotSVG(mid)}</g>
     <g class="lbl"><rect rx="6" fill="var(--panel)" stroke="var(--ink)" stroke-width="1.5"/><text class="run" text-anchor="middle" font-size="${nar ? 12 : 13}" font-weight="800" fill="var(--ink)"></text></g>
     <g class="fx"></g>
     <text class="endlbl" x="${(end[0] - 8).toFixed(1)}" y="${Math.max(16, end[1] - (nar ? 40 : 46)).toFixed(1)}" text-anchor="end" font-size="${nar ? 15 : 17}" font-weight="800" fill="var(--ink)">${fmtU(last)}</text></svg>
     <button class="ghost replay" type="button" aria-label="Ride again">Ride again</button></div>`;
    rideAnim(el, { W, H, L, R, n: N, ys: Y, x, y, sc, last, trough: dd >= 3 ? x(di1) : null, end });
  }
  // the ride mascot: the header's rubber-hose character for this ride, cloned into the chart
  function mascotSVG(id) {
    const m = document.querySelector(`header svg .m-${id}`) || document.querySelector("header svg .m-ncaab");
    return m ? m.outerHTML : '<rect x="-12" y="-16" width="34" height="12" rx="3" fill="var(--coral)" stroke="var(--ink)" stroke-width="2"/><circle cx="-3" cy="-2" r="3" fill="var(--ink)"/><circle cx="13" cy="-2" r="3" fill="var(--ink)"/>';
  }
  // drive the car along the track: the track is laid down just ahead of it, the counter rides above it,
  // bets pop as it passes them, the drawdown marker appears at the trough, and the finish gets a burst
  const ridden = new Set();   // charts that already played this visit: redraws (filters, resize) settle straight to the end
  function rideAnim(el, o) {
    const svg = el.querySelector("svg.ride"), track = svg.querySelector("path.track"), reveal = svg.querySelector(".reveal"), car = svg.querySelector(".car"), lbl = svg.querySelector(".lbl"), run = lbl.querySelector("text"), box = lbl.querySelector("rect"), fx = svg.querySelector(".fx"), ddm = svg.querySelector(".ddm"), bts = [...svg.querySelectorAll(".bt")], btn = el.querySelector(".replay");
    const Ltot = track.getTotalLength ? track.getTotalLength() : 0, span = o.W - o.L - o.R;
    let raf = 0, sPos = 0, tPrev = 0, ddShown = false, btI = 0;
    const place = (s) => {
      const p = track.getPointAtLength(s), a = track.getPointAtLength(Math.max(0, s - 3)), b = track.getPointAtLength(Math.min(Ltot, s + 3));
      const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      car.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${o.sc}) translate(-5 -29)`);
      reveal.setAttribute("width", (p.x + 6).toFixed(1));
      const i = Math.max(0, Math.min(o.n - 1, Math.round((p.x - o.L) / span * (o.n - 1)))), v = o.ys[i], txt = fmtU(v);
      run.textContent = txt; run.setAttribute("fill", v >= 0 ? "var(--win)" : "var(--loss)");
      const lx = Math.min(o.W - 34, Math.max(34, p.x)), ly = Math.max(14, p.y - 44 * o.sc - 14), w = txt.length * 7.6 + 12;
      run.setAttribute("x", lx); run.setAttribute("y", ly + 4); box.setAttribute("x", lx - w / 2); box.setAttribute("y", ly - 9); box.setAttribute("width", w); box.setAttribute("height", 18);
      while (btI < bts.length && +bts[btI].getAttribute("cx") <= p.x + 0.5) bts[btI++].classList.add("on");
      if (!ddShown && o.trough != null && p.x >= o.trough - 0.5) { ddShown = true; ddm.classList.add("on") }
      return { p, ang };
    };
    const finish = quiet => { cancelAnimationFrame(raf); sPos = Ltot; const { p } = place(Ltot); bts.forEach(c => c.classList.add("on")); ddm.classList.add("on"); svg.classList.add("done"); if (quiet === true) svg.classList.add("still"); lbl.style.opacity = 0; if (quiet !== true) burst(p) };
    const burst = p => {
      if (reduced()) return; fx.innerHTML = "";
      if (o.last > 0) { const cols = ["var(--coral)", "var(--sun)", "var(--cobalt)", "var(--win)", "#fff"];
        for (let i = 0; i < 22; i++) { const a = -Math.PI * (0.15 + Math.random() * 0.7), d = 40 + Math.random() * 70; fx.insertAdjacentHTML("beforeend", `<rect x="${(p.x - 3).toFixed(1)}" y="${(p.y - 22).toFixed(1)}" width="6" height="${3 + Math.random() * 5 | 0}" fill="${cols[i % cols.length]}" style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d + 60).toFixed(0)}px;animation-delay:${(Math.random() * 120) | 0}ms"/>`) } }
      else for (let i = 0; i < 7; i++) { const d = 14 + Math.random() * 26; fx.insertAdjacentHTML("beforeend", `<circle cx="${(p.x - 10).toFixed(1)}" cy="${(p.y - 4).toFixed(1)}" r="${2 + Math.random() * 3 | 0}" fill="var(--ink2)" opacity=".5" style="--dx:${(-d - 10).toFixed(0)}px;--dy:${(-Math.random() * 16).toFixed(0)}px"/>`) }
      setTimeout(() => fx.innerHTML = "", 1600);
    };
    const reset = () => { cancelAnimationFrame(raf); sPos = 0; tPrev = 0; ddShown = false; btI = 0; bts.forEach(c => c.classList.remove("on")); ddm.classList.remove("on"); svg.classList.remove("done", "still"); lbl.style.opacity = 1; fx.innerHTML = ""; place(0) };
    const dur = Math.min(2800, 1500 + o.n * 5);   // longer records get a slightly longer ride
    const step = t => {
      if (!tPrev) tPrev = t; const dt = Math.min(48, t - tPrev); tPrev = t;
      const a = track.getPointAtLength(Math.max(0, sPos - 2)), b = track.getPointAtLength(Math.min(Ltot, sPos + 2)), slope = (b.y - a.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
      const k = slope > 0 ? 1 + slope * 0.9 : 1 + slope * 0.45;   // y grows downward: downhill (losing) runs fast, climbs grind
      sPos += Ltot / dur * dt * k;
      if (sPos >= Ltot) { finish(); return }
      place(sPos); raf = requestAnimationFrame(step);
    };
    const start = () => { reset(); if (reduced() || !Ltot) { finish(); return } raf = requestAnimationFrame(step) };
    btn.onclick = start;
    el.rideStart = start;
    reset(); lbl.style.opacity = 0;
    const rk = el.id || ""; if (rk && ridden.has(rk)) { finish(true); return } if (rk) ridden.add(rk);
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(start, 120) } }, { threshold: 0.35 }); io.observe(svg) } else start();
  }
  // sparkline: cumulative units over a run of graded picks (home tiles, the trend strip)
  function spark(rows, w = 150, h = 40) {
    if (rows.length < 2) return "";
    let c = 0; const ys = [0].concat(rows.map(r => (c += r.pl || 0))), ymin = Math.min(0, ...ys), ymax = Math.max(0.5, ...ys), span = ymax - ymin || 1, n = ys.length;
    const x = i => 3 + i / (n - 1) * (w - 10), y = v => 4 + (ymax - v) / span * (h - 8);
    const pts = ys.map((v, i) => [x(i), y(v)]), d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(""), e = pts[n - 1], z = y(0);
    const svg = `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Units over the last ${n - 1} picks, ${fmtU(ys[n - 1])}"><line class="z" x1="3" x2="${w - 7}" y1="${z.toFixed(1)}" y2="${z.toFixed(1)}"/><path class="sa" d="${d} L${e[0].toFixed(1)} ${z.toFixed(1)} L${pts[0][0].toFixed(1)} ${z.toFixed(1)} Z"/><path class="sl" d="${d}" style="--len:${(n * w / n * 1.6).toFixed(0)}"/><circle class="e" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3.5"/></svg>`;
    return svg;
  }
  const dots = rows => rows.length ? `<span class="dots"><small>Last ${rows.length}</small>${rows.map((r, i) => `<i class="${r.r === "W" ? "w" : r.r === "L" ? "l" : "p"}" style="--i:${i}" title="${esc(r.pick)} · ${r.r}">${r.r === "W" || r.r === "L" ? r.r : "–"}</i>`).join("")}</span>` : "";
  // the trend strip on every ride's card page: this season at a glance before digging into history
  function trendHTML(sp, live) {
    const g = live.filter(r => r.status === "graded" && (!sp.headline || sp.headline(r))).sort(byTime); if (!g.length) return "";
    const s = stats(g), cv = clvStats(g);
    return `<div class="trend"><div class="tr-rec"><small>${esc(sp.trendLabel || (sp.seasonLabel || "Season") + " so far")}</small><b>${recTxt(s)}</b><em class="${sgn(s.u)}">${fmtU(s.u)}${s.n >= MINROI ? ` · ${roiTxt(s.roi)} ROI` : ""}</em></div>${sp.clvFront && cv.n ? `<div class="tr-rec"><small>Vs the closing line</small><b class="${sgn(cv.avg)}">${sp.clv.fmt(cv.avg)}${sp.clvUnit || ""}</b><em>beat it ${cv.beat} of ${cv.n}</em></div>` : ""}${spark(g.slice(-60))}${dots(g.slice(-10))}<button class="ghost" data-go="${sp.id}-live">Full record</button></div>`;
  }
  NCSUN.spark = spark;
  // closing line: how many graded picks got a better number than the market closed at, and by how much on average
  function clvStats(rows) { const c = rows.filter(r => r.clv != null); const beat = c.filter(r => r.clv > 0).length, tied = c.filter(r => r.clv === 0).length;
    const srt = c.map(r => r.clv).sort((x, y) => x - y), m = srt.length >> 1;
    return { n: c.length, beat, tied, worse: c.length - beat - tied, avg: c.length ? c.reduce((a, r) => a + r.clv, 0) / c.length : null, med: !c.length ? null : srt.length % 2 ? srt[m] : (srt[m - 1] + srt[m]) / 2 } }
  NCSUN.clvStats = clvStats;
  // "Beating the close" panel (college hoops; UFC draws its own): the headline read on whether the edge is real
  function clvPanel(rows, sp) {
    const c = rows.filter(r => r.clv != null).sort(byTime); if (!c.length) return "";
    const cv = clvStats(c), f = sp.clv.fmt, u = sp.clvUnit || "";
    const g = c.slice(-40), W = 100, H = 56, bw = W / Math.max(g.length, 12), mx = Math.max(0.5, ...g.map(r => Math.abs(r.clv)));
    const bars = g.map((r, i) => { const h = Math.abs(r.clv) / mx * (H / 2 - 4), y = r.clv > 0 ? H / 2 - h : H / 2;
      return `<rect x="${(i * bw + bw * 0.15).toFixed(2)}" y="${y.toFixed(2)}" width="${(bw * 0.7).toFixed(2)}" height="${Math.max(h, 1).toFixed(2)}" rx="1" fill="${r.clv > 0 ? "var(--win)" : r.clv < 0 ? "var(--loss)" : "var(--ink2)"}"><title>${esc(r.pick)} ${f(r.clv)}</title></rect>` }).join("");
    const last = c.slice(-25).reverse();
    // each pick on one number line: the hollow dot is where the line closed, the solid dot is the number we got
    const dmx = Math.max(1, ...last.map(r => Math.abs(r.clv)));
    const bell = r => { const w = Math.abs(r.clv) / dmx * 44, x0 = 50, x1 = 50 + (r.clv > 0 ? w : -w), col = r.clv > 0 ? "var(--win)" : r.clv < 0 ? "var(--loss)" : "var(--ink2)";
      return `<svg class="bell" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><line x1="4" x2="96" y1="7" y2="7" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/><line x1="${x0}" x2="${x1.toFixed(1)}" y1="7" y2="7" stroke="${col}" stroke-width="3" vector-effect="non-scaling-stroke"/></svg><i class="b0" style="left:50%"></i><i class="b1" style="left:${x1.toFixed(1)}%;background:${col}"></i>` };
    return `<div class="panel clvp" style="display:grid;gap:12px"><div class="lab-head"><h2>Beating the <em>close</em></h2><span class="note">the number we got vs where the line ended up at tip-off</span></div>
      <div class="kpis"><div><small>Beat the close</small><b>${cv.beat} of ${cv.n}</b><span>${cv.tied} matched · ${cv.worse} worse</span></div>
        <div><small>Typical pick</small><b class="${sgn(cv.med)}">${f(cv.med)}<i class="un">${u}</i></b><span>the middle pick (median)</span></div>
        <div><small>Average</small><b class="${sgn(cv.avg)}">${f(cv.avg)}<i class="un">${u}</i></b><span>a few big moves pull this up</span></div></div>
      <p class="note" style="margin:0">We bet in the morning; the line keeps moving until the game starts. If we took +3.5 and it closed +2.5, the market moved our way by a point. Doing that more often than not is the best early sign a model is onto something real, well before the win-loss record means much.</p>
      ${c.length > 25 ? `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:84px" role="img" aria-label="Closing line value for the last ${g.length} picks: ${cv.beat} of ${cv.n} beat the close"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--line)" stroke-width=".5"/>${bars}</svg>
      <p class="note" style="margin:0">One bar per pick, oldest to newest. Up and green: we got a better number than the close. Down and red: a worse one.</p>` : ""}
      <div class="tbl"><table class="clvt"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th>We got</th><th>Closed</th><th class="bellh"><span>worse</span><span>better</span></th><th>Vs close</th><th>Result</th></tr></thead><tbody>${last.map(r => `<tr><td class="mono">${esc(dateTxt(r.d || "").replace(/^\w+ /, ""))}</td><td class="l"><b>${esc(r.pick)}</b></td><td class="mono">${esc((r.cl || {}).got || "")}</td><td class="mono">${esc((r.cl || {}).closed || "")}</td><td class="bellc">${bell(r)}</td><td class="${sgn(r.clv)}"><b>${f(r.clv)}</b></td><td class="rz"><span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span></td></tr>`).join("")}</tbody></table></div>
      ${c.length > last.length ? `<p class="note" style="margin:0">Showing the latest ${last.length} of ${c.length}. Every pick is in the bet log below.</p>` : ""}</div>`;
  }
  NCSUN.clvPanel = clvPanel;
  // count-up for KPI numbers (first render only; respects reduced motion)
  function countUp(el) {
    if (reduced()) return;
    el.querySelectorAll("b[data-n]").forEach(b => { const n = +b.dataset.n, fmt = b.dataset.f, t0 = performance.now(), dur = 900, fin = b.textContent;
      const f = v => fmt === "u" ? fmtU(v) : fmt === "pct" ? (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%" : Math.round(v).toLocaleString();
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = k < 1 ? f(n * e) : fin; if (k < 1) requestAnimationFrame(step) }; requestAnimationFrame(step) });
  }
  const MINROI = 30;   // under this many graded bets a percentage is noise: show the count and the units, not a rate
  const roiTxt = v => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%";
  function kpis(el, s, label, sp, sim) {
    const clv = sp && sp.clv, big = s.n >= MINROI;
    el.innerHTML = `<div><small>Bets</small><b data-n="${s.n}" data-f="int">${s.n.toLocaleString()}</b><span>${sim ? '<i class="sim">Simulated</i> ' : ""}${esc(label)}</span></div><div><small>Record</small><b>${recTxt(s)}</b><span>${big ? pct(s.wp) + " win rate" : "small sample so far"}${s.v ? ` · ${s.v} void` : ""}</span></div>
     <div><small>Units</small><b class="${s.u >= 0 ? "pos" : "neg"}" data-n="${s.u}" data-f="u">${fmtU(s.u)}</b><span>flat stakes, graded at the posted price</span></div>
     <div><small>ROI</small>${big ? `<b class="${s.roi >= 0 ? "pos" : "neg"}" data-n="${s.roi * 100}" data-f="pct">${roiTxt(s.roi)}</b><span>per unit risked</span>` : `<b>–</b><span>shown after ${MINROI} graded bets</span>`}</div>
     ${clv ? `<div><small>Vs close</small><b>${clv.fmt(s.clv)}</b><span>${esc(clv.label)}</span></div>` : `<div><small>Break-even</small><b>52.4%</b><span>to beat -110</span></div>`}`;
    if (!el.dataset.counted) { el.dataset.counted = "1"; countUp(el) }
  }
  NCSUN.coaster = coaster; NCSUN.kpis = kpis;

  // ------------------------------------------------------------------ Slice Lab: one filter set drives KPIs, ride, breakdown and log
  function lab(root, all, idp, label, sp) {
    const DIMS = sp.dims, FILTERS = (sp.filters || Object.keys(DIMS)).filter(d => groupBy(all, DIMS[d]).length > 1), minN = sp.minN || 50, clv = sp.clv;
    const F = {}; FILTERS.forEach(d => F[d] = new Set());
    const opts = Object.entries(DIMS).map(([k, d]) => `<option value="${k}">${esc(d.n)}</option>`).join("");
    root.innerHTML = `<div class="kpis" id="${idp}-k"></div>
    <div class="panel"><div class="lab-head"><h2>The ride</h2><span class="note" id="${idp}-sub"></span></div><div id="${idp}-chart"></div></div>
    <div class="panel lab"><div class="lab-head"><h2>Slice lab</h2><div class="active" id="${idp}-active"></div></div>
     ${FILTERS.length ? `<details class="filters" ${matchMedia("(max-width:640px)").matches ? "" : "open"}><summary><h3>Filters</h3><span class="note">Tap chips to narrow every number on this page. Chips in the same group add together.</span></summary>
      <div class="fgrid">${FILTERS.map(d => `<div class="fgroup"><h4>${esc(DIMS[d].n)}</h4><div class="chips">${groupBy(all, DIMS[d]).map(([k, v]) => `<button class="chip" data-d="${d}" data-v="${esc(k)}" aria-pressed="false">${esc(k)}<small>${v.length}</small></button>`).join("")}</div></div>`).join("")}</div></details>` : ""}
     <div class="lab-controls">
       <label class="f" for="${idp}-a">Break down by<select id="${idp}-a">${opts}</select></label>
       <label class="f" for="${idp}-b">Then by<select id="${idp}-b"><option value="">Nothing</option>${opts}</select></label>
       <div class="viewtog" role="group" aria-label="View"><button id="${idp}-vt" aria-pressed="true">Table</button><button id="${idp}-vh" aria-pressed="false">Heatmap</button></div>
       <button class="ghost" id="${idp}-clear">Clear filters</button>
     </div>
     <div class="tbl" id="${idp}-out"></div><p class="note">Rows under ${minN} bets are marked small. Treat them as noise until they grow.</p></div>
    <div class="panel"><div class="lab-head"><h2>Bet log</h2><label class="f" for="${idp}-q">Search<input id="${idp}-q" type="search" placeholder="${esc(sp.searchHint || "Search a pick or game")}"></label></div><div class="tbl" id="${idp}-log"></div></div>`;
    const a = $(`#${idp}-a`, root), b = $(`#${idp}-b`, root), vt = $(`#${idp}-vt`, root), vh = $(`#${idp}-vh`, root), q = $(`#${idp}-q`, root);
    a.value = sp.defaultDim && DIMS[sp.defaultDim] ? sp.defaultDim : Object.keys(DIMS)[0]; let heat = false, page = 0;
    const filtered = () => all.filter(r => FILTERS.every(d => !F[d].size || F[d].has(DIMS[d].f(r.raw, r))));
    const clvCell = s => clv ? `<td>${clv.fmt(s.clv)}</td>` : "";
    function row(lbl, s, max, cls) {
      const w = Math.min(50, Math.abs(s.u) / max * 50);
      return `<tr class="${cls || ""}"><td>${esc(lbl)}${s.n < minN && cls !== "tot" ? ' <span class="tag small">small</span>' : ""}</td><td>${s.n}</td><td class="mono">${recTxt(s)}</td><td>${pct(s.wp)}</td><td class="${sgn(s.u)}">${fmtU(s.u)}</td><td class="${sgn(s.roi)}">${roiTxt(s.roi)}</td>${clvCell(s)}<td><span class="ubar" aria-hidden="true"><i style="left:${s.u >= 0 ? 50 : 50 - w}%;width:${w}%;background:var(${s.u >= 0 ? "--win" : "--loss"})"></i></span></td></tr>`;
    }
    function breakdown(rows) {
      const A = a.value, Bd = b.value && b.value !== a.value ? b.value : "";
      if (!rows.length) return '<p class="note">No bets match these filters.</p>';
      if (heat && Bd) {
        const ra = groupBy(rows, DIMS[A]), cb = groupBy(rows, DIMS[Bd]).map(x => x[0]);
        const cell = rs => { if (!rs.length) return '<td class="c"><span>–</span></td>'; const s = stats(rs); const o = Math.min(70, Math.round(Math.abs(s.roi) * 260 + 8)); return `<td class="c" style="background:color-mix(in srgb,var(${s.roi >= 0 ? "--win" : "--loss"}) ${o}%,var(--panel))" title="${recTxt(s)}, ${fmtU(s.u)}"><b>${(s.roi * 100).toFixed(0)}%</b><span>${s.n} bets · ${pct(s.wp)}</span></td>` };
        return `<table class="heat"><thead><tr><th class="l">${esc(DIMS[A].n)} ↓ · ${esc(DIMS[Bd].n)} →</th>${cb.map(c => `<th style="text-align:center">${esc(c)}</th>`).join("")}</tr></thead><tbody>${ra.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td>${cb.map(c => cell(v.filter(r => DIMS[Bd].f(r.raw, r) === c))).join("")}</tr>`).join("")}</tbody></table><p class="note">Each cell: ROI, then bets and win rate. Green is profitable, red is losing; deeper color means bigger ROI. Prices differ by market, so read ROI before win rate.</p>`;
      }
      if (heat && !Bd) return '<p class="note">Pick a second slice under "Then by" to see the heatmap.</p>';
      const g = groupBy(rows, DIMS[A]); let max = 1;
      const blocks = g.map(([k, v]) => { const s = stats(v); max = Math.max(max, Math.abs(s.u)); const subs = Bd ? groupBy(v, DIMS[Bd]).map(([k2, v2]) => { const s2 = stats(v2); max = Math.max(max, Math.abs(s2.u)); return [k2, s2] }) : []; return [k, s, subs] });
      return `<table><thead><tr><th>${esc(DIMS[A].n)}</th><th>Bets</th><th>W-L</th><th>Win%</th><th>Units</th><th>ROI</th>${clv ? `<th title="${esc(clv.title || "")}">CLV</th>` : ""}<th></th></tr></thead><tbody>${blocks.map(([k, s, subs]) => row(k, s, max) + subs.map(([k2, s2]) => row(k2, s2, max, "sub")).join("")).join("")}${row("All filtered bets", stats(rows), max, "tot")}</tbody></table>`;
    }
    function log(rows) {
      const qq = q.value.trim().toLowerCase(); const f = rows.filter(r => !qq || [r.pick, r.ev, r.detail].some(t => t && String(t).toLowerCase().includes(qq))).slice().reverse();
      const PER = 30, pages = Math.max(1, Math.ceil(f.length / PER)); page = Math.min(page, pages - 1); const v = f.slice(page * PER, page * PER + PER);
      $(`#${idp}-log`, root).innerHTML = `<table class="log"><thead><tr><th class="l">Date</th><th class="l">Pick</th><th class="l">Game</th><th>Price</th><th class="l">Book</th><th class="l">Tier</th><th class="l">Actual</th><th>Result</th><th>Units</th></tr></thead><tbody>${v.map(r => `<tr><td class="mono">${esc(r.d || r.season)}</td><td class="l"><b>${esc(r.pick)}</b></td><td class="l">${esc(r.ev)}</td><td class="mono">${am(r.o)}</td><td class="l">${esc(r.bk)}</td><td class="l">${esc(r.tier || r.mk)}</td><td class="l mono">${esc(r.act || "")}</td><td><span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${esc(r.r)}</span></td><td class="${sgn(r.pl)}">${fmtU(r.pl)}</td></tr>`).join("")}</tbody></table>
      <div class="pager"><button class="ghost" id="${idp}-pp" ${page <= 0 ? "disabled" : ""}>Newer</button><span class="note">Page ${page + 1} of ${pages} · ${f.length.toLocaleString()} bets</span><button class="ghost" id="${idp}-pn" ${page >= pages - 1 ? "disabled" : ""}>Older</button></div>`;
      $(`#${idp}-pp`, root).onclick = () => { page--; log(rows) }; $(`#${idp}-pn`, root).onclick = () => { page++; log(rows) };
    }
    function draw() {
      const rows = filtered(); kpis($(`#${idp}-k`, root), stats(rows), label, sp, /-bt$/.test(idp)); coaster($(`#${idp}-chart`, root), rows, sp);
      $(`#${idp}-sub`, root).textContent = rows.length === all.length ? "Every bet, in date order" : `${rows.length.toLocaleString()} of ${all.length.toLocaleString()} bets match your filters`;
      $(`#${idp}-out`, root).innerHTML = breakdown(rows);
      const act = FILTERS.flatMap(d => [...F[d]].map(v => `<button class="pill" data-d="${d}" data-v="${esc(v)}" title="Remove this filter">${esc(DIMS[d].n)}: ${esc(v)}</button>`));
      $(`#${idp}-active`, root).innerHTML = act.length ? act.join("") : '<span class="note">No filters. Showing every bet.</span>';
      root.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", F[c.dataset.d].has(c.dataset.v))); page = 0; log(rows);
    }
    root.addEventListener("click", e => { const c = e.target.closest(".chip,.pill"); if (!c || !F[c.dataset.d]) return; const d = c.dataset.d, v = c.dataset.v; F[d].has(v) ? F[d].delete(v) : F[d].add(v); draw() });
    $(`#${idp}-clear`, root).onclick = () => { FILTERS.forEach(d => F[d].clear()); draw() };
    [a, b].forEach(x => x.addEventListener("change", draw)); q.addEventListener("input", () => { page = 0; log(filtered()) });
    vt.onclick = () => { heat = false; vt.setAttribute("aria-pressed", "true"); vh.setAttribute("aria-pressed", "false"); draw() };
    vh.onclick = () => { heat = true; vh.setAttribute("aria-pressed", "true"); vt.setAttribute("aria-pressed", "false"); if (!b.value) b.value = Object.keys(DIMS).find(k => k !== a.value) || ""; draw() };
    let nar = innerWidth < 600; addEventListener("resize", () => { const n2 = innerWidth < 600; if (n2 !== nar) { nar = n2; coaster($(`#${idp}-chart`, root), filtered(), sp) } });
    draw();
  }
  NCSUN.lab = lab;

  // ------------------------------------------------------------------ the bet card (same component on every tab and on Home)
  function whyChart(w) {
    if (!w || !((w.items && w.items.length) || (w.notes && w.notes.length))) return "";
    const items = w.items || [], max = Math.max(1, ...items.map(x => Math.abs(x.pts || 0)));
    const rows = items.map(x => { const wd = Math.abs(x.pts || 0) / max * 50; return `<div class="row"><div class="lbl" title="${esc(x.label)}${x.v ? " · " + esc(x.v) : ""}">${esc(x.label)}${x.v ? `<small>${esc(x.v)}</small>` : ""}</div><div class="bar" aria-hidden="true"><i class="${x.pts < 0 ? "neg" : ""}" style="width:${wd.toFixed(1)}%"></i></div><div class="val ${x.pts > 0 ? "pos" : x.pts < 0 ? "neg" : ""}">${esc(x.txt ?? ((x.pts > 0 ? "+" : "") + (x.pts || 0).toFixed(1)))}</div></div>` }).join("");
    const sr = items.length ? `Reasons: ${items.map(x => `${x.label} ${x.txt ?? x.pts}`).join(", ")}` : (w.notes || []).join(" ");
    return `<div class="why" role="img" aria-label="${esc(sr)}"><h4>${esc(w.head || "Why the model likes it")}${w.sub ? `<span>${esc(w.sub)}</span>` : ""}</h4>${(w.notes || []).map(t => `<p class="wnote">${esc(t)}</p>`).join("")}${rows}${w.foot ? `<div class="foot">${w.foot}</div>` : ""}</div>`;
  }
  const STATUS = { posted: ["Posted", "st-posted"], live: ["Live now", "st-live"], finished: ["Awaiting grade", "st-fin"], graded: ["Graded", "st-graded"], void: ["Void", "st-void"] };
  const resTag = r => !r.r ? "" : `<span class="tag ${r.r === "W" ? "w" : r.r === "L" ? "l" : "small"}">${r.r === "W" ? "Won" : r.r === "L" ? "Lost" : r.r === "P" ? "Push" : esc(r.r)}${r.act ? " · " + esc(r.act) : ""}</span>`;
  function betRow(r, i) {
    const sp = NCSUN.byId[r.sport], res = r.r === "W" ? "w" : r.r === "L" ? "l" : "p";
    const px = sp.stub ? "" : `${am(r.o)}${r.bk ? " " + esc(r.bk) : ""}`;
    const cl = r.cl ? `got ${esc(r.cl.got)}, closed ${esc(r.cl.closed)}` : "";
    return `<div class="brow ${res}" style="--i:${Math.min(i, 12)}"><span class="res">${r.r === "W" ? "Won" : r.r === "L" ? "Lost" : r.r === "P" ? "Push" : esc(r.r)}</span><span class="bw"><b>${esc(r.pick)}</b><small>${[`<b>${esc(sp.short)}</b>`, px, r.act ? esc(r.act) : "", cl].filter(Boolean).join(" · ")}</small></span>${r.cl ? `<span class="bclv ${sgn(r.clv)}" title="vs the closing line">${r.clv > 0 ? "beat close" : r.clv < 0 ? "missed close" : "matched close"}${r.cl.diff ? ` <b>${esc(r.cl.diff)}</b>` : ""}</span>` : ""}<b class="bu ${sgn(r.pl || 0)}">${fmtU(r.pl || 0)}</b></div>`;
  }
  function betCard(r, opt = {}) {
    const sp = NCSUN.byId[r.sport], st = r.status, badge = sp.badge ? sp.badge(r) : `<span class="tbadge">${esc(r.tier || r.mk)}</span>`;
    const when = r.d ? `${dateTxt(r.d)}${r.t ? " " + timeTxt(r.t) + " ET" : ""}` : (r.raw && r.raw.wk) || "";
    const showEv = r.ev && (opt.home || sp.evInSub) && !(r.detail || "").replace(/ @ /g, " at ").includes(String(r.ev).replace(/ @ /g, " at "));
    const sub = [showEv ? esc(r.ev) : "", r.detail, opt.home ? `<b>${esc(sp.short)}</b>` : "", opt.home || opt.when !== false ? esc(when) : ""].filter(Boolean).join(" · ");
    let line = "";
    if (r.r) line += resTag(r);
    if (r.r && r.cl) line += `<span class="clv ${sgn(r.clv)}">${r.clv > 0 ? "Beat the close" : r.clv < 0 ? "Missed the close" : "Matched the close"} · got ${esc(r.cl.got)}, closed ${esc(r.cl.closed)}${r.cl.diff ? ` · <b>${esc(r.cl.diff)}</b>` : ""}</span>`;
    else if (st === "live") line += `<span class="floor live">In progress</span>`;
    else if (st === "finished") line += `<span class="floor">${esc(sp.finishedText || "Finished · grading soon")}</span>`;
    else if (r.limit) line += `<span class="floor${r.limitGone ? " warn" : ""}">${esc(r.limit)}</span>`;
    if (!r.r && r.e != null) line += `<span>Edge <b style="color:var(--win)">+${r.e.toFixed(1)}</b> pts</span>`;
    if (r.extra) line += `<span>${r.extra}</span>`;
    const stub = sp.stub ? sp.stub(r) : `<span class="px2"><b>${am(r.o)}</b><span>${esc(r.bk)}</span></span>`;   // a model can show its own number (CFB shows the spread or total)
    const body = opt.compact ? "" : bodyHTML(r, sp);
    const iv = opt.i != null ? ` style="--i:${Math.min(opt.i, 12)}"` : "";
    if (!body) return `<article class="bet ${st}${r.paper ? " paper" : ""}"${iv}><div class="sum"><span class="what"><span class="bdg">${badge}</span><b>${esc(r.pick)}</b><span class="sub">${sub}</span></span>${stub}<span class="line">${line}</span></div></article>`;
    return `<details class="bet ${st}${r.paper ? " paper" : ""}"${iv}><summary><span class="what"><span class="bdg">${badge}</span><b>${esc(r.pick)}</b><span class="sub">${sub}</span></span>${stub}<span class="line">${line}<span class="tog"><span class="t1">Details</span><span class="t2">Hide</span></span></span></summary><div class="body">${body}</div></details>`;
  }
  function bodyHTML(r, sp) {
    const cells = sp.cells ? sp.cells(r) : defaultCells(r);
    const grid = cells.length ? `<div class="pricegrid">${cells.map(c => `<div><small>${esc(c[0])}</small><b class="${c[3] || ""}">${esc(c[1])}</b><span>${esc(c[2] || "")}</span></div>`).join("")}</div>` : "";
    const extra = sp.details ? sp.details(r) : "";
    const why = whyChart(sp.why ? sp.why(r) : r.why);
    const foot = `<p class="note">${esc(r.ev || "")}${r.posted ? ` · posted ${esc(stampTxt(r.posted))} ET` : ""}${r.paper ? " · paper only: logged and graded, never staked" : ` · ${r.stake === 0.5 ? "½" : r.stake === 0.25 ? "¼" : r.stake}u · posted picks stand and are graded at this price, even if the line moves`}</p>`;
    return grid + extra + why + foot;
  }
  function defaultCells(r) {
    const c = [["Bet at", am(r.o), r.bk]];
    if (r.p) c.push(["Fair", am(fair(r.p)), pct0(r.p) + " to win"]);
    if (r.e != null) c.push(["Edge", (r.e > 0 ? "+" : "") + r.e.toFixed(1), "pts over the market", r.e > 0 ? "pos" : ""]);
    if (r.m != null) c.push(["Market", am(fair(r.m)), pct0(r.m) + " no-vig"]);
    if (r.worst != null) c.push(["Worst price", typeof r.worst === "number" ? am(r.worst) : r.worst, "still a bet"]);
    return c;
  }
  NCSUN.betCard = betCard; NCSUN.betRow = betRow; NCSUN.whyChart = whyChart;

  // group a list of records: by event, by book, or by tier
  function groupCards(recs, by, sp) {
    const key = by === "book" ? (r => r.bk) : by === "tier" ? (r => r.tier || r.mk) : (r => sp.groupKey ? sp.groupKey(r) : (r.ev || ""));
    const g = new Map(); recs.forEach(r => { const k = key(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r) });
    const order = by === "book" ? ["FanDuel", "DraftKings", "Caesars"] : by === "tier" ? (sp.tierOrder || []) : null;
    let keys = [...g.keys()]; if (order) keys.sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) });
    return { g, keys };
  }
  const AB = { FanDuel: "FD", DraftKings: "DK", Caesars: "CZR", BetMGM: "MGM" };
  function cardList(recs, by, sp, opt = {}) {
    const { g, keys } = groupCards(recs, by, sp);
    return `<div class="books">${keys.map(k => { const rs = g.get(k), head = by === "event" && sp.groupHead ? sp.groupHead(rs[0], rs) : `<div class="bookhead"><span class="logo">${esc(by === "book" ? AB[k] || k.slice(0, 3).toUpperCase() : by === "tier" ? "★" : "▶")}</span><h2>${esc(k)}</h2><span class="note">${rs.length} ${plural(rs.length, "pick")}</span></div>`;
      return `<div>${head}<div class="slip">${rs.map((r, i) => betCard(r, Object.assign({ i }, opt))).join("")}</div></div>` }).join("")}</div>`;
  }
  NCSUN.cardList = cardList;
  function copyLines(recs, sp, title) {
    const L = [title]; let i = 0;
    const { g, keys } = groupCards(recs, "event", sp);
    keys.forEach(k => { L.push("", k); g.get(k).forEach(r => L.push(`${++i}. ${r.pick} · ${r.bk} ${am(r.o)}${r.limit ? " · " + r.limit.replace(/^Take /, "good to ").replace(" or better", "") : ""}${r.detail ? " · " + r.detail : ""}`)) });
    return L.join("\n");
  }

  // ------------------------------------------------------------------ model health line (last run, problems)
  function healthHTML(h) {
    if (!h) return "";
    const color = h.ok === false ? "var(--loss)" : "var(--win)";
    return `<div class="status"><span><span class="dot" style="background:${color}"></span>${esc(h.what || "Updated")} <b>${h.at ? esc(stampTxt(h.at)) + (/ET$/.test(String(h.at)) ? "" : " ET") : "not yet"}</b></span>${NCSUN.owner ? (h.problems || []).map(p => `<span><b>Last run had a problem:</b> ${esc(p)}</span>`).join("") : (h.problems || []).length ? "<span><b>Heads up:</b> updates are running late; picks and grades may lag.</span>" : ""}${h.stale ? `<span><b>Stale:</b> ${esc(h.stale)}</span>` : ""}${h.note ? `<span>${esc(h.note)}</span>` : ""}</div>`;
  }
  // generic health from a <sport>_status.json ({step:{ok,at,msg|note}}) and an "updated" stamp
  function health(status, updated, maxHours, note) {
    const fails = status ? Object.entries(status).filter(([k, v]) => v && typeof v === "object" && v.ok === false).map(([k, v]) => `${k}${v.msg || v.note ? " (" + (v.msg || v.note) + ")" : ""}`) : [];
    const upd = updated ? etDate(updated.slice(0, 10), updated.slice(11, 16) || "00:00") : null;
    const hrs = upd ? (Date.now() - upd.getTime()) / 3.6e6 : null;
    const stale = hrs != null && maxHours && hrs > maxHours ? `the last run reported ${Math.round(hrs)} hours ago` : "";
    return { ok: !fails.length && !stale, at: updated, problems: fails, stale, note };
  }
  NCSUN.health = health; NCSUN.healthHTML = healthHTML;

  // ------------------------------------------------------------------ registry and mounting
  const STANDARD = ["card", "live", "record", "how", "hood"];
  const STOP_LABEL = { card: "Today's card", live: "Live", record: "Backtest", how: "How it works", hood: "Under the hood" };
  NCSUN.register = function (sp) {
    sp.short = sp.short || sp.name; sp.tag = sp.tag || sp.short; sp.recs = { today: null, live: null, record: null };
    NCSUN.sports.push(sp); NCSUN.byId[sp.id] = sp;
  };
  // data: each sport returns {today:[recs], live:[recs], meta:{...}} from its own files
  const loaded = {};
  NCSUN.data = sp => loaded[sp.id] || (loaded[sp.id] = Promise.resolve(sp.load()).then(d => { d = d || {}; d.today = (d.today || []).map(r => finish(r, sp)); d.live = (d.live || []).map(r => finish(r, sp)); sp.data = d; return d }).catch(e => { console.error(sp.id, e); sp.data = { today: [], live: [], meta: {}, error: String(e) }; return sp.data }));
  const recordLoaded = {};
  NCSUN.record = sp => recordLoaded[sp.id] || (recordLoaded[sp.id] = Promise.resolve(sp.loadRecord ? sp.loadRecord() : []).then(rs => (rs || []).map(r => finish(r, sp))).catch(() => []));

  function mount(sp) {
    const root = document.getElementById(sp.id); if (!root) return;
    const stops = sp.stops || STANDARD.slice(); const extras = sp.extras || {};
    const labelOf = s => (sp.labels && sp.labels[s]) || (extras[s] && extras[s].label) || STOP_LABEL[s] || cap(s);
    root.innerHTML = `<nav class="stops" role="tablist" aria-label="${esc(sp.name)} sections">${stops.map((s, i) => `<button role="tab" data-view="${s}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><i>${i + 1}</i><span data-lbl="${s}">${esc(labelOf(s))}</span></button>`).join("")}</nav>
      ${stops.map(s => `<section class="view" data-view="${s}" ${s === stops[0] ? "" : "hidden"}><div id="${sp.id}-${s}"></div></section>`).join("")}`;
    const head = (kicker, h1, lede, extraHTML = "") => `<div><div class="kicker" data-k>${kicker}</div><h1>${h1}</h1><p class="lede" data-lede>${lede}</p>${extraHTML}</div>`;
    const done = {};
    sp.show = v => { if (done[v]) return; done[v] = true; const el = $(`#${sp.id}-${v}`, root); if (!el) return;
      if (v === "card") drawCard(sp, el, head); else if (v === "live") drawLive(sp, el, head); else if (v === "record") drawRecord(sp, el, head);
      else if (v === "how" || v === "hood") { const h = sp[v]; if (typeof h === "function") h(el); else el.innerHTML = h || "" }
      else if (extras[v]) { el.innerHTML = head(extras[v].kicker || "", extras[v].h1 || esc(labelOf(v)), extras[v].lede || "") + `<div id="${sp.id}-${v}-body" class="stack"></div>`; extras[v].draw($(`#${sp.id}-${v}-body`, root)) } };
    root.querySelectorAll("nav.stops button").forEach(b => b.addEventListener("click", () => show(sp.id, b.dataset.view, true)));
  }
  function drawCard(sp, el, head) {
    el.innerHTML = head(esc(sp.kicker || sp.name), sp.h1 || "Today's <em>card</em>", esc(sp.lede || "Every pick is 1 unit. Take the listed price or better. Posted picks stand and are graded at the price they locked."), `<div class="head-row" data-health></div>`) + `<div class="lab-controls" data-ctl hidden><div class="viewtog" role="group" aria-label="Group picks"></div><button class="ghost" data-copy>Copy card</button><span class="note" role="status" aria-live="polite"></span></div><div data-picks><p class="note">Loading…</p></div><div data-after class="stack"></div>`;
    NCSUN.data(sp).then(d => {
      const picks = d.today.filter(r => !r.paper), meta = d.meta || {};
      if (meta.kicker) $("[data-k]", el).textContent = meta.kicker;
      if (meta.lede) { const parts = String(meta.lede).split("<br>"), isNote = p => /^<span class="note">/.test(p);
        let lead = parts.filter(p => !isNote(p)), rest = parts.filter(isNote);
        if (!lead.length && rest.length) lead = [rest.pop()];
        $("[data-lede]", el).innerHTML = lead.join("<br>") + (rest.length ? `<details class="notes"><summary>Model status and notes</summary><div>${rest.map(p => `<p>${p}</p>`).join("")}</div></details>` : "") }
      $("[data-health]", el).innerHTML = healthHTML(meta.health) + trendHTML(sp, d.live);
      const ctl = $("[data-ctl]", el), tog = $(".viewtog", ctl), opts = sp.groupings || ["event", "book", "tier"]; let by = sp.defaultGroup || opts[0];
      const NAMES = { event: sp.groupName || "By game", book: "By book", tier: "By tier" };
      tog.innerHTML = opts.map(o => `<button data-by="${o}" aria-pressed="${o === by}">${esc(NAMES[o])}</button>`).join("");
      const draw = () => {
        if (picks.length) {
          const open = picks.filter(r => !r.r), gr = picks.filter(r => r.r), s = stats(gr);
          const sum = `<div class="slipsum"><span><b>${open.length}</b>${plural(open.length, "open pick")}</span>${meta.stake && meta.stake !== "1u each" ? "" : "<span><b>1u</b>each</span>"}${gr.length ? `<span>${gr.length} graded · ${recTxt(s)}, <b class="${sgn(s.u)}" style="font:inherit">${fmtU(s.u)}</b></span>` : ""}${meta.summary ? `<span>${esc(meta.summary)}</span>` : ""}</div>`;
          const note = !open.length ? `<div class="banner" style="margin-bottom:14px"><b>${esc(meta.emptyHead || "No open picks")}</b><span>${meta.empty || "Nothing open right now."}${gr.length ? " Here's how the last card went." : ""}</span></div>` : "";
          $("[data-picks]", el).innerHTML = note + sum + cardList(picks, by, sp);
          ctl.hidden = false;
        } else $("[data-picks]", el).innerHTML = `<div class="banner"><b>${esc(meta.emptyHead || "No picks")}</b><span>${meta.empty || "Nothing posted right now."}</span></div>` + (meta.exampleHTML || "");
        tog.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.by === by));
      };
      tog.onclick = e => { const b = e.target.closest("button"); if (!b) return; by = b.dataset.by; draw() };
      $("[data-copy]", el).onclick = e => copyText(copyLines(picks.filter(r => !r.r), sp, `${sp.name} · ${meta.copyTitle || "picks"} · ${meta.stake && meta.stake !== "1u each" ? meta.stake : "1 unit each"} · take the listed price or better`), e.target, "Copy card");
      draw(); sp.redrawCard = draw;
      if (d.error) $("[data-picks]", el).insertAdjacentHTML("afterbegin", `<div class="banner err" style="margin-bottom:14px"><b>Couldn't load</b><span>This ride's picks didn't load. Check your connection and refresh; nothing here should be read as "no picks".</span></div>`);
      if (sp.afterCard) sp.afterCard($("[data-after]", el), d);
    });
  }
  function drawLive(sp, el, head) {
    el.innerHTML = head(esc(sp.liveKicker || "Season to date · real picks only"), `${esc(sp.seasonLabel || "")} <em>live</em>`, esc(sp.liveLede || "Every pick posted here, graded at the book and price shown when it locked, 1 unit each. Nothing from the backtest is mixed in.")) + `<div class="stack" data-live></div>`;
    NCSUN.data(sp).then(d => {
      const body = $("[data-live]", el), live = d.live.filter(r => r.status === "graded" || r.status === "void").sort(byTime), graded = live.filter(r => r.status === "graded");
      let html = "";
      if (graded.length) {
        const open = d.today.filter(r => !r.r && !r.paper).length;
        if (sp.clvPanel) html += clvPanel(graded, sp);
        if (sp.liveGroup) html += `<div class="panel" data-lg></div>`;
        html += `<div data-lab class="stack"></div>`;
        body.innerHTML = html;
        if (sp.liveGroup) groupTable($("[data-lg]", body), graded.concat(live.filter(r => r.status === "void")), sp);
        lab($("[data-lab]", body), graded, sp.id + "-lv", sp.seasonLabel || "this season", sp);
      } else {
        const open = d.today.filter(r => !r.r && !r.paper).length;
        body.innerHTML = `<div class="banner"><b>Boarding</b><span>No graded picks yet. ${esc(sp.liveEmpty || "The record starts with the first posted pick.")}${open ? ` ${open} ${plural(open, "pick is", "picks are")} posted and waiting.` : ""}</span></div>`;
      }
      if (sp.afterLive) sp.afterLive(body, d);
    });
  }
  function groupTable(el, rows, sp) {
    const G = sp.liveGroup, g = new Map(); rows.forEach(r => { const k = G.key(r); if (!g.has(k)) g.set(k, { name: G.name(r), rows: [] }); g.get(k).rows.push(r) });
    const ks = [...g.keys()].sort().reverse(), tot = stats(rows);
    el.innerHTML = `<div class="lab-head"><h2>${esc(G.label)}</h2><span class="note">${esc(G.note || "1 unit a bet, graded at the posted price")}</span></div>
      <div class="tbl"><table class="cards-tbl"><thead><tr><th class="l">${esc(G.col || "Card")}</th><th>Bets</th><th>W-L</th><th>Units</th></tr></thead><tbody>
      ${ks.map(k => { const x = g.get(k), s = stats(x.rows); return `<tr><td class="l" style="white-space:normal"><b>${esc(x.name)}</b><br><span class="note">${x.rows.map(r => esc((G.short ? G.short(r) : r.pick) + " " + (r.r === "W" ? "W" : r.r === "L" ? "L" : r.r === "P" ? "P" : "void"))).join(", ")}</span></td><td>${s.n + s.p + s.v}</td><td class="mono">${recTxt(s)}</td><td class="${sgn(s.u)}"><b>${fmtU(s.u)}</b></td></tr>` }).join("")}
      ${ks.length > 1 ? `<tr class="tot"><td>All</td><td>${tot.n + tot.p + tot.v}</td><td class="mono">${recTxt(tot)}</td><td class="${sgn(tot.u)}">${fmtU(tot.u)}</td></tr>` : ""}</tbody></table></div>`;
  }
  function drawRecord(sp, el, head) {
    const R = sp.recordHead || {};
    el.innerHTML = head(esc(R.kicker || "Out-of-sample backtest"), R.h1 || "The <em>ride</em> so far", R.lede || "", R.extra || "") + `<div class="stack" data-rec><p class="note">Loading the graded record…</p></div>`;
    NCSUN.record(sp).then(rs => { const body = $("[data-rec]", el), g = rs.filter(r => r.status === "graded").sort(byTime);
      if (g.length) { if (sp.recordDraw) sp.recordDraw(body, g); else lab(body, g, sp.id + "-bt", R.label || "all seasons", sp) }
      else body.innerHTML = '<div class="banner"><b>Loading</b><span>Record file not published yet.</span></div>' });
  }
  const byTime = (a, b) => (a.d || a.season || "") < (b.d || b.season || "") ? -1 : (a.d || a.season || "") > (b.d || b.season || "") ? 1 : ((a.t || "") < (b.t || "") ? -1 : (a.t || "") > (b.t || "") ? 1 : (a.ord || 0) - (b.ord || 0));
  NCSUN.byTime = byTime;

  // ------------------------------------------------------------------ routing: #home | #<sport> | #<sport>-<view>; old college hashes (#live, #backtest) still work
  let curSport = "home", curView = {};
  function show(sportId, view, push) {
    const prev = curSport, sp0 = NCSUN.byId[sportId]; curSport = sportId; document.documentElement.classList.remove("deep");
    document.querySelectorAll(".seg button, .tabbar button").forEach(b => { const on = b.dataset.model === sportId; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && push) b.scrollIntoView({ block: "nearest", inline: "nearest" }) });
    document.querySelectorAll("main > [data-sport]").forEach(x => x.hidden = x.dataset.sport !== sportId);
    mascot(sportId === "get" ? "home" : sportId);
    const nav = (u) => { if (push) history[prev !== sportId ? "pushState" : "replaceState"](null, "", u) };
    if (sp0 && sp0.onShow) sp0.onShow();
    if (sportId === "get") { nav("#get"); drawGet(); if (!push) scrollTo({ top: 0 }); return }
    if (sportId === "home") { nav(location.pathname + location.search); drawHome(); return }
    const sp = NCSUN.byId[sportId], root = document.getElementById(sportId), stops = [...root.querySelectorAll("nav.stops button")].map(b => b.dataset.view);
    view = stops.includes(view) ? view : stops[0]; curView[sportId] = view;
    root.querySelectorAll("nav.stops button").forEach(b => { const on = b.dataset.view === view; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && push) b.scrollIntoView({ block: "nearest", inline: "nearest" }) });
    root.querySelectorAll("section.view").forEach(s => { const on = s.dataset.view === view; if (on && s.hidden) { s.classList.remove("in"); void s.offsetWidth; s.classList.add("in") } s.hidden = !on });
    nav("#" + sportId + (view === stops[0] ? "" : "-" + view));
    sp.show(view);
    if (prev !== sportId && !push) { scrollTo(0, 0); requestAnimationFrame(() => scrollTo(0, 0)) }
  }
  NCSUN.show = show;
  const TAG_HOME = "All rides";
  const ICON = { home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/></svg>', dot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/></svg>', mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/></svg>' };
  function mascot(id) {
    const h = $("header.top"); const sp = NCSUN.byId[id];
    const m = id === "home" ? (NCSUN.homeMascot || NCSUN.sports[0].id) : id;
    if (h.dataset.sport === m && $("#wm-tag").textContent === (sp ? sp.tag : TAG_HOME)) return;
    h.dataset.sport = m; $("#wm-tag").textContent = sp ? sp.tag : TAG_HOME;
    if (!reduced()) { h.classList.remove("hop"); void h.offsetWidth; h.classList.add("hop") }
  }
  function route() {
    const h = (location.hash || "").slice(1);
    if (!h || h === "home") return show("home", null, false);
    if (h === "get") return show("get", null, false);
    const [sid, ...rest] = h.split("-"); const view = rest.join("-");
    if (NCSUN.byId[sid]) return show(sid, view, false);
    if (["today", "live", "backtest", "how", "hood"].includes(h)) return show("ncaab", h === "today" ? "card" : h === "backtest" ? "record" : h, false);   // links from the first version
    show("home", null, false);
  }

  // ------------------------------------------------------------------ Home: every model, right now
  let homeDrawn = false;
  function drawHome() {
    if (homeDrawn) return; homeDrawn = true;
    const el = document.getElementById("home-body");
    const sports = NCSUN.sports.filter(s => !s.hidden);
    Promise.all(sports.map(s => NCSUN.data(s))).then(async () => {
      const all = sports.flatMap(s => s.data.today.map(r => r).concat(s.data.live.filter(r => !s.data.today.some(t => t.id === r.id))));
      const real = all.filter(r => !r.paper), today = etToday(), yday = addDays(today, -1);
      const live = real.filter(r => r.status === "live").sort(byTime), fin = real.filter(r => r.status === "finished").sort(byTime);
      const posted = real.filter(r => r.status === "posted").sort((a, b) => (a.start ? a.start.getTime() : 9e15) - (b.start ? b.start.getTime() : 9e15) || byTime(a, b));
      const gradedAll = real.filter(r => r.status === "graded"), recent = gradedAll.filter(r => r.d && r.d >= addDays(today, -6)).sort(byTime).reverse();
      const todayG = gradedAll.filter(r => r.d === today), ydayG = gradedAll.filter(r => r.d === yday);
      NCSUN.homeMascot = (live[0] || posted[0] || recent[0] || {}).sport; mascot("home");
      const sT = stats(todayG), sY = stats(ydayG);
      const bits = [];
      if (live.length) bits.push(`<b>${live.length}</b> live now`); if (fin.length) bits.push(`<b>${fin.length}</b> awaiting a grade`);
      bits.push(`<b>${posted.length}</b> posted and waiting`);
      if (todayG.length) bits.push(`today <b>${recTxt(sT)}, ${fmtU(sT.u)}</b>`); else if (ydayG.length) bits.push(`yesterday <b>${recTxt(sY)}, ${fmtU(sY.u)}</b>`);
      $("#home-lede").innerHTML = `<span class="summary">${bits.map(b => `<span>${b}</span>`).join("")}</span><a href="#get" data-go="get">New here? How to read a pick, and picks by email</a>`;
      $("#home-kicker").textContent = `${dateTxt(today)} · a free hobby project · every pick graded in public`;
      // model strip
      const tiles = sports.map((s, i) => { const d = s.data, m = d.meta || {}, g = d.live.filter(r => r.status === "graded").sort(byTime), st = stats(g), open = d.today.filter(r => !r.r && !r.paper), lv = open.filter(r => r.status === "live").length;
        const h = m.health || {}, ok = h.ok !== false, bad = !!d.error;
        return `<a class="tile" href="#${s.id}" data-go="${s.id}" style="--i:${i}"><span class="tile-top"><b>${esc(s.name)}</b><span class="dot" title="${bad ? "Did not load" : ok ? "Updating normally" : "Updates running late"}" style="background:var(${bad ? "--ink2" : ok ? "--win" : "--loss"})"></span></span>
          <span class="tile-rec">${bad ? `<b>–</b><em>didn't load</em>` : g.length ? `<b>${recTxt(st)}</b><em class="${sgn(st.u)}">${fmtU(st.u)}</em>` : `<b>–</b><em>no graded picks yet</em>`}</span>
          ${g.length > 1 ? spark(g.slice(-40), 150, 34) : ""}
          ${(() => { const cv = s.clvFront ? clvStats(g) : null; return cv && cv.n ? `<span class="tile-clv">vs close <b class="${sgn(cv.avg)}">${s.clv.fmt(cv.avg)}${s.clvUnit || ""}</b> · beat it ${cv.beat}/${cv.n}</span>` : "" })()}
          <span class="tile-sub">${lv ? `<b>${lv} live</b> · ` : ""}${open.length ? `<b>${open.length} open</b>` : "nothing open"}${m.next ? ` · ${esc(m.next)}` : ""}</span>
          <span class="tile-foot own">${h.at ? "Run " + esc(stampTxt(h.at)) : esc(m.cadence || "")}</span></a>` }).join("");
      const sec = (id, title, note, recs, opt) => recs.length ? `<section class="hsec" id="h-${id}"><div class="lab-head"><h2>${title}</h2><span class="note">${note}</span></div><div class="slip">${recs.map((r, i) => betCard(r, Object.assign({ home: true, i }, opt))).join("")}</div></section>` : "";
      // posted, grouped by day (CFB has no game date: "this week")
      const dayName = d => !d ? "This week" : d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : dateTxt(d);
      const pdays = new Map(); posted.forEach(r => { const k = r.d || "~"; if (!pdays.has(k)) pdays.set(k, []); pdays.get(k).push(r) });
      const postedHTML = posted.length ? `<section class="hsec" id="h-posted"><div class="lab-head"><h2>Posted and <em>waiting</em></h2><span class="note">${posted.length} ${plural(posted.length, "bet")} · soonest first</span></div>${[...pdays.entries()].map(([d, rs]) => `<div class="dayblk"><div class="dayhead"><b>${esc(dayName(d === "~" ? null : d))}</b><span>${rs.length} ${plural(rs.length, "bet")} · ${[...new Set(rs.map(r => NCSUN.byId[r.sport].short))].join(", ")}</span></div><div class="slip">${rs.map((r, i) => betCard(r, { home: true, i })).join("")}</div></div>`).join("")}</section>` : "";
      // graded, grouped by day
      const days = new Map(); recent.forEach(r => { if (!days.has(r.d)) days.set(r.d, []); days.get(r.d).push(r) });
      const dayBlk = ([d, rs]) => { const s = stats(rs), cv = clvStats(rs.filter(r => r.cl)); return `<div class="dayblk"><div class="dayhead"><b>${esc(dateTxt(d))}</b><span>${recTxt(s)} · <em class="${sgn(s.u)}">${fmtU(s.u)}</em>${cv.n ? ` · beat the close ${cv.beat} of ${cv.n}` : ""}</span></div><div class="brows">${rs.map(betRow).join("")}</div></div>` };
      const dayList = [...days.entries()], recentDays = dayList.slice(0, 2), olderDays = dayList.slice(2);
      const gradedHTML = days.size ? `<section class="hsec" id="h-graded"><div class="lab-head"><h2>Just <em>graded</em></h2><span class="note">last 7 days · what we got and where it closed</span></div>${recentDays.map(dayBlk).join("")}${olderDays.length ? `<details class="more"><summary>Earlier this week<span>${olderDays.length} more ${plural(olderDays.length, "day")} · ${olderDays.reduce((a, x) => a + x[1].length, 0)} picks</span></summary><div class="inner">${olderDays.map(dayBlk).join("")}</div></details>` : ""}</section>` : "";
      // combined ride across every model
      const models = sports.filter(s => !s.hand), hands = sports.filter(s => s.hand);   // hand picks are not model output: kept off the models' track
      const combined = models.flatMap(s => s.data.live.filter(r => r.status === "graded" && (!s.headline || s.headline(r)))).sort(byTime), cs = stats(combined);
      const rideHTML = combined.length ? `<section class="hsec" id="h-ride"><div class="lab-head"><h2>The models, <em>one track</em></h2><span class="note">every model's live picks this season, in date order${hands.length ? ` · ${hands.map(s => esc(s.name)).join(", ")} ${hands.length === 1 ? "is" : "are"} hand picks, shown apart` : ""}</span></div><div class="kpis" id="h-k"></div><div class="panel"><div id="h-chart"></div><div class="legend" style="margin-top:10px">${sports.map(s => { const g = s.data.live.filter(r => r.status === "graded" && (!s.headline || s.headline(r))), st = stats(g); return g.length ? `<span><b>${esc(s.short)}${s.hand ? " (hand picks, not on the track)" : ""}</b> ${recTxt(st)} · <em class="${sgn(st.u)}">${fmtU(st.u)}</em></span>` : "" }).join("")}</div></div></section>` : "";
      const failed = sports.filter(s => s.data.error);
      const errHTML = failed.length ? `<div class="banner err"><b>Couldn't load</b><span>${failed.map(s => esc(s.name)).join(", ")} didn't load, so ${failed.length === sports.length ? "nothing below is current" : "those picks are missing below"}. Check your connection and refresh.</span></div>` : "";
      const nothing = !live.length && !fin.length && !posted.length;
      const quiet = nothing && !failed.length ? `<div class="banner"><b>Quiet</b><span>Nothing open across the models right now. Each ride shows when its next card is due.</span></div>` : "";
      const finHTML = fin.length ? `<details class="more"><summary>Finished, waiting on a grade<span>${fin.length} ${plural(fin.length, "pick")} · results usually land within a few hours</span></summary><div class="inner"><div class="brows">${fin.map((r, i) => `<div class="brow p" style="--i:${Math.min(i, 12)}"><span class="res">Final</span><span class="bw"><b>${esc(r.pick)}</b><small><b>${esc(NCSUN.byId[r.sport].short)}</b>${r.ev ? " · " + esc(r.ev) : ""}</small></span></div>`).join("")}</div></div></details>` : "";
      el.innerHTML = `<div class="homegrid"><div class="hg-open">${errHTML}${quiet}${sec("live", "Live <em>now</em>", "events in progress", live)}${postedHTML}</div>
        <aside class="hg-tiles"><div class="lab-head"><h2>The <em>rides</em></h2><span class="note">this season, live picks only</span></div><div class="tiles">${tiles}</div></aside>
        <div class="hg-done">${finHTML}${gradedHTML}</div><div class="hg-ride">${rideHTML}<div id="h-activity"></div></div></div>`;
      if (combined.length) { kpis($("#h-k"), cs, "models only", null); coaster($("#h-chart"), combined, null) }
      if (NCSUN.owner) activity();
    });
  }
  // ------------------------------------------------------------------ Get picks: what this is, how to read a pick, picks by email
  const GET = { ncaab: ["College hoops", "Spreads and totals from the luck-fade model.", "Early morning on game days (about 5:15 AM ET), Nov to April. Usually 3 to 10 picks."],
    ufc: ["UFC", "Moneylines from the fight model.", "A week or two before each card, as lines open; checked at 9 AM and 5 PM ET."],
    nfl: ["NFL props", "Receiving props (receptions and yards).", "About 80 minutes before each kickoff, just after inactives. Time-sensitive: prop lines move fast."],
    cfb: ["College football", "Our hand-picked sides and totals. Not a model.", "During the week, when we've settled the card."],
    mlb: ["MLB", "Moneylines and totals.", "Daily in season, from 2027."] };
  let getDrawn = false;
  function drawGet() {
    if (getDrawn) return; getDrawn = true;
    const sports = NCSUN.sports.filter(s => !s.hidden);
    $("#get-body").innerHTML = `<div class="ridemap">
        <div class="panel stop"><h3>What this is</h3><p>A few betting models (and one hand-picked card) that post their picks here, then grade every one of them in public at the price they posted. Free. Nothing is sold, and nothing is taken down after the fact.</p></div>
        <div class="panel stop"><h3>How to read a pick</h3><p><b>Maryland +3.5 · DK -110 (good to +3)</b> means: bet Maryland +3.5 at DraftKings at -110. If the line has moved, it is still a bet down to +3. Past that, skip it. A pick is only a pick at the listed number or better.</p></div>
        <div class="panel stop"><h3>Units</h3><p>Every pick is 1 unit unless it says ½u. A unit is whatever you would normally put on one game; keep it the same size every time. The records here count units, not dollars.</p></div>
        <div class="panel stop"><h3>The closing line</h3><p>After a game starts we record where the line <em>closed</em>. If we got +3.5 and it closed +2.5, we beat the close by a point. Over a season that is the best sign a model is finding real value, so every result shows what we got and where it ended.</p></div>
      </div>
      <div class="panel" style="display:grid;gap:14px"><div class="lab-head"><h2>Picks by <em>email</em></h2><span class="note">free · choose your sports · stop any time</span></div>
        <div class="getgrid">${sports.map(s => { const g = GET[s.id] || [s.name, "", ""]; return `<div class="getc"><b>${esc(g[0])}</b><span>${esc(g[1])}</span><small>${esc(g[2])}</small><button class="ghost" data-go="${s.id}">See the ride</button></div>` }).join("")}</div>
        <div class="grid2"><div class="panel flat prose"><h3>Every pick</h3><p>An email the moment a pick posts, with the book, the price and how far it is still a bet. Another if a line changes, and the results once they are graded, with where each line closed. Plus a short recap each morning.</p></div>
          <div class="panel flat prose"><h3>Morning digest</h3><p>One email a day, around 7 AM ET: the open picks in your sports and how yesterday went. Fine for hoops and UFC; too slow for NFL props, which lock about 80 minutes before kickoff.</p></div></div>
        <div class="banner"><b>How to join</b><span>This is a friends list, not a sign-up form. Ask Mark and tell him two things: which sports you want, and whether you want every pick or just the morning digest. To change sports or stop, reply to any pick email.</span></div>
      </div>
      <div class="panel flat prose"><h3>Words you'll see</h3><p><b>Tier</b>: which rule produced the pick; each ride's "How it works" stop explains its tiers. <b>Paper</b>: logged and graded for the record but not bet; paper picks are never emailed. <b>Edge</b>: how far the model's chance is above the price's break-even. <b>Backtest</b>: how the rules would have done in past seasons, simulated, kept apart from the live record. <b>Live</b>: real picks posted here before the games, nothing added later.</p>
        <p class="note">Picks are for information and entertainment, not betting advice, and past results don't guarantee future ones. Sports betting is legal only in some states and only for adults (21+ in most): know your own state's rules. If gambling stops being fun, call 1-800-GAMBLER.</p></div>`;
  }
  // activity log written by the hub (ncsun_hub.py): what was posted, locked and graded, with timestamps
  function activity() {
    load("activity.json").then(a => { const ev = (a && a.events || []).slice().reverse().slice(0, 60); if (!ev.length) return;
      const K = { posted: "Posted", live: "Started", graded: "Graded", void: "Voided", updated: "Updated", alert: "Alert", digest: "Digest" };
      $("#h-activity").innerHTML = `<section class="hsec"><div class="lab-head"><h2>Activity <em>log</em></h2><span class="note">owner view · what the hub saw, newest first${a.updated ? " · checked " + esc(stampTxt(a.updated)) + " ET" : ""}</span></div><div class="panel flat"><ul class="act">${ev.map(e => `<li class="k-${esc(e.kind)}"><span class="mono">${esc(stampTxt(e.ts))}</span><b>${esc((NCSUN.byId[e.sport] || {}).short || e.sport || "")}</b><em>${esc(K[e.kind] || e.kind)}</em><span>${esc(e.text)}</span></li>`).join("")}</ul></div></section>` });
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    const seg = $(".seg"), order = NCSUN.sports.filter(s => !s.hidden);
    seg.innerHTML = `<button role="tab" data-model="home" aria-selected="true">Home</button>` + order.map(s => `<button role="tab" data-model="${s.id}" aria-selected="false" tabindex="-1">${esc(s.navName || s.name)}</button>`).join("") + `<button role="tab" data-model="get" aria-selected="false" tabindex="-1" class="getb">Get picks</button>`;
    const bar = $(".tabbar"); if (bar) bar.innerHTML = `<button role="tab" data-model="home" aria-selected="true">${ICON.home}<span>Home</span></button>` + order.map(s => `<button role="tab" data-model="${s.id}" aria-selected="false" tabindex="-1">${s.icon || ICON.dot}<span>${esc(s.short)}</span></button>`).join("") + `<button role="tab" data-model="get" aria-selected="false" tabindex="-1">${ICON.mail}<span>Get picks</span></button>`;
    document.querySelectorAll(".seg button, .tabbar button").forEach(b => b.addEventListener("click", () => { show(b.dataset.model, curView[b.dataset.model], true); scrollTo({ top: 0 }) }));
    document.querySelectorAll('[role="tablist"]').forEach(tl => tl.addEventListener("keydown", e => { const t = [...tl.querySelectorAll('[role="tab"]')], i = t.indexOf(document.activeElement); if (i < 0) return;
      const j = e.key === "ArrowRight" ? (i + 1) % t.length : e.key === "ArrowLeft" ? (i - 1 + t.length) % t.length : e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : -1; if (j < 0) return; e.preventDefault(); t[j].focus(); t[j].click() }));
    document.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (!g) return; e.preventDefault(); const [s, v] = g.dataset.go.split("-"); show(s, v, true); scrollTo({ top: 0 }) });
    const hh = () => document.documentElement.style.setProperty("--toph", ($("header.top").offsetHeight - 1) + "px"); hh(); addEventListener("resize", hh);
    order.forEach(mount);
    try { history.scrollRestoration = "manual" } catch (e) { }
    addEventListener("hashchange", route); addEventListener("popstate", () => { if (!location.hash) route() }); route(); scrollTo(0, 0);
    if (location.hash) { const top = () => scrollTo(0, 0); addEventListener("load", () => { top(); setTimeout(top, 60); setTimeout(top, 400) }); if (document.readyState === "complete") { setTimeout(top, 60); setTimeout(top, 400) } }   // the hash names an element, so the browser tries to jump to it: a deep link should open at the top
    // hidden sports (a model that hasn't published yet) show up as soon as their files exist
    NCSUN.sports.filter(s => s.hidden && s.probe).forEach(s => load(s.probe).then(x => { if (!x) return; s.hidden = false; seg.insertAdjacentHTML("beforeend", `<button role="tab" data-model="${s.id}" aria-selected="false" tabindex="-1">${esc(s.navName || s.name)}</button>`); seg.lastElementChild.addEventListener("click", () => show(s.id, null, true));
      const bar = $(".tabbar"); if (bar) { bar.insertAdjacentHTML("beforeend", `<button role="tab" data-model="${s.id}" aria-selected="false" tabindex="-1">${s.icon || ICON.dot}<span>${esc(s.short)}</span></button>`); bar.lastElementChild.addEventListener("click", () => { show(s.id, null, true); scrollTo({ top: 0 }) }) } mount(s); homeDrawn = false; if (curSport === "home") drawHome() }));
  }
  NCSUN.boot = boot;   // index.html calls this after every sports/*.js has registered
})();
