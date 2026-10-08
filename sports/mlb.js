/* MLB — slot for next season. Uses the generic feed contract (see README): the pipeline writes
     mlb_today.json    {updated, picks:[row…]}       mlb_live.json  [row…]   mlb_backtest.json [row…]   mlb_status.json {step:{ok,at,msg}}
   where a row is {d, t, ev, pick, detail, mk, tier, o, bk, p, m, e, why:[{label,v,pts}], posted, r, pl, act, clv, season}.
   The tab stays hidden until mlb_status.json exists. Any new model can be added the same way with NCSUN.generic(). */
(function () {
  const U = NCSUN.u, { esc, am, fair, pct0, load } = U, MON = U.MON;
  NCSUN.generic = function (cfg) {
    const id = cfg.id;
    const toRec = r => ({ d: r.d, t: r.t || null, season: r.season || (r.d ? r.d.slice(0, 4) : ""), ev: r.ev || "", pick: r.pick, detail: r.detail || "", mk: r.mk || "", tier: r.tier || r.mk || "", o: r.o, bk: r.bk || "", stake: r.stake || 1,
      p: r.p, m: r.m, e: r.e, r: r.r || null, pl: r.r ? (r.pl || 0) : null, act: r.act || null, clv: r.clv ?? null, posted: r.posted || null, worst: r.worst ?? (r.p && cfg.bar ? fair(r.p - cfg.bar) : null), limit: r.limit || (r.worst != null ? `Take ${am(r.worst)} or better` : null), raw: r });
    return Object.assign({
      id, name: cfg.name, short: cfg.short || cfg.name, tag: cfg.tag || cfg.short || cfg.name, hidden: !!cfg.hidden, probe: `${id}_status.json`,
      kicker: cfg.kicker || cfg.name, h1: cfg.h1 || "Today's <em>card</em>", durationH: cfg.durationH || 3, defaultTime: cfg.defaultTime, seasonLabel: cfg.seasonLabel || "",
      groupings: ["event", "tier", "book"], defaultGroup: "event", minN: 50, defaultDim: "tier",
      clv: cfg.clv, car: cfg.car, labels: cfg.labels || {},
      liveGroup: { label: "Day by day", col: "Day", key: r => r.d, name: r => U.dateTxt(r.d), short: r => r.pick },
      recordHead: cfg.recordHead || { kicker: "Out-of-sample backtest", lede: "Simulated results, not a live record." },
      dims: Object.assign({
        mk: { n: "Market", f: r => r.mk || "–" }, tier: { n: "Tier", f: r => r.tier || r.mk || "–" }, season: { n: "Season", f: r => r.season || (r.d || "").slice(0, 4) },
        book: { n: "Book", f: r => r.bk || "–" }, price: { n: "Price", f: r => r.o <= -150 ? "-150 or shorter" : r.o <= -110 ? "-149 to -110" : r.o < 100 ? "-109 to -101" : r.o <= 150 ? "+100 to +150" : "+151 or longer", order: ["-150 or shorter", "-149 to -110", "-109 to -101", "+100 to +150", "+151 or longer"] },
        edge: { n: "Edge", f: r => r.e == null ? "–" : r.e < 3 ? "Under 3 pts" : r.e < 6 ? "3-6 pts" : "6+ pts", order: ["Under 3 pts", "3-6 pts", "6+ pts", "–"] },
        month: { n: "Month", f: r => r.d ? MON[+r.d.slice(5, 7) - 1] : "–", order: MON },
      }, cfg.dims || {}),
      why: r => { const w = r.raw.why; if (!w || !w.length) return null; return { items: w.map(x => ({ label: x.label, v: x.v, pts: x.pts, txt: (x.pts > 0 ? "+" : "") + Number(x.pts).toFixed(1) })), foot: r.p ? `Model <b>${pct0(r.p)}</b>${r.m != null ? ` · Market <b>${pct0(r.m)}</b>` : ""}` : "" } },
      async load() {
        const [today, live, status] = await Promise.all([load(`${id}_today.json`), load(`${id}_live.json`), load(`${id}_status.json`)]);
        const T = today || { picks: [] }, picks = (T.picks || []).map(toRec), lv = (live || []).filter(r => r.r).map(toRec);
        return { today: picks, live: lv, meta: { health: NCSUN.health(status, T.updated, cfg.maxHours || 36, cfg.note || ""), kicker: T.kicker || null, empty: T.empty || cfg.empty || "Nothing posted right now.", cadence: cfg.cadence || "" } };
      },
      async loadRecord() { const bt = await load(`${id}_backtest.json`); return (bt || []).filter(r => r.r).map(toRec) },
      how: cfg.how || "", hood: cfg.hood || "",
    }, cfg.override || {});
  };
  NCSUN.register(NCSUN.generic({
    id: "mlb", name: "MLB", short: "MLB", tag: "Baseball", hidden: true,
    kicker: "MLB · moneylines and totals", h1: "First <em>pitch</em>", defaultTime: "19:00", durationH: 3.5, seasonLabel: "2027",
    car: '<circle cx="-12" cy="-19" r="5.5" fill="#fff" stroke="var(--ink)" stroke-width="1.6"/><path d="M-15 -22 q3 3 0 6 M-9 -22 q-3 3 0 6" fill="none" stroke="var(--coral)" stroke-width="1.1"/>',
    cadence: "daily in season", note: "Runs each morning in season", empty: "The MLB model joins the site for the 2027 season.",
    how: `<div><div class="kicker">The theory</div><h1>Coming <em>spring</em></h1><p class="lede">The MLB model (LightGBM over Statcast, lineups, park factors, umpires and weather) joins the site for the 2027 season. Its card, live record and backtest will post here in the same format as the other rides.</p></div>`,
  }));
})();
