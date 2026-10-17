/* Mr. Wall Street · Stock Analysis (ronda 134). Every company worth $10B or more: its filings, its statements since 2009, estimates, ranks.
   The numbers come from the "stocks" function (SEC filings, EODHD); this file only reads and shows them. Money is in US dollars, at the rate of each
   period (a 2015 figure at 2015's rate); the reported currency is one click away. A figure we do not have, or cannot convert, shows "—", never a guess. */
(function () {
  "use strict";
  var W = window, MWS = W.MWS || {};
  var esc = MWS.esc || function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DASH = "—";
  var S = { list: null, listAt: 0, listBusy: null, co: {}, fx: {}, log: {}, ctx: { staff: false, sim: false, member: false }, per: "a", cur: "usd", local: false, all: false, sort: { k: "rank", d: 1 }, q: "", region: "all", sector: "", size: 10, lastArg: null, live: null };
  try { var saved = JSON.parse(localStorage.getItem("mws_sa") || "{}"); if (saved.per) S.per = saved.per; if (saved.cur) S.cur = saved.cur; } catch (e) { /* none */ }
  function remember() { try { localStorage.setItem("mws_sa", JSON.stringify({ per: S.per, cur: S.cur })); } catch (e) { /* none */ } }
  function sb() { try { return MWS.sb && MWS.sb(); } catch (e) { return null; } }
  /* speed (134e): what was read once is kept in this browser and shown at once; the fresh copy is read behind it and replaces it.
     The list in localStorage, each company in IndexedDB (no size worry). Any storage error: the page simply reads the database. */
  var LS = { get: function (k) { try { var v = W.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }, set: function (k, v) { try { W.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked */ } } };
  var IDB = (function () {
    var dbp = null;
    function open() { if (dbp) return dbp; dbp = new Promise(function (res) { try { var r = W.indexedDB.open("mws_stocks", 1); r.onupgradeneeded = function () { r.result.createObjectStore("co"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; r.onblocked = function () { res(null); }; } catch (e) { res(null); } }); return dbp; }
    return {
      get: function (k) { return open().then(function (db) { if (!db) return null; return new Promise(function (res) { try { var q = db.transaction("co").objectStore("co").get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }); }); },
      put: function (k, v) { return open().then(function (db) { if (!db) return; try { db.transaction("co", "readwrite").objectStore("co").put(v, k); } catch (e) { /* none */ } }); }
    };
  })();

  /* ---------- formatting ---------- */
  var fin = function (v) { return v != null && v !== "" && isFinite(v); };
  function fmtNum(v, d) { if (!fin(v)) return DASH; return Number(v).toLocaleString("en-US", { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 0 : d }); }
  function neg(s, v) { return v < 0 ? "(" + s.replace("-", "") + ")" : s; }
  function fmtMoney(v, unit) { /* unit: 1e6 or 1e9 */ if (!fin(v)) return DASH; var x = v / unit, d = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2; if (unit === 1e6 && Math.abs(x) >= 1000) d = 0; return neg(fmtNum(x, d), x); }
  function big(v, ccy) { if (!fin(v)) return DASH; var a = Math.abs(v), s = a >= 1e12 ? (v / 1e12).toFixed(2) + "T" : a >= 1e9 ? (v / 1e9).toFixed(a >= 1e11 ? 0 : 1) + "B" : a >= 1e6 ? (v / 1e6).toFixed(0) + "M" : fmtNum(v); return (ccy === "USD" || !ccy ? "$" : "") + s + (ccy && ccy !== "USD" ? " " + ccy : ""); }
  function pct(v, d) { if (!fin(v)) return DASH; return (v * 100).toFixed(d == null ? 1 : d) + "%"; }
  function pctA(v) { if (!fin(v)) return DASH; var a = Math.abs(v); return (v * 100).toFixed(a > 0 && a < 0.01 ? 2 : 1) + "%"; } /* 0.12%, 1.3%, 45.0% */
  function pctS(v, d) { if (!fin(v)) return DASH; return (v > 0 ? "+" : "") + (v * 100).toFixed(d == null ? 1 : d) + "%"; }
  function mult(v) { if (!fin(v) || v <= 0 || v > 999) return DASH; return v.toFixed(v >= 100 ? 0 : 1) + "x"; }
  function px(v, ccy) { if (!fin(v)) return DASH; var d = Math.abs(v) >= 1000 ? 0 : 2; return (ccy === "USD" ? "$" : "") + fmtNum(v, d) + (ccy && ccy !== "USD" ? " " + ccy : ""); }
  function date(d) { return MWS.fmtDate ? MWS.fmtDate(d) : (d || DASH); }
  function cls(v) { return fin(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : ""; }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function mShort(d) { if (!d) return ""; return MON[Number(String(d).slice(5, 7)) - 1] + " " + String(d).slice(2, 4); }

  /* ---------- exchange rates: dollars per unit, by month; a period's flows at its average rate, a balance at its month-end ---------- */
  var CCY_FIX = { GBX: ["GBP", 0.01], GBp: ["GBP", 0.01], ILA: ["ILS", 0.01], ZAC: ["ZAR", 0.01] };
  function loadFx(ccy) {
    var c = String(ccy || "").trim(); if (!c || c.toUpperCase() === "USD") return Promise.resolve(null);
    var C = (CCY_FIX[c] || [c.toUpperCase()])[0];
    if (S.fx[C] !== undefined) return S.fx[C] && S.fx[C].then ? S.fx[C] : Promise.resolve(S.fx[C]);
    var kept = LS.get("mws_sa_fx_" + C); if (kept && kept.m && Date.now() - kept.at < 12 * 3600e3) { S.fx[C] = kept.m; return Promise.resolve(kept.m); }
    var c2 = sb(); if (!c2) return Promise.resolve(null);
    var p = c2.from("stock_fx").select("ccy,m").eq("ccy", C).maybeSingle().then(function (r) { S.fx[C] = r && r.data ? r.data.m : null; if (S.fx[C]) LS.set("mws_sa_fx_" + C, { at: Date.now(), m: S.fx[C] }); return S.fx[C]; }, function () { S.fx[C] = null; return null; });
    S.fx[C] = p; return p;
  }
  function fxRate(ccy, start, end) {
    var c = String(ccy || "USD"); if (c.toUpperCase() === "USD") return 1;
    var fix = CCY_FIX[c] || [c.toUpperCase(), 1], m = S.fx[fix[0]]; if (!m || m.then) return null;
    var e = String(end).slice(0, 7);
    if (!start) { var v = m[e]; if (v == null) { var keys = Object.keys(m).filter(function (k) { return k <= e; }).sort(); v = keys.length && keys[keys.length - 1] >= prevMonth(e, 2) ? m[keys[keys.length - 1]] : null; } return v == null ? null : v * fix[1]; }
    var s = String(start).slice(0, 7), sum = 0, n = 0; Object.keys(m).forEach(function (k) { if (k >= s && k <= e) { sum += m[k]; n++; } });
    if (!n) return null; return sum / n * fix[1];
  }
  function prevMonth(ym, n) { var y = +ym.slice(0, 4), mo = +ym.slice(5, 7) - n; while (mo < 1) { mo += 12; y--; } return y + "-" + String(mo).padStart(2, "0"); }

  /* ---------- styles: the site's own, plus what this section adds ---------- */
  function css() {
    if ($("#sa-css")) return; var st = document.createElement("style"); st.id = "sa-css";
    st.textContent = [
      "#sa-page{--sa-w:1280px}#sa-page .back{margin:0 0 18px}#sa-page .back a{font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3);text-decoration:none}#sa-page .back a:hover{color:var(--fg)}",
      ".sa-bar{display:flex;flex-wrap:wrap;gap:12px 36px;align-items:center;margin:0 0 14px}.sa-bar input[type=search]{background:var(--bg-2);border:1px solid var(--line-2);color:var(--fg);font:inherit;font-size:15px;padding:10px 14px;min-width:260px;flex:1 1 260px;outline:0;border-radius:0}.sa-bar input:focus{border-color:var(--fg-2)}.sa-bar select{background:var(--bg-2);border:1px solid var(--line-2);color:var(--fg-2);font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:9px 10px;border-radius:0}",
      ".sa-wrap{overflow-x:auto;border:1px solid var(--line);background:var(--bg)}.sa-wrap table{border-collapse:collapse;width:100%}.sa-tbl th,.sa-tbl td{white-space:nowrap}.sa-tbl td.num,.sa-tbl th.num{text-align:right;font-variant-numeric:tabular-nums}",
      ".sa-tbl tr.clk{cursor:pointer}.sa-tbl tr.clk:hover td{background:var(--bg-2)}.sa-tbl td .tk{font-family:var(--mono);font-size:11.5px;color:var(--fg-3);margin-left:8px}.sa-tbl td.pos{color:var(--good)}.sa-tbl td.neg{color:var(--bad)}",
      ".sa-fin th:first-child,.sa-fin td:first-child{position:sticky;left:0;background:var(--bg);z-index:1;text-align:left;min-width:220px}.sa-fin thead th:first-child{background:var(--bg-2)}.sa-fin tr.sum td{color:var(--fg);font-weight:500}.sa-fin tr.sub td:first-child{padding-left:28px;color:var(--fg-3)}.sa-fin tr.hd td{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-3);background:var(--bg-2);padding-top:14px}",
      ".sa-fin td .d{color:var(--fg-3);font-size:10px;margin-left:3px;vertical-align:1px}.sa-fin td .r{color:var(--warn);font-size:10px;margin-left:3px;vertical-align:1px;cursor:help}",
      ".sa-hd{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;margin:0 0 18px}.sa-hd h1{font-size:clamp(28px,3.2vw,40px);letter-spacing:-.025em;line-height:1.05}.sa-hd .id{flex:1 1 360px;min-width:0}.sa-hd .meta{font-family:var(--mono);font-size:11.5px;letter-spacing:.04em;color:var(--fg-3);margin-top:8px}.sa-hd .quote{text-align:right}.sa-hd .quote b{font-size:28px;font-weight:500;font-variant-numeric:tabular-nums}.sa-hd .quote .chg{display:block;font-size:13px;margin-top:4px}",
      ".sa-tabs{display:flex;gap:0;border:1px solid var(--line-2);margin:0 0 18px;overflow-x:auto;scrollbar-width:none}.sa-tabs a{font-family:var(--mono);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);text-decoration:none;padding:11px 14px;border-left:1px solid var(--line-2);white-space:nowrap}.sa-tabs a:first-child{border-left:0}.sa-tabs a.on,.sa-tabs a:hover{color:var(--fg);background:var(--bg-2)}",
      ".sa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:1px;margin:0 0 18px}.sa-grid div{background:var(--bg);padding:12px 14px;box-shadow:0 0 0 1px var(--line)}.sa-grid div>span{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-3)}.sa-grid b .pos{color:var(--good)}.sa-grid b .neg{color:var(--bad)}.sa-grid b{display:block;font-weight:500;font-size:17px;margin-top:5px;font-variant-numeric:tabular-nums}.sa-grid b small{color:var(--fg-3);font-size:12px;font-weight:400}",
      ".sa-cols{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px}.sa-cols>div>section+section{margin-top:18px}@media (max-width:980px){.sa-cols{grid-template-columns:1fr}}",
      ".sa-sec{border:1px solid var(--line);background:var(--bg);padding:18px 20px}.sa-sec h3{font-size:15px;font-weight:500;margin:0 0 4px}.sa-sec .sub{color:var(--fg-3);font-size:12.5px;margin:0 0 14px}.sa-sec p{color:var(--fg-2);font-size:14px;line-height:1.55}",
      ".sa-rank{display:grid;grid-template-columns:120px 1fr 44px 44px;gap:6px 10px;align-items:center;font-size:13px}.sa-rank i{display:block;height:6px;background:var(--line-2);position:relative}.sa-rank i b{position:absolute;left:0;top:0;bottom:0;background:var(--fg-2)}.sa-rank i em{position:absolute;top:-3px;width:2px;height:12px;background:var(--warn)}.sa-rank span{color:var(--fg-3)}.sa-rank .n{font-family:var(--mono);font-size:11.5px;text-align:right;color:var(--fg-2)}",
      ".sa-svg{width:100%;height:auto;display:block}.sa-svg text{fill:var(--fg-3);font-family:var(--mono);font-size:10px}.sa-svg .b1{fill:var(--fg-2)}.sa-svg .b2{fill:var(--line-2)}.sa-svg .neg{fill:var(--bad)}.sa-svg .ln{stroke:var(--fg-2);stroke-width:1.5;fill:none}.sa-svg .est{fill:none;stroke:var(--warn);stroke-width:1.5}.sa-svg .act{fill:var(--fg)}.sa-svg .z{stroke:var(--line-2)}",
      ".sa-note{color:var(--fg-3);font-size:12.5px;margin-top:12px;line-height:1.5}.sa-note b{color:var(--fg-2);font-weight:500}.sa-kv{display:grid;grid-template-columns:150px 1fr;gap:6px 14px;font-size:13.5px}.sa-kv span{color:var(--fg-3)}.sa-kv b{font-weight:400;color:var(--fg-2);overflow-wrap:anywhere}",
      ".sa-tv{height:520px;border:1px solid var(--line)}.sa-tv.sm{height:300px}.sa-tvno{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px;text-align:center;color:var(--fg-3);font-size:14px}.sa-tvno p{margin:0;max-width:440px}.sa-staff{border:1px dashed var(--line-2);padding:10px 14px;margin:0 0 14px;font-size:12.5px;color:var(--fg-3);display:flex;gap:14px;flex-wrap:wrap;align-items:center}.sa-staff button{background:0 0;border:1px solid var(--line-2);color:var(--fg-2);font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:6px 10px;cursor:pointer}.sa-staff button:hover{color:var(--fg);border-color:var(--fg-2)}",
      ".sa-pill{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--line-2);padding:2px 6px;color:var(--fg-3);margin-left:6px;vertical-align:2px}.sa-more{margin-top:12px}.sa-more button{background:0 0;border:0;color:var(--fg-2);font:inherit;font-size:13px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:0}",
      ".sa-main{min-width:0}.sa-ttl{font-size:20px;font-weight:500;letter-spacing:-.01em;margin:0 0 14px}.sa-h{font-size:15px;font-weight:500;margin:6px 0 10px}.sa-sel{display:none}",
      "@media (max-width:960px){.sa-sel{display:block;width:100%;margin:0 0 14px;background:var(--bg-2);border:1px solid var(--line-2);color:var(--fg);font:inherit;font-size:15px;padding:10px 12px;border-radius:0}}",
      "#sa-snav{display:flex;flex-direction:column;gap:1px;margin:2px 0 6px}#sa-snav .sa-cn{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-2);padding:10px 10px 2px 28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#sa-snav .sa-sg{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-3);padding:12px 10px 4px 28px}#sa-snav a{padding:6px 10px 6px 28px;font-size:13.5px;border-left:1px solid transparent}#sa-snav a.on{color:var(--fg);background:var(--bg-2);border-left-color:var(--fg-3)}",
      ".sa-check{border:1px solid var(--warn);border-left-width:3px;background:var(--bg);padding:10px 14px;margin:0 0 14px}.sa-check p{margin:0;font-size:13.5px;color:var(--fg-2);line-height:1.5}.sa-check p+p{margin-top:6px}",
      ".sa-pr td.bar{min-width:170px;width:30%}.sa-pr td.bar i{display:block;height:6px;background:var(--line-2);position:relative}.sa-pr td.bar i b{position:absolute;left:0;top:0;bottom:0;background:var(--fg-2)}.sa-pr td.bar i em{position:absolute;top:-3px;width:2px;height:12px;background:var(--warn)}",
      "@media (max-width:720px){.sa-hd .quote{text-align:left}.sa-fin th:first-child,.sa-fin td:first-child{min-width:150px}.sa-tv{height:380px}}",
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- the list ---------- */
  var EUROPE = /^(united kingdom|germany|france|netherlands|switzerland|sweden|denmark|norway|finland|italy|spain|portugal|ireland|belgium|austria|luxembourg|poland|czech republic|hungary|greece|romania|jersey|gb|de|fr|nl|ch|se|dk|no|fi|it|es|pt|ie|be|at|lu|pl|cz|hu|gr|ro)$/i;
  var ASIA = /^(china|japan|south korea|taiwan|hong kong|india|singapore|indonesia|malaysia|thailand|vietnam|philippines|australia|new zealand|kazakhstan|cn|jp|kr|tw|hk|in|sg|id|my|th|vn|ph|au|nz|kz)$/i;
  var ME = /^(saudi arabia|united arab emirates|qatar|kuwait|israel|turkey|sa|ae|qa|kw|il|tr)$/i;
  function region(c) { c = String(c || ""); if (/^(united states|us|usa)$/i.test(c)) return "us"; if (EUROPE.test(c)) return "eu"; if (ASIA.test(c)) return "asia"; if (ME.test(c)) return "me"; return "other"; }
  var LIST_COLS = "id,name,country,sector,kind,rank,cap_usd,active,pe:metrics->v->pe,evx:metrics->v->ev_ebitda,ps:metrics->v->ps,fcfy:metrics->v->fcf_y,grev:metrics->f->g_rev,nm:metrics->f->nm,roic:metrics->f->roic,dy:metrics->p->dy,r1y:metrics->r->r1y,sec:status->sec->>at,eod:status->eod->>at";
  var LIST_KEY = "mws_sa_list_v2";
  /* the list: shown at once from this browser's copy, read again behind it (three pages at the same time, not one after the other) */
  function fetchList() {
    if (S.listBusy) return S.listBusy;
    var c = sb(); if (!c) return Promise.reject(new Error("no client"));
    var page = function (from) { return c.from("stock_universe").select(LIST_COLS).eq("active", true).order("rank", { ascending: true, nullsFirst: false }).order("cap_usd", { ascending: false }).order("id", { ascending: true }).range(from, from + 999).then(function (r) { if (r.error) throw r.error; return r.data || []; }); };
    var more = function (rows, from) { return rows.length === from && from < 8000 ? page(from).then(function (x) { return more(rows.concat(x), from + 1000); }) : rows; };
    S.listBusy = Promise.all([page(0), page(1000), page(2000)]).then(function (p) { var rows = p[0].concat(p[1], p[2]); return more(rows, 3000); }).then(function (rows) {
      S.list = rows; S.listAt = Date.now(); S.listBusy = null; LS.set(LIST_KEY, { at: S.listAt, rows: rows }); return rows;
    }, function (e) { S.listBusy = null; throw e; });
    return S.listBusy;
  }
  function loadList(force) {
    if (force) return fetchList();
    if (S.list && Date.now() - S.listAt < 10 * 60e3) return Promise.resolve(S.list);
    if (!S.list) { var kept = LS.get(LIST_KEY); if (kept && kept.rows && kept.rows.length) { S.list = kept.rows; S.listAt = kept.at || 0; } }
    if (S.list) { /* shown now; the fresh list replaces it when it arrives */
      if (Date.now() - S.listAt > 60e3) fetchList().then(function () { if (S.onList) S.onList(); }, function () { /* the kept copy stays */ });
      return Promise.resolve(S.list);
    }
    return fetchList();
  }
  /* a company is read as soon as the pointer rests on its row, and the 20 largest while the list is idle: opening one is then immediate */
  var preq = [], pbusy = false;
  function prefetch(id, front) { if (!id || S.co[id]) return; if (front) preq.unshift(id); else preq.push(id); pump(); }
  function pump() { if (pbusy || !preq.length) return; var id = preq.shift(); if (S.co[id]) return pump(); pbusy = true; loadCompany(id).then(done, done); function done() { pbusy = false; setTimeout(pump, 150); } }
  var SORTS = { rank: function (r) { return r.rank != null ? r.rank : 1e9 - (r.cap_usd || 0) / 1e9; }, name: function (r) { return String(r.name || r.id).toLowerCase(); }, cap: function (r) { return r.cap_usd; }, r1y: function (r) { return r.r1y; }, pe: function (r) { return r.pe; }, evx: function (r) { return r.evx; }, ps: function (r) { return r.ps; }, fcfy: function (r) { return r.fcfy; }, grev: function (r) { return r.grev; }, nm: function (r) { return r.nm; }, roic: function (r) { return r.roic; }, dy: function (r) { return r.dy; } };
  function renderList(el) {
    css(); var head = '<div class="head rv"><h1>Stock analysis.</h1><p>Every company worth $10 billion or more. Their own filings, every statement since 2009, estimates, dividends, holders, and how each one ranks against the rest.</p></div>';
    el.innerHTML = head + staffBar(null) + '<p class="small muted">Loading the companies…</p>';
    loadList().then(function (rows) { drawList(el, rows, head); }, function (e) { el.innerHTML = head + '<div class="banner bad"><div><b>Could not load the companies.</b><p>' + esc(e && e.message || e) + '</p></div></div>'; });
  }
  function drawList(el, rows, head) {
    var sectors = {}; rows.forEach(function (r) { if (r.sector) sectors[r.sector] = (sectors[r.sector] || 0) + 1; });
    var secOpts = Object.keys(sectors).sort().map(function (s) { return '<option value="' + esc(s) + '"' + (S.sector === s ? " selected" : "") + ">" + esc(s) + " (" + sectors[s] + ")</option>"; }).join("");
    var bar = '<div class="sa-bar"><input type="search" id="sa-q" placeholder="Search a company or ticker" value="' + esc(S.q) + '" autocomplete="off">' +
      '<div class="chips sm" id="sa-reg">' + [["all", "All"], ["us", "US"], ["eu", "Europe"], ["asia", "Asia-Pacific"], ["me", "Middle East"], ["other", "Other"]].map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (S.region === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<select id="sa-sec"><option value="">Every sector</option>' + secOpts + "</select>" +
      '<select id="sa-size">' + [[10, "$10B and more"], [50, "$50B and more"], [200, "$200B and more"], [1000, "$1T and more"]].map(function (x) { return '<option value="' + x[0] + '"' + (S.size === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select></div>";
    el.innerHTML = head + staffBar(null) + progress(rows) + bar + '<div id="sa-lt"></div>';
    var pr = $("#sa-prog-go", el); if (pr) pr.addEventListener("click", function () { pr.disabled = true; pr.textContent = "Refreshing…"; loadList(true).then(function (r2) { drawList(el, r2, head); }, function () { pr.disabled = false; pr.textContent = "Refresh"; }); });
    var redraw = function () { drawRows($("#sa-lt", el), S.list || rows); };
    S.onList = function () { if ($("#sa-lt", el) && el.isConnected) redraw(); }; /* the fresh list, quietly, without touching the search box */
    var idle = W.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    idle(function () { (S.list || rows).slice(0, 20).forEach(function (r) { prefetch(r.id); }); });
    $("#sa-q", el).addEventListener("input", function (e) { S.q = e.target.value; S.shown = 100; redraw(); });
    $("#sa-reg", el).addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; S.region = b.dataset.v; $$("#sa-reg button", el).forEach(function (x) { x.classList.toggle("on", x === b); }); S.shown = 100; redraw(); });
    $("#sa-sec", el).addEventListener("change", function (e) { S.sector = e.target.value; S.shown = 100; redraw(); });
    $("#sa-size", el).addEventListener("change", function (e) { S.size = Number(e.target.value); S.shown = 100; redraw(); });
    redraw();
  }
  function drawRows(box, rows) {
    var q = S.q.trim().toLowerCase(), min = S.size * 1e9;
    var list = rows.filter(function (r) {
      if (S.region !== "all" && region(r.country) !== S.region) return false; if (S.sector && r.sector !== S.sector) return false;
      if (r.cap_usd != null && Number(r.cap_usd) < min) return false; if (r.cap_usd == null && S.size > 10) return false;
      if (q && String(r.name || "").toLowerCase().indexOf(q) < 0 && String(r.id).toLowerCase().indexOf(q) < 0) return false; return true; });
    var f = SORTS[S.sort.k] || SORTS.rank, d = S.sort.d;
    list.sort(function (a, b) { var x = f(a), y = f(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * d; });
    var n = S.shown || 100, th = function (k, label, num) { return '<th data-k="' + k + '" class="' + (num ? "num " : "") + (S.sort.k === k ? "on" : "") + '">' + label + (S.sort.k === k ? (S.sort.d > 0 ? " <i>↑</i>" : " <i>↓</i>") : "") + "</th>"; };
    var body = list.slice(0, n).map(function (r, i) {
      return '<tr class="clk" data-id="' + esc(r.id) + '"><td class="num">' + (r.rank || DASH) + '</td><td class="em"><a class="sym" href="#stocks/' + encodeURIComponent(r.id) + '">' + esc(r.name || r.id) + '</a><span class="tk">' + esc(r.id) + "</span></td>" +
        "<td>" + esc(r.country || DASH) + "</td><td>" + esc(r.sector || DASH) + '</td><td class="num">' + big(r.cap_usd) + '</td><td class="num ' + cls(r.r1y) + '">' + pctS(r.r1y, 0) + '</td><td class="num">' + mult(r.pe) + '</td><td class="num">' + mult(r.evx) + '</td><td class="num">' + mult(r.ps) + '</td><td class="num">' + pct(r.fcfy) + '</td><td class="num ' + cls(r.grev) + '">' + pctS(r.grev, 0) + '</td><td class="num">' + pct(r.nm, 0) + '</td><td class="num">' + pct(r.roic, 0) + '</td><td class="num">' + pct(r.dy) + '</td><td class="num">' + (r.sec ? '<span class="sa-pill" title="Statements from its SEC filings">SEC</span>' : "") + (r.eod ? '<span class="sa-pill" title="Profile, prices and estimates in">EOD</span>' : "") + "</td></tr>";
    }).join("");
    box.innerHTML = '<p class="small muted" style="margin:0 0 8px">' + fmtNum(list.length) + " companies" + (list.length !== rows.length ? " of " + fmtNum(rows.length) : "") + " · market values in US dollars · ratios on the last twelve months</p>" +
      '<div class="sa-wrap"><table class="pt sa-tbl"><thead><tr>' + th("rank", "#", 1) + th("name", "Company") + "<th>Country</th><th>Sector</th>" + th("cap", "Market cap", 1) + th("r1y", "1 year", 1) + th("pe", "P/E", 1) + th("evx", "EV/EBITDA", 1) + th("ps", "P/S", 1) + th("fcfy", "FCF yield", 1) + th("grev", "Sales growth", 1) + th("nm", "Net margin", 1) + th("roic", "ROIC", 1) + th("dy", "Dividend", 1) + '<th class="num">Data</th></tr></thead><tbody>' + (body || '<tr><td colspan="15">No company matches.</td></tr>') + "</tbody></table></div>" +
      (list.length > n ? '<div class="sa-more"><button type="button" id="sa-more">Show ' + Math.min(100, list.length - n) + " more</button></div>" : "");
    $$("th[data-k]", box).forEach(function (h) { h.addEventListener("click", function () { var k = h.dataset.k; S.sort = { k: k, d: S.sort.k === k ? -S.sort.d : (k === "rank" || k === "name" || k === "pe" || k === "evx" || k === "ps" ? 1 : -1) }; drawRows(box, rows); }); });
    $$("tr.clk", box).forEach(function (tr) { tr.addEventListener("click", function (e) { if (e.target.closest("a")) return; location.hash = "#stocks/" + encodeURIComponent(tr.dataset.id); });
      var pre = function () { prefetch(tr.dataset.id, true); }; tr.addEventListener("mouseenter", pre); tr.addEventListener("touchstart", pre, { passive: true }); });
    var more = $("#sa-more", box); if (more) more.addEventListener("click", function () { S.shown = n + 100; drawRows(box, rows); });
  }
  /* staff only: how far the first load has got, and how long the rest should take at the pace of the last half hour */
  function progress(rows) {
    if (!S.ctx.staff || S.ctx.sim || !rows || !rows.length) return "";
    var now = Date.now(), at = function (r) { var t = Math.max(r.eod ? Date.parse(r.eod) : 0, r.sec ? Date.parse(r.sec) : 0); return t > 0 ? t : 0; };
    var total = rows.length, done = 0, last30 = 0, last120 = 0, first30 = now, first120 = now;
    rows.forEach(function (r) { var t = at(r); if (!t) return; done++; if (now - t <= 30 * 60e3) { last30++; first30 = Math.min(first30, t); } if (now - t <= 120 * 60e3) { last120++; first120 = Math.min(first120, t); } });
    /* companies per minute over the window, or over the time since loading began when that is shorter */
    var span = function (first, w) { return Math.max(1, Math.min(w, (now - first) / 60e3)); };
    var pace = last30 >= 5 ? last30 / span(first30, 30) : last120 ? last120 / span(first120, 120) : 0, left = total - done, txt; if (pace < 0.1) pace = 0;
    if (!left) txt = "Data: all " + fmtNum(total) + " companies loaded. Each one refreshes by itself (prices every day, filings when the company files).";
    else if (!pace) txt = "Data: " + fmtNum(done) + " of " + fmtNum(total) + " companies loaded. The function loads a few every minute; nothing new in the last two hours, so it may be waiting for the daily EODHD limit to reset (00:10 UTC).";
    else { var mins = Math.round(left / pace), end = new Date(now + mins * 60e3), hh = Math.floor(mins / 60), mm = mins % 60;
      txt = "Data: " + fmtNum(done) + " of " + fmtNum(total) + " companies loaded (" + Math.floor(done / total * 100) + "%). At the current pace (about " + (pace >= 1 ? Math.round(pace) : pace.toFixed(1)) + " a minute), the rest takes about " + (hh ? hh + " h " : "") + mm + " min, so around " + String(end.getUTCHours()).padStart(2, "0") + ":" + String(end.getUTCMinutes()).padStart(2, "0") + " UTC" + (mins >= 48 * 60 ? " on " + date(end.toISOString().slice(0, 10)) : end.getUTCDate() !== new Date(now).getUTCDate() ? " tomorrow" : "") + ". An estimate: the daily EODHD limit can move the last ones to after 00:10 UTC."; }
    return '<div class="sa-staff" id="sa-prog"><span>' + esc(txt) + '</span><button type="button" id="sa-prog-go">Refresh</button></div>';
  }
  function staffBar(id) {
    if (!S.ctx.staff && !S.ctx.sim) return "";
    var live = S.live === true;
    var txt = S.ctx.sim ? "Preview: this is the section as a member will see it." + (live ? "" : " Members do not see it yet: it is switched off.") : live ? "Members see this section." : "Only you and the admins see this section. Members do not see it until it is switched on (settings: desk_stocks_live = on).";
    return '<div class="sa-staff"><span>' + esc(txt) + "</span>" + (id && S.ctx.staff && !S.ctx.sim ? '<button type="button" id="sa-refresh">Refresh this company now</button><span id="sa-rmsg"></span>' : "") + "</div>";
  }

  /* ---------- one company ---------- */
  var U_COLS = "id,name,country,sector,industry,kind,eodhd,adr,cik,tv,rank,cap_usd,currency,fin_currency,status,metrics,active,updated_at";
  /* one company: from memory, else from this browser's copy (shown at once, read again behind it), else from the database */
  var CO_KEY = "v2:";
  function withFx(co) {
    var st = stmts(co.d), cs = [st.A && st.A.cur, st.Q && st.Q.cur, co.d.profile && co.d.profile.ccy, co.u.currency, co.u.fin_currency];
    (st.A ? st.A.rows : []).concat(st.Q ? st.Q.rows : []).forEach(function (x) { if (x.cur) cs.push(x.cur); });
    var uniq = cs.filter(function (x, i) { return x && cs.indexOf(x) === i; });
    return Promise.all(uniq.map(loadFx)).then(function () { return co; });
  }
  var coBusy = {};
  function fetchCompany(id) {
    if (coBusy[id]) return coBusy[id];
    var c = sb(); if (!c) return Promise.reject(new Error("no client"));
    coBusy[id] = Promise.all([c.from("stock_universe").select(U_COLS).eq("id", id).maybeSingle(), c.from("stock_data").select("*").eq("id", id).maybeSingle()]).then(function (r) {
      if (r[0].error) throw r[0].error; if (!r[0].data) return null;
      var co = { u: r[0].data, d: r[1].data || {}, at: Date.now() };
      return withFx(co).then(function () { S.co[id] = co; IDB.put(CO_KEY + id, co); return co; });
    }).then(function (co) { delete coBusy[id]; return co; }, function (e) { delete coBusy[id]; throw e; });
    return coBusy[id];
  }
  function stamp(co) { return co ? String(co.u && co.u.updated_at) + "|" + String(co.d && co.d.updated_at) : ""; }
  function behind(id, kept) { /* the fresh copy; the page is drawn again only if something changed */
    fetchCompany(id).then(function (co) { if (co && stamp(co) !== stamp(kept) && S.onCo) S.onCo(id); }, function () { /* the kept copy stays */ });
  }
  function loadCompany(id, force) {
    if (force) return fetchCompany(id);
    var have = S.co[id];
    if (have && Date.now() - have.at < 5 * 60e3) return Promise.resolve(have);
    if (have) { behind(id, have); return Promise.resolve(have); }
    return IDB.get(CO_KEY + id).then(function (kept) {
      if (kept && kept.u && Date.now() - (kept.at || 0) < 24 * 3600e3) { S.co[id] = kept; if (Date.now() - kept.at > 60e3) behind(id, kept); return withFx(kept); }
      return fetchCompany(id);
    });
  }
  /* which statements: the SEC's when they are current (US companies file every quarter), else EODHD's; a foreign company filing a 20-F has SEC years and EODHD quarters */
  function stmts(D) {
    var sec = D.sec, f = D.fin, out = { A: null, Q: null };
    var fresh = function (rows) { return rows && rows.length && Date.now() - Date.parse(rows[rows.length - 1].end) < 200 * 864e5; };
    /* years: the SEC's, then the later years EODHD has when the SEC's data lags (some foreign filers' latest 20-F), in the same currency */
    var sA = sec && sec.annual || [], fA = f && f.annual || [];
    if (sA.length) {
      var lastS = Date.parse(sA[sA.length - 1].end), newer = fA.filter(function (r) { return Date.parse(r.end) > lastS + 200 * 864e5; });
      if (!newer.length) out.A = { rows: sA, src: "sec", cur: sec.currency };
      else if (f.currency === sec.currency) out.A = { rows: sA.concat(newer.map(function (r) { var x = {}; for (var k in r) x[k] = r[k]; x.src = "eodhd"; return x; })), src: "sec", cur: sec.currency, added: newer.length };
      else out.A = { rows: fA, src: "eodhd", cur: f.currency };
    } else if (fA.length) out.A = { rows: fA, src: "eodhd", cur: f.currency };
    var steady = function (rows) { var r = rows.slice(-8); for (var i = 1; i < r.length; i++) if ((Date.parse(r[i].end) - Date.parse(r[i - 1].end)) / 864e5 > 125) return false; return r.length >= 4; }; /* foreign filers give half-years: not quarters */
    if (sec && sec.quarterly && sec.quarterly.length >= 4 && fresh(sec.quarterly) && steady(sec.quarterly)) out.Q = { rows: sec.quarterly, src: "sec", cur: sec.currency };
    else if (f && f.quarterly && f.quarterly.length) out.Q = { rows: f.quarterly, src: "eodhd", cur: f.currency };
    else if (sec && sec.quarterly && sec.quarterly.length) out.Q = { rows: sec.quarterly, src: "sec", cur: sec.currency };
    return out;
  }
  function startOf(row, per) { if (row.start) return row.start; var d = new Date(Date.parse(row.end + "T00:00:00Z")); d.setUTCMonth(d.getUTCMonth() - (per === "a" ? 12 : 3)); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  /* a value of a period in the chosen currency: flows at the period's average rate, balances at its end; null when the rate is unknown */
  function conv(v, row, set, kind, per) {
    if (!fin(v)) return null; if (kind === "s" || kind === "n" || S.cur !== "usd" || S.local) return v;
    var ccy = row.cur || set.cur || "USD"; var r = fxRate(ccy, kind === "b" ? null : startOf(row, per), row.end); return r == null ? null : v * r;
  }
  function restMap(D) { var m = {}; ((D.sec && D.sec.restated) || []).forEach(function (x) { var e = String(x.p || "").split(" ")[1]; if (e && !x.split) m[x.k + "|" + e] = x; }); return m; }
  /* the periods to show: years, quarters, or trailing twelve months at each quarter */
  function periods(set, per, A) {
    if (!set) return [];
    if (per !== "t") return set.rows.map(function (r) { return r; });
    var q = set.rows, out = [];
    for (var i = 3; i < q.length; i++) {
      var four = q.slice(i - 3, i + 1); var ok = four.every(function (r, j) { return j === 0 || (Date.parse(r.end) - Date.parse(four[j - 1].end)) / 864e5 < 125; }); if (!ok) continue;
      var d = {}, der = []; var keys = {}; four.forEach(function (r) { Object.keys(r.d).forEach(function (k) { keys[k] = 1; }); });
      var yr = A && A.cur === set.cur ? (A.rows || []).filter(function (a) { return Math.abs(Date.parse(a.end) - Date.parse(q[i].end)) <= 5 * 864e5; })[0] : null;
      Object.keys(keys).forEach(function (k) { var kind = KIND[k] || "f";
        if (kind === "b" || kind === "n") { d[k] = q[i].d[k]; return; }
        if (kind === "s") { var s = four.map(function (r) { return r.d[k]; }); if (s.every(fin)) d[k] = s.reduce(function (a, x) { return a + x; }, 0) / 4; return; }
        var v = four.map(function (r) { return r.d[k]; }); if (v.every(fin)) d[k] = v.reduce(function (a, x) { return a + x; }, 0);
        /* a per-share line over four quarters that end with the year: the year's own figure when one quarter's is not known on its own */
        else if (kind === "e" && yr && fin(yr.d[k])) d[k] = yr.d[k]; });
      out.push({ end: q[i].end, start: four[0].start || startOf(four[0], "q"), fyl: q[i].fyl, fq: q[i].fq, cur: q[i].cur, d: d, ttm: true });
    }
    return out;
  }
  var KIND = { rev: "f", cogs: "f", gp: "f", rnd: "f", sga: "f", opex: "f", opinc: "f", intexp: "f", pretax: "f", tax: "f", ni: "f", nic: "f", eps: "e", epsd: "e", shb: "s", shd: "s", dps: "e", nii: "f", nonii: "f", prov: "f", nonie: "f", ebitda: "f", cash: "b", sti: "b", recv: "b", inv: "b", ca: "b", ppe: "b", gw: "b", intang: "b", ta: "b", ap: "b", cl: "b", debtc: "b", debtl: "b", debtt: "b", tl: "b", eq: "b", nci: "b", re: "b", sho: "n", cfo: "f", da: "f", sbc: "f", capex: "f", acq: "f", cfi: "f", divp: "f", buyb: "f", dissue: "f", drepay: "f", cff: "f" };
  /* lines: label, key (or a function of the period's values), kind, style; negative: shown as an outflow */
  var LINES = {
    is: [["Revenue", "rev", "f", "sum"], ["Cost of revenue", "cogs", "f", "sub"], ["Gross profit", "gp", "f", "sum"], ["Research and development", "rnd", "f", "sub"], ["Selling, general and admin", "sga", "f", "sub"], ["Operating income", "opinc", "f", "sum"], ["EBITDA", function (d) { return fin(d.opinc) && fin(d.da) ? d.opinc + d.da : (fin(d.ebitda) ? d.ebitda : null); }, "f", ""], ["Interest expense", "intexp", "f", "sub"], ["Pre-tax income", "pretax", "f", ""], ["Income tax", "tax", "f", "sub"], ["Net income", "ni", "f", "sum"], ["Net income to common", "nic", "f", "sub"], ["EPS, basic", "eps", "e", ""], ["EPS, diluted", "epsd", "e", "sum"], ["Diluted shares, millions", "shd", "s", ""], ["Dividend per share", "dps", "e", ""],
      ["hd", "Banks"], ["Net interest income", "nii", "f", ""], ["Non-interest income", "nonii", "f", ""], ["Provision for credit losses", "prov", "f", "sub"], ["Non-interest expense", "nonie", "f", "sub"]],
    bs: [["Cash and equivalents", "cash", "b", ""], ["Short-term investments", "sti", "b", "sub"], ["Receivables", "recv", "b", "sub"], ["Inventory", "inv", "b", "sub"], ["Current assets", "ca", "b", "sum"], ["Property, plant and equipment", "ppe", "b", ""], ["Goodwill", "gw", "b", "sub"], ["Other intangibles", "intang", "b", "sub"], ["Total assets", "ta", "b", "sum"], ["Payables", "ap", "b", "sub"], ["Short-term debt", "debtc", "b", "sub"], ["Current liabilities", "cl", "b", "sum"], ["Long-term debt", "debtl", "b", ""], ["Total debt", function (d) { return fin(d.debtc) || fin(d.debtl) ? (d.debtc || 0) + (d.debtl || 0) : (fin(d.debtt) ? d.debtt : null); }, "b", "sum"], ["Net debt", function (d) { var t = fin(d.debtc) || fin(d.debtl) ? (d.debtc || 0) + (d.debtl || 0) : d.debtt; return fin(t) && fin(d.cash) ? t - d.cash - (d.sti || 0) : null; }, "b", ""], ["Total liabilities", "tl", "b", "sum"], ["Minority interest", "nci", "b", "sub"], ["Shareholders' equity", "eq", "b", "sum"], ["Retained earnings", "re", "b", "sub"], ["Shares outstanding, millions", "sho", "n", ""]],
    cf: [["Operating cash flow", "cfo", "f", "sum"], ["Depreciation and amortization", "da", "f", "sub"], ["Stock-based compensation", "sbc", "f", "sub"], ["Capital expenditure", "capex", "f", "sub", true], ["Free cash flow", function (d) { return fin(d.cfo) && fin(d.capex) ? d.cfo - d.capex : null; }, "f", "sum"], ["Acquisitions", "acq", "f", "sub", true], ["Investing cash flow", "cfi", "f", "sum"], ["Dividends paid", "divp", "f", "sub", true], ["Share buybacks", "buyb", "f", "sub", true], ["Debt issued", "dissue", "f", "sub"], ["Debt repaid", "drepay", "f", "sub", true], ["Financing cash flow", "cff", "f", "sum"]],
  };
  function lineVal(line, row, set, per) {
    var key = line[1], kind = line[2], raw = typeof key === "function" ? key(row.d) : row.d[key];
    if (!fin(raw)) return null; if (line[4]) raw = -Math.abs(raw);
    return conv(raw, row, set, kind, per);
  }
  function colLabel(r, per) { var fy = r.fyl ? "FY" + String(r.fyl).slice(per === "a" ? 0 : 2) : r.end.slice(0, 4); return per === "a" ? fy : per === "t" ? "TTM" : "Q" + (r.fq || "?") + " " + fy; }
  function finTable(D, which, per) {
    var st = stmts(D), set = per === "a" ? st.A : st.Q; if (!set) return '<p class="muted">No statements yet for this company.</p>';
    var rows = periods(set, per, st.A); if (!rows.length) return '<p class="muted">No ' + (per === "a" ? "yearly" : "quarterly") + " figures.</p>";
    /* no dollar rate for this currency (the rates are not in the EODHD plan): the figures in the currency of the reports, said so */
    var lastEnd = rows[rows.length - 1].end, noRate = S.cur === "usd" && set.cur && String(set.cur).toUpperCase() !== "USD" && fxRate(set.cur, null, lastEnd) == null;
    S.local = noRate; try { return finTableIn(D, which, per, st, set, rows, noRate); } finally { S.local = false; }
  }
  function finTableIn(D, which, per, st, set, rows, noRate) {
    var shown = per === "a" ? rows.slice(-17) : S.all ? rows : rows.slice(-12);
    var rm = set.src === "sec" ? restMap(D) : {}, lines = LINES[which];
    var maxAbs = 0; shown.forEach(function (r) { ["rev", "ta", "cfo"].forEach(function (k) { var v = conv(r.d[k], r, set, "f", per); if (fin(v)) maxAbs = Math.max(maxAbs, Math.abs(v)); }); });
    var unit = maxAbs >= 5e10 ? 1e9 : 1e6, unitName = unit === 1e9 ? "billions" : "millions";
    var ccyName = S.cur === "usd" && !noRate ? "US dollars" : (set.cur || "reported currency");
    var body = "", any = false, hdr = "", bankNet = set.src === "eodhd" && D.fin && D.fin.bankNet;
    lines.forEach(function (ln) {
      if (ln[0] === "hd") { hdr = '<tr class="hd"><td>' + esc(ln[1]) + '</td><td colspan="' + shown.length + '"></td></tr>'; return; } /* a heading only above lines that have figures */
      var vals = shown.map(function (r) { return lineVal(ln, r, set, per); }); if (!vals.some(fin)) return; any = true; body += hdr; hdr = "";
      if (bankNet && ln[1] === "rev") ln = ["Net revenue (after interest paid)"].concat(ln.slice(1));
      var key = typeof ln[1] === "string" ? ln[1] : null, kind = ln[2];
      body += '<tr class="' + (ln[3] || "") + '"><td>' + esc(ln[0]) + "</td>" + vals.map(function (v, i) {
        var r = shown[i], t = !fin(v) ? DASH : kind === "e" ? neg(fmtNum(v, 2), v) : kind === "s" || kind === "n" ? fmtNum(v / 1e6, 1) : fmtMoney(v, unit);
        var mark = ""; if (key && r.der && r.der.indexOf(key) >= 0) mark = '<span class="d" title="Not reported for this quarter on its own: the year (or year to date) less the quarters before">◦</span>';
        var rs = key && !r.ttm ? rm[key + "|" + r.end] : null; if (rs) mark += '<span class="r" title="Restated. First filed ' + esc(rs.filed0 || "") + ": " + esc(fmtNum(rs.was, Math.abs(rs.was) < 100 ? 2 : 0)) + "; latest " + esc(rs.filed || "") + ": " + esc(fmtNum(rs.now, Math.abs(rs.now) < 100 ? 2 : 0)) + ' (reported currency)">r</span>';
        return '<td class="num">' + t + mark + "</td>"; }).join("") + "</tr>";
    });
    if (!any) return '<p class="muted">No figures on these lines.</p>';
    var head = "<tr><th>" + esc(ccyName + ", " + unitName) + "</th>" + shown.map(function (r) { return '<th class="num">' + esc(colLabel(r, per)) + '<br><small class="muted">' + esc(mShort(r.end)) + "</small></th>"; }).join("") + "</tr>";
    var src = set.src === "sec" ? "From the company's own filings at the SEC (" + (D.sec && D.sec.tax === "ifrs-full" ? "20-F, IFRS" : "10-K and 10-Q") + "): the latest figure filed for each period." + (set.added ? " The last " + (set.added > 1 ? set.added + " years are" : "year is") + " from EODHD: the SEC's data does not have " + (set.added > 1 ? "them" : "it") + " yet." : "") : "From EODHD's records of the company's reports." + (bankNet ? " A bank's revenue here is net: the interest and fees it received less the interest it paid (shown as interest expense), as the bank and Koyfin count it." : "");
    var more = per !== "a" && rows.length > 12 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the last 12 only" : "Show all " + rows.length + " periods") + "</button></div>" : "";
    return '<div class="sa-wrap"><table class="pt sa-tbl sa-fin"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>" + more +
      '<p class="sa-note">' + esc(src) + (noRate ? " In " + esc(set.cur) + ", the currency of the reports: there is no dollar rate for " + esc(set.cur) + " yet." : "") + (S.cur === "usd" && !noRate && set.cur && set.cur !== "USD" ? " Reported in " + esc(set.cur) + "; shown in US dollars at each period's average rate (balance sheet: the rate at its end). A period without a rate shows —." : "") + (shown.some(function (r) { return r.split; }) ? " Per-share figures and share counts before a stock split are on today's basis." : "") + ' <b>◦</b> derived from the year or year-to-date figure. <b>r</b> restated: the company changed the figure in a later filing (hover for both).</p>';
  }

  /* ---------- ratios, period by period ---------- */
  function usdOf(v, row, set, kind, per) { if (!fin(v)) return null; if (kind === "s" || kind === "n") return v; var r = fxRate(row.cur || set.cur || "USD", kind === "b" ? null : startOf(row, per), row.end); return r == null ? null : v * r; }
  function priceAt(D, end) { var m = (D.prices && D.prices.m) || []; var ym = String(end).slice(0, 7), dd = Number(String(end).slice(8, 10)); if (dd <= 7) ym = prevMonth(ym, 1); for (var i = m.length - 1; i >= 0; i--) { if (String(m[i][0]).slice(0, 7) === ym) return { px: m[i][1], date: m[i][0] }; if (String(m[i][0]).slice(0, 7) < ym) break; } return null; }
  function ratioRows(co, per) {
    var D = co.d, st = stmts(D), set = per === "a" ? st.A : st.Q; if (!set) return null;
    var rows = periods(set, per === "a" ? "a" : "t", st.A); if (!rows.length) return null;
    var debtOf = function (d) { return fin(d.debtc) || fin(d.debtl) ? (d.debtc || 0) + (d.debtl || 0) : (fin(d.debtt) ? d.debtt : null); };
    var lc = D.profile && D.profile.ccy, adrMix = co.u.kind === "adr" && /\.US$/.test(co.u.eodhd || "");
    var out = rows.map(function (r, i) {
      var p = per === "a" ? rows[i - 1] : rows[i - 4]; var d = r.d, q = p ? p.d : {};
      var avg = function (k) { return fin(d[k]) && fin(q[k]) ? (d[k] + q[k]) / 2 : d[k]; };
      var rev = d.rev, ebitda = fin(d.opinc) && fin(d.da) ? d.opinc + d.da : d.ebitda, fcf = fin(d.cfo) && fin(d.capex) ? d.cfo - d.capex : null, debt = debtOf(d), cash = fin(d.cash) ? d.cash + (d.sti || 0) : null;
      var t = fin(d.tax) && fin(d.pretax) && d.pretax > 0 ? Math.min(0.5, Math.max(0, d.tax / d.pretax)) : 0.21;
      var ic = fin(d.eq) ? d.eq + (debt || 0) - (cash || 0) : null, icP = fin(q.eq) ? q.eq + (debtOf(q) || 0) - (fin(q.cash) ? q.cash + (q.sti || 0) : 0) : null, icA = fin(ic) && fin(icP) ? (ic + icP) / 2 : ic;
      var g = function (a, b) { return fin(a) && fin(b) && b > 0 ? a / b - 1 : null; };
      /* banks and insurers: no gross / operating / EBITDA margin and no ROIC (their revenue and debt mean other things); a margin above 100% or a gross
         profit above revenue is a mismatch of two lines' definitions: "—" rather than a wrong number */
      var finCo = fin(d.nii) || fin(d.prov), mg = function (v) { return fin(v) && rev > 0 && v / rev <= 1 && v / rev >= -10 ? v / rev : null; };
      var x = { end: r.end, fyl: r.fyl, fq: r.fq, ttm: r.ttm,
        gm: finCo || !(fin(d.gp) && d.gp <= rev * 1.0001) ? null : mg(d.gp), om: finCo ? null : mg(d.opinc), em: finCo ? null : mg(ebitda), nm: fin(d.ni) && rev > 0 ? d.ni / rev : null, fm: finCo ? null : mg(fcf),
        roe: fin(d.ni) && avg("eq") > 0 ? d.ni / avg("eq") : null, roa: fin(d.ni) && avg("ta") > 0 ? d.ni / avg("ta") : null,
        roic: !finCo && fin(d.opinc) && fin(debt) && d.eq > 0 && icA > 0 && ic >= 0.25 * (d.eq + debt) && Math.abs(d.opinc * (1 - t) / icA) <= 1 ? d.opinc * (1 - t) / icA : null,
        g_rev: g(rev, q.rev), g_op: g(d.opinc, q.opinc), g_ni: g(d.ni, q.ni), g_eps: g(d.epsd, q.epsd), g_fcf: g(fcf, fin(q.cfo) && fin(q.capex) ? q.cfo - q.capex : null),
        de: fin(debt) && d.eq > 0 ? debt / d.eq : null, nde: fin(debt) && fin(cash) && ebitda > 0 ? (debt - cash) / ebitda : null, cov: fin(d.opinc) && d.intexp > 0 ? d.opinc / d.intexp : null, cr: fin(d.ca) && d.cl > 0 ? d.ca / d.cl : null, la: fin(d.tl) && d.ta > 0 ? d.tl / d.ta : null };
      if (!adrMix) { var P = priceAt(D, r.end), sh = fin(d.sho) ? d.sho : fin(d.shb) ? d.shb : d.shd;
        if (P && fin(P.px) && fin(sh) && sh > 0) { var fxl = fxRate(lc || "USD", null, r.end); if (fxl != null) {
          var cap = P.px * sh * fxl, u = function (v, k) { return usdOf(v, r, set, k || "f", per === "a" ? "a" : "q"); };
          var niU = u(d.ni), revU = u(rev), eqU = u(d.eq, "b"), ebU = u(ebitda), fcfU = u(fcf), debtU = u(debt, "b"), cashU = u(cash, "b"), nciU = u(d.nci, "b");
          var ev = fin(debtU) || fin(cashU) ? cap + (debtU || 0) + (nciU || 0) - (cashU || 0) : null;
          x.cap = cap; x.ev = ev; x.pe = niU > 0 ? cap / niU : null; x.ps = revU > 0 ? cap / revU : null; x.pb = eqU > 0 ? cap / eqU : null; x.eve = ev && ebU > 0 ? ev / ebU : null; x.evs = ev && revU > 0 ? ev / revU : null; x.fy = fin(fcfU) ? fcfU / cap : null;
          var dps = u(d.dps, "e"), pxU = P.px * fxl; x.dy = fin(dps) && pxU > 0 ? dps / pxU : null; } } }
      return x;
    });
    /* a check before any multiple is shown: the last period's market value must be near today's (a share count on another basis, an ADR, would be off by a ratio) */
    var last = out[out.length - 1]; if (last && fin(last.cap) && fin(co.u.cap_usd) && (last.cap / co.u.cap_usd > 4 || last.cap / co.u.cap_usd < 0.25)) out.forEach(function (x) { ["cap", "ev", "pe", "ps", "pb", "eve", "evs", "fy", "dy"].forEach(function (k) { x[k] = null; }); });
    return { rows: out, set: set };
  }
  var RATIO_LINES = [["hd", "Margins"], ["Gross margin", "gm", "p"], ["Operating margin", "om", "p"], ["EBITDA margin", "em", "p"], ["Net margin", "nm", "p"], ["Free cash flow margin", "fm", "p"], ["hd", "Returns"], ["Return on equity", "roe", "p"], ["Return on assets", "roa", "p"], ["Return on invested capital", "roic", "p"], ["hd", "Growth, year on year"], ["Revenue", "g_rev", "g"], ["Operating income", "g_op", "g"], ["Net income", "g_ni", "g"], ["EPS, diluted", "g_eps", "g"], ["Free cash flow", "g_fcf", "g"],
    ["hd", "Balance sheet"], ["Debt / equity", "de", "x"], ["Net debt / EBITDA", "nde", "xx"], ["Interest cover (operating income / interest)", "cov", "x"], ["Current ratio", "cr", "x"], ["Liabilities / assets", "la", "p"],
    ["hd", "Valuation at the period's end (US dollars)"], ["Market value", "cap", "m"], ["Enterprise value", "ev", "m"], ["Price / earnings", "pe", "x"], ["Price / sales", "ps", "x"], ["Price / book", "pb", "x"], ["EV / EBITDA", "eve", "x"], ["EV / sales", "evs", "x"], ["Free cash flow yield", "fy", "p"], ["Dividend yield", "dy", "p"]];
  /* groups: the headings of RATIO_LINES to show (one page each in the side menu); all when not given */
  function ratioTable(co, per, groups, note) {
    var R = ratioRows(co, per); if (!R) return '<p class="muted">No statements yet for this company.</p>';
    var shown = per === "a" ? R.rows.slice(-15) : S.all ? R.rows : R.rows.slice(-12);
    var body = "", inG = !groups, anyRow = false, hdr = "";
    RATIO_LINES.forEach(function (ln) {
      if (ln[0] === "hd") { inG = !groups || groups.indexOf(ln[1]) >= 0; hdr = inG && (!groups || groups.length > 1) ? '<tr class="hd"><td>' + esc(ln[1]) + '</td><td colspan="' + shown.length + '"></td></tr>' : ""; return; }
      if (!inG) return;
      var vals = shown.map(function (x) { return x[ln[1]]; }); if (!vals.some(fin)) return;
      body += hdr; hdr = ""; anyRow = true;
      body += "<tr><td>" + esc(ln[0]) + "</td>" + vals.map(function (v) { var t = ln[2] === "p" ? pct(v) : ln[2] === "g" ? pctS(v) : ln[2] === "x" ? (fin(v) ? v.toFixed(v >= 100 ? 0 : 1) + "x" : DASH) : ln[2] === "xx" ? (fin(v) ? v.toFixed(1) + "x" : DASH) : big(v); return '<td class="num ' + (ln[2] === "g" ? cls(v) : "") + '">' + t + "</td>"; }).join("") + "</tr>";
    });
    if (!anyRow) return '<p class="muted">' + esc(note && note.none || "No figures for these lines.") + "</p>";
    var head = "<tr><th>" + (per === "a" ? "Fiscal years" : "Trailing twelve months, at each quarter") + "</th>" + shown.map(function (r) { return '<th class="num">' + esc(colLabel(r, per === "a" ? "a" : "t")) + '<br><small class="muted">' + esc(mShort(r.end)) + "</small></th>"; }).join("") + "</tr>";
    var more = per !== "a" && R.rows.length > 12 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the last 12 only" : "Show all " + R.rows.length + " periods") + "</button></div>" : "";
    return '<div class="sa-wrap"><table class="pt sa-tbl sa-fin"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>" + more +
      '<p class="sa-note">' + esc(note && note.text || "Computed here from the company's statements. A ratio on a loss, or one we cannot check, shows —.") + "</p>";
  }

  /* ---------- small charts ---------- */
  function bars(series, opt) { /* series: [{l, a, b}] a = main bar, b = second (thinner) */
    opt = opt || {}; var w = 640, h = opt.h || 180, pad = 22, n = series.length; if (!n) return "";
    var vals = []; series.forEach(function (s) { if (fin(s.a)) vals.push(s.a); if (fin(s.b)) vals.push(s.b); }); if (!vals.length) return "";
    var mx = Math.max(0, Math.max.apply(null, vals)), mn = Math.min(0, Math.min.apply(null, vals)), span = mx - mn || 1, y0 = pad + (mx / span) * (h - 2 * pad), bw = (w - 20) / n;
    var y = function (v) { return pad + ((mx - v) / span) * (h - 2 * pad); };
    var g = series.map(function (s, i) { var x = 10 + i * bw; var o = "";
      if (fin(s.a)) o += '<rect class="' + (s.a < 0 ? "neg" : "b2") + '" x="' + (x + bw * 0.12).toFixed(1) + '" y="' + Math.min(y(s.a), y0).toFixed(1) + '" width="' + (bw * 0.76).toFixed(1) + '" height="' + Math.max(1, Math.abs(y(s.a) - y0)).toFixed(1) + '"/>';
      if (fin(s.b)) o += '<rect class="' + (s.b < 0 ? "neg" : "b1") + '" x="' + (x + bw * 0.32).toFixed(1) + '" y="' + Math.min(y(s.b), y0).toFixed(1) + '" width="' + (bw * 0.36).toFixed(1) + '" height="' + Math.max(1, Math.abs(y(s.b) - y0)).toFixed(1) + '"/>';
      if (n <= 20 || i % Math.ceil(n / 12) === 0) o += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + esc(s.l) + "</text>"; return o; }).join("");
    return '<svg class="sa-svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opt.label || "chart") + '"><line class="z" x1="10" x2="' + (w - 10) + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '"/>' + g + "</svg>";
  }
  function epsChart(hist) { /* hist rows: [q, report, when, cur, act, est] */
    var rows = hist.filter(function (h) { return fin(h[4]) || fin(h[5]); }).slice(-12); if (!rows.length) return "";
    var w = 640, h = 180, pad = 22, vals = []; rows.forEach(function (r) { if (fin(r[4])) vals.push(r[4]); if (fin(r[5])) vals.push(r[5]); });
    var mx = Math.max.apply(null, vals.concat([0])), mn = Math.min.apply(null, vals.concat([0])), span = mx - mn || 1, bw = (w - 20) / rows.length, y = function (v) { return pad + ((mx - v) / span) * (h - 2 * pad); };
    return '<svg class="sa-svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="EPS against the estimate"><line class="z" x1="10" x2="' + (w - 10) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>' + rows.map(function (r, i) { var x = 10 + i * bw + bw / 2, o = "";
      if (fin(r[5])) o += '<circle class="est" cx="' + x.toFixed(1) + '" cy="' + y(r[5]).toFixed(1) + '" r="7"/>'; if (fin(r[4])) o += '<circle class="act" cx="' + x.toFixed(1) + '" cy="' + y(r[4]).toFixed(1) + '" r="4.5"/>';
      return o + '<text x="' + x.toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + esc(mShort(r[0])) + "</text>"; }).join("") + "</svg>";
  }
  function line(points, opt) { /* points: [[date, v]] */
    var p = points.filter(function (x) { return fin(x[1]); }); if (p.length < 2) return ""; opt = opt || {};
    var w = 640, h = opt.h || 160, pad = 18, t0 = Date.parse(p[0][0]), t1 = Date.parse(p[p.length - 1][0]) || t0 + 1, vs = p.map(function (x) { return x[1]; }), mx = Math.max.apply(null, vs), mn = Math.min.apply(null, vs), span = mx - mn || Math.abs(mx) || 1;
    var X = function (d) { return 10 + (Date.parse(d) - t0) / (t1 - t0 || 1) * (w - 20); }, Y = function (v) { return pad + (mx - v) / span * (h - 2 * pad); };
    return '<svg class="sa-svg" viewBox="0 0 ' + w + " " + h + '"><path class="ln" d="' + p.map(function (x, i) { return (i ? "L" : "M") + X(x[0]).toFixed(1) + " " + Y(x[1]).toFixed(1); }).join("") + '"/><text x="10" y="12">' + esc(opt.fmt ? opt.fmt(mx) : fmtNum(mx, 2)) + '</text><text x="10" y="' + (h - 4) + '">' + esc(opt.fmt ? opt.fmt(mn) : fmtNum(mn, 2)) + '</text><text x="' + (w - 10) + '" y="' + (h - 4) + '" text-anchor="end">' + esc(mShort(p[p.length - 1][0])) + "</text></svg>";
  }
  /* exchanges whose prices TradingView does not show in charts embedded on other sites ("This symbol is only available on TradingView"):
     a link to the chart on TradingView instead of an empty box */
  var TV_NO_EMBED = /^(KRX|NSE|BSE|TADAWUL|ADX|DFM|QSE|KSE|EGX):/;
  function tvWidget(el, symbol, small) {
    if (!el || !symbol || el.dataset.on === symbol) return; el.dataset.on = symbol;
    if (TV_NO_EMBED.test(symbol)) { el.innerHTML = '<div class="sa-tvno"><p>The price chart of ' + esc(symbol) + " cannot be shown here: TradingView keeps this exchange's prices on its own site.</p><p><a href=\"https://www.tradingview.com/symbols/" + encodeURIComponent(symbol.replace(":", "-")) + '/" target="_blank" rel="noopener">Open the chart on TradingView ↗</a></p></div>'; return; } el.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div><div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div></div>';
    var s = document.createElement("script"); s.async = true;
    if (small) { s.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"; s.textContent = JSON.stringify({ symbols: [[symbol, symbol + "|12M"]], chartOnly: false, width: "100%", height: "100%", locale: "en", colorTheme: "dark", autosize: true, showVolume: false, showMA: false, hideDateRanges: false, hideMarketStatus: false, hideSymbolLogo: true, scalePosition: "right", scaleMode: "Normal", fontSize: "10", noTimeScale: false, valuesTracking: "1", changeMode: "price-and-percent", chartType: "area", lineWidth: 2, lineType: 0, lineColor: "rgba(255, 255, 255, 1)", topColor: "rgba(255, 255, 255, 0.16)", bottomColor: "rgba(255, 255, 255, 0)", backgroundColor: "rgba(10, 10, 11, 1)", gridLineColor: "rgba(255, 255, 255, 0.05)", widgetFontColor: "rgba(219, 219, 219, 1)", dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"] }); }
    else { s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"; s.textContent = JSON.stringify({ autosize: true, symbol: symbol, interval: "D", timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(10, 10, 11, 1)", gridColor: "rgba(255, 255, 255, 0.05)", allow_symbol_change: true, calendar: false, hide_volume: false, support_host: "https://www.tradingview.com" }); }
    el.querySelector(".tradingview-widget-container").appendChild(s);
  }

  /* ---------- the company page ---------- */
  /* the side menu, as on Koyfin: snapshots, analysts' estimates, financial analysis, news and filings, graphs (one page each) */
  var MENU = [
    ["Snapshots", [["overview", "Overview"], ["description", "Description"], ["rank", "Percentile rank"], ["dividends", "Dividends"], ["ownership", "Ownership"], ["earnings", "Earnings history"]]],
    ["Analyst estimates", [["estimates", "Estimates"], ["target", "Price target"]]],
    ["Financial analysis", [["highlights", "Highlights"], ["is", "Income statement"], ["bs", "Balance sheet"], ["cf", "Cash flow"], ["multiples", "Multiples"], ["ev", "Enterprise value"], ["profitability", "Profitability"], ["returns", "Returns (ROE, ROIC)"], ["growth", "Growth"], ["solvency", "Solvency"]]],
    ["News and filings", [["news", "News"], ["filings", "SEC filings"]]],
    ["Graphs", [["chart", "Price chart"]]]
  ];
  var ALIAS = { summary: "overview", financials: "is", ratios: "profitability" }; /* the old links keep working */
  function pageOf(tab) { tab = ALIAS[tab] || tab; return MENU.some(function (g) { return g[1].some(function (t) { return t[0] === tab; }); }) ? tab : "overview"; }
  function pageName(tab) { var n = "Overview"; MENU.forEach(function (g) { g[1].forEach(function (t) { if (t[0] === tab) n = t[1]; }); }); return n; }
  /* the company's sections live in the site's own side menu, under Stock Analysis (as on Koyfin), not in a second menu beside it.
     On a phone the side menu is a drawer: a list of the sections also sits at the top of the page there */
  function sideSel(on) {
    return '<select id="sa-sidesel" class="sa-sel" aria-label="Section">' + MENU.map(function (g) { return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === on ? " selected" : "") + ">" + esc(t[1]) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select>";
  }
  function sideNav(id, on, name) {
    var old = document.getElementById("sa-snav"), anchor = document.getElementById("nav-stocks");
    if (!id || !anchor) { if (old) old.remove(); return; }
    var href = function (t) { return "#stocks/" + encodeURIComponent(id) + "/" + t; };
    var html = '<span class="sa-cn" title="' + esc(name || id) + '">' + esc(name || id) + "</span>" + MENU.map(function (g) { return '<span class="sa-sg">' + esc(g[0]) + "</span>" + g[1].map(function (t) { return '<a href="' + href(t[0]) + '" data-sa="' + t[0] + '"' + (t[0] === on ? ' class="on" aria-current="page"' : "") + ">" + esc(t[1]) + "</a>"; }).join(""); }).join("");
    var box = old; if (!box) { box = document.createElement("div"); box.id = "sa-snav"; box.className = "sa-snav"; box.setAttribute("role", "navigation"); box.setAttribute("aria-label", "Company sections");
      box.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("a"); if (!a) return; var close = document.getElementById("side-close"); if (close && W.matchMedia && W.matchMedia("(max-width:960px)").matches) setTimeout(function () { close.click(); }, 0); }); }
    if (box.getAttribute("data-k") !== id) { box.innerHTML = html; box.setAttribute("data-k", id); }
    Array.prototype.forEach.call(box.querySelectorAll("a"), function (a) { var me = a.getAttribute("data-sa") === on; a.classList.toggle("on", me); if (me) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); /* the site's own router clears every mark in its menu on each page change */
    if (box.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", box);
    /* a page opened from a link: its section brought into view in the side menu (the menu scrolls, the page does not) */
    var cur = box.querySelector("a.on"), nav = anchor.parentElement; if (cur && nav && !old) { var r = cur.getBoundingClientRect(), nr = nav.getBoundingClientRect(); if (r.bottom > nr.bottom || r.top < nr.top) nav.scrollTop += r.top - nr.top - nr.height / 2; }
  }
  /* what the checks on the data found, said once at the top of every page in plain words */
  function xOf(s) { var m = /x(-?[\d.]+)/.exec(String(s || "")); return m ? "\u00d7" + m[1] : DASH; }
  function checks(co) {
    var u = co.u, m = u.metrics || {}, f = m.f || {}, v = m.v || {}, st = u.status || {}, out = [];
    if (st.res && st.res.dead) out.push(st.res.plan || /\b403\b/.test(String(st.res.err || "")) ? "EODHD's plan does not include company data from this exchange (EODHD answers 403), so there are no figures for this company yet. It is asked again every week; nothing needs doing." : "EODHD has no record we can read for this company yet. It is asked again every month.");
    if (f.withheld && /market-value/.test(f.check || "")) out.push("Amounts withheld: this company's figures in EODHD are out of all proportion to its market value (" + xOf(f.check) + "), a currency or unit error in EODHD's records. No amount is shown until it is corrected; margins, growth and returns, which do not depend on the currency, are shown.");
    else if (f.withheld && /^eodhd-vs-sec/.test(f.check || "")) out.push("Amounts withheld: EODHD's figures for this company differ from its own 20-F at the SEC (" + xOf(f.check) + "), so they are in another currency or unit, and the SEC's latest year (" + ((/year (\d{4})/.exec(f.check) || [])[1] || "—") + ") is too old to show instead. No amount is shown until a newer 20-F is in; margins, growth and returns are shown.");
    else if (f.withheld) out.push("Amounts withheld: EODHD's statements for this company and EODHD's own twelve-month figures differ by more than double (" + xOf(f.check) + "), so one of them is in another currency or unit. No amount is shown until the two agree; margins, growth and returns, which do not depend on the currency, are shown.");
    else if (/^eodhd-vs-sec/.test(f.check || "")) out.push("EODHD's statements differed from the company's own 20-F at the SEC (" + xOf(f.check) + "): the 20-F's figures are shown.");
    else if (/^sec-revenue-partial/.test(f.check || "")) out.push("The revenue line in the company's SEC filings is only part of its revenue (" + xOf(f.check) + " of the total): EODHD's twelve-month revenue is shown; net income is the filings'.");
    else if (/^bank-gross/.test(f.check || "")) out.push("EODHD gives this bank's gross income (interest received plus fees): its net revenue, EODHD's own twelve-month figure, is shown.");
    if (f.qbad && !f.withheld) out.push("EODHD's quarterly figures for this company do not add up to its yearly ones (a half-year or a change of definition among the quarters): the latest year is shown instead of the last twelve months, and the quarterly views are left out.");
    if (v.capcheck) out.push("EODHD's market value for this company disagrees with its own enterprise value less the company's net debt (" + xOf(v.capcheck) + "): no market value is shown until the two agree, and the multiples that need it show —.");
    return out.length ? '<div class="sa-check" role="note">' + out.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>" : "";
  }
  /* withheld amounts: the SEC's own years stay, the EODHD years added after them go */
  function secOnly(D) { if (!D.fin) return D; var x = {}; for (var k in D) x[k] = D[k]; x.fin = null; return x; }
  function withheldMsg() { return '<p class="sa-note">The amounts for this company are withheld until EODHD\'s statements and its own twelve-month figures agree (see the note above).</p>'; }
  var RANK_LABEL = { cap: "Size", g_rev: "Sales growth", g_eps: "EPS growth", gm: "Gross margin", om: "Operating margin", nm: "Net margin", roe: "Return on equity", roic: "Return on capital", pe: "P/E (cheaper higher)", ps: "P/S (cheaper higher)", pb: "P/B (cheaper higher)", ev_ebitda: "EV/EBITDA (cheaper higher)", fcf_y: "Free cash flow yield", dy: "Dividend yield", de: "Debt/equity (less higher)", r1y: "1-year return", r3m: "3-month return" };
  function header(co) {
    var u = co.u, D = co.d, P = D.profile || {}, m = u.metrics || {}, r = m.r || {}, dl = (D.prices && D.prices.d) || [];
    var last = dl[dl.length - 1], prev = dl[dl.length - 2], chg = last && prev && prev[1] > 0 ? last[1] / prev[1] - 1 : null, lc = P.ccy || u.currency;
    var hist = (D.earnings && D.earnings.hist) || [], today = new Date().toISOString().slice(0, 10);
    var next = hist.filter(function (h) { return h[4] == null && h[1] && h[1] >= today; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1])); })[0];
    var bits = [u.id, P.exchange || null, u.country, [u.sector, u.industry].filter(Boolean).join(" · ") || null].filter(Boolean);
    return '<div class="sa-hd"><div class="id"><h1>' + esc(u.name || P.name || u.id) + '</h1><div class="meta">' + bits.map(esc).join(" · ") + (u.adr ? " · US line " + esc(String(u.adr).replace(/\.US$/, "")) : "") + "</div></div>" +
      '<div class="quote">' + (last ? "<b>" + esc(px(last[2] != null ? last[2] : last[1], lc)) + '</b><span class="chg ' + cls(chg) + '">' + pctS(chg, 2) + " on " + esc(date(last[0])) + "</span>" : "") +
      '<span class="chg muted">Market value ' + esc(big(u.cap_usd)) + (u.rank ? " · #" + u.rank + " in the world" : "") + "</span>" + (next ? '<span class="chg muted">Next results ' + esc(date(next[1])) + (next[2] ? " · " + esc(next[2]) : "") + "</span>" : "") + "</div></div>";
  }
  function grid(items) { return '<div class="sa-grid">' + items.filter(function (x) { return x; }).map(function (x) { return "<div><span>" + esc(x[0]) + "</span><b>" + x[1] + "</b></div>"; }).join("") + "</div>"; }
  function vSummary(co) {
    var u = co.u, D = co.d, P = D.profile || {}, m = u.metrics || {}, v = m.v || {}, f = m.f || {}, p = m.p || {}, r = m.r || {};
    var g = grid([["Market value", esc(big(v.cap != null ? v.cap : u.cap_usd))], ["Enterprise value", esc(big(v.ev))], ["P/E, last 12 months", esc(mult(v.pe))], ["P/E, next 12 months", esc(mult(p.fpe))], ["EV / EBITDA", esc(mult(v.ev_ebitda))], ["Price / sales", esc(mult(v.ps))], ["Price / book", esc(mult(v.pb))], ["Free cash flow yield", esc(pct(v.fcf_y))], ["Dividend yield", esc(pct(p.dy))],
      [f.ttm === false && f.end ? "Revenue, year to " + mShort(f.end) : "Revenue, 12 months", esc(big(v.rev_usd))], [f.ttm === false && f.end ? "Net income, year to " + mShort(f.end) : "Net income, 12 months", esc(big(v.ni_usd))], ["Sales growth", '<span class="' + cls(f.g_rev) + '">' + esc(pctS(f.g_rev)) + "</span>"], ["Gross margin", esc(pct(f.gm))], ["Operating margin", esc(pct(f.om))], ["Net margin", esc(pct(f.nm))], ["Return on equity", esc(pct(f.roe))], ["Return on capital", esc(pct(f.roic))], ["Debt / equity", esc(fin(f.de) ? f.de.toFixed(2) + "x" : DASH)],
      ["1 year", '<span class="' + cls(r.r1y) + '">' + esc(pctS(r.r1y)) + "</span>"], ["Since 1 January", '<span class="' + cls(r.ytd) + '">' + esc(pctS(r.ytd)) + "</span>"], ["5 years", '<span class="' + cls(r.r5y) + '">' + esc(pctS(r.r5y, 0)) + "</span>"], ["52-week range", (function () { var T = P.tech || {}, lo = fin(r.lo52) ? r.lo52 : fin(T["52WeekLow"]) ? T["52WeekLow"] : null, hi = fin(r.hi52) ? r.hi52 : fin(T["52WeekHigh"]) ? T["52WeekHigh"] : null; return esc(fin(lo) && fin(hi) ? px(lo, P.ccy) + " – " + px(hi, P.ccy) : DASH); })()], ["Beta", esc(fin(p.beta) ? p.beta.toFixed(2) : DASH)], ["Analysts' target", p.analysts > 0 ? esc(px(p.target, P.ccy)) + " <small>" + p.analysts + " analysts</small>" : DASH]]);
    var pr = m.pr || {}, ps = m.ps || {};
    var ranks = Object.keys(RANK_LABEL).filter(function (k) { return fin(pr[k]); }).map(function (k) { return "<span>" + esc(RANK_LABEL[k]) + '</span><i><b style="width:' + pr[k] + '%"></b>' + (fin(ps[k]) ? '<em style="left:' + ps[k] + '%" title="In its sector: ' + ps[k] + '"></em>' : "") + '</i><span class="n">' + pr[k] + '</span><span class="n">' + (fin(ps[k]) ? ps[k] : DASH) + "</span>"; }).join("");
    var st = stmts(D), Q = st.Q, byYear = f.qbad && (!Q || Q.src === "eodhd"), set = byYear ? st.A : Q, qs = set ? set.rows.slice(byYear ? -10 : -12) : [];
    /* withheld amounts are not drawn either; quarters that do not add up to the year: the years instead */
    var revChart = f.withheld && (!set || set.src === "eodhd") ? "" : bars(qs.map(function (q) { return { l: byYear ? "FY" + String(q.fyl || q.end.slice(0, 4)).slice(2) : mShort(q.end), a: conv(q.d.rev, q, set, "f", byYear ? "a" : "q"), b: conv(q.d.ni, q, set, "f", byYear ? "a" : "q") }; }), { label: "Revenue and net income by " + (byYear ? "year" : "quarter") });
    var hist = (D.earnings && D.earnings.hist) || [];
    return g + '<div class="sa-cols"><div>' +
      (revChart ? '<section class="sa-sec"><h3>Revenue and net income</h3><p class="sub">By ' + (byYear ? "year" : "quarter") + ", " + (S.cur === "usd" ? "US dollars" : esc(set && set.cur || "")) + " · wide bar revenue, narrow bar net income</p>" + revChart + "</section>" : "") +
      (hist.length ? '<section class="sa-sec"><h3>Earnings per share against the estimate</h3><p class="sub">Ring: analysts\' average before the report · dot: the result</p>' + epsChart(hist) + "</section>" : "") +
      (P.desc ? '<section class="sa-sec"><h3>The business</h3><p>' + esc(P.desc.length > 420 ? P.desc.slice(0, P.desc.lastIndexOf(" ", 400)) + "…" : P.desc) + '</p><p><a href="#stocks/' + encodeURIComponent(u.id) + '/description">Description and company facts</a></p></section>' : "") +
      '</div><div><section class="sa-sec"><h3>How it ranks</h3><p class="sub">Percentile among every company of $10B and more (bar) and in its sector (mark). 100 is the best.</p>' + (ranks ? '<div class="sa-rank">' + ranks + "</div>" : '<p class="muted">Ranked once a day; not yet.</p>') + "</section>" +
      (u.tv ? '<section class="sa-sec"><h3>Price</h3><div class="sa-tv sm" id="sa-tv-s"></div></section>' : "") +
      "</div></div>";
  }
  /* the company's facts: EODHD's profile, with the SEC's record filling what EODHD has not given (address, website, year end, industry code) */
  function facts(co) {
    var u = co.u, D = co.d, P = D.profile || {}, A = P.officers && P.officers[0], F = D.filings || {};
    var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var fyeSec = /^\d{4}$/.test(String(F.fye || "")) ? MONTHS[Number(String(F.fye).slice(0, 2)) - 1] + " " + Number(String(F.fye).slice(2)) : null;
    var web = P.web || (F.web ? (/^https?:/.test(F.web) ? F.web : "https://" + F.web) : null);
    return [["Headquarters", P.addr || F.addr], ["Employees", fin(P.employees) ? fmtNum(P.employees) : null], ["Chief executive", A && /chief executive|ceo/i.test(String(A[1])) ? A[0] : null], ["Website", web ? '<a href="' + esc(web) + '" target="_blank" rel="noopener">' + esc(String(web).replace(/^https?:\/\//, "")) + "</a>" : null], ["Listed since", P.ipo ? date(P.ipo) : null], ["Fiscal year ends", P.fye || fyeSec], ["ISIN", P.isin], ["SEC CIK", u.cik ? '<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + esc(u.cik) + '" target="_blank" rel="noopener">' + esc(String(u.cik).replace(/^0+/, "")) + "</a>" : null], ["Industry (GICS)", P.gics && [P.gics.sector, P.gics.industry, P.gics.sub].filter(Boolean).join(" \u203a ")], ["Industry (SEC code)", !P.gics && F.sicd ? F.sicd + (F.sic ? " (" + F.sic + ")" : "") : null], ["Incorporated in", F.inc]].filter(function (x) { return x[1]; });
  }
  function kvHtml(kv) { return kv.map(function (x) { return "<span>" + esc(x[0]) + "</span><b>" + (/^</.test(String(x[1])) ? x[1] : esc(x[1])) + "</b>"; }).join(""); }
  function vDescription(co) {
    var P = co.d.profile || {}, kv = facts(co), off = (P.officers || []).filter(function (o) { return o && o[0]; });
    return '<div class="sa-cols"><div><section class="sa-sec"><h3>The business</h3>' + (P.desc ? "<p>" + esc(P.desc) + "</p>" : '<p class="muted">No description yet.</p>') + "</section></div><div>" +
      (kv.length ? '<section class="sa-sec"><h3>The company</h3><div class="sa-kv">' + kvHtml(kv) + "</div></section>" : "") +
      (off.length ? '<section class="sa-sec"><h3>Officers</h3><div class="sa-kv">' + off.map(function (o) { return "<span>" + esc(o[1] || "") + "</span><b>" + esc(o[0]) + (o[2] ? ' <small class="muted">born ' + esc(o[2]) + "</small>" : "") + "</b>"; }).join("") + "</div></section>" : "") + "</div></div>";
  }
  function vRank(co) {
    var m = co.u.metrics || {}, pr = m.pr || {}, ps = m.ps || {}, v = m.v || {}, f = m.f || {}, p = m.p || {}, r = m.r || {};
    var val = { cap: big(v.cap != null ? v.cap : co.u.cap_usd), g_rev: pctS(f.g_rev), g_eps: pctS(f.g_eps), gm: pct(f.gm), om: pct(f.om), nm: pct(f.nm), roe: pct(f.roe), roic: pct(f.roic), pe: mult(v.pe), ps: mult(v.ps), pb: mult(v.pb), ev_ebitda: mult(v.ev_ebitda), fcf_y: pct(v.fcf_y), dy: pct(p.dy), de: fin(f.de) ? f.de.toFixed(2) + "x" : DASH, r1y: pctS(r.r1y), r3m: pctS(r.r3m) };
    var keys = Object.keys(RANK_LABEL); if (!keys.some(function (k) { return fin(pr[k]); })) return '<p class="muted">Ranked once a day; not yet for this company.</p>';
    var rows = keys.map(function (k) { return "<tr><td>" + esc(RANK_LABEL[k]) + '</td><td class="num">' + esc(val[k] || DASH) + '</td><td class="bar">' + (fin(pr[k]) ? '<i><b style="width:' + pr[k] + '%"></b>' + (fin(ps[k]) ? '<em style="left:' + ps[k] + '%"></em>' : "") + "</i>" : "") + '</td><td class="num">' + (fin(pr[k]) ? pr[k] : DASH) + '</td><td class="num">' + (fin(ps[k]) ? ps[k] : DASH) + "</td></tr>"; }).join("");
    return '<div class="sa-wrap"><table class="pt sa-tbl sa-pr"><thead><tr><th>Measure</th><th class="num">This company</th><th>Percentile</th><th class="num">All companies</th><th class="num">' + esc(co.u.sector || "Sector") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="sa-note">Percentile among every company of $10B and more in the list (bar) and in its sector (mark): 100 is the best; for price multiples and debt, the lowest is the best. Ranked once a day' + (m.ranked_at ? ", last on " + esc(date(String(m.ranked_at).slice(0, 10))) : "") + ".</p>";
  }
  function chips(id, opts, on) { return '<div class="chips sm" id="' + id + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (o[0] === on ? "on" : "") + '">' + o[1] + "</button>"; }).join("") + "</div>"; }
  /* the period chips: years always; quarters and twelve months only where EODHD's quarters add up to its years */
  function perOpts(co, withQ) { var f = (co.u.metrics || {}).f || {}, st = stmts(co.d), bad = f.qbad && (!st.Q || st.Q.src === "eodhd"); return bad ? [["a", "Years"]] : withQ ? [["a", "Years"], ["q", "Quarters"], ["t", "Last 12 months"]] : [["a", "Years"], ["t", "Last 12 months"]]; }
  function perNow(opts, want) { return opts.some(function (o) { return o[0] === want; }) ? want : "a"; }
  function vStmt(co, which) {
    var f = (co.u.metrics || {}).f || {}, st = stmts(co.d), rc = (st.A && st.A.cur) || (st.Q && st.Q.cur) || "", opts = perOpts(co, true), per = perNow(opts, S.per), set = per === "a" ? st.A : st.Q;
    var bar = '<div class="sa-bar">' + chips("sa-per", opts, per) + (rc && rc !== "USD" ? chips("sa-cur", [["usd", "US dollars"], ["rep", rc]], S.cur) : "") + "</div>";
    if (f.withheld && set && set.src === "eodhd") return bar + withheldMsg();
    return bar + finTable(f.withheld ? secOnly(co.d) : co.d, which, per);
  }
  /* the main figures year by year, as Koyfin's Highlights */
  function vHighlights(co) {
    var f = (co.u.metrics || {}).f || {}, st = stmts(co.d), A = st.A; if (!A || !A.rows.length) return '<p class="muted">No statements yet for this company.</p>';
    if (f.withheld && A.src === "eodhd") return withheldMsg();
    if (f.withheld) A = stmts(secOnly(co.d)).A || A;
    var rows = A.rows.slice(-10), lastEnd = rows[rows.length - 1].end, noRate = S.cur === "usd" && A.cur && String(A.cur).toUpperCase() !== "USD" && fxRate(A.cur, null, lastEnd) == null;
    var rc = A.cur || ""; S.local = noRate || S.cur !== "usd";
    try {
      var ebitdaOf = function (d) { return fin(d.opinc) && fin(d.da) ? d.opinc + d.da : (fin(d.ebitda) ? d.ebitda : null); }, fcfOf = function (d) { return fin(d.cfo) && fin(d.capex) ? d.cfo - d.capex : null; };
      var raw = function (r, k) { return typeof k === "function" ? k(r.d) : r.d[k]; };
      var L = [["Revenue", "rev", "m", "sum"], ["Growth", "rev", "g"], ["Gross profit", "gp", "m", "sum"], ["Gross margin", "gp", "mg"], ["Operating income", "opinc", "m", "sum"], ["Operating margin", "opinc", "mg"], ["EBITDA", ebitdaOf, "m"], ["Net income", "ni", "m", "sum"], ["Net margin", "ni", "mg"], ["Growth", "ni", "g"], ["EPS, diluted", "epsd", "e"], ["Growth", "epsd", "g"], ["Operating cash flow", "cfo", "m", "sum"], ["Free cash flow", fcfOf, "m", "sum"], ["Free cash flow margin", fcfOf, "mg"], ["Dividend per share", "dps", "e"]];
      var maxAbs = 0; rows.forEach(function (r) { var v = conv(r.d.rev, r, A, "f", "a"); if (fin(v)) maxAbs = Math.max(maxAbs, Math.abs(v)); });
      var unit = maxAbs >= 5e10 ? 1e9 : 1e6, body = "";
      L.forEach(function (ln) {
        var vals = rows.map(function (r, i) { var v = raw(r, ln[1]), p = i ? raw(rows[i - 1], ln[1]) : null;
          if (ln[2] === "m") return conv(v, r, A, "f", "a");
          if (ln[2] === "e") return fin(v) ? v : null;
          if (ln[2] === "mg") return fin(v) && r.d.rev > 0 && v / r.d.rev <= 1 && v / r.d.rev >= -10 ? v / r.d.rev : null;
          return fin(v) && fin(p) && p > 0 && i && (Date.parse(r.end) - Date.parse(rows[i - 1].end)) / 864e5 < 380 ? v / p - 1 : null; /* growth: the reported currency, a year apart */ });
        if (!vals.some(fin)) return;
        body += '<tr class="' + (ln[3] || (ln[2] === "g" || ln[2] === "mg" ? "sub" : "")) + '"><td>' + esc(ln[0]) + "</td>" + vals.map(function (v) { return '<td class="num ' + (ln[2] === "g" ? cls(v) : "") + '">' + (ln[2] === "m" ? (fin(v) ? fmtMoney(v, unit) : DASH) : ln[2] === "e" ? (fin(v) ? neg(fmtNum(v, 2), v) : DASH) : ln[2] === "g" ? pctS(v) : pct(v)) + "</td>"; }).join("") + "</tr>";
      });
      if (!body) return '<p class="muted">No figures on these lines.</p>';
      var ccyName = S.cur === "usd" && !noRate ? "US dollars" : (rc || "reported currency");
      var head = "<tr><th>" + esc(ccyName + ", " + (unit === 1e9 ? "billions" : "millions")) + "</th>" + rows.map(function (r) { return '<th class="num">' + esc(colLabel(r, "a")) + '<br><small class="muted">' + esc(mShort(r.end)) + "</small></th>"; }).join("") + "</tr>";
      return '<div class="sa-bar">' + (rc && rc !== "USD" ? chips("sa-cur", [["usd", "US dollars"], ["rep", rc]], S.cur) : "") + "</div>" + '<div class="sa-wrap"><table class="pt sa-tbl sa-fin"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>" +
        '<p class="sa-note">The last ten fiscal years, from ' + (A.src === "sec" ? "the company's filings at the SEC" : "EODHD's records of the company's reports") + ". Growth in the reported currency; margins over revenue. Per-share figures in " + esc(rc || "the reported currency") + "." + (noRate ? " No dollar rate for " + esc(rc) + " yet: amounts in " + esc(rc) + "." : "") + "</p>";
    } finally { S.local = false; }
  }
  function vRatioPage(co, groups, text) { var opts = perOpts(co, false), per = perNow(opts, S.per === "a" ? "a" : "t"); return '<div class="sa-bar">' + chips("sa-per", opts, per) + "</div>" + ratioTable(co, per, groups, { text: text }); }
  function vMultiples(co) {
    var m = co.u.metrics || {}, v = m.v || {}, p = m.p || {}, opts = perOpts(co, false), per = perNow(opts, S.per === "a" ? "a" : "t"), hasPx = co.d.prices && co.d.prices.m && co.d.prices.m.length;
    var g = grid([["Market value", esc(big(v.cap != null ? v.cap : co.u.cap_usd))], ["Enterprise value", esc(big(v.ev))], ["P/E, last 12 months", esc(mult(v.pe))], ["P/E, next 12 months", esc(mult(p.fpe))], ["Price / sales", esc(mult(v.ps))], ["Price / book", esc(mult(v.pb))], ["EV / EBITDA", esc(mult(v.ev_ebitda))], ["EV / sales", esc(mult(v.ev_sales))], ["Free cash flow yield", esc(pct(v.fcf_y))], ["Dividend yield", esc(pct(p.dy))]]);
    return '<h3 class="sa-h">Today</h3>' + g + '<h3 class="sa-h">At the end of each period</h3>' + (hasPx ? '<div class="sa-bar">' + chips("sa-per", opts, per) + "</div>" + ratioTable(co, per, ["Valuation at the period's end (US dollars)"], { text: "The share price at the end of the month each period closed, times the shares then outstanding, against that period's figures. A multiple on a loss, or one we cannot check, shows —." }) :
      '<p class="muted">The history needs the share price at the end of each period, and EODHD\'s plan does not include prices (it answers 403). Today\'s multiples above use EODHD\'s market value, the latest twelve months\' figures and today\'s exchange rates.</p>');
  }
  function vEV(co) {
    var m = co.u.metrics || {}, v = m.v || {}, f = m.f || {}, cap = v.cap != null ? v.cap : co.u.cap_usd;
    var rows = [["Market value", cap, "sum"], ["Plus debt", v.debt_usd, "sub"], ["Plus minority interests", v.nci_usd, "sub"], ["Less cash and short-term investments", v.cash_usd, "sub"], ["Enterprise value", v.ev, "sum"]];
    var fins = f.fin || /bank|insur/i.test(String(co.u.industry || ""));
    var tbl = '<div class="sa-wrap" style="max-width:640px"><table class="pt sa-tbl sa-fin"><thead><tr><th>US dollars, today</th><th class="num">Value</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr class="' + r[2] + '"><td>' + esc(r[0]) + '</td><td class="num">' + esc(big(r[1])) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    return tbl + '<p class="sa-note">EODHD\'s market value, plus the debt and minority interests on the latest balance sheet' + (f.bs_end ? " (" + esc(date(f.bs_end)) + ")" : "") + ", less its cash and short-term investments, at today\'s exchange rate." + (fins ? " For a bank or an insurer, debt is part of the business: enterprise value says little and the ranks leave it out." : "") + " The history needs share prices at each period\'s end, which EODHD\'s plan does not include yet.</p>";
  }
  function vEarnings(co) {
    var hist = ((co.d.earnings && co.d.earnings.hist) || []).slice().reverse(); if (!hist.length) return '<p class="muted">No earnings history yet.</p>';
    var rows = hist.slice(0, S.all ? 400 : 40).map(function (h) { var s = fin(h[4]) && fin(h[5]) && h[5] !== 0 ? (h[4] - h[5]) / Math.abs(h[5]) : null; return "<tr><td>" + esc(mShort(h[0])) + "</td><td>" + esc(h[1] ? date(h[1]) : DASH) + "</td><td>" + esc(h[2] || "") + '</td><td class="num">' + (fin(h[5]) ? fmtNum(h[5], 2) : DASH) + '</td><td class="num">' + (fin(h[4]) ? fmtNum(h[4], 2) : h[1] && h[1] >= new Date().toISOString().slice(0, 10) ? "due" : DASH) + '</td><td class="num ' + cls(s) + '">' + pctS(s) + "</td><td>" + esc(h[3] || "") + "</td></tr>"; }).join("");
    return '<section class="sa-sec"><h3>Earnings per share against the estimate</h3><p class="sub">The last 12 quarters</p>' + epsChart(hist.slice().reverse()) + "</section>" +
      '<div class="sa-wrap" style="margin-top:18px"><table class="pt sa-tbl"><thead><tr><th>Quarter</th><th>Reported</th><th>When</th><th class="num">Estimate</th><th class="num">Result</th><th class="num">Surprise</th><th>Currency</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (hist.length > 40 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the last 40 only" : "Show all " + hist.length + " quarters") + "</button></div>" : "") +
      '<p class="sa-note">EPS on the basis analysts forecast (adjusted where the company adjusts), from EODHD; the statements\' GAAP EPS is in Financials. The estimate is the analysts\' average before the report.</p>';
  }
  function vEstimates(co, log) {
    var E = co.d.earnings || {}, tr = E.trend || [], P = co.d.profile || {}, ar = P.ar || {};
    var name = { "0q": "This quarter", "+1q": "Next quarter", "0y": "This year", "+1y": "Next year" };
    var periodsT = ["0q", "+1q", "0y", "+1y"].map(function (k) { return tr.filter(function (t) { return t.period === k; })[0]; });
    var cell = function (v, d) { return '<td class="num">' + (fin(v) ? fmtNum(v, d == null ? 2 : d) : DASH) + "</td>"; };
    var head = "<tr><th></th>" + periodsT.map(function (t, i) { var k = ["0q", "+1q", "0y", "+1y"][i]; return '<th class="num">' + name[k] + (t ? '<br><small class="muted">' + esc(mShort(t.date)) + "</small>" : "") + "</th>"; }).join("") + "</tr>";
    var row = function (label, f, d) { return "<tr><td>" + label + "</td>" + periodsT.map(function (t) { return cell(t ? f(t) : null, d); }).join("") + "</tr>"; };
    var rowP = function (label, f) { return "<tr><td>" + label + "</td>" + periodsT.map(function (t) { var v = t ? f(t) : null; return '<td class="num ' + cls(v) + '">' + pctS(v) + "</td>"; }).join("") + "</tr>"; };
    var money = function (v) { return fin(v) ? v / 1e6 : null; };
    var tbl = '<div class="sa-wrap"><table class="pt sa-tbl sa-fin"><thead>' + head + '</thead><tbody><tr class="hd"><td>Earnings per share</td><td colspan="4"></td></tr>' + row("Average", function (t) { return t.eps.avg; }) + row("Low", function (t) { return t.eps.low; }) + row("High", function (t) { return t.eps.high; }) + row("Analysts", function (t) { return t.eps.n; }, 0) + row("A year ago (actual)", function (t) { return t.eps.yago; }) + rowP("Growth", function (t) { return t.eps.growth; }) +
      '<tr class="hd"><td>Revenue, millions (' + esc(P.ccy || "") + ")</td><td colspan=\"4\"></td></tr>" + row("Average", function (t) { return money(t.rev.avg); }, 0) + row("Low", function (t) { return money(t.rev.low); }, 0) + row("High", function (t) { return money(t.rev.high); }, 0) + row("Analysts", function (t) { return t.rev.n; }, 0) + rowP("Growth", function (t) { return t.rev.growth; }) +
      '<tr class="hd"><td>How the EPS estimate moved</td><td colspan="4"></td></tr>' + row("Now", function (t) { return t.tr.cur; }) + row("7 days ago", function (t) { return t.tr.d7; }) + row("30 days ago", function (t) { return t.tr.d30; }) + row("60 days ago", function (t) { return t.tr.d60; }) + row("90 days ago", function (t) { return t.tr.d90; }) + row("Raised, last 30 days", function (t) { return t.rv.up30; }, 0) + row("Cut, last 30 days", function (t) { return t.rv.dn30; }, 0) + "</tbody></table></div>";
    var votes = [ar.StrongBuy, ar.Buy, ar.Hold, ar.Sell, ar.StrongSell].map(function (x) { return Number(x) || 0; }), tot = votes.reduce(function (a, b) { return a + b; }, 0);
    var vt = tot ? '<div class="sa-rank" style="grid-template-columns:120px 1fr 44px">' + ["Strong buy", "Buy", "Hold", "Sell", "Strong sell"].map(function (l, i) { return "<span>" + l + '</span><i><b style="width:' + Math.round(votes[i] / tot * 100) + '%"></b></i><span class="n">' + votes[i] + "</span>"; }).join("") + "</div>" : '<p class="muted">No ratings.</p>';
    var hist = (log || []).map(function (x) { return [x.day, x.data && x.data.target]; }), hy = (log || []).map(function (x) { return [x.day, x.data && x.data.y0 && x.data.y0.eps]; });
    return '<div class="sa-cols"><div>' + tbl + '</div><div><section class="sa-sec"><h3>The EPS estimate over time</h3><p class="sub">This year\'s, kept here every day from ' + (log && log.length ? esc(date(log[0].day)) : "today") + "; the line grows with each day.</p>" + (line(hy) || '<p class="muted">The line starts after two days of records.</p>') + "</section></div></div>" +
      '<p class="sa-note">Analysts\' consensus from EODHD. Revenue estimates in ' + esc(P.ccy || "the listing's currency") + ", as EODHD gives them.</p>";
  }
  function vTarget(co, log) {
    var P = co.d.profile || {}, ar = P.ar || {}, votes = [ar.StrongBuy, ar.Buy, ar.Hold, ar.Sell, ar.StrongSell].map(function (x) { return Number(x) || 0; }), tot = votes.reduce(function (a, b) { return a + b; }, 0);
    var target = tot > 0 ? (ar.TargetPrice != null ? ar.TargetPrice : P.hl && P.hl.WallStreetTargetPrice) : null; /* a target with no analyst behind it (999,999.99) is not a figure */
    var vt = tot ? '<div class="sa-rank" style="grid-template-columns:120px 1fr 44px">' + ["Strong buy", "Buy", "Hold", "Sell", "Strong sell"].map(function (l, i) { return "<span>" + l + '</span><i><b style="width:' + Math.round(votes[i] / tot * 100) + '%"></b></i><span class="n">' + votes[i] + "</span>"; }).join("") + "</div>" : '<p class="muted">No ratings.</p>';
    var hist = (log || []).map(function (x) { var d = x.data || {}, n = (d.votes || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0); return [x.day, n > 0 && fin(d.target) && d.target < 999999 ? d.target : null]; }); /* a day without analysts has no target */
    return grid([["Target price", tot > 0 ? esc(px(target, P.ccy)) + " <small>" + tot + " analysts</small>" : DASH], ["Rating (1 sell, 5 buy)", esc(fin(ar.Rating) ? Number(ar.Rating).toFixed(2) : DASH)]]) +
      '<div class="sa-cols"><div><section class="sa-sec"><h3>The target over time</h3><p class="sub">Analysts\' average, ' + esc(P.ccy || "") + ", kept here every day from " + (log && log.length ? esc(date(log[0].day)) : "today") + "</p>" + (line(hist, { fmt: function (v) { return px(v, P.ccy); } }) || '<p class="muted">The line starts after two days of records.</p>') + "</section></div>" +
      '<div><section class="sa-sec"><h3>Ratings</h3><p class="sub">How many analysts say what</p>' + vt + "</section></div></div>" + '<p class="sa-note">From EODHD. The target is the analysts\' average 12-month price target.</p>';
  }
  function vDividends(co) {
    var D = co.d, P = D.profile || {}, dv = P.div || {}, list = ((D.divs && D.divs.list) || []).slice();
    var byYear = {}; list.forEach(function (d) { var y = String(d[0]).slice(0, 4); byYear[y] = (byYear[y] || 0) + (Number(d[1]) || 0); });
    var years = Object.keys(byYear).sort(), thisY = new Date().getUTCFullYear().toString(), full = years.filter(function (y) { return y < thisY; }).slice(-15);
    var cagr = function (n) { var a = byYear[full[full.length - 1 - n]], b = byYear[full[full.length - 1]]; return a > 0 && b > 0 ? Math.pow(b / a, 1 / n) - 1 : null; };
    var g = grid([["Dividend a year (forward)", esc(px(dv.ForwardAnnualDividendRate, P.ccy))], ["Yield", esc(pctA(dv.ForwardAnnualDividendYield != null ? dv.ForwardAnnualDividendYield : P.hl && P.hl.DividendYield))], ["Payout ratio", esc(pctA(dv.PayoutRatio))], ["Last ex-dividend date", esc(date(dv.ExDividendDate))], ["Next payment", esc(date(dv.DividendDate))], ["Growth, 5 years a year", '<span class="' + cls(cagr(5)) + '">' + esc(pctS(cagr(5))) + "</span>"], ["Growth, 10 years a year", '<span class="' + cls(cagr(10)) + '">' + esc(pctS(cagr(10))) + "</span>"], ["Last split", esc(dv.LastSplitFactor ? dv.LastSplitFactor + " on " + date(dv.LastSplitDate) : DASH)]]);
    if (!list.length) return g + '<p class="muted">No dividends on record.</p>';
    var chart = bars(full.map(function (y) { return { l: "’" + y.slice(2), a: byYear[y] }; }), { label: "Dividends a year" });
    var rows = list.slice().reverse().slice(0, S.all ? 1000 : 24).map(function (d) { return "<tr><td>" + esc(date(d[0])) + '</td><td class="num">' + fmtNum(d[1], 4) + '</td><td class="num">' + (fin(d[2]) && d[2] !== d[1] ? fmtNum(d[2], 4) : "") + "</td><td>" + esc(d[3] || "") + "</td><td>" + esc(d[4] ? date(d[4]) : DASH) + "</td><td>" + esc(d[6] || "") + "</td></tr>"; }).join("");
    return g + '<section class="sa-sec"><h3>Dividends paid each year</h3><p class="sub">Per share, adjusted for splits, ' + esc(P.ccy || "") + "</p>" + chart + "</section>" +
      '<div class="sa-wrap" style="margin-top:18px"><table class="pt sa-tbl"><thead><tr><th>Ex-date</th><th class="num">Per share</th><th class="num">As paid (before splits)</th><th>Currency</th><th>Paid</th><th>Period</th></tr></thead><tbody>' + rows + "</tbody></table></div>" + (list.length > 24 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the last 24 only" : "Show all " + list.length) + "</button></div>" : "");
  }
  function vOwnership(co) {
    var D = co.d, P = D.profile || {}, sh = P.sh || {}, H = D.holders || {};
    var g = grid([["Shares outstanding", esc(fin(sh.SharesOutstanding) ? fmtNum(sh.SharesOutstanding / 1e6, 0) + "M" : DASH)], ["Free float", esc(fin(sh.SharesFloat) ? fmtNum(sh.SharesFloat / 1e6, 0) + "M" : DASH)], ["Held by insiders", esc(fin(sh.PercentInsiders) ? Number(sh.PercentInsiders).toFixed(1) + "%" : DASH)], ["Held by institutions", esc(fin(sh.PercentInstitutions) ? Number(sh.PercentInstitutions).toFixed(1) + "%" : DASH)], ["Short interest, % of float", esc(fin(sh.ShortPercentFloat) ? (Number(sh.ShortPercentFloat) * (sh.ShortPercentFloat < 1 ? 100 : 1)).toFixed(1) + "%" : DASH)], ["Days to cover", esc(fin(sh.ShortRatio) ? Number(sh.ShortRatio).toFixed(1) : DASH)]]);
    var tbl = function (title, rows) { if (!rows || !rows.length) return ""; return '<section class="sa-sec"><h3>' + title + '</h3><div class="sa-wrap"><table class="pt sa-tbl"><thead><tr><th>Holder</th><th>As of</th><th class="num">Shares</th><th class="num">% of company</th><th class="num">Change</th></tr></thead><tbody>' + rows.map(function (h) { return "<tr><td>" + esc(h[0]) + "</td><td>" + esc(date(h[1])) + '</td><td class="num">' + fmtNum(h[2]) + '</td><td class="num">' + (fin(h[3]) ? Number(h[3]).toFixed(2) + "%" : DASH) + '</td><td class="num ' + cls(h[6]) + '">' + (fin(h[6]) ? (h[6] > 0 ? "+" : "") + Number(h[6]).toFixed(1) + "%" : DASH) + "</td></tr>"; }).join("") + "</tbody></table></div></section>"; };
    var ins = (H.insiders || []).slice(0, 40);
    var it = ins.length ? '<section class="sa-sec"><h3>Insiders\' trades</h3><div class="sa-wrap"><table class="pt sa-tbl"><thead><tr><th>Date</th><th>Who</th><th>Trade</th><th class="num">Shares</th><th class="num">Price</th></tr></thead><tbody>' + ins.map(function (t) { var buy = t[6] === "A" || t[3] === "P"; return "<tr><td>" + esc(date(t[0])) + "</td><td>" + esc(t[1] || "") + (t[2] ? ' <span class="muted">' + esc(t[2]) + "</span>" : "") + '</td><td class="' + (buy ? "pos" : "neg") + '">' + esc(t[3] === "P" ? "Bought" : t[3] === "S" ? "Sold" : t[3] === "M" ? "Exercised" : t[3] === "A" ? "Granted" : t[3] === "F" ? "Tax withheld" : t[3] === "G" ? "Gift" : (t[3] || "")) + '</td><td class="num">' + fmtNum(t[4]) + '</td><td class="num">' + (fin(t[5]) && t[5] > 0 ? fmtNum(t[5], 2) : DASH) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" : "";
    var shs = ((H.shares && H.shares.annual) || []).slice().sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); }).slice(-15);
    var shsOld = shs.length && Number(String(shs[shs.length - 1][0]).slice(0, 4)) < new Date().getUTCFullYear() - 3; /* a series that stops years ago (SK Hynix: 2019) says nothing about today */
    var sc = shs.length > 1 && !shsOld ? '<section class="sa-sec"><h3>Shares outstanding over time</h3><p class="sub">Millions; fewer means buybacks</p>' + bars(shs.map(function (x) { return { l: "’" + String(x[0]).slice(2, 4), a: x[1] / 1e6 }; }), { label: "Shares outstanding" }) + "</section>" : "";
    return g + '<div class="sa-cols"><div>' + tbl("Largest institutions", H.inst) + tbl("Largest funds", H.funds) + "</div><div>" + sc + it + "</div></div>" + '<p class="sa-note">From EODHD (institutional filings, 13F, and insiders\' Form 4 for US companies).</p>';
  }
  var FILING_GROUPS = [["all", "All"], ["periodic", "Annual and quarterly"], ["results", "Results"], ["proxy", "Proxy"], ["owners", "Large holders"], ["other", "Other"]];
  function filingGroup(f) { var form = f[0], items = String(f[6] || ""); if (/^(10-K|10-Q|20-F|40-F|10-KT|10-QT)/.test(form)) return "periodic"; if (/^8-K/.test(form) && /2\.02/.test(items)) return "results"; if (/^6-K/.test(form)) return "results"; if (/^DEF 14A|^ARS/.test(form)) return "proxy"; if (/13D|13G/.test(form)) return "owners"; return "other"; }
  /* what a filing is about: an 8-K by its items, the others by their form */
  var ITEM_8K = { "1.01": "Material agreement", "1.02": "Agreement ended", "1.05": "Cybersecurity incident", "2.01": "Acquisition or disposal completed", "2.02": "Results of the quarter", "2.03": "New debt", "2.05": "Restructuring costs", "2.06": "Impairment", "3.02": "Shares sold privately", "3.03": "Rights of holders changed", "4.01": "Auditor changed", "4.02": "Earlier statements not to be relied on", "5.01": "Change of control", "5.02": "Directors or officers changed", "5.03": "Bylaws or fiscal year changed", "5.07": "Shareholder vote", "7.01": "Regulation FD disclosure", "8.01": "Other events" };
  var FORM_WHAT = { "10-K": "Annual report", "10-Q": "Quarterly report", "20-F": "Annual report (foreign issuer)", "40-F": "Annual report (Canadian issuer)", "6-K": "Report of a foreign issuer", "DEF 14A": "Proxy statement", "ARS": "Annual report to shareholders", "11-K": "Employee savings plan report", "SD": "Conflict minerals report", "S-3": "Shelf registration", "S-8": "Employee share plan registration", "SC 13G": "Large holder (passive)", "SC 13D": "Large holder (active)", "SCHEDULE 13G": "Large holder (passive)", "SCHEDULE 13D": "Large holder (active)" };
  function filingWhat(f, g) {
    var form = String(f[0] || ""), base = form.replace(/\/A$/, ""), amend = /\/A$/.test(form) ? " (amended)" : "";
    if (/^8-K/.test(form)) { var items = String(f[6] || "").split(",").map(function (x) { return ITEM_8K[x.trim()]; }).filter(Boolean); return (items.length ? items.join(" · ") : "Current report") + amend; }
    if (/^424B/.test(base)) return "Prospectus" + amend;
    return (FORM_WHAT[base] || (f[5] && f[5] !== form ? f[5] : form)) + amend;
  }
  function vFilings(co, rest) {
    var F = co.d.filings, cik = co.u.cik; if (!cik) return '<p class="muted">This company does not file with the SEC. Its reports are on its own website' + (co.d.profile && co.d.profile.web ? ': <a href="' + esc(co.d.profile.web) + '" target="_blank" rel="noopener">' + esc(String(co.d.profile.web).replace(/^https?:\/\//, "")) + "</a>" : "") + ".</p>";
    if (!F || !F.list) return '<p class="muted">The SEC filings arrive with the next run.</p>';
    S.fg = S.fg || "all"; var c = String(Number(cik)), list = F.list.filter(function (f) { return S.fg === "all" || filingGroup(f) === S.fg; });
    var rows = list.slice(0, S.all ? 600 : 60).map(function (f) { var acc = String(f[3]), dir = "https://www.sec.gov/Archives/edgar/data/" + c + "/" + acc.replace(/-/g, "") + "/"; var g = filingGroup(f);
      return "<tr><td>" + esc(date(f[1])) + "</td><td><b>" + esc(f[0]) + "</b></td><td>" + esc(filingWhat(f, g)) + "</td><td>" + esc(f[2] ? date(f[2]) : "") + '</td><td><a href="' + esc(f[4] ? dir + f[4] : dir) + '" target="_blank" rel="noopener">Document</a> · <a href="' + esc(dir + acc + "-index.htm") + '" target="_blank" rel="noopener">All files</a></td></tr>'; }).join("");
    var rt = rest && rest.length ? '<section class="sa-sec" style="margin-top:18px"><h3>Restated figures</h3><p class="sub">A later filing changed a figure the company had already published. Both stay here; the statements show the latest.</p><div class="sa-wrap"><table class="pt sa-tbl"><thead><tr><th>Line</th><th>Period</th><th class="num">First filed</th><th class="num">Latest</th><th class="num">Change</th><th>Changed on</th></tr></thead><tbody>' +
      rest.slice(0, S.all ? 1000 : 40).map(function (x) { var d = x.data || {}, ch = fin(d.was) && d.was !== 0 ? d.now / d.was - 1 : null, lbl = LINE_NAME[d.k] || d.k; return "<tr><td>" + esc(lbl) + "</td><td>" + esc(String(d.p || "").replace(/^FY /, "Year to ").replace(/^Q /, "Quarter to ")) + '</td><td class="num">' + fmtNum(d.was, Math.abs(d.was) < 100 ? 2 : 0) + '</td><td class="num">' + fmtNum(d.now, Math.abs(d.now) < 100 ? 2 : 0) + '</td><td class="num ' + cls(ch) + '">' + pctS(ch) + "</td><td>" + esc(date(d.filed)) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" : "";
    return '<div class="sa-bar">' + chips("sa-fg", FILING_GROUPS, S.fg) + '</div><div class="sa-wrap"><table class="pt sa-tbl"><thead><tr><th>Filed</th><th>Form</th><th>What</th><th>Period</th><th>Links</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">None.</td></tr>') + "</tbody></table></div>" + (list.length > 60 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the last 60 only" : "Show all " + list.length) + "</button></div>" : "") +
      '<p class="sa-note">The SEC\'s own records' + (F.sicd ? " · industry code: " + esc(F.sicd) : "") + (F.cat ? " · " + esc(F.cat) : "") + (F.insider30 ? " · " + F.insider30 + " insider filings (Forms 3, 4, 5) in the recent list" : "") + ".</p>" + rt;
  }
  var LINE_NAME = {}; ["is", "bs", "cf"].forEach(function (k) { LINES[k].forEach(function (l) { if (typeof l[1] === "string" && l[0] !== "hd") LINE_NAME[l[1]] = l[0]; }); });
  function vNews(co) { var n = (co.d.news && co.d.news.list) || []; if (!n.length) return '<p class="muted">No headlines yet.</p>'; return '<div class="sa-wrap"><table class="pt sa-tbl"><tbody>' + n.map(function (x) { return "<tr><td>" + esc(date(String(x[0]).slice(0, 10))) + '</td><td style="white-space:normal"><a href="' + esc(x[2]) + '" target="_blank" rel="noopener nofollow">' + esc(x[1]) + '</a> <span class="muted">' + esc(x[3] || "") + "</span></td></tr>"; }).join("") + '</tbody></table></div><p class="sa-note">Headlines and links from EODHD\'s news feed; the articles are on their publishers\' sites.</p>'; }
  function vChart(co) { return co.u.tv ? '<div class="sa-tv" id="sa-tv"></div>' : '<p class="muted">No chart for this listing.</p>'; }

  /* ---------- routing, access, wiring ---------- */
  function sources(co) {
    var st = co.u.status || {}, d = function (x) { return x && x.at && !x.err ? date(String(x.at).slice(0, 10)) : x && x.err ? "not read yet (tried " + date(String(x.at).slice(0, 10)) + ")" : "not yet"; };
    var NAME = { px: "prices", div: "dividends", news: "news" }, is403 = function (x) { return x && (x.plan || /\b403\b/.test(String(x.err || ""))); };
    var bits = []; if (co.u.cik) bits.push("SEC filings read " + d(st.subs) + ", statements " + d(st.sec)); if (!(st.res && st.res.dead)) bits.push("EODHD profile and statements " + d(st.eod) + (st.px && !st.px.err ? ", prices " + d(st.px) : ""));
    /* EODHD refusing a kind of data (403) is the plan, not a fault: said plainly, never as an error */
    var plan = ["px", "div", "news"].filter(function (k) { return is403(st[k]); }).map(function (k) { return NAME[k]; });
    if (plan.length) bits.push("not in the EODHD plan: " + plan.join(", ") + " (asked again every week)");
    var slow = ["px", "div", "news"].filter(function (k) { return st[k] && st[k].err && !is403(st[k]) && /timed out|aborted|did not answer/i.test(st[k].err); }).map(function (k) { return NAME[k]; });
    if (slow.length) bits.push("EODHD did not answer in time for " + slow.join(", ") + " (tried again later)");
    var errs = ["sec", "subs", "eod", "px", "div", "news"].filter(function (k) { return st[k] && st[k].err && !is403(st[k]) && !/timed out|aborted|did not answer|no EODHD record/i.test(st[k].err); }).map(function (k) { return k + ": " + st[k].err; });
    if (st.res && st.res.dead && !(st.res.plan || /\b403\b/.test(String(st.res.err || "")))) errs.push("EODHD has no record we can read for this company" + (st.res.err ? " (" + st.res.err + ")" : ""));
    return '<p class="sa-note">' + esc(bits.join(" · ")) + "." + (errs.length && (S.ctx.staff && !S.ctx.sim) ? '<br><span style="color:var(--warn)">' + esc(errs.join(" · ")) + "</span>" : "") + "</p>";
  }
  /* the refresh button's answer, in words: a refusal by the plan is not an error */
  function noteText(n) { var m = /^(px|div|news|eod)\b[^:]*:\s*(.*)$/.exec(String(n)); if (m && /\b403\b/.test(m[2])) return ({ px: "prices", div: "dividends", news: "news", eod: "company data" })[m[1]] + ": not in the EODHD plan"; return String(n).replace(/\s*Please contact support@eodhistoricaldata\.com\.?/g, ""); }
  function loadLog(id, kind) {
    var key = id + "|" + kind; if (S.log[key]) return S.log[key];
    var c = sb(); if (!c) return Promise.resolve([]);
    var q = c.from("stock_log").select("day,data").eq("sid", id).eq("kind", kind).order("day", { ascending: kind === "est" }).limit(kind === "est" ? 2000 : 1000);
    S.log[key] = q.then(function (r) { return r.data || []; }, function () { return []; }); return S.log[key];
  }
  function renderCompany(el, id, tab) {
    css(); var back = '<p class="back"><a href="#stocks">← Stock analysis</a></p>';
    if (!S.co[id]) el.innerHTML = back + '<p class="small muted">Loading ' + esc(id) + "…</p>";
    S.onCo = function (id2) { if (id2 === id && el.isConnected && location.hash.indexOf("#stocks/" + encodeURIComponent(id)) === 0) renderCompany(el, id, tab); }; /* a fresher copy arrived */
    loadCompany(id).then(function (co) {
      if (!co) { el.innerHTML = back + "<h1>" + esc(id) + '</h1><p class="muted">This company is not in the list.</p>'; return; }
      var crumb = $("#crumb"); if (crumb) crumb.textContent = co.u.name || id; document.title = (co.u.name || id) + " · Stock analysis · Mr. Wall Street";
      tab = pageOf(tab);
      var view = { overview: vSummary, description: vDescription, rank: vRank, dividends: vDividends, ownership: vOwnership, earnings: vEarnings, highlights: vHighlights,
        is: function (c) { return vStmt(c, "is"); }, bs: function (c) { return vStmt(c, "bs"); }, cf: function (c) { return vStmt(c, "cf"); }, multiples: vMultiples, ev: vEV,
        profitability: function (c) { return vRatioPage(c, ["Margins"], "Margins over revenue, computed here from the company's statements. Banks and insurers have no gross, operating or EBITDA margin: their revenue and costs mean other things."); },
        returns: function (c) { return vRatioPage(c, ["Returns"], "Return on equity and on assets: net income over the average of the opening and closing balance. Return on invested capital: operating income after tax (the company's own rate, 21% when unclear) over equity plus debt less cash; not for banks and insurers."); },
        growth: function (c) { return vRatioPage(c, ["Growth, year on year"], "Each period against the same period a year before, in the reported currency."); },
        solvency: function (c) { return vRatioPage(c, ["Balance sheet"], "From the balance sheet at each period's end; interest cover from the period's operating income and interest paid."); },
        news: vNews, chart: vChart }[tab];
      var draw = function (extra) {
        var body; try { body = tab === "estimates" ? vEstimates(co, extra) : tab === "target" ? vTarget(co, extra) : tab === "filings" ? vFilings(co, extra) : (view || vSummary)(co); } catch (e) { body = '<div class="banner bad"><div><b>This part could not be shown.</b><p>' + esc(e && e.message || e) + "</p></div></div>"; if (W.console) console.error(e); }
        el.innerHTML = back + staffBar(id) + header(co) + '<div class="sa-main">' + sideSel(tab) + '<h2 class="sa-ttl">' + esc(pageName(tab)) + "</h2>" + checks(co) + body + sources(co) + "</div>"; sideNav(id, tab, co.u.name || id); wire(el, co, id, tab);
      };
      if (tab === "estimates" || tab === "target") loadLog(id, "est").then(draw); else if (tab === "filings") loadLog(id, "restated").then(draw); else draw();
    }, function (e) { el.innerHTML = back + '<div class="banner bad"><div><b>Could not load this company.</b><p>' + esc(e && e.message || e) + "</p></div></div>"; });
  }
  function wire(el, co, id, tab) {
    var redraw = function () { renderCompany(el, id, tab); };
    var on = function (sel, f) { var b = $(sel, el); if (b) b.addEventListener("click", function (e) { var t = e.target.closest("button"); if (t) f(t.dataset.v, t); }); };
    on("#sa-st", function (v) { S.stmt = v; redraw(); }); on("#sa-per", function (v) { S.per = v; S.all = false; remember(); redraw(); }); on("#sa-cur", function (v) { S.cur = v; remember(); redraw(); }); on("#sa-fg", function (v) { S.fg = v; S.all = false; redraw(); });
    var all = $("#sa-all", el); if (all) all.addEventListener("click", function () { S.all = !S.all; redraw(); });
    /* the statements read like the company's: the latest period at the right, in view; older ones a scroll away */
    $$(".sa-wrap", el).forEach(function (w) { if (w.querySelector(".sa-fin")) w.scrollLeft = w.scrollWidth; });
    if (tab === "chart") tvWidget($("#sa-tv", el), co.u.tv, false); if (tab === "overview") tvWidget($("#sa-tv-s", el), co.u.tv, true);
    var sel = $("#sa-sidesel", el); if (sel) sel.addEventListener("change", function () { location.hash = "#stocks/" + encodeURIComponent(id) + "/" + sel.value; });
    var rb = $("#sa-refresh", el); if (rb) rb.addEventListener("click", function () {
      var msg = $("#sa-rmsg", el); rb.disabled = true; if (msg) msg.textContent = "Reading the SEC and EODHD now…";
      (MWS.fn ? MWS.fn("stocks", { action: "refresh", id: id }) : Promise.reject(new Error("no client"))).then(function (r) {
        if (msg) msg.textContent = r && r.ok ? "Done" + (r.notes && r.notes.length ? ": " + r.notes.map(noteText).join("; ") : ".") : "Failed: " + (r && r.error || "unknown");
        S.log = {}; setTimeout(function () { fetchCompany(id).then(function () { renderCompany(el, id, tab); }, function () { renderCompany(el, id, tab); }); }, 300);
      }, function (e) { if (msg) msg.textContent = "Failed: " + (e && e.message || e); rb.disabled = false; });
    });
  }
  /* who sees it: staff always; members only once the section is switched on (desk_stocks_live); in the staff's "view as" mode, the member's page with a note */
  function liveCheck() {
    if (S.live !== null) return Promise.resolve(S.live); var c = sb(); if (!c) return Promise.resolve(false);
    return c.rpc("desk_live", { section: "stocks" }).then(function (r) { S.live = !r.error && r.data === true; return S.live; }, function () { S.live = false; return false; });
  }
  function nav(ctx) {
    if (ctx) S.ctx = { staff: !!ctx.staff, sim: !!ctx.sim, member: !!ctx.member };
    var a = $("#nav-stocks"), g = $("#nav-res"); if (!a) return;
    var show = function (v) { a.hidden = !v; if (g) g.hidden = !v; };
    if (S.ctx.staff || S.ctx.sim) { show(true); liveCheck(); return; }
    liveCheck().then(function (live) { show(live && S.ctx.member); });
  }
  function show(ctx) {
    if (ctx) S.ctx = { staff: !!ctx.staff, sim: !!ctx.sim, member: !!ctx.member };
    var el = $("#sa-page"); if (!el) return; css();
    if (ctx && !ctx.ready) { el.innerHTML = '<p class="small muted">Loading…</p>'; return; }
    var arg = ctx && ctx.arg != null ? ctx.arg : (W.__saArg || ""); var parts = String(arg).split("/"), id = parts[0] ? decodeURIComponent(parts[0]) : "", tab = parts[1] || "summary";
    var go = function () { if (id) renderCompany(el, id, tab); else { sideNav(null); renderList(el); } };
    if (S.ctx.staff || S.ctx.sim) { liveCheck().then(go); return; }
    liveCheck().then(function (live) { if (live && S.ctx.member) go(); else { el.innerHTML = ""; location.replace("#telegram"); } });
  }
  W.mwsStocks = { show: show, nav: nav, _: { S: S, stmts: stmts, periods: periods, finTable: finTable, ratioRows: ratioRows, fxRate: fxRate, conv: conv, loadFx: loadFx } };
  /* this file can load after the app has routed: catch up */
  function boot() {
    var d = MWS.debug ? (function () { try { return MWS.debug(); } catch (e) { return null; } })() : null; if (!d) return false;
    var acc = MWS.store && MWS.store.get ? MWS.store.get("mws_access") : null, member = !!(acc && acc.valid);
    S.ctx = { staff: !!d.staff, sim: !!d.sim, member: S.ctx.member || member }; nav();
    if (/^#stocks/.test(location.hash) && (d.staff || d.sim || member)) { var m = /^#stocks(?:\/(.*))?$/.exec(location.hash); show({ arg: m && m[1] ? m[1] : "", staff: !!d.staff, sim: !!d.sim, member: S.ctx.member, ready: true }); }
    return true;
  }
  /* leaving a company (another page of the site, or the list): its sections leave the side menu */
  W.addEventListener("hashchange", function () { if (!/^#stocks\/[^/]+/.test(location.hash)) sideNav(null); });
  if (!boot()) { var tries = 0, t = setInterval(function () { if (boot() || ++tries > 40) clearInterval(t); }, 250); }
})();
