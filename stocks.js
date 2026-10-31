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
  /* r24 (SU24-3): a per-share figure to two decimals, to four under half a cent (Hecla's quarterly dividend of 0.00375, LATAM's EPS of 0.00096): never a
     "0.00" for a dividend paid or a profit made */
  function psD(v) { return fin(v) && Math.abs(v) >= 5e-5 && Math.abs(v) < 0.005 ? 4 : 2; } /* a sum of quarters that cancel (1e-17) stays "0.00" */
  function psNum(v) { return fmtNum(v, psD(v)); }
  /* r24 (SU24-5): a restatement's two per-share figures to as many decimals as tell them apart (up to six): a restated EPS of 0.30 then 0.302, or 1.98
     then 2.00 put on today's basis after a 4-for-1 split, read "0.30; 0.30" and "0.50; 0.50" */
  function psDec(a, b) { var d = Math.max(psD(a), psD(b)); while (d < 6 && fmtNum(a, d) === fmtNum(b, d)) d++; return d; }
  function fmtMoney(v, unit) { /* unit: 1e6 or 1e9 */ if (!fin(v)) return DASH; var x = v / unit, d = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2; if (unit === 1e6 && Math.abs(x) >= 1000) d = 0; return neg(fmtNum(x, d), x); }
  function big(v, ccy) { if (!fin(v)) return DASH; var a = Math.abs(v), s = a >= 999.5e9 ? (a / 1e12).toFixed(2) + "T" : a >= 999.5e6 ? (a / 1e9).toFixed(a >= 99.95e9 ? 0 : 1) + "B" : a >= 1e6 ? (a / 1e6).toFixed(0) + "M" : fmtNum(a); return (v < 0 && s.replace(/[^1-9]/g, "") ? "-" : "") + (ccy === "USD" || !ccy ? "$" : "") + s + (ccy && ccy !== "USD" ? " " + ccy : ""); } /* r3: -$11.3B, not $-11.3B; $1.00T, not $1000B */
  function pct(v, d) { if (!fin(v)) return DASH; var s = (v * 100).toFixed(d == null ? 1 : d); return (/^-0(\.0*)?$/.test(s) ? s.slice(1) : s) + "%"; } /* r5: never -0.0% */
  function pctA(v) { if (!fin(v)) return DASH; var a = Math.abs(v); return (v * 100).toFixed(a > 0 && a < 0.01 ? 2 : 1) + "%"; } /* 0.12%, 1.3%, 45.0% */
  function pctS(v, d) { if (!fin(v)) return DASH; var s = (v * 100).toFixed(d == null ? 1 : d); return (/^-?0(\.0*)?$/.test(s) ? s.replace("-", "") : (v > 0 ? "+" : "") + s) + "%"; } /* r5: 0.0%, never -0.0% or +0.0% */
  function mult(v) { if (!fin(v) || v <= 0 || v > 999) return DASH; return v.toFixed(v >= 100 ? 0 : 1) + "x"; }
  function px(v, ccy) { if (!fin(v)) return DASH; var d = Math.abs(v) >= 1000 ? 0 : 2; return (ccy === "USD" ? "$" : "") + fmtNum(v, d) + (ccy && ccy !== "USD" ? " " + ccy : ""); }
  function date(d) { return MWS.fmtDate ? MWS.fmtDate(d) : (d || DASH); }
  function cls(v) { return fin(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : ""; }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function mShort(d) { if (!d) return ""; return MON[Number(String(d).slice(5, 7)) - 1] + " " + String(d).slice(2, 4); }
  function mLong(d) { if (!d) return ""; return MON[Number(String(d).slice(5, 7)) - 1] + " " + String(d).slice(0, 4); } /* r6: in a label, "year to Mar 2026", not "year to Mar 26" (read as 26 March) */

  /* ---------- exchange rates: dollars per unit, by month; a period's flows at its average rate, a balance at its month-end ---------- */
  var CCY_FIX = { GBX: ["GBP", 0.01], GBp: ["GBP", 0.01], ILA: ["ILS", 0.01], ZAC: ["ZAR", 0.01], KWF: ["KWD", 0.001] }; /* r25 (M25-5): Kuwait's prices in fils, a thousandth of a dinar (Kuwait Finance House, National Bank of Kuwait, Boubyan: no rate for "KWF", so no market value or multiple at any period's end) */
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
      ".sa-bar{display:flex;flex-wrap:wrap;gap:12px 36px;align-items:center;margin:0 0 14px}.sa-bar input[type=search]{background:var(--bg-2);border:1px solid var(--line-2);color:var(--fg);font:inherit;font-size:15px;padding:10px 14px;min-width:260px;flex:1 1 260px;outline:0;border-radius:0}.sa-bar input:focus{border-color:var(--fg-2)}.sa-bar select{max-width:100%;background:var(--bg-2);border:1px solid var(--line-2);color:var(--fg-2);font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:9px 10px;border-radius:0}",
      ".sa-wrap{overflow-x:auto;border:1px solid var(--line);background:var(--bg)}.sa-wrap table{border-collapse:collapse;width:100%}.sa-tbl th,.sa-tbl td{white-space:nowrap}.sa-tbl td.num,.sa-tbl th.num{text-align:right;font-variant-numeric:tabular-nums}",
      ".sa-tbl th .sa-sort{background:0 0;border:0;padding:0;margin:0;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}.sa-tbl tr.clk{cursor:pointer}.sa-tbl tr.clk:hover td{background:var(--bg-2)}.sa-tbl td .tk{font-family:var(--mono);font-size:11.5px;color:var(--fg-3);margin-left:8px}.sa-tbl td.pos{color:var(--good)}.sa-tbl td.neg{color:var(--bad)}",
      ".sa-fin th:first-child,.sa-fin td:first-child{position:sticky;left:0;background:var(--bg);z-index:1;text-align:left;min-width:220px}.pt.sa-fin{min-width:0}.sa-fin thead th:first-child{background:var(--bg-2)}.sa-fin tr.sum td{color:var(--fg);font-weight:500}.sa-fin tr.sub td:first-child{padding-left:28px;color:var(--fg-3)}.sa-fin tr.hd td{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-3);background:var(--bg-2);padding-top:14px}",
      ".sa-fin td .d{color:var(--fg-3);font-size:10px;margin-left:3px;vertical-align:1px}#sa-page .sa-tbl tbody th[scope=row]{font:inherit;letter-spacing:normal;text-transform:none;color:var(--fg-2);font-weight:inherit;text-align:start;padding:14px;border-bottom:1px solid var(--line);vertical-align:top;white-space:nowrap;font-variant-numeric:tabular-nums;background:0 0}#sa-page .sa-fin tbody th[scope=row]{text-align:left;background:var(--bg)}#sa-page .sa-fin tr.sum th[scope=row]{color:var(--fg);font-weight:500}#sa-page .sa-fin tr.sub th[scope=row]{padding-left:28px;color:var(--fg-3)}@media (max-width:720px){#sa-page .sa-fin tbody th[scope=row]{white-space:normal}}@media print{#sa-page .sa-tbl tbody th[scope=row]{font-size:inherit!important;letter-spacing:normal!important}#sa-page .sa-fin tbody th[scope=row]+td{padding-left:4px!important;padding-right:4px!important}}.sa-fin td .r{color:var(--warn);font-size:10px;margin-left:3px;vertical-align:1px;cursor:help}.sa-fin td button.d,.sa-fin td button.r{background:0 0;border:0;padding:0;font:inherit;font-size:10px;line-height:normal;cursor:help}.sa-wrap:focus-visible{outline:2px solid var(--fg-2);outline-offset:2px}",
      ".sa-hd{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;margin:0 0 18px}.sa-hd h1{font-size:clamp(28px,3.2vw,40px);letter-spacing:-.025em;line-height:1.05}.sa-hd .id{flex:1 1 360px;min-width:0}.sa-hd .meta{font-family:var(--mono);font-size:11.5px;letter-spacing:.04em;color:var(--fg-3);margin-top:8px}.sa-hd .quote{text-align:right}.sa-hd .quote b{font-size:28px;font-weight:500;font-variant-numeric:tabular-nums}.sa-hd .quote .chg{display:block;font-size:13px;margin-top:4px}",
      ".sa-tabs{display:flex;gap:0;border:1px solid var(--line-2);margin:0 0 18px;overflow-x:auto;scrollbar-width:none}.sa-tabs a{font-family:var(--mono);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);text-decoration:none;padding:11px 14px;border-left:1px solid var(--line-2);white-space:nowrap}.sa-tabs a:first-child{border-left:0}.sa-tabs a.on,.sa-tabs a:hover{color:var(--fg);background:var(--bg-2)}",
      ".sa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:1px;margin:0 0 18px}.sa-grid div{background:var(--bg);padding:12px 14px;box-shadow:0 0 0 1px var(--line)}.sa-grid div>span{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-3)}.sa-grid b .pos{color:var(--good)}.sa-grid b .neg{color:var(--bad)}.sa-grid b{display:block;font-weight:500;font-size:17px;margin-top:5px;font-variant-numeric:tabular-nums}.sa-grid b small{color:var(--fg-3);font-size:12px;font-weight:400}",
      ".sa-cols{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px}.sa-cols>div>section+section{margin-top:18px}@media (max-width:980px){.sa-cols{grid-template-columns:minmax(0,1fr)}}",
      ".sa-sec{border:1px solid var(--line);background:var(--bg);padding:18px 20px}.sa-sec h3{font-size:15px;font-weight:500;margin:0 0 4px}.sa-sec .sub{color:var(--fg-3);font-size:12.5px;margin:0 0 14px}.sa-sec p{color:var(--fg-2);font-size:14px;line-height:1.55}",
      ".sa-rank{display:grid;grid-template-columns:120px 1fr 44px 44px;gap:6px 10px;align-items:center;font-size:13px}.sa-rank i{display:block;height:6px;background:var(--line-2);position:relative}.sa-rank i b{position:absolute;left:0;top:0;bottom:0;background:var(--fg-2)}.sa-rank i em{position:absolute;top:-3px;width:2px;height:12px;background:var(--warn)}.sa-rank span{color:var(--fg-3)}.sa-rank .n{font-family:var(--mono);font-size:11.5px;text-align:right;color:var(--fg-2)}",
      ".sa-svg{width:100%;height:auto;display:block}.sa-svg text{fill:var(--fg-3);font-family:var(--mono);font-size:10px}.sa-svg .b1{fill:var(--fg-2)}.sa-svg .b2{fill:var(--line-2)}.sa-svg .neg{fill:var(--bad)}.sa-svg .ln{stroke:var(--fg-2);stroke-width:1.5;fill:none}.sa-svg .est{fill:none;stroke:var(--warn);stroke-width:1.5}.sa-svg .act{fill:var(--fg)}.sa-svg .z{stroke:var(--line-2)}.sa-svg text.lt{dominant-baseline:hanging}",
      ".sa-note{color:var(--fg-3);font-size:12.5px;margin-top:12px;line-height:1.5}.sa-note b{color:var(--fg-2);font-weight:500}.sa-kv{display:grid;grid-template-columns:150px 1fr;gap:6px 14px;font-size:13.5px}.sa-kv span{color:var(--fg-3)}.sa-kv b{font-weight:400;color:var(--fg-2);overflow-wrap:anywhere}",
      ".sa-tv{height:520px;border:1px solid var(--line)}.sa-tv.sm{height:300px}.sa-tvno{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px;text-align:center;color:var(--fg-3);font-size:14px}.sa-tvno p{margin:0;max-width:440px}.sa-staff{border:1px dashed var(--line-2);padding:10px 14px;margin:0 0 14px;font-size:12.5px;color:var(--fg-3);display:flex;gap:14px;flex-wrap:wrap;align-items:center}.sa-staff button{background:0 0;border:1px solid var(--line-2);color:var(--fg-2);font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:6px 10px;cursor:pointer}.sa-staff button:hover{color:var(--fg);border-color:var(--fg-2)}",
      ".sa-pill{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--line-2);padding:2px 6px;color:var(--fg-3);margin-left:6px;vertical-align:2px}.sa-more{margin-top:12px}.sa-more button{background:0 0;border:0;color:var(--fg-2);font:inherit;font-size:13px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:0}",
      ".sa-ptabs{display:flex;gap:2px;border-bottom:1px solid var(--line-2);margin:4px 0 20px;overflow-x:auto;scrollbar-width:none}.sa-ptabs::-webkit-scrollbar{display:none}.sa-ptabs a{flex:none;font-size:13.5px;color:var(--fg-3);text-decoration:none;padding:9px 12px 10px;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}.sa-ptabs a:hover{color:var(--fg)}.sa-ptabs a.on{color:var(--fg);font-weight:600;border-bottom-color:var(--fg)}.sa-ptabs a.sa-in2{animation:saTtl .9s var(--ease) both}" +
      ".sa-main{min-width:0}.sa-crumb{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-3);margin:2px 0 6px}.sa-ttl{font-size:26px;font-weight:500;letter-spacing:-.015em;margin:0 0 16px}.sa-main.sa-in{animation:saIn .24s var(--ease) both}@keyframes saIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.sa-main.sa-in,#sa-snav a.flash,.sa-ttl.sa-in2{animation:none}}.sa-h{font-size:15px;font-weight:500;margin:6px 0 10px}.sa-sel{display:none}",
      "@media (max-width:960px){.sa-sel{display:block;width:100%;margin:0 0 14px;background:var(--bg-2);border:1px solid var(--line-2);color:var(--fg);font:inherit;font-size:15px;padding:10px 12px;border-radius:0}}",
      "#sa-snav{display:flex;flex-direction:column;gap:1px;margin:2px 0 6px}#sa-snav .sa-cn{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-2);padding:10px 10px 2px 28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#sa-snav .sa-gh{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;background:0 0;border:0;border-left:2px solid transparent;cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-3);padding:10px 12px 8px 26px;text-align:left}#sa-snav .sa-gh:hover{color:var(--fg)}#sa-snav .sa-gh i{font-style:normal;font-size:14px;color:var(--fg-3);flex:none}#sa-snav .sa-gh[aria-expanded=true]{color:var(--fg)}#sa-snav .sa-gh.cur{color:var(--fg)}#sa-snav .sa-gn{display:flex;flex-direction:column;gap:4px;min-width:0}#sa-snav .sa-gh em{display:none;font-style:normal;font-family:var(--sans);font-size:13px;letter-spacing:0;text-transform:none;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#sa-snav .sa-gh.cur[aria-expanded=false]{border-left-color:var(--fg);background:rgba(245,245,243,.06)}#sa-snav .sa-gh.cur[aria-expanded=false] em{display:block}#sa-snav .sa-gb{display:flex;flex-direction:column;gap:1px;padding-bottom:4px}#sa-snav .sa-gb[hidden]{display:none}#sa-snav a{padding:7px 10px 7px 26px;font-size:13.5px;border-left:2px solid transparent}#sa-snav a{color:var(--fg-2)}#sa-snav a.on{color:var(--fg);background:rgba(245,245,243,.14);border-left:3px solid var(--fg);padding-left:25px;font-weight:600}#sa-snav a.on::after{content:'';float:right;width:6px;height:6px;margin-top:6px;border-radius:50%;background:var(--fg)}#sa-snav a.flash{animation:saFlash 1.1s var(--ease) both}@keyframes saFlash{0%{background:rgba(245,245,243,.38)}100%{background:rgba(245,245,243,.14)}}.sa-ttl.sa-in2{animation:saTtl .9s var(--ease) both}@keyframes saTtl{0%{color:var(--fg);text-shadow:0 0 18px rgba(245,245,243,.55)}100%{text-shadow:none}}",
      ".sa-wait{display:flex;gap:6px;padding:28px 0}.sa-wait span{width:6px;height:6px;background:var(--fg-3);animation:saw 1s infinite ease-in-out}.sa-wait span:nth-child(2){animation-delay:.15s}.sa-wait span:nth-child(3){animation-delay:.3s}@keyframes saw{0%,100%{opacity:.2}50%{opacity:1}}",
      ".sa-check{border:1px solid var(--warn);border-left-width:3px;background:var(--bg);padding:10px 14px;margin:0 0 14px}.sa-check p{margin:0;font-size:13.5px;color:var(--fg-2);line-height:1.5}.sa-check p+p{margin-top:6px}",
      ".sa-pr td.bar{min-width:170px;width:30%}.sa-pr td.bar i{display:block;height:6px;background:var(--line-2);position:relative}.sa-pr td.bar i b{position:absolute;left:0;top:0;bottom:0;background:var(--fg-2)}.sa-pr td.bar i em{position:absolute;top:-3px;width:2px;height:12px;background:var(--warn)}",
      "@media (max-width:720px){.sa-svg text.ax{font-size:20px}.sa-svg text.ax.odd{display:none}.sa-hd .quote{text-align:left}.sa-fin th:first-child,.sa-fin td:first-child{min-width:110px;white-space:normal}.sa-tv{height:380px}}",
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- the list ---------- */
  var EUROPE = /^(united kingdom|germany|france|netherlands|switzerland|sweden|denmark|norway|finland|italy|spain|portugal|ireland|belgium|austria|luxembourg|poland|czech republic|hungary|greece|romania|jersey|gb|de|fr|nl|ch|se|dk|no|fi|it|es|pt|ie|be|at|lu|pl|cz|hu|gr|ro)$/i;
  var ASIA = /^(china|japan|south korea|korea|republic of korea|korea, republic of|taiwan|hong kong|india|singapore|indonesia|malaysia|thailand|vietnam|philippines|australia|new zealand|kazakhstan|cn|jp|kr|tw|hk|in|sg|id|my|th|vn|ph|au|nz|kz)$/i;
  var ME = /^(saudi arabia|united arab emirates|qatar|kuwait|israel|turkey|sa|ae|qa|kw|il|tr)$/i;
  function fold(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\u00f8/g, "o").replace(/\u00e6/g, "ae").replace(/\u0153/g, "oe").replace(/\u00df/g, "ss").replace(/\u0142/g, "l").replace(/\u0111/g, "d").replace(/['\u2018\u2019`\u201c\u201d"()]/g, "").replace(/[\s.\-\/_]+/g, " ").trim(); } /* r3: Nestle finds Nestl\u00e9, loreal L'Or\u00e9al */
  function region(c) { c = String(c || ""); if (/^(united states|us|usa)$/i.test(c)) return "us"; if (EUROPE.test(c)) return "eu"; if (ASIA.test(c)) return "asia"; if (ME.test(c)) return "me"; return "other"; }
  var LIST_COLS = "id,name,country,sector,kind,rank,cap_usd,active,pe:metrics->v->pe,evx:metrics->v->ev_ebitda,ps:metrics->v->ps,fcfy:metrics->v->fcf_y,grev:metrics->f->g_rev,nm:metrics->f->nm,roic:metrics->f->roic,dy:metrics->p->dy,nx:metrics->v->>notrade,nr:metrics->v->>norecord,r1y:metrics->r->r1y,oy:metrics->v->>oldyear,sec:status->sec->>at,secerr:status->sec->>err,secnone:status->sec->>none,eod:status->eod->>at,eoderr:status->eod->>err";
  var LIST_KEY = "mws_sa_list_v3";
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
  var mx = function (v) { return fin(v) && v > 0 && v <= 999 ? Number(v) : null; }; /* r3: the multiple as mult() shows it (above 999x: "—", sorted with the others without one) */
  var SORTS = { rank: function (r) { return r.rank != null ? r.rank : 1e9 - (r.cap_usd || 0) / 1e9; }, name: function (r) { return fold(r.name || r.id); }, cap: function (r) { return r.cap_usd; }, r1y: function (r) { return r.r1y; }, pe: function (r) { return mx(r.pe); }, evx: function (r) { return mx(r.evx); }, ps: function (r) { return mx(r.ps); }, fcfy: function (r) { return r.fcfy; }, grev: function (r) { return r.grev; }, nm: function (r) { return r.nm; }, roic: function (r) { return r.roic; }, dy: function (r) { return r.nx || r.nr ? null : r.dy; } };
  function renderList(el) {
    css(); var head = '<div class="head rv"><h1>Stock analysis.</h1><p>Every company worth $10 billion or more. Their own filings, every statement since 2009, estimates, dividends, holders, and how each one ranks against the rest.</p></div>';
    el.innerHTML = head + staffBar(null) + '<p class="small muted">Loading the companies…</p>';
    loadList().then(function (rows) { drawList(el, rows, head); }, function (e) { el.innerHTML = head + '<div class="banner bad"><div><b>Could not load the companies.</b><p>' + esc(e && e.message || e) + '</p></div></div>'; });
  }
  function drawList(el, rows, head) {
    var sectors = {}; rows.forEach(function (r) { if (r.sector) sectors[r.sector] = (sectors[r.sector] || 0) + 1; });
    var secOpts = Object.keys(sectors).sort().map(function (s) { return '<option value="' + esc(s) + '"' + (S.sector === s ? " selected" : "") + ">" + esc(s) + " (" + sectors[s] + ")</option>"; }).join("");
    var bar = '<div class="sa-bar"><input type="search" id="sa-q" aria-label="Search a company or ticker" placeholder="Search a company or ticker" value="' + esc(S.q) + '" autocomplete="off">' +
      '<div class="chips sm" id="sa-reg">' + [["all", "All"], ["us", "US"], ["eu", "Europe"], ["asia", "Asia-Pacific"], ["me", "Middle East"], ["other", "Other"]].map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (S.region === x[0] ? "on" : "") + '" aria-pressed="' + (S.region === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<select id="sa-sec" aria-label="Sector"><option value="">Every sector</option>' + secOpts + "</select>" +
      '<select id="sa-size" aria-label="Market value">' + [[10, "$10B and more"], [50, "$50B and more"], [200, "$200B and more"], [1000, "$1T and more"]].map(function (x) { return '<option value="' + x[0] + '"' + (S.size === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select></div>";
    el.innerHTML = head + staffBar(null) + progress(rows) + bar + '<div id="sa-lt"></div>';
    var pr = $("#sa-prog-go", el); if (pr) pr.addEventListener("click", function () { pr.disabled = true; pr.textContent = "Refreshing…"; loadList(true).then(function (r2) { drawList(el, r2, head); }, function () { pr.disabled = false; pr.textContent = "Refresh"; }); });
    var redraw = function () { drawRows($("#sa-lt", el), S.list || rows); };
    S.onList = function () { if ($("#sa-lt", el) && el.isConnected) redraw(); }; /* the fresh list, quietly, without touching the search box */
    var idle = W.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    idle(function () { (S.list || rows).slice(0, 20).forEach(function (r) { prefetch(r.id); }); });
    $("#sa-q", el).addEventListener("input", function (e) { S.q = e.target.value; S.shown = 100; redraw(); });
    $("#sa-reg", el).addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; S.region = b.dataset.v; $$("#sa-reg button", el).forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); S.shown = 100; redraw(); });
    $("#sa-sec", el).addEventListener("change", function (e) { S.sector = e.target.value; S.shown = 100; redraw(); });
    $("#sa-size", el).addEventListener("change", function (e) { S.size = Number(e.target.value); S.shown = 100; redraw(); });
    redraw();
  }
  function drawRows(box, rows) {
    var q = fold(S.q.trim()), min = S.size * 1e9;
    var list = rows.filter(function (r) {
      if (S.region !== "all" && region(r.country) !== S.region) return false; if (S.sector && r.sector !== S.sector) return false;
      if (r.cap_usd != null && Number(r.cap_usd) < min) return false; if (r.cap_usd == null && S.size > 10) return false;
      if (q && fold(r.name).indexOf(q) < 0 && fold(r.id).indexOf(q) < 0) return false; return true; });
    var f = SORTS[S.sort.k] || SORTS.rank, d = S.sort.d;
    list.sort(function (a, b) { var x = f(a), y = f(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * d; });
    var n = S.shown || 100, th = function (k, label, num) { var on = S.sort.k === k; return '<th data-k="' + k + '" class="' + (num ? "num " : "") + (on ? "on" : "") + '" aria-sort="' + (on ? (S.sort.d > 0 ? "ascending" : "descending") : "none") + '"><button type="button" class="sa-sort">' + label + (on ? (S.sort.d > 0 ? " <i>↑</i>" : " <i>↓</i>") : "") + "</button></th>"; };
    var body = list.slice(0, n).map(function (r, i) {
      var old = !!r.oy; /* statements that stop more than eighteen months ago: their growth, margin and return are not this year's */
      return '<tr class="clk" data-id="' + esc(r.id) + '"><td class="num">' + (r.rank || DASH) + '</td><td class="em"><a class="sym" href="#stocks/' + encodeURIComponent(r.id) + '">' + esc(r.name || r.id) + '</a><span class="tk">' + esc(r.id) + "</span></td>" +
        "<td>" + esc(r.country || DASH) + "</td><td>" + esc(r.sector || DASH) + '</td><td class="num">' + big(r.cap_usd) + '</td><td class="num ' + cls(r.r1y) + '">' + pctS(r.r1y, 0) + '</td><td class="num">' + mult(r.pe) + '</td><td class="num">' + mult(r.evx) + '</td><td class="num">' + mult(r.ps) + '</td><td class="num">' + pct(r.fcfy) + '</td><td class="num ' + (old ? "" : cls(r.grev)) + '">' + pctS(old ? null : r.grev, 0) + '</td><td class="num">' + pct(old ? null : r.nm, 0) + '</td><td class="num">' + pct(old ? null : r.roic, 0) + '</td><td class="num">' + pctA(r.nx || r.nr ? null : r.dy) /* r24 (SU24-8) */ + '</td><td class="num">' + (r.sec && !r.secerr && String(r.secnone) !== "true" ? '<span class="sa-pill" title="Statements from its SEC filings">SEC</span>' : "") + (r.eod && !r.eoderr ? '<span class="sa-pill" title="Profile, prices and estimates from EODHD">EOD</span>' : "") + "</td></tr>";
    }).join("");
    var fs = (function () { var a = document.activeElement; if (!a || !box.contains(a)) return null; var h = a.closest && a.closest("th[data-k]"); return h ? { k: h.getAttribute("data-k") } : a.id === "sa-more" ? { more: Math.max(0, n - 100) } : null; })(); /* r39 (SU39-1) */
    box.innerHTML = '<p class="small muted" style="margin:0 0 8px">' + fmtNum(list.length) + (list.length === 1 ? " company" : " companies") + (list.length !== rows.length ? " of " + fmtNum(rows.length) : "") + " · market values in US dollars · ratios on the latest twelve months or fiscal year of each company's statements (its overview names the period where it is a year, or twelve months that ended more than 200 days ago)</p>" +
      '<div class="sa-wrap"><table class="pt sa-tbl"><thead><tr>' + th("rank", "#", 1) + th("name", "Company") + "<th>Country</th><th>Sector</th>" + th("cap", "Market cap", 1) + th("r1y", "1 year", 1) + th("pe", "P/E", 1) + th("evx", "EV/EBITDA", 1) + th("ps", "P/S", 1) + th("fcfy", "FCF yield", 1) + th("grev", "Sales growth", 1) + th("nm", "Net margin", 1) + th("roic", "ROIC", 1) + th("dy", "Dividend", 1) + '<th class="num">Data</th></tr></thead><tbody>' + (body || '<tr><td colspan="15">No company matches.</td></tr>') + "</tbody></table></div>" +
      (list.length > n ? '<div class="sa-more"><button type="button" id="sa-more">Show ' + Math.min(100, list.length - n) + " more</button></div>" : "");
    if (fs && (!document.activeElement || document.activeElement === document.body)) { var fn = fs.k ? $$("th[data-k] button", box).filter(function (b) { return b.parentNode.getAttribute("data-k") === fs.k; })[0] : ($$("tr.clk a.sym", box)[fs.more] || $("#sa-more", box)); if (fn) { if (fs.k) try { fn.focus({ preventScroll: true }); } catch (e) { fn.focus(); } else fn.focus(); } } /* r39 (SU39-1) */
    /* one listener for the whole table (not three per row: with every company shown, 6,000 of them were added again on each sort or keystroke) */
    box.onclick = function (e) { var h = e.target.closest("th[data-k]"); if (h) { var k = h.dataset.k; S.shown = 100; S.sort = { k: k, d: S.sort.k === k ? -S.sort.d : (k === "rank" || k === "name" || k === "pe" || k === "evx" || k === "ps" ? 1 : -1) }; drawRows(box, rows); return; }
      if (e.target.closest("#sa-more")) { S.shown = n + 100; drawRows(box, rows); return; }
      var tr = e.target.closest("tr.clk"); if (tr && !e.target.closest("a")) location.hash = "#stocks/" + encodeURIComponent(tr.dataset.id); };
    box.onmouseover = function (e) { var tr = e.target.closest && e.target.closest("tr.clk"); if (tr && tr.dataset.id !== box.dataset.pre) { box.dataset.pre = tr.dataset.id; prefetch(tr.dataset.id, true); } }; /* the pointer resting on a row; not a finger scrolling past it */
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
    var live = S.live === true, sa = S.ctx.sim && MWS.sim ? (function () { try { var x = MWS.sim(); return x && x.access; } catch (e) { return null; } })() : null, pv = sa && sa.valid === false ? "Preview: the member you are viewing as has no valid plan and does not see this section (they are sent to Telegram); below, the section as a member with a plan sees it." : "Preview: this is the section as a member will see it."; /* r31 (SU31-3) */
    var txt = S.live === null ? (S.ctx.sim ? pv + " " : "") + "Whether members see this section could not be checked just now (the server did not answer)." : S.ctx.sim ? pv + (live ? "" : " Members do not see it yet: it is switched off.") : live ? "Members see this section." : "Only you and the admins see this section. Members do not see it until it is switched on (settings: desk_stocks_live = on)."; /* r30 (SU30-3): not known is not "switched off" */
    return '<div class="sa-staff"><span>' + esc(txt) + "</span>" + (id && S.ctx.staff && !S.ctx.sim ? '<button type="button" id="sa-refresh">Refresh this company now</button><span id="sa-rmsg"></span>' : "") + "</div>";
  }

  /* ---------- one company ---------- */
  var U_COLS = "id,name,country,sector,industry,kind,eodhd,adr,cik,tv,rank,cap_usd,currency,fin_currency,status,metrics,active,updated_at";
  /* one company: from memory, else from this browser's copy (shown at once, read again behind it), else from the database */
  var CO_KEY = "v2:";
  /* r26 (SU26-1): the function's secScaleCheck (p4_jobs) weighs EODHD's quarters against the SEC's years at the rates of the SEC's currency and the
     country's (ISO_CCY there): EODHD has given a 20-F filer's quarters in its home currency under the SEC's label (JBS's reais as dollars: a quarter's
     revenue of 114 billion "dollars"). Without the country's rate the check cannot run: the function then makes the summary from the record without
     EODHD's quarters and marks it (status.sum.fx 0, R24-1/R25-1), but the record it keeps (stock_data.fin) still holds them, unjudged. While that mark
     stands on such a record, the pages leave those quarters out too (the function's next run with the rate judges them and takes the mark off) */
  var ISO_CCY = { BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", CN: "CNY", HK: "HKD", TW: "TWD", KR: "KRW", JP: "JPY", IN: "INR", ID: "IDR", TH: "THB", MY: "MYR", PH: "PHP", SG: "SGD", VN: "VND", ZA: "ZAR", RU: "RUB", TR: "TRY", IL: "ILS", SA: "SAR", AE: "AED", QA: "QAR", KW: "KWD", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", CA: "CAD", AU: "AUD", NZ: "NZD", KZ: "KZT", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", IE: "EUR", PT: "EUR", GR: "EUR", LU: "EUR", US: "USD" }; /* the function's ISO_CCY */
  function qWait(co) { var sm = ((co.u && co.u.status) || {}).sum || {}, D = co.d || {}, s = D.sec, f = D.fin, P = D.profile || {};
    if (sm.fx !== 0 || !s || !f || !s.currency || s.currency !== f.currency || !(f.quarterly && f.quarterly.length)) return null;
    var C = ISO_CCY[String(P.iso || "").toUpperCase()]; return C && C !== String(s.currency).toUpperCase() ? C : null; }
  function withFx(co) {
    var qw = qWait(co); if (qw) { var f1 = {}, d1 = {}, k; for (k in co.d.fin) f1[k] = co.d.fin[k]; f1.quarterly = []; f1.qWait = qw; for (k in co.d) d1[k] = co.d[k]; d1.fin = f1; co.d = d1; } /* r26 (SU26-1) */
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
      if (r[1].error) throw r[1].error; /* r32 (SU32-5): a failed stock_data read is not a company without statements (nor kept) */
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
  /* no revenue for banks and insurers (outside a US 10-K), nor where EODHD's revenue line is the profit: the same rule as the function's (134k) */
  function revOff(D) { var p = D.profile || {}, g = p.gics || {}, ind = String(p.industry || "") + " " + String(g.sub || "") + " " + String(g.industry || ""); return /\bbank/i.test(ind) || (/insurance/i.test(ind) && !/broker/i.test(ind)) || /financial conglomerates/i.test(ind); }
  /* r22 (SU22-1): a bank by its industry (EODHD's industry, GICS group, industry and sub-industry): "Banks - Regional", "Diversified Banks", "Asset
     Management & Custody Banks"; not an insurer, an exchange, a payments network, an asset manager or a broker */
  /* r23 (SU23-1): GICS's "Asset Management & Custody Banks" is every asset manager's sub-industry (BlackRock, Blackstone, KKR, T. Rowe Price, Ameriprise,
     Franklin, Blue Owl, Brookfield): it names a bank only where the company's own figures make it one (finSummary's metrics.f.fin: Bank of New York Mellon,
     State Street, Northern Trust, Julius Baer), as the function's depositBiz reads it */
  function bankCo(D, M0) { var p = (D && D.profile) || {}, g = p.gics || {}, t = [p.industry, g.group, g.industry, g.sub].map(function (x) { return String(x || ""); }).join(" | ");
    return /\bbanks?\b/i.test(t.replace(/asset management\s*(?:&|and)\s*custody banks/gi, " ")) || (/asset management\s*(?:&|and)\s*custody banks/i.test(t) && !!(M0 && M0.f && M0.f.fin === true)); }
  function revHidden(D) { if (!revOff(D)) return false; var a = (D.sec && D.sec.annual) || [], f = ""; for (var i = a.length - 1; i >= 0; i--) if (a[i].form) { f = String(a[i].form); break; } return !/^10-K/.test(f); }
  var REV_KEYS = ["rev", "grev", "gp", "cogs"];
  function noRev(src, all) {
    if (!src) return src; var x = {}; for (var k in src) x[k] = src[k];
    var fix = function (rows) { return (rows || []).map(function (r) { var d = r.d || {}, same = function (a, b) { return a != null && b != null && Math.abs(a - b) <= 0.005 * Math.abs(a); };
      var bad = all || (d.rev != null && (d.rev < 0 || (same(d.rev, d.opinc) && same(d.rev, d.pretax)))); if (!bad) return r;
      var y = {}, e = {}; for (var k2 in r) y[k2] = r[k2]; for (var j in d) e[j] = d[j]; REV_KEYS.forEach(function (z) { delete e[z]; }); y.d = e; return y; }); };
    x.annual = fix(src.annual); x.quarterly = fix(src.quarterly); return x;
  }
  /* r4: a gross profit equal to the revenue to the unit is EODHD's filler for a period without one (the function's gpFill, r137b: Wanhua Chemical's and China
     Tourism Group Duty Free's 2025, a gross margin of 100% where Koyfin has 13% and 32%): left out when the period has a cost of revenue, or when the
     company's periods of the two years around it show a margin under 90% (a company with no cost of sales keeps it) */
  function gpFill(src) {
    if (!src) return src; var fill = function (d) { return d && fin(d.gp) && d.rev > 0 && Math.abs(d.gp - d.rev) <= 1e-4 * d.rev; };
    var real = (src.annual || []).concat(src.quarterly || []).filter(function (r) { return r && r.d && fin(r.d.gp) && r.d.rev > 0 && !fill(r.d) && r.d.gp / r.d.rev < 0.9; });
    var low = function (r) { return real.some(function (x) { return Math.abs(Date.parse(x.end) - Date.parse(r.end)) <= 730 * 864e5; }); };
    /* r34 (M34-6): and a cost of revenue above 0 but under a thousandth of the revenue is a part of the costs, not the cost of revenue (CenterPoint
       Energy's 2024 and 2025 at the SEC: 3 and 4 million dollars beside revenues of 8,643 and 9,357 million, "Gross margin 100.0%"): no cost of
       revenue nor gross profit for that period (the function's gpFill the same) */
    var part = function (d) { return d && d.rev > 0 && fin(d.cogs) && d.cogs > 0 && d.cogs < 1e-3 * d.rev; };
    var fix = function (rows) { return (rows || []).map(function (r) { var d = r && r.d; if (!part(d) && (!fill(d) || !((d.cogs || 0) > 0.02 * d.rev || low(r)))) return r; var y = {}, e = {}; for (var k in r) y[k] = r[k]; for (var j in d) if (j !== "gp" && !(j === "cogs" && part(d))) e[j] = d[j]; y.d = e; return y; }); };
    var x = {}; for (var k in src) x[k] = src[k]; x.annual = fix(src.annual); x.quarterly = fix(src.quarterly); return x;
  }
  /* r32 (SU32-3): EODHD's own "ebitda" (kept on its rows) is the page's EBITDA only where a row has no operating income or no depreciation; where the
     function's guard took the row's operating income (an EBITDA tagged as it, a copy of the gross profit, ten times the revenue: opgp, opscale) or its
     depreciation (figures to date, below zero: qda, neg), that figure goes with them, as the function's summary has no EBITDA there (fin.qg.at) */
  function ebitdaCut(src) {
    var at = src && src.qg && Array.isArray(src.qg.at) ? src.qg.at : null; if (!at || !at.length) return src; var off = {}, n = 0;
    at.forEach(function (p) { var a = String(p).split("|"); if (a[2] === "opinc" || a[2] === "da") { off[a[0] + "|" + a[1]] = 1; n++; } }); if (!n) return src;
    var fix = function (rows, w) { return (rows || []).map(function (r) { if (!r || !r.d || r.d.ebitda == null || !off[w + "|" + r.end]) return r; var y = {}, e = {}; for (var k in r) y[k] = r[k]; for (var j in r.d) if (j !== "ebitda") e[j] = r.d[j]; y.d = e; return y; }); };
    var x = {}; for (var k in src) x[k] = src[k]; x.annual = fix(src.annual, "A"); x.quarterly = fix(src.quarterly, "Q"); return x;
  }
  /* r36 (M36-3): an SEC year whose line of one sign (a cost, the spending, a payout, the interest) is more than 10% off its own four quarters' sum (and
     more than 0.01% of its revenue) is shown "—" unless the other record's year of that day (EODHD's, same currency) is near it or a quarter holds
     the year's figure: McKesson's "Depreciation and amortization" of 272 and 287 million dollars for its years to March 2025 and 2026 is its
     depreciation alone (its quarters', 636 and 729, its cash flow statement's), CACI's 68.4 for its year to June 2024 (142.2); McDonald's and
     Snap-on's quarters are the partial ones. The year's figure is kept (cut36) to judge its quarters by, as the function's (finSummary: secYearCut) */
  function secYearCut(sec, f) { if (!sec || !(sec.annual || []).length || !(sec.quarterly || []).length) return sec;
    var near = function (a, b) { return Math.abs(a - b) <= 0.1 * Math.max(Math.abs(a), Math.abs(b)); }, annual = null;
    var Q = sec.quarterly.filter(function (q) { return q && q.d && q.end; }).sort(function (a, b) { return String(a.end).localeCompare(String(b.end)); });
    var OA = f && f.currency && f.currency === sec.currency ? f.annual || [] : [];
    sec.annual.forEach(function (y, i) { if (!y || !y.d || !y.end) return; var ye = Date.parse(y.end);
      var inY = Q.filter(function (q) { var e = Date.parse(q.end); return e > ye - 355 * 864e5 && e <= ye + 10 * 864e5; });
      if (inY.length !== 4 || !inY.every(function (q, j) { if (!j) return true; var g = (Date.parse(q.end) - Date.parse(inY[j - 1].end)) / 864e5; return g >= 60 && g < 125; })) return;
      var bk = fin(y.d.rev) ? "rev" : "ni"; if (!fin(y.d[bk]) || !inY.every(function (q) { return fin(q.d[bk]); }) || Math.abs(inY.reduce(function (a, q) { return a + q.d[bk]; }, 0) - y.d[bk]) > 0.01 * Math.abs(y.d[bk])) return; /* only a year on its quarters' basis (revenue, a bank's profit, their sum to 1%): one recast after them (DuPont's 2024), or whose basis cannot be seen, stands */
      var oy = OA.filter(function (x) { return x && x.d && x.end && Math.abs(Date.parse(x.end) - ye) <= 10 * 864e5; })[0];
      var cut = ["cogs", "rnd", "sga", "da", "sbc", "capex", "divp", "buyb", "intexp", "acq", "drepay", "dissue"].filter(function (k) { var yv = y.d[k]; if (!fin(yv) || !inY.every(function (q) { return fin(q.d[k]); })) return false;
        var sm = inY.reduce(function (a, q) { return a + q.d[k]; }, 0), gap = Math.abs(sm - yv); if (!(gap > 0.1 * Math.max(Math.abs(yv), Math.abs(sm))) || (y.d.rev > 0 && gap <= 1e-4 * y.d.rev)) return false;
        if (oy && fin(oy.d[k]) && near(oy.d[k], yv)) return false;
        /* quarters given to date (SS&C's dividends paid of 2025: 61.6, 122.5, 65.8, 65.5 for 253.8) add up to the year once taken back to their own */
        for (var m = 1; m < 8; m++) { var run = 0, ok = true, own = []; for (var j = 0; j < 4; j++) { var v = j && m & (1 << (j - 1)) ? inY[j].d[k] - run : inY[j].d[k]; if (v * Math.sign(yv) < 0) { ok = false; break; } run += v; own.push(v); }
          if (ok && Math.abs(run - yv) <= 0.01 * Math.abs(yv) && ytdLike(k, m, own)) return false; } /* r37 (M37-3) */
        return true; });
      if (cut.indexOf("cogs") >= 0 && fin(y.d.gp) && fin(y.d.rev) && Math.abs(y.d.gp - (y.d.rev - y.d.cogs)) <= 1e-3 * Math.abs(y.d.rev)) cut.push("gp"); /* r37 (SU37-1): the gross profit made of that cost of revenue (the revenue less it: Rockwell Automation's FY2024, 3,851 beside quarters of 3,194) goes with it */
      if (!cut.length) return; if (!annual) annual = sec.annual.slice(); var d = Object.assign({}, y.d), c = {}; cut.forEach(function (k) { c[k] = d[k]; delete d[k]; }); annual[i] = Object.assign({}, y, { d: d, cut36: c }); });
    return annual ? Object.assign({}, sec, { annual: annual }) : sec; }
  function stmts(D0) {
    var off = revOff(D0), lastForm = (function () { var a = (D0.sec && D0.sec.annual) || []; for (var i = a.length - 1; i >= 0; i--) if (a[i].form) return String(a[i].form); return ""; })();
    var D = { sec: D0.sec && ((off && !/^10-K/.test(lastForm)) || D0._rp) ? noRev(D0.sec, true) : D0.sec, fin: noRev(D0.fin, off) }; D.sec = secYearCut(gpFill(D.sec), D.fin); /* r36 (M36-3) */ D.fin = ebitdaCut(gpFill(D.fin)); /* r32 (SU32-3) */ /* r4: _rp, the function found the filings' revenue line to be only part of the revenue (the note at the top says none is shown) */
    var sec = D.sec, f = D.fin, out = { A: null, Q: null };
    var fresh = function (rows) { return rows && rows.length && Date.now() - Date.parse(rows[rows.length - 1].end) < 200 * 864e5; };
    /* years: the SEC's, then the later years EODHD has when the SEC's data lags (some foreign filers' latest 20-F), in the same currency */
    var sA = sec && sec.annual || [], fA = f && f.annual || [];
    if (sA.length) {
      var lastS = Date.parse(sA[sA.length - 1].end), newer = fA.filter(function (r) { return Date.parse(r.end) > lastS + 200 * 864e5; });
      if (!newer.length) out.A = { rows: sA, src: "sec", cur: sec.currency };
      else if (f.currency === sec.currency) { var add = laterYears(sA[sA.length - 1], newer); out.A = add.length ? { rows: sA.concat(add), src: "sec", cur: sec.currency, added: add.length } : { rows: sA, src: "sec", cur: sec.currency }; }
      else out.A = { rows: fA, src: "eodhd", cur: f.currency };
    } else if (fA.length) out.A = { rows: fA, src: "eodhd", cur: f.currency };
    var steady = function (rows) { var r = rows.slice(-8); for (var i = 1; i < r.length; i++) if ((Date.parse(r[i].end) - Date.parse(r[i - 1].end)) / 864e5 > 125) return false; return r.length >= 4; }; /* foreign filers give half-years: not quarters */
    /* r36 (M36-4): the other record's years, shown or not, as the function's tie-break (finSummary: OTH, r137d): EODHD's years beside the SEC's quarters
       (the record keeps its last eight beside the SEC's), the SEC's beside EODHD's while the SEC's are not too old to speak (550 days, as the function's
       secOld). The page took only the other record's years its Years page shows (EODHD's after the SEC's), so where EODHD's year said which of the
       SEC's year and its quarters is the cash flow statement's line (Salesforce's depreciation of its year to January 2026, 1,200 million dollars at
       the SEC beside quarters of 3,631: EODHD's year near the quarters), the function summed them (its EBITDA) and the page's twelve months showed "—" */
    var secLast = sec ? [].concat(sec.annual || [], sec.quarterly || []).reduce(function (m, r) { return Math.max(m, Date.parse(r && r.end) || 0); }, 0) : 0, secOk = !!sec && Date.now() - secLast <= 550 * 864e5;
    if (sec && sec.quarterly && sec.quarterly.length >= 4 && fresh(sec.quarterly) && steady(sec.quarterly)) out.Q = { rows: sec.quarterly, src: "sec", cur: sec.currency, oth: f && f.currency === sec.currency ? fA : [] };
    else if (f && f.quarterly && f.quarterly.length) out.Q = { rows: f.quarterly, src: "eodhd", cur: f.currency, yrs: fA, oth: secOk && sec.currency === f.currency ? sA : [] }; /* r33 (SU33-1): EODHD's own years, to judge its quarters by (periods) */
    else if (sec && sec.quarterly && sec.quarterly.length) out.Q = { rows: sec.quarterly, src: "sec", cur: sec.currency, oth: f && f.currency === sec.currency ? fA : [] };
    /* r20 (SU20-2): the company's own latest SEC year with an interest figure gives its finance costs (the function's intF, IFRS): EODHD's figure for its
       interest can be those too (Wipro's four quarters to March 2024: 12,552 million rupees, its 20-F's finance costs 12,550; Sanofi's above its 20-F's) */
    var fcY = sA.filter(function (r) { return r && r.d && fin(r.d.intexp); }).pop(); if (fcY && fcY.intF) { if (out.A) out.A.fc = 1; if (out.Q) out.Q.fc = 1; }
    return out;
  }
  /* r20 (SU20-2): a period whose interest figure is EODHD's for such a company (an EODHD set or year, or twelve months summed from EODHD's quarters) */
  function intU(r, set) { return !!(r && set && set.fc && !r.intF && r.d && fin(r.d.intexp) && (r.ttm ? !!r.intE : set.src === "eodhd" || r.src === "eodhd")); }
  /* EODHD's later years only when they continue the SEC's (the same scale; per-share lines on the same share count): the same rule as the function's */
  function laterYears(last, newer) {
    var ld = (last && last.d) || {}, nd = (newer[0] && newer[0].d) || {};
    var q = function (a, b) { return a != null && b != null && a > 0 && b > 0 ? b / a : null; };
    var scale = q(ld.rev, nd.rev); if (scale == null) scale = q(ld.ta, nd.ta); if (scale != null && (scale < 0.5 || scale > 2)) return [];
    /* a "later" year with the very figures of the SEC's last one is that year under a wrong date (Copel at EODHD: its 2024 dated September 2025) */
    var eqv = function (a, b) { return a != null && b != null && a !== 0 && Math.abs(b / a - 1) <= 0.002; };
    if ((eqv(ld.rev, nd.rev) && (eqv(ld.ni, nd.ni) || ld.ni == null || nd.ni == null)) || (ld.rev == null && eqv(ld.ni, nd.ni) && eqv(ld.ta, nd.ta))) return [];
    var sh = q(ld.shd != null ? ld.shd : ld.shb != null ? ld.shb : ld.sho, nd.shd != null ? nd.shd : nd.shb != null ? nd.shb : nd.sho), same = sh != null && sh > 0.7 && sh < 1.43;
    return newer.map(function (r) { var x = {}, d = {}; for (var k in r) x[k] = r[k]; for (var j in r.d) d[j] = r.d[j]; if (!same) ["eps", "epsd", "dps", "shb", "shd", "sho"].forEach(function (z) { delete d[z]; }); x.d = d; x.src = "eodhd"; return x; });
  }
  function startOf(row, per) { if (row.start) return row.start; var d = new Date(Date.parse(row.end + "T00:00:00Z")); d.setUTCMonth(d.getUTCMonth() - (per === "a" ? 12 : 3)); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  /* a value of a period in the chosen currency: flows at the period's average rate, balances at its end; null when the rate is unknown */
  function conv(v, row, set, kind, per) {
    if (!fin(v)) return null; if (kind === "s" || kind === "n" || S.cur !== "usd" || S.local) return v;
    var ccy = row.cur || set.cur || "USD"; var r = fxRate(ccy, kind === "b" ? null : startOf(row, per), row.end); return r == null ? null : v * r;
  }
  /* r23 (SU23-2): the factor that puts a restatement's two figures (as filed) on the basis of the row the page shows: 1 where the row was not moved;
     the row's own figure over the last filed one where the parser moved it to today's basis after a split (r.split) by that very factor; null (no hover)
     where that cannot be told */
  function restOn(rs, r, key) { if (!r || !r.split || !/^(eps|epsd|dps|shb|shd|sho)$/.test(String(key))) return 1; var v = r.d && r.d[key]; if (!fin(v) || !fin(rs.now) || !v || !rs.now) return null;
    var q = v / rs.now; if (Math.abs(q - 1) <= 0.005) return 1; var f = /^sh/.test(key) ? q : 1 / q; return Math.abs(f / r.split - 1) <= 0.03 ? q : null; }
  function restMap(D) { var m = {}; ((D.sec && D.sec.restated) || []).forEach(function (x) { var p = String(x.p || "").split(" "), e = p[1]; if (e && !x.split) m[(p[0] === "FY" ? "a" : "q") + "|" + x.k + "|" + e] = x; }); return m; }
  /* r27 (SU27-1): EODHD's rows that hold six months or more under a quarter's label: the function's guard (finQualityGuard) moves a half year to
     fin.halves only where it can prove it one (two rows of a year that add up to it within 3%, or a quarter twice the others' size beside them): Roche's
     halves of 2022 (32.3 and 31.0 billion francs, 3.8% short of a year of 65.8 that counts its other revenue), Adyen's (854 and 887, 7% over its year),
     a half alone in its year (Tesco's to August 2024, 34,770 of 69,920; LVMH's second half of 2020) stayed, and were shown as quarters. A row of EODHD's
     quarters that ends 150 days or more after the period before it (the row with revenue before it, the year before's end, a half the function moved)
     and holds 40% or more of its year's revenue (after the latest year: of that year's; the record's first period: half) is one: its income statement and cash flows are not a
     quarter's. {end: 1} */
  function halfQ(st, D) { var o = {}; if (!st || !st.Q || st.Q.src !== "eodhd") return o; var sameA = !!(st.A && st.A.cur === st.Q.cur); /* r28 (SU28-1): the pairs below need no years */
    var hE = ((D && D.fin && D.fin.halves) || []).map(function (h) { return h && Date.parse(h.end); }).filter(isFinite), bnd = (sameA ? st.A.rows : []).map(function (a) { return Date.parse(a.end); }).filter(isFinite).concat(hE), seen = [];
    if (sameA) st.Q.rows.forEach(function (q) { if (!q || !q.d || !(q.d.rev > 0)) return; var t = Date.parse(q.end);
      var thr = seen.length || hE.some(function (e) { return e <= t - 20 * 864e5; }) ? 0.4 : 0.5; /* the record's first period: its start unknown (EODHD's quarters may begin with any quarter), half its year or more */
      var from = bnd.concat(seen).filter(function (e) { return e <= t - 20 * 864e5; }).reduce(function (m, e) { return Math.max(m, e); }, -Infinity);
      var y = st.A.rows.filter(function (a) { var e = Date.parse(a.end); return a.d && a.d.rev > 0 && t > e - 355 * 864e5 && t <= e + 10 * 864e5; })[0];
      if (!y) { var yl = st.A.rows.filter(function (a) { return a.d && a.d.rev > 0; }).pop(); if (yl && t > Date.parse(yl.end) + 10 * 864e5 && t <= Date.parse(yl.end) + 400 * 864e5) y = yl; } /* after the latest year: against it (Adyen's first half of 2026, 1,459 beside 2,673 for 2025) */
      if (y && isFinite(from) && (t - from) / 864e5 >= 150 && q.d.rev >= thr * y.d.rev) o[q.end] = 1; seen.push(t); });
    /* r28 (SU28-1): and the rows the rule above misses, by their other figures: a year's two rows six months apart that add up to it (within 3%, two
       lines at least among revenue, gross profit, operating income, pre-tax income, net income, operating cash flow and net interest income, net or
       pre-tax income among them; three where the revenue is given and does not add up): its halves, whatever their revenue (a bank's or an insurer's
       without one: Commonwealth Bank's halves to December 2025 and June 2026, net income 5,367 and 5,499 million of 10,870; Imperial Brands', revenue
       net of duties beside a year with them, 7,823 and 9,084 of 32,550, net income 995 and 575 of 1,570; Akeso's second half of 2023, 849 of 4,526).
       A record with such halves and no two rows with figures a quarter apart reports by halves: every row 150 days or more after the period before it
       is one (Imperial's half to March 2026, after two years without figures). Two rows a quarter apart with the same figures, or the first half the
       second's, line by line (within 0.2%, four lines at least with the revenue; the same figures on three in five of the lines both give), are not each quarter's own: a
       half year split in two or one quarter's figures given again (BT's quarters to June and September 2024, 5,059 million each; PDD's December 2023
       and March 2024, 86,810), the half year halved before the half year itself (Unilever's March and June 2024, 15,560 and 31,120; Stellantis',
       Symrise's, Holcim's). {end: 1} a half year; {end: 2} not the quarter's own figures */
    var HK = ["rev", "gp", "opinc", "pretax", "ni", "cfo", "nii"], FK = ["rev", "cogs", "gp", "rnd", "sga", "opinc", "intexp", "pretax", "tax", "ni", "cfo", "da", "sbc", "capex", "cfi", "cff", "divp", "buyb"], DAY = 864e5;
    var nK = function (q, K) { return K.filter(function (k) { return fin(q.d[k]) && q.d[k] !== 0; }).length; };
    var per1 = function (K) { var P = []; st.Q.rows.forEach(function (q) { if (!q || !q.d || !nK(q, K)) return; var p = P[P.length - 1]; if (p && (Date.parse(q.end) - Date.parse(p.end)) / DAY < 20) { if (nK(q, K) > nK(p, K)) P[P.length - 1] = q; } else P.push(q); }); return P; }; /* twin dates: one period */
    var R = per1(HK), RF = per1(FK);
    for (var i = 1; i < RF.length; i++) { var a = RF[i - 1], c = RF[i], g = (Date.parse(c.end) - Date.parse(a.end)) / DAY, rv = (a.d.rev > 0 ? 1 : 0) + (c.d.rev > 0 ? 1 : 0); if (g < 60 || g > 125 || rv === 1) continue;
      for (var m = 1; m <= 2; m++) { var ks = FK.filter(function (k) { return fin(a.d[k]) && fin(c.d[k]) && a.d[k] !== 0; }), eq = ks.filter(function (k) { return Math.abs(c.d[k] / (m * a.d[k]) - 1) <= 0.002; });
        var pSame = function (k) { return m === 2 && Math.abs(c.d[k] / a.d[k] - 1) <= 0.002; }, pAll = !["ni", "pretax"].some(function (k) { return ks.indexOf(k) >= 0 && eq.indexOf(k) < 0 && !pSame(k); }), pEq = ["ni", "pretax"].some(function (k) { return ks.indexOf(k) >= 0 && pSame(k); }); /* r29 (SU29-1): the half's profit halved into both rows (Unilever's September and December 2022: 2,369 and 2,369 beside flows of 432 and 863...) */
        if ((rv ? eq.indexOf("rev") >= 0 : pAll) && eq.length >= 4 && (m === 2 || eq.length >= 0.6 * ks.length)) { if (!o[a.end]) o[a.end] = 2; if (!o[c.end]) o[c.end] = m === 2 && !(!rv && pEq) ? 1 : 2; break; } } }
    /* twice, line by line on four lines, is no chance (Gold Fields' September and December 2022: revenue, cost of revenue, gross profit, tax); rows
       without revenue (the function took it away) by their other flows: Delivery Hero's 2023 and 2024, selling and admin costs 550 and 1,099 million,
       depreciation 120 and 240, stock-based pay 65.8 and 132; Unilever's capital spending, dividends and buybacks of 2022 and 2023), unless their
       profits differ (XP's net income of 1,030 and 1,051 million beside cash flows given alike: which lines are the quarter's cannot be told here) */
    /* and a quarter whose figures are half those of the half year the function moved (fin.halves) that ends a quarter after it, on five lines at least
       and half the lines both give, the revenue among them where both give one: Carlsberg's first quarter of 2023 (revenue 18,890 million kroner, gross
       profit 8,441, operating cash flow 3,054: each half its first half's; the function's M27-6 needs every line and its profits are not), Coca-Cola
       Europacific's, Ferrovial's, Henkel's, Moncler's of 2024 */
    ((D && D.fin && D.fin.halves) || []).forEach(function (h) { if (!h || !h.d || !h.end) return; var he = Date.parse(h.end);
      st.Q.rows.forEach(function (q) { if (!q || !q.d || o[q.end]) return; var g = (he - Date.parse(q.end)) / DAY; if (g < 75 || g > 105) return;
        var ks = FK.filter(function (k) { return fin(q.d[k]) && fin(h.d[k]) && q.d[k] !== 0 && h.d[k] !== 0; }), eq = ks.filter(function (k) { return Math.abs(q.d[k] * 2 / h.d[k] - 1) <= 0.002; });
        if (eq.length >= 5 && eq.length >= 0.5 * ks.length && (!(fin(q.d.rev) && fin(h.d.rev)) || eq.indexOf("rev") >= 0)) o[q.end] = 2; }); });
    if (!sameA) return o; var proven = 0;
    /* r28 (SU28-5): a quarter with a flow more than four times the largest revenue or total assets of the years beside it (within 400 days) is on
       another scale (another currency's or unit's figures under the record's): YPF's quarters of 2026 (revenue 6,956,000 and 9,167,000 million
       "dollars", its pesos, beside years of 18,450), Norilsk Nickel's to June 2022 (net income 370,800 million beside years of 1,313 to 6,512 and
       assets of 23,580), Bayan Resources' dividends paid to June 2025. {end: 3} */
    st.Q.rows.forEach(function (q) { if (!q || !q.d || o[q.end]) return; var t = Date.parse(q.end), lim = 0;
      st.A.rows.forEach(function (a) { if (a && a.d && Math.abs(Date.parse(a.end) - t) <= 400 * DAY) lim = Math.max(lim, fin(a.d.rev) ? Math.abs(a.d.rev) : 0, fin(a.d.ta) ? Math.abs(a.d.ta) : 0); });
      if (lim > 0 && FK.some(function (k) { return fin(q.d[k]) && Math.abs(q.d[k]) > 4 * lim; })) o[q.end] = 3; });
    st.A.rows.forEach(function (y) { var ye = Date.parse(y.end); if (!y.d || !isFinite(ye)) return;
      var inY = R.filter(function (q) { var e = Date.parse(q.end); return e > ye - 355 * DAY && e <= ye + 10 * DAY; }); if (inY.length < 2) return;
      var py = st.A.rows.map(function (x) { return Date.parse(x.end); }).filter(function (t) { return t < ye - 300 * DAY && t > ye - 430 * DAY; }).sort(function (u, v) { return v - u; })[0]; if (!isFinite(py)) py = ye - 365 * DAY;
      inY.forEach(function (a) { inY.forEach(function (c) { /* any two of them: a stray row between them (Sasol's March 2025) does not hide the halves */
        var g1 = (Date.parse(a.end) - py) / DAY, g2 = (Date.parse(c.end) - Date.parse(a.end)) / DAY; if (g1 < 150 || g1 > 210 || g2 < 150 || g2 > 210) return;
        var fit = function (k) { return fin(y.d[k]) && y.d[k] !== 0 && fin(a.d[k]) && fin(c.d[k]) && Math.abs(a.d[k] + c.d[k] - y.d[k]) <= 0.03 * Math.abs(y.d[k]); };
        var ok = HK.filter(fit), revOff = fin(y.d.rev) && y.d.rev !== 0 && fin(a.d.rev) && fin(c.d.rev) && !fit("rev");
        if (inY.length > 2 && ok.some(function (k) { return inY.every(function (r) { return fin(r.d[k]); }) && Math.abs(inY.reduce(function (t, r) { return t + r.d[k]; }, 0) - y.d[k]) <= 0.03 * Math.abs(y.d[k]); })) return; /* all the year's rows add up to it too: quarters, two of them carrying the year (a quarterly reporter's tiny quarters beside a big one) */
        if (ok.length >= (revOff ? 3 : 2) && (ok.indexOf("ni") >= 0 || ok.indexOf("pretax") >= 0)) { o[a.end] = 1; o[c.end] = 1; proven++; } }); }); });
    var qtr = R.some(function (q, j) { if (!j) return false; var g = (Date.parse(q.end) - Date.parse(R[j - 1].end)) / DAY; return g >= 60 && g <= 125 && !(o[q.end] && o[R[j - 1].end]); });
    if (proven && !qtr) R.forEach(function (q, j) { if (o[q.end]) return; var t = Date.parse(q.end);
      var from = bnd.concat(R.slice(0, j).map(function (x) { return Date.parse(x.end); })).filter(function (e) { return e <= t - 20 * DAY; }).reduce(function (mx, e) { return Math.max(mx, e); }, -Infinity);
      if (isFinite(from) && (t - from) / DAY >= 150) o[q.end] = 1; });
    return o; }
  /* r27 (SU27-2): EODHD's twin dates (one period's rows a few days apart: Coca-Cola HBC's 30 June and 1 July 2022, Imperial's 30 and 31 March 2022,
     Tesco's 24 and 31 August 2024) on the Quarters view: per statement, a twin row with none of its figures is no column where its twin has some (the
     function's M26-1 leaves a period's flows in one of them); twins that both have figures stay, named by their day (rows.twin) */
  function twinCut(rows, which, hq) { var L = (LINES[which] || []).filter(function (l) { return l[0] !== "hd" && typeof l[1] === "string"; }), tw = {}, out = [], g = [];
    var has = function (r) { return L.some(function (l) { return !(hq && hq[r.end] && (l[2] === "f" || l[2] === "e")) && fin(r.d && r.d[l[1]]); }); };
    var flush = function () { if (g.length === 1) out.push(g[0]); else if (g.length > 1) { var w = g.filter(has); if (w.length > 1) w.forEach(function (r) { tw[r.end] = 1; }); (w.length ? w : [g[g.length - 1]]).forEach(function (r) { out.push(r); }); } g = []; };
    rows.forEach(function (r) { if (g.length && (Date.parse(r.end) - Date.parse(g[g.length - 1].end)) / 864e5 < 20) g.push(r); else { flush(); g = [r]; } }); flush();
    out.twin = tw; return out; }
  /* the periods to show: years, quarters, or trailing twelve months at each quarter */
  /* r36 (M36-2): the add-up check's slack, a share of the year's revenue, as the function's (finSummary: slack): 1% for a line that can change sign
     (a profit, a cash flow, the tax: a small difference of revenue-sized figures), 0.01% (rounding) for a line of one sign (costs, spending, payouts,
     interest): 1% passed quarters 25% to 150% off their year (Samsung Electronics' interest expense of 2025 at EODHD, 3,901,200 million won for a
     year of 605,800; McKesson's depreciation of its year to March 2026, 729 million dollars for 287; Airbus's buybacks of 2025, 1,032 for 565) */
  /* r36 (M36-7): the quarters given to date among four (one or more of them the year's figure so far) that, taken back to their own, add up to the year
     (to 1%) in one way only: only they are not summed, the year is right (SS&C's dividends paid of 2025, 61.6, 122.5, 65.8 and 65.5 for 253.8: its
     twelve months to June 2026 its own quarters'), as the function's (finSummary: ytdOf) */
  /* r37 (M37-3): a mask is a reading of figures to date only where each quarter taken back gives a figure of the size of the year's other quarters
     (a third of their median at least), but for a payout, which a quarter can lack (dividends, buybacks, acquisitions, debt issued or repaid): Komatsu's
     cost of revenue of its year to March 2025 at EODHD, 644,300, 694,100, 661,100 and 1,448,000 million yen (its fourth row its second half's) for a
     year of 2,782,000: its second quarter taken back to 49,800 made 2,803,200 (0.76% off), and the fourth was summed as sure: "Cost of revenue
     3,408,700" for its twelve months to September 2025 (about 2,743,000); Hikvision's research costs of 2025 (2,672, 2,998, 3,068 and 8,738, its
     nine months, for 11,750), BASF's and Cellnex's interest of 2024 and 2025, First Citizens' depreciation of 2025: as the function's (ytdLike) */
  function ytdLike(k, m, own) { if (/^(divp|buyb|acq|dissue|drepay)$/.test(k)) return true; var back = [], keep = [];
    own.forEach(function (v, j) { (j && m & (1 << (j - 1)) ? back : keep).push(Math.abs(v)); }); keep.sort(function (a, b) { return a - b; });
    var ref = keep[Math.floor((keep.length - 1) / 2)]; return back.every(function (v) { return v >= ref / 3; }); }
  function ytdOf(qs, k, yv) { if (qs.length !== 4 || !yv) return null; var hit = null, n = 0;
    for (var m = 1; m < 8; m++) { var run = 0, ok = true, own = []; for (var j = 0; j < 4; j++) { var v = j && m & (1 << (j - 1)) ? qs[j].d[k] - run : qs[j].d[k]; if (v * Math.sign(yv) < 0) { ok = false; break; } run += v; own.push(v); }
      if (ok && Math.abs(run - yv) <= 0.01 * Math.abs(yv)) { n++; if (!ytdLike(k, m, own)) { hit = null; continue; } hit = qs.filter(function (q, i) { return i > 0 && (m & (1 << (i - 1))) !== 0; }); } }
    return n === 1 ? hit : null; }
  function slackOf(k) { return /^(rev|cogs|rnd|sga|da|sbc|capex|divp|buyb|intexp|acq|drepay|dissue|dps)$/.test(k) ? 1e-4 : 0.01; }
  function periods(set, per, A, hq) { /* r28 (SU28-2): hq, halfQ()'s rows: no quarter's own figures, not summed into twelve months */
    if (!set) return [];
    if (per !== "t") return set.rows.map(function (r) { return r; });
    /* r25 (SU25-2): one period's rows a few days apart (EODHD's twin dates: CCH.LSE's half-year to June 2022 on 30 June and 1 July, HSBC's March 2025 on
       the 30th and the 31st) are one period, not two quarters: the one with more figures (the later of two as full) stands for both in the twelve
       months (CCH.LSE's "TTM Dec 22" summed both: revenue 15,709 for a year of 9,198, and the check that a year's quarters add up to it, which needs
       four, skipped its five) */
    var nF = function (x) { return Object.keys(x.d || {}).filter(function (k) { return fin(x.d[k]); }).length; };
    var q = set.rows.reduce(function (o, r) { var p = o[o.length - 1]; if (p && (Date.parse(r.end) - Date.parse(p.end)) / 864e5 < 20) { if (nF(r) >= nF(p)) o[o.length - 1] = r; } else o.push(r); return o; }, []), out = [];
    /* r4: the function's rule (finSummary's addsUp): a flow is summed over four quarters only where the quarters of each year among them add up to that
       year's figure (within 10%, or 1% of its revenue): EODHD gives some companies' capital spending, dividends paid or depreciation to date, not for the
       quarter (Hong Kong Exchanges' capital spending 0, 3,490, 0, 4,881 in a year of 1,733; Tencent's 2025: 87.5 billion in its quarters, 112.9 in its year) */
    var consec = function (rows) { return rows.length === 4 && rows.every(function (r, j) { return j === 0 || (Date.parse(r.end) - Date.parse(rows[j - 1].end)) / 864e5 < 125; }); };
    /* r33 (SU33-1): and by the quarters' own record's years where the Years page shows another source's (a 20-F filer's SEC years beside EODHD's
       quarters: none was checked, Equinor's capital spending to date summed as quarters), the other source's year of that day the tie-break (r137d) */
    var ownY = (A && A.cur === set.cur ? A.rows || [] : []).filter(function (y) { return (y.src || A.src) === set.src; }), othY = A && A.cur === set.cur ? (A.rows || []).filter(function (y) { return (y.src || A.src) !== set.src; }) : [];
    (set.yrs || []).forEach(function (y) { if (y && y.d && y.end && !ownY.some(function (z) { return Math.abs(Date.parse(z.end) - Date.parse(y.end)) <= 10 * 864e5; })) ownY.push(y); });
    var bad = {}, sure = {}; ownY.forEach(function (y) { var ye = Date.parse(y.end), yd = y.cut36 ? Object.assign({}, y.d, y.cut36) : y.d; /* r36 (M36-3): a year shown "—" still judges its quarters */
      var inY = q.filter(function (r) { var e = Date.parse(r.end); return e > ye - 355 * 864e5 && e <= ye + 10 * 864e5; });
      /* r38 (M38-5): a year whose rows are not four quarters a quarter apart (a series that starts or stops within it, quarters missing whole; a half
         pair is the function's own case) was not judged: for a line of one sign, the quarters given there that exceed the whole year beyond the add-up
         tolerance cannot all be that year's (Bandai Namco's interest of its quarter to June 2022 at EODHD, 6,796 million yen beside its year to March
         2023's 332, the year's only row: "TTM Jun 22" 7,081; Universal Music's capital spending of its quarter to December 2022, 442 beside a year of
         93); not summed, as the function's (addsUp). The other record's year of that day clears them only when it holds them; not where a row
         halfQ() takes for a half is among them */
      if (!consec(inY)) { if (!inY.length || (inY.length === 2 && (function (g) { return g >= 165 && g <= 200; })((Date.parse(inY[1].end) - Date.parse(inY[0].end)) / 864e5)) || inY.some(function (r) { return hq && hq[r.end]; })) return;
        Object.keys(yd || {}).forEach(function (k) { if (!/^(rev|cogs|rnd|sga|da|sbc|capex|divp|buyb|intexp|acq|drepay|dissue|dps)$/.test(k) || !fin(yd[k])) return;
          var oy = (set.oth || othY).filter(function (x) { return x && x.d && x.end && Math.abs(Date.parse(x.end) - ye) <= 10 * 864e5; })[0], ov = oy && oy.d ? oy.d[k] : null;
          var hv = inY.filter(function (r) { return fin(r.d[k]); }), sg = yd[k] > 0 ? 1 : yd[k] < 0 ? -1 : 0, sp = hv.reduce(function (a, r) { return a + r.d[k]; }, 0);
          var past = function (x) { return Math.abs(sp) - Math.abs(x) > 0.1 * Math.abs(sp) && !(k !== "dps" && yd.rev > 0 && Math.abs(sp) - Math.abs(x) <= slackOf(k) * yd.rev); };
          if (sg && hv.length && hv.every(function (r) { return r.d[k] * sg > 0; }) && past(yd[k]) && !(fin(ov) && !past(ov))) hv.forEach(function (r) { bad[k + "|" + r.end] = 1; }); });
        return; }
      Object.keys(yd || {}).forEach(function (k) { if (((KIND[k] || "f") !== "f" && k !== "dps") || !fin(yd[k])) return;
        var oy = (set.oth || othY).filter(function (x) { return x && x.d && x.end && Math.abs(Date.parse(x.end) - ye) <= 10 * 864e5; })[0], ov = oy && oy.d ? oy.d[k] : null; /* r36 (M36-4): set.oth */ /* r33 (SU33-1, SU33-2): the other source's year of that day */
        if (!inY.every(function (r) { return fin(r.d[k]); })) { /* r33 (SU33-2): a quarter without the line: the others already well above their year (figures to date) are not summed */
          var hv = inY.filter(function (r) { return fin(r.d[k]); }), sg = yd[k] > 0 ? 1 : yd[k] < 0 ? -1 : 0, sp = hv.reduce(function (a, r) { return a + r.d[k]; }, 0);
          /* a line of one sign by nature (costs, spending, payouts), or quarters that grow through the year as figures to date do: a line that can change
             sign (a profit, a cash flow) may have its missing quarter of the other sign (Bayer's 2024 profit to common: -4,183 and -335 in its third and
             fourth quarters, its first, +1,950, missing: a year of -2,552) */
          var one = /^(rev|cogs|rnd|sga|da|sbc|capex|divp|buyb|intexp|acq|drepay|dissue|dps)$/.test(k), grows = hv.every(function (r, j) { return !j || Math.abs(r.d[k]) >= Math.abs(hv[j - 1].d[k]); });
          /* r34 (M34-4): or, not growing, two or more of them each above the whole year's figure and together above three times it: the missing quarter
             would have to be of the other sign and more than twice the year (Japan Post's operating income to March 2025 at EODHD, 2,737,000, 2,799,000
             and 520,100 million yen beside a year of 762,900: "5,678,400" for its twelve months to September 2025; Sompo's) */
          var over = hv.filter(function (r) { return Math.abs(r.d[k]) > Math.abs(yd[k]); }).length >= 2 && Math.abs(sp) > 3 * Math.abs(yd[k]) && Math.abs(sp - yd[k]) > (inY.length - hv.length) * Math.max.apply(null, hv.map(function (r) { return Math.abs(r.d[k]); })); /* r35 (SU35-1): and the missing part larger than the quarters given (FM.TO's net income to common of 2024: two missing quarters of -205 together beside 108 and 99, a year of 2) */
          /* r37 (M37-1, SU36-1 of round 36): a line of one sign: the quarters given beyond the add-up test's own tolerance above the year (10% of
             the larger, and the line's slack of revenue) cannot all be that year's: the missing quarter would have to be below zero. 1.5x let 1.1x to
             1.5x be summed: Liberty Media's revenue at the SEC for 2024, 587, 3,166 (its second quarter as first filed, with SiriusXM) and 1,167
             million dollars beside a year of 3,653: "10,478" for its twelve months to June 2024; Sika's dividends paid of 2023, 762.1 for the twelve
             months to June 2023 (its one payment of the year, 492.3, in its second quarter); PPC's cost of revenue, Regions' and Hartford's capital
             spending. The other record's year of that day clears them only when it holds them by the same measure (as the function's addsUp) */
          var one1 = one && !hv.some(function (r) { return hq && hq[r.end]; }); /* (a half or a row out of scale among them: halfQ's, as before) */
          var past = function (x) { return one1 ? Math.abs(sp) - Math.abs(x) > 0.1 * Math.abs(sp) && !(k !== "dps" && yd.rev > 0 && Math.abs(sp) - Math.abs(x) <= slackOf(k) * yd.rev) : Math.abs(sp) > 1.5 * Math.abs(x) + (k !== "dps" && yd.rev > 0 ? slackOf(k) * yd.rev : 0); };
          if (sg && hv.length >= 2 && (one || grows || over) && hv.every(function (r) { return r.d[k] * sg > 0; }) && past(yd[k]) && !(fin(ov) && (one1 ? !past(ov) : 1.5 * Math.abs(ov) >= Math.abs(sp)))) hv.forEach(function (r) { bad[k + "|" + r.end] = 1; });
          return; }
        var sm = inY.reduce(function (a, r) { return a + r.d[k]; }, 0), gap = Math.abs(sm - yd[k]);
        /* r23 (M23-5): and the dividend per share (four quarters of a year add up to its figure): where the function's check (secDpsCheck R11) had
           no payments or shares to say which is right (KKR's fourth quarters of 2024 and 2025, 0.70 and 0.74 beside 0.165 to 0.185 in the others and
           0.69 and 0.73 for the years; Howmet's 2024, 0.05, 0.05, 0.16 and 0.08 for 0.26), no twelve months summed from them (KKR's 1.215 and 1.285),
           the year's own figure for the twelve months that end with it */
        var near = function (a, b) { return Math.abs(a - b) <= 0.1 * Math.max(Math.abs(a), Math.abs(b)); }; /* r33 (SU33-1): the quarters right, the year's line another one */
        if (gap > 0.1 * Math.max(Math.abs(yd[k]), Math.abs(sm)) && !(k !== "dps" && yd.rev > 0 && gap <= slackOf(k) * yd.rev) && !(fin(ov) && near(ov, sm) && !near(ov, yd[k]))) { var td = k !== "dps" ? ytdOf(inY, k, yd[k]) : null; /* r36 (M36-7) */
          if (td) { td.forEach(function (r) { bad[k + "|" + r.end] = 1; }); inY.forEach(function (r) { sure[k + "|" + r.end] = 1; }); return; }
          inY.forEach(function (r) { bad[k + "|" + r.end] = 1; });
          /* r35 (M35-4): the year known right (the function's yearSure): the other record's year of that day near it, or a quarter that is the year's own figure */
          if ((fin(ov) && near(ov, yd[k])) || inY.some(function (r) { return Math.abs(r.d[k] - yd[k]) <= 0.01 * Math.abs(yd[k]); })) inY.forEach(function (r) { sure[k + "|" + r.end] = 1; }); } }); });
    /* r34 (M34-1, M33-1 of round 33): and against the year of the other record that the Years page shows (a 20-F or 40-F filer's SEC years beside
       EODHD's quarters), which quarters the check above passed or could not check: IHG's 2023 quarters at EODHD add up to a revenue of 5,725 million
       dollars and an operating income of 1,335 where its 20-F gives 4,624 and 1,066 ("TTM Dec 23" beside "FY2023"); Baidu's 2025 quarters to an
       operating income of 10,367 million yuan where its 20-F gives a loss of 5,823 (the third quarter's impairment left out); Welltower's capital
       spending of 2025, 33.8 million dollars beside its 10-K's 1,050. Which of the two records is right for that line cannot be told (the SEC's line
       can be the partial one: Thomson Reuters' depreciation alone, 113 of 822), so the line is "—" in every twelve months those quarters make, at
       the year's end too (xbad); the function's summary the same (finSummary: addsUp, yearOk) */
    var xbad = {}; othY.forEach(function (y) { var ye = Date.parse(y.end);
      var inY = q.filter(function (r) { var e = Date.parse(r.end); return e > ye - 355 * 864e5 && e <= ye + 10 * 864e5; }); if (!consec(inY)) return;
      Object.keys(y.d || {}).forEach(function (k) { if (((KIND[k] || "f") !== "f" && k !== "dps") || !fin(y.d[k]) || !inY.every(function (r) { return fin(r.d[k]) && !bad[k + "|" + r.end]; })) return;
        var sm = inY.reduce(function (a, r) { return a + r.d[k]; }, 0), gap = Math.abs(sm - y.d[k]);
        if (gap > 0.1 * Math.max(Math.abs(y.d[k]), Math.abs(sm)) && !(k !== "dps" && y.d.rev > 0 && gap <= slackOf(k) * y.d.rev)) inY.forEach(function (r) { xbad[k + "|" + r.end] = 1; }); }); });
    for (var i = 3; i < q.length; i++) {
      var four = q.slice(i - 3, i + 1); var ok = four.every(function (r, j) { var dd = j ? (Date.parse(r.end) - Date.parse(four[j - 1].end)) / 864e5 : 0; return j === 0 || (dd >= 60 && dd < 125); }); if (!ok) continue; /* r25 (SU25-2): and a quarter apart */
      var d = {}, der = []; var keys = {}; four.forEach(function (r) { Object.keys(r.d).forEach(function (k) { keys[k] = 1; }); });
      var yr = A && A.cur === set.cur ? (A.rows || []).filter(function (a) { return Math.abs(Date.parse(a.end) - Date.parse(q[i].end)) <= 5 * 864e5; })[0] : null;
      if (yr) Object.keys(yr.d || {}).forEach(function (k) { if (KIND[k] === "f" || KIND[k] === "e") keys[k] = 1; }); /* r4: a line the quarters lack altogether (COST's pre-tax income) */
      Object.keys(keys).forEach(function (k) { var kind = KIND[k] || "f";
        if (kind === "b" || kind === "n") { d[k] = q[i].d[k]; return; }
        if (kind === "s") { var s = four.map(function (r) { return r.d[k]; }); if (s.every(fin)) d[k] = s.reduce(function (a, x) { return a + x; }, 0) / 4; return; }
        /* r29 (M29-2): twelve months that end with a year that gives its EPS are that year: its EPS (the profit over the year's average count), not the
           four quarters' added up (Chevron's 2025: 6.63, not 6.66); the function's twelve-month EPS and its growth take the same */
        if ((k === "eps" || k === "epsd") && yr && fin(yr.d[k])) { d[k] = yr.d[k]; return; }
        var v = four.map(function (r) { return hq && hq[r.end] && (kind === "f" || kind === "e") ? null : r.d[k]; }); if ((kind === "f" || k === "dps") && four.some(function (r) { return xbad[k + "|" + r.end]; })) return; /* r34 (M34-1): neither summed nor the year's */
        if (v.every(fin) && !((kind === "f" || k === "dps") && four.some(function (r) { return bad[k + "|" + r.end]; }))) d[k] = v.reduce(function (a, x) { return a + x; }, 0);
        /* a line over four quarters that end with the year: the year's own figure when one quarter's is not known on its own, or the quarters do not add up to it (r4: flows too, the function's rule) */
        /* r35 (M35-4): not an SEC year whose four quarters do not add up to it, unless it is known right (the function's yearOk, r137d: the year and its
           quarters are two lines of the filings, either the one the company means: CACI's depreciation of 77.6 million dollars for its year to June 2026
           beside quarters of 54.3 to 78.8, "EBITDA 997.5" where the overview shows "—") */
        else if ((kind === "e" || kind === "f") && yr && fin(yr.d[k]) && !(kind === "f" && set.src === "sec" && v.every(fin) && four.some(function (r) { return bad[k + "|" + r.end]; }) && !four.every(function (r) { return sure[k + "|" + r.end]; }))) d[k] = yr.d[k]; });
      out.push({ end: q[i].end, start: four[0].start || startOf(four[0], "q"), fyl: q[i].fyl, fq: q[i].fq, cur: q[i].cur, d: d, ttm: true, intF: (four.every(function (r) { return fin(r.d.intexp) && !(hq && hq[r.end]); }) ? four : yr ? [yr] : []).some(function (r) { return r.intF; }) ? 1 : undefined, intE: (four.every(function (r) { return fin(r.d.intexp) && !(hq && hq[r.end]); }) ? set.src === "eodhd" : !!(yr && fin(yr.d.intexp) && (yr.src || A.src) === "eodhd")) ? 1 : undefined }); /* r21 (SU21-1): or the year's own figure where a quarter lacks it, when that year is EODHD's (POSCO's twelve months to December 2025) */ /* r19: the finance costs summed or taken from the year (intF) */
    }
    return out;
  }
  var KIND = { rev: "f", cogs: "f", gp: "f", rnd: "f", sga: "f", opex: "f", opinc: "f", intexp: "f", pretax: "f", tax: "f", ni: "f", nic: "f", eps: "e", epsd: "e", shb: "s", shd: "s", dps: "e", nii: "f", nonii: "f", prov: "f", nonie: "f", ebitda: "f", cash: "b", sti: "b", recv: "b", inv: "b", ca: "b", ppe: "b", gw: "b", intang: "b", ta: "b", ap: "b", cl: "b", debtc: "b", debtl: "b", debtt: "b", tl: "b", eq: "b", nci: "b", pref: "b", re: "b", sho: "n", cfo: "f", da: "f", sbc: "f", capex: "f", acq: "f", cfi: "f", divp: "f", buyb: "f", dissue: "f", drepay: "f", cff: "f" };
  /* lines: label, key (or a function of the period's values), kind, style; negative: shown as an outflow */
  var LINES = {
    is: [["Revenue", "rev", "f", "sum"], ["Cost of revenue", "cogs", "f", "sub"], ["Gross profit", "gp", "f", "sum"], ["Research and development", "rnd", "f", "sub"], ["Selling, general and admin", "sga", "f", "sub"], ["Operating income", "opinc", "f", "sum"], ["EBITDA", function (d) { return fin(d.opinc) && fin(d.da) ? d.opinc + d.da : (fin(d.ebitda) ? d.ebitda : null); }, "f", ""], ["Interest expense", "intexp", "f", "sub"], ["Finance costs (interest and other financial costs)", function (d, r) { return r && r.intF ? d.intexp : null; }, "f", "sub", false, "intexp"], ["Interest expense or finance costs", function (d, r, set) { return intU(r, set) ? d.intexp : null; }, "f", "sub", false, "intexp"], ["Pre-tax income", "pretax", "f", ""], ["Income tax", "tax", "f", "sub"], ["Net income", "ni", "f", "sum"], ["Net income to common", "nic", "f", "sub"], ["EPS, basic", "eps", "e", ""], ["EPS, diluted", "epsd", "e", "sum"], ["Diluted shares, millions", "shd", "s", ""], ["Dividend per share", "dps", "e", ""],
      ["hd", "Banks"], ["Net interest income", "nii", "f", ""], ["Non-interest income", "nonii", "f", ""], ["Provision for credit losses", "prov", "f", "sub"], ["Non-interest expense", "nonie", "f", "sub"]],
    bs: [["Cash and equivalents", "cash", "b", ""], ["Short-term investments", "sti", "b", "sub"], ["Receivables", "recv", "b", "sub"], ["Inventory", "inv", "b", "sub"], ["Current assets", "ca", "b", "sum"], ["Property, plant and equipment", "ppe", "b", ""], ["Goodwill", "gw", "b", "sub"], ["Other intangibles", "intang", "b", "sub"], ["Total assets", "ta", "b", "sum"], ["Payables", "ap", "b", "sub"], ["Short-term debt", "debtc", "b", "sub"], ["Current liabilities", "cl", "b", "sum"], ["Long-term debt", "debtl", "b", ""], ["Total debt", function (d, r, set, pool) { return debtInfo(r, pool || (set && set.rows)).debt; }, "b", "sum"], ["Net debt", function (d, r, set, pool) { var t = debtInfo(r, pool || (set && set.rows)).debt; return fin(t) && fin(d.cash) ? t - d.cash - (d.sti || 0) : null; }, "b", ""], ["Total liabilities", "tl", "b", "sum"], ["Minority interest", "nci", "b", "sub"], ["Shareholders' equity", "eq", "b", "sum"], ["Retained earnings", "re", "b", "sub"], ["Shares outstanding, millions", "sho", "n", ""]],
    cf: [["Operating cash flow", "cfo", "f", "sum"], ["Depreciation and amortization", "da", "f", "sub"], ["Stock-based compensation", "sbc", "f", "sub"], ["Capital expenditure", "capex", "f", "sub", true], ["Free cash flow", function (d) { return fcfOfD(d); }, "f", "sum"], ["Acquisitions", "acq", "f", "sub", true], ["Investing cash flow", "cfi", "f", "sum"], ["Dividends paid", "divp", "f", "sub", true], ["Share buybacks", "buyb", "f", "sub", true], ["Debt issued", "dissue", "f", "sub"], ["Debt repaid", "drepay", "f", "sub", true], ["Financing cash flow", "cff", "f", "sum"]],
  };
  /* r4: a balance sheet's debt as the function counts it (finSummary's debtInfo): both debt lines, or the total. A line it lacks that a balance sheet of
     the 400 days before had leaves the debt known only in part (Caterpillar's and Chevron's 10-Qs, Baxter's June 2026, Shell's, Midea's: one line alone):
     the part and the gap are kept, never the part as the debt. No debt line at all is no debt only when none of the 400 days before had one and no
     interest is paid (unk otherwise) */
  /* r6: a line missing beside the other one, as the function (r137f): looked for as far back as the statements go, not 400 days (Gazprom's long-term
     debt since June 2025, Nippon Steel's since 2019, the Korean companies' short-term debt since 2019: the line is not read, not repaid) */
  /* r8: a debt more than twice the liabilities that must hold it (the total liabilities, or the assets less the equity and the minorities, the larger) is a
     debt line on another scale, as the function reads it (finSummary's debtWild, r137h): no debt figure from it (Norilsk Nickel's long-term debt in roubles
     beside dollar balance sheets: debt / equity 111x for 2024, 233x for 2015; Bayan Resources' in rupiah, 7,584x for 2009); nor from a debt line below zero
     (the SEC's TC Energy 2021: -1.32 billion, debt / equity 0.00x; SQM 2016: -0.54x), which is no line to look back to either */
  /* r9: nor a debt above the liabilities at all, as the function (r137i): debt is part of the liabilities, so one of the two lines is wrong (EODHD's
     Mid-America Apartment at March 2026: its current liabilities as its short-term debt, debt / equity 1.20x for Yahoo's 1.02x; Ivanhoe Mines' 2022) */
  function debtWild(d) { if ([d.debtc, d.debtl, d.debtt].some(function (v) { return fin(v) && v < 0; })) return true; return debtOver(d); }
  function debtOver(d) { var p = function (v) { return fin(v) && v > 0 ? v : 0; };
    var l1 = fin(d.ta) && fin(d.eq) ? d.ta - d.eq - (d.nci || 0) : null, liab = fin(d.tl) && l1 != null ? Math.max(d.tl, l1) : fin(d.tl) ? d.tl : l1;
    var dt = Math.max(p(d.debtc) + p(d.debtl), p(d.debtt)); return liab != null && dt > 0 && dt > Math.max(liab, 0); }
  /* r9: on the Balance sheet page such a line shows "—": the one below zero, or, beside liabilities it cannot fit in, every debt line of that balance sheet
     (which of them is on another scale cannot be told: Norilsk Nickel's long-term debt of 520,500 million beside total assets of 13,370 for 2015, Novonesis's
     short-term debt of 12,710 beside liabilities of 5,494 for December 2025, Petrobras's quarters of 2022) */
  function wildLine(d, k) { return !!d && fin(d[k]) && debtWild(d) && (d[k] < 0 || ![d.debtc, d.debtl, d.debtt].some(function (v) { return fin(v) && v < 0; })); }
  /* r13: the minorities of a balance sheet as the function reads them (finSummary, r137n): its own line; without one, where a balance sheet of the 400 days
     before it (the latest such) gives minorities above 0, its own assets less liabilities less equity when they are those within a quarter (the line not
     read: EODHD's Jardine Matheson at June 2025, 25,400 million dollars beside 25,440 at December 2024, Yahoo 25,403), else unknown (gap: their last
     figure; an enterprise value needs them within 1%, as the debt). The enterprise value of such a period was made with none (Jardine's June 2025:
     26.7 billion dollars for some 52.1) */
  function nciInfo(r, pool) {
    var d = (r && r.d) || {}; if (fin(d.nci)) return { nci: d.nci, gap: null };
    var g = fin(d.ta) && fin(d.tl) && fin(d.eq) ? d.ta - d.tl - d.eq : null;
    /* r14: an SEC balance sheet whose equity the filing gives as the shareholders' own (eqT 0, the function's parser since r137o): its own gap is its
       minorities and other claims, exactly (xclInfo below; Antero Resources' June 2026: none, Yahoo 0.0, 160 at March 2026). Otherwise unknown as large as
       its own gap where that is above the last line (Liberty Media's June 2026: 22 million dollars at September 2025, its own gap 760, Yahoo 759):
       finSummary's nciB (r137o) */
    if (g != null && r.eqT === 0) return { nci: null, gap: null };
    var t = Date.parse(r.end), b = null, be = 0;
    (pool || []).forEach(function (x) { var e = Date.parse(x.end); if (e < t && e >= t - 400 * 864e5 && x.d && fin(x.d.nci) && x.d.nci >= 0 && (!b || e > be)) { b = x; be = e; } });
    if (!b || !(b.d.nci > 0)) return { nci: null, gap: null };
    return g != null && Math.abs(g - b.d.nci) <= 0.25 * b.d.nci ? { nci: g, gap: null } : { nci: null, gap: g != null && g > b.d.nci ? g : b.d.nci };
  }
  /* r14: the claims a balance sheet carries between its liabilities and its shareholders' equity beside its minorities (finSummary's xcl / xgap, r137o):
     its assets less liabilities less equity less minorities, above 0.1% of its assets; at the SEC its temporary equity (redeemable minorities, redeemable
     or convertible preferred stock) or minorities without a line, in the enterprise value (QXO's 1.96 billion dollars of convertible preferred at June
     2026, Tenet's 2.14 of redeemable minorities, Expedia's 1.26 of minorities); at EODHD unknown (its liabilities line can leave liabilities out): an
     enterprise value only where it is under 1% of it */
  function xclInfo(E, nI, secRow) {
    var d = (E && E.d) || {}; if (fin(nI.gap) || !(d.ta > 0) || !fin(d.tl) || !fin(d.eq)) return { x: null, gap: null };
    var x = d.ta - d.tl - d.eq - (fin(nI.nci) ? nI.nci : 0); if (!(x > 0.001 * d.ta)) return { x: null, gap: null };
    return secRow ? { x: x, gap: null } : { x: null, gap: x };
  }
  function debtInfo(r, pool, paid, other) {
    var d = (r && r.d) || {}; if (debtWild(d)) return { debt: null, part: 0, gap: 0, none: false, unk: true };
    if (fin(d.debtc) && fin(d.debtl)) return { debt: d.debtc + d.debtl, part: d.debtc + d.debtl, gap: 0, none: false };
    if (fin(d.debtt)) return { debt: d.debtt, part: d.debtt, gap: 0, none: false };
    var none = !fin(d.debtc) && !fin(d.debtl), part = (d.debtc || 0) + (d.debtl || 0), t = Date.parse(r.end), gap = 0;
    (none ? ["debtc", "debtl", "debtt"] : ["debtc", "debtl"]).forEach(function (k) { if (fin(d[k])) return; var b = null, be = 0;
      (pool || []).forEach(function (x) { var e = Date.parse(x.end); if (e < t && (!none || e >= t - 400 * 864e5) && x.d && fin(x.d[k]) && x.d[k] >= 0 && (!b || e > be)) { b = x; be = e; } }); if (b) gap += Math.max(0, b.d[k]); });
    if (none && gap === 0 && ((fin(d.intexp) && d.intexp !== 0) || paid || (other || []).some(function (x) { var e = Date.parse(x.end), ta = Math.abs(fin(d.ta) ? d.ta : fin(d.eq) ? d.eq : 0); return x.d && e <= t + 10 * 864e5 && e >= t - 200 * 864e5 && ((x.d.debtc || 0) + (x.d.debtl || 0) > 0.01 * ta || (x.d.debtt || 0) > 0.01 * ta); }))) return { debt: null, part: 0, gap: 0, none: false, unk: true }; /* r5: the function's test (finSummary's payInt, otherDebt): interest paid in the period (or in the balance sheet's own), or debt on the other record's balance sheet of those days */
    return gap > 0 ? { debt: null, part: part, gap: gap, none: none } : { debt: none ? null : part, part: part, gap: 0, none: none };
  }
  /* r5: the function's record for the summary (finSummary's Q, from): four quarters with a revenue or a profit, the SEC's while current and steady, else
     EODHD's; none that stop more than a month before the latest year (the summary is then the year's, on the years' balance sheets alone) */
  function fnRec(D, A) {
    var sec = D.sec, now = Date.now(), lastS = 0; ((sec && sec.annual) || []).concat((sec && sec.quarterly) || []).forEach(function (r) { lastS = Math.max(lastS, Date.parse(r.end) || 0); }); if (sec && now - lastS > 550 * 864e5) sec = null;
    /* r6: EODHD's halves (fin.halves) read back in place, as the function does before it picks its quarters: a half-year reporter's record has quarters,
       so its quarters' balance sheets count (Hermès, Safran, Aéroports de Paris: return on capital and debt / equity on the years' balance sheets alone) */
    var hE = {}; ((D.fin && D.fin.halves) || []).forEach(function (h) { if (h && h.end && h.d && (fin(h.d.rev) || fin(h.d.ni))) hE[String(h.end)] = 1; });
    var pick = function (x) { return ((x && x.quarterly) || []).filter(function (q) { return q && q.d && (fin(q.d.rev) || fin(q.d.ni) || (x === D.fin && hE[String(q.end)] === 1)); }); }, lastE = function (r) { return r.length ? r[r.length - 1].end : ""; };
    var steady = function (rows) { return rows.slice(-8).every(function (r, i, a) { return i === 0 || (Date.parse(r.end) - Date.parse(a[i - 1].end)) / 864e5 <= 125; }); };
    var Q = pick(sec), from = "sec"; if (Q.length < 4 || now - Date.parse(lastE(Q)) > 200 * 864e5 || !steady(Q)) { var q2 = pick(D.fin); if (q2.length >= 4 && (!Q.length || lastE(q2) > lastE(Q))) { Q = q2; from = "eodhd"; } }
    var ya = ((A && A.rows) || []).filter(function (r) { return r.d && (fin(r.d.rev) || fin(r.d.ni)); }).pop();
    if (Q.length && ya && Date.parse(lastE(Q)) < Date.parse(ya.end) - 30 * 864e5) Q = [];
    if (!Q.length && ya) from = ya.src === "eodhd" || A.src === "eodhd" ? "eodhd" : "sec";
    return { q: Q.length > 0, from: from };
  }
  /* r6: a capital expenditure of 0 for a whole period beside a depreciation above 0.5% of that period's revenue (any, where it has no revenue) is
     EODHD's filler for a figure it does not have, not a fact (finSummary's capexOk, r137e: ČEZ in every period since 2020, Novatek's years since 2023,
     Daifuku's year to March 2026): "—", and no free cash flow from it (the function shows none: not the whole operating cash flow as free cash flow) */
  function capexOf(d) { var c = d && d.capex; return fin(c) && !(c === 0 && fin(d.da) && d.da > 0 && !(fin(d.rev) && d.rev > 0 && d.da <= 0.005 * d.rev)) ? c : null; }
  function fcfOfD(d) { var c = capexOf(d); return d && fin(d.cfo) && fin(c) ? d.cfo - c : null; }
  /* the debt to within 1% of a base (the equity, the invested capital), 0 for a company without debt: the function's debtNear */
  function debtNear(x, base) { return !x || x.unk ? null : x.debt != null ? x.debt : x.none && x.gap === 0 ? 0 : fin(base) && base > 0 && x.gap <= 0.01 * base ? x.part : null; }
  function lineVal(line, row, set, per, pool) {
    var key = line[1], kind = line[2], raw = typeof key === "function" ? key(row.d, row, set, pool) : key === "capex" ? capexOf(row.d) : row.d[key];
    if (!fin(raw)) return null; if (line[4]) raw = raw ? -Math.abs(raw) : 0; /* r3: a zero outflow is 0.00, not -0.00 */
    return conv(raw, row, set, kind, per);
  }
  /* r36 (M36-3): the years secYearCut shows "—" on a line, named with it */
  function cutNote(rows, which, per) { if (per !== "a") return ""; var by = {}, order = [];
    (LINES[which] || []).forEach(function (l) { if (typeof l[1] !== "string") return; rows.forEach(function (r) { if (r && r.cut36 && fin(r.cut36[l[1]])) { if (!by[l[0]]) { by[l[0]] = []; order.push(l[0]); } by[l[0]].push(colLabel(r, "a")); } }); });
    var eb = which === "is" ? rows.filter(function (r) { return r && r.cut36 && fin(r.cut36.da) && r.d && fin(r.d.opinc) && !fin(r.d.ebitda); }).map(function (r) { return colLabel(r, "a"); }) : []; /* r37 (SU37-2): the EBITDA made with a D&A taken */
    var ebT = eb.length ? " EBITDA of " + eb.join(", ") + ": the operating income plus the depreciation and amortization, which the cash flow statement shows — for " + (eb.length > 1 ? "those years" : "that year") + " (its filing's year and its four quarters give two different figures), so it shows — too." : "";
    if (!order.length) return ebT; return " " + order.map(function (n) { return esc(n) + " of " + by[n].join(", "); }).join("; ") + ": the filing's year gives another figure than its four quarters together (one of the two is a part of the other's line, and the filings do not say which is the company's), so " + (order.length > 1 || by[order[0]].length > 1 ? "they show" : "it shows") + " — here." + ebT; }
  function colLabel(r, per) { var fy = r.fyl ? "FY" + String(r.fyl).slice(per === "a" ? 0 : 2) : r.end.slice(0, 4); return per === "a" ? fy : per === "t" ? "TTM" : "Q" + (r.fq || "?") + " " + fy; }
  function finTable(D, which, per, M0) {
    var st = stmts(D), set = per === "a" ? st.A : st.Q; if (!set) return '<p class="muted">' + ((per === "a" ? st.Q : st.A) ? "No " + (per === "a" ? "yearly" : "quarterly") + " figures for this company." : "No statements yet for this company.") + "</p>"; /* r39 (SU39-3) */
    var rows = periods(set, per, st.A, per === "t" ? halfQ(st, D) : null); if (per === "q") rows = twinCut(rows, which, halfQ(st, D)); /* r27 (SU27-2) */ if (!rows.length) return '<p class="muted">No ' + (per === "a" ? "yearly" : "quarterly") + " figures.</p>";
    /* no dollar rate for this currency (the rates are not in the EODHD plan): the figures in the currency of the reports, said so */
    var lastEnd = rows[rows.length - 1].end, noRate = S.cur === "usd" && set.cur && String(set.cur).toUpperCase() !== "USD" && fxRate(set.cur, null, lastEnd) == null;
    S.local = noRate; try { return finTableIn(D, which, per, st, set, rows, noRate, M0); } finally { S.local = false; }
  }
  /* r8: nor a shell's balance sheet, as the function's (finSummary's shell, r137h): cash above the total assets (TechnipFMC's 2015: returns of 19,433%), or,
     without total assets nor liabilities, an equity under a thousandth of the cash beside it (Smurfit WestRock's 2022: the shell's 107 dollars) */
  function shellBS(d) { return (fin(d.ta) && fin(d.cash) && d.cash > 1.01 * Math.abs(d.ta)) || (!fin(d.ta) && !fin(d.tl) && fin(d.eq) && fin(d.cash) && Math.abs(d.cash) > 1000 * Math.abs(d.eq)); }
  /* r8 (F7-1): a quarter out of scale with the years, as the function leaves it out (finSummary's scaleOff, r137h): total assets a quarter or less, or four
     times or more, of the year's of its day, or, without one, of the years on both sides (within 400 days, the same way), unless its equity is within those
     bounds of such a year's (EODHD's Polyus: its years in roubles under "USD", its quarters in dollars; Smurfit WestRock's 10-Qs of March and June 2024 are
     the shell's). Under the twelve months and the quarters, a year out of scale with the quarters the same way is left out too */
  function sideOf(v, w) { return v / w <= 0.25 ? -1 : v / w >= 4 ? 1 : 0; }
  function scaleOff(x, others) { var v = x && x.d && x.d.ta; if (!(v > 0) || !x.end) return false; var t = Date.parse(x.end);
    var O = (others || []).filter(function (y) { return y !== x && y && y.d && y.d.ta > 0 && y.end; }).sort(function (a, z) { return Date.parse(a.end) - Date.parse(z.end); });
    var same = O.filter(function (y) { return Math.abs(Date.parse(y.end) - t) <= 10 * 864e5; })[0];
    var pv = O.filter(function (y) { var e = Date.parse(y.end); return e < t - 10 * 864e5 && e >= t - 400 * 864e5; }).pop(), nx = O.filter(function (y) { var e = Date.parse(y.end); return e > t + 10 * 864e5 && e <= t + 400 * 864e5; })[0];
    var cmp = same ? [same] : pv && nx ? [pv, nx] : []; if (!cmp.length) return false; var s0 = sideOf(v, cmp[0].d.ta); if (!s0 || cmp.some(function (y) { return sideOf(v, y.d.ta) !== s0; })) return false;
    return !(x.d.eq > 0 && cmp.some(function (y) { return y.d.eq > 0 && !sideOf(x.d.eq, y.d.eq); })); }
  function scaleSets(st, fr, M0) { var sameCur = !!(st.Q && st.A && st.Q.cur === st.A.cur), aRows = sameCur ? st.A.rows : [], qRows = sameCur ? st.Q.rows : [];
    var qF = fr.q && st.Q && st.Q.src === fr.from ? st.Q.rows : [];
    return { qF: qF, qOk: function (x) { return qRows.indexOf(x) < 0 || !scaleOff(x, aRows); }, yOk: function (x) { return aRows.indexOf(x) < 0 || !scaleOff(x, qRows); },
      yOkF: function (x) { return !((M0 || {}).f || {}).ttm || !scaleOff(x, qF); } }; } /* yOkF: the function's own: its quarters' record, its years left out only under twelve months */
  /* r8: r7's out-of-proportion latest balance sheet (ratioRows), for the Balance sheet page too: the end of that balance sheet, or null */
  function offEndOf(D, st, fr, hasBS, sc) { var nF = function (x) { return ["eq", "ta", "cash", "debtc", "debtl", "debtt"].filter(function (k) { return fin(x.d[k]); }).length; };
      var b0 = (sc ? sc.qF.filter(sc.qOk) : fr.q && st.Q && st.Q.src === fr.from ? st.Q.rows : []).concat(st.A && (!fr.q || !st.Q || st.A.cur === st.Q.cur) ? (sc ? st.A.rows.filter(sc.yOkF) : st.A.rows) : []).filter(function (x) { return hasBS(x) && Date.parse(x.end) <= Date.now(); }).sort(function (x, y) { return String(y.end).localeCompare(String(x.end)) || nF(y) - nF(x); });
      var r0 = b0[0], t0 = r0 ? Date.parse(r0.end) : 0; return b0.length > 2 && ["ta", "eq"].every(function (k) { var v = r0.d[k]; if (!(v > 0)) return false;
        var pv = b0.filter(function (x) { var e = Date.parse(x.end); return e < t0 && e >= t0 - 400 * 864e5 && x.d[k] > 0; }).slice(0, 2).map(function (x) { return x.d[k]; });
        return pv.length === 2 && Math.max(pv[0], pv[1]) / Math.min(pv[0], pv[1]) <= 1.5 && pv.every(function (x) { return v / x >= 4 || v / x <= 0.25; }); }) ? r0.end : null; }
  function finTableIn(D, which, per, st, set, rows, noRate, M0) {
    var shown = per === "a" ? rows.slice(-17) : S.all ? rows : rows.slice(-12);
    var hq = per === "q" ? halfQ(st, D) : {}, hqE = [], hqE2 = [], hqE3 = [], tw = rows.twin || {}; /* r27 (SU27-1, SU27-2) */
    var rm = set.src === "sec" ? restMap(D) : {}, lines = LINES[which];
    /* r9: a debt line a balance sheet lacks is looked for in the years' and the quarters' balance sheets both (one currency), as the function and the ratio
       pages look for it (finSummary's gapRows, r137f): on the quarters alone, a line the quarters never gave and the years did (Hyundai Motor's and SK Hynix's
       short-term debt, last given for 2019, as every Korean company's) was no line at all, and the long-term debt alone showed as the total debt, with a net
       debt from it, under Quarters, beside "—" for the same balance sheet under Years and on the overview */
    var frD = which === "bs" ? fnRec(D, st.A) : null, dPool = which === "bs" ? (st.Q && st.A && st.Q.cur === st.A.cur ? (per === "a" && !frD.q ? st.A.rows.concat(st.Q.src === frD.from ? st.Q.rows : []) : st.Q.rows.concat(st.A.rows)) : set.rows).filter(function (x) { return x && x.d && !shellBS(x.d); }) : null; /* r10: under Years, the ratio pages' pool for those years (ratioRows: the quarters only where they are the summary's record when it is the years'), so a balance sheet's total debt is known or "—" on both (AutoZone's FY2024 and FY2025: 9,024 and 8,800 million, all of it long-term, "—" here beside a net debt / EBITDA of 2.01x and 2.02x on the Solvency page) */
    /* r8: the balance sheet the function and the ratio pages leave out as out of all proportion to the two before it (Brookfield Asset Management's June 2026,
       Brookfield Corporation's 525.5 billion dollars of assets) is "—" here too, said so */
    var offE = which === "bs" ? (function (fr0) { return offEndOf(D, st, fr0, function (x) { return x && x.d && (fin(x.d.ta) || (fin(x.d.eq) && (fin(x.d.cash) || fin(x.d.tl)))) && !shellBS(x.d); }, scaleSets(st, fr0, M0 || null)); })(fnRec(D, st.A)) : null; /* r9: with the company's summary (M0), as the ratio pages: under its twelve months, a year out of scale with the quarters is left out (the function's yOk), so the same balance sheet is the out-of-proportion one here and there */ if (offE && !shown.some(function (r) { return r.end === offE; })) offE = null;
    /* r9: nor a shell's balance sheet (shellBS, finSummary's shell: TechnipFMC's 2015 at the SEC, total assets of 74,100 dollars beside cash of 3.18 billion and
       liabilities of -4,956 million; Smurfit WestRock's 2022, an equity of 107 dollars beside cash of 841 million): the function and the ratio pages read none
       of it, so its figures show "—" here too, said so */
    var shellE = which === "bs" ? shown.filter(function (r) { return r.d && shellBS(r.d); }).map(function (r) { return r.end; }) : [];
    /* r10: nor, under Quarters and Last 12 months, a quarter's balance sheet on another scale than the years beside it (scaleSets' qOk, the function's
       scaleOff, r137h): the function and the ratio pages read none of it (Banco Santander Brasil's September 2025, total assets of 6,740,000 million
       beside 1,239,000 and 1,270,000; Smurfit WestRock's shell 10-Qs of 2024), so its figures show "—" here too, said so, and set no unit */
    var scE = which === "bs" && per !== "a" && st.Q ? (function () { var sc = scaleSets(st, fnRec(D, st.A), M0 || null), bad = st.Q.rows.filter(function (x) { return x && x.d && !sc.qOk(x); }).map(function (x) { return x.end; });
      return shown.filter(function (r) { return bad.indexOf(r.end) >= 0 && shellE.indexOf(r.end) < 0 && r.end !== offE; }).map(function (r) { return r.end; }); })() : [];
    var maxAbs = 0; shown.forEach(function (r) { ["rev", "ta", "cfo"].forEach(function (k) { if ((k === "ta" && offE && r.end === offE) || scE.indexOf(r.end) >= 0 || (k !== "ta" && hq[r.end])) return; /* r8: nor its unit (r10: nor a quarter's on another scale) */ var v = conv(r.d[k], r, set, "f", per); if (fin(v)) maxAbs = Math.max(maxAbs, Math.abs(v)); }); });
    var unit = maxAbs >= 5e10 ? 1e9 : 1e6, unitName = unit === 1e9 ? "billions" : "millions";
    var ccyName = S.cur === "usd" && !noRate ? "US dollars" : (set.cur || "reported currency");
    var body = "", any = false, hdr = "", bankNet = set.src === "eodhd" && D.fin && D.fin.bankNet, casDiv = set.src === "eodhd" && /^(SHG|SHE)$/i.test(String((D.profile || {}).exchange || "")) /* r39: a Shanghai or Shenzhen listing's cash flow statement (Chinese standards) gives one line for the cash paid for dividends, profits or interest (分配股利、利润或偿付利息支付的现金), EODHD's "dividends paid": Air China's 6,562 million yuan for 2024, a year without a dividend, is its interest (the function gives no payout ratio from it) */, revShown = false, marks = false, wildM = false, uShown = false;
    lines.forEach(function (ln) {
      if (ln[0] === "hd") { hdr = '<tr class="hd"><td>' + esc(ln[1] === "Banks" && !bankCo(D, M0) ? "Interest and credit losses" : ln[1]) /* r22 (SU22-1): "Banks" only over a bank's lines, by its industry: not Visa's, S&P Global's, an exchange's, a broker's or an insurer's (metrics.p.fin, p.bank and f.fin hold those too) */ + '</td><td colspan="' + shown.length + '"></td></tr>'; return; } /* r21 (SU21-2): "Banks" only over a bank's or a financial company's lines (Samsung's net interest income is not a bank's) */ /* a heading only above lines that have figures */
      var vals = shown.map(function (r) { if (hq[r.end] && (ln[2] === "f" || ln[2] === "e")) { var hL = hq[r.end] === 3 ? hqE3 : hq[r.end] === 2 ? hqE2 : hqE; if (fin(lineVal(ln, r, set, per, dPool)) && hL.indexOf(r.end) < 0) hL.push(r.end); return null; } /* r28 (SU28-1): hqE2, not the quarter's own */ /* r27 (SU27-1): six months or more, not a quarter */ if (((offE && r.end === offE) || shellE.indexOf(r.end) >= 0 || scE.indexOf(r.end) >= 0) && (ln[2] === "b" || ln[2] === "n")) return null; if (which === "bs" && /^debt[clt]$/.test(ln[1]) && wildLine(r.d, ln[1])) { wildM = true; return null; } /* r9 */ if (ln[1] === "intexp" && (r.intF || intU(r, set))) return null; /* r19: an IFRS filer's finance costs (the function's intF) are on their own line (r20: and EODHD's figure for such a company, SU20-2) */ return lineVal(ln, r, set, per, dPool); }); if (!vals.some(fin) && !(ln[1] === "eq" && which === "bs" && set.src === "sec" && D.sec && (D.sec.eqNci > 0 || D.sec.eqOwn > 0) && shown.some(function (r) { return r.d && fin(r.d.ta); }))) return; any = true; /* r12: the note says it shows "—" (sec.eqNci) */ body += hdr; hdr = ""; if (ln[1] === "rev") revShown = true; if (ln[0] === "Interest expense or finance costs") uShown = true;
      if (bankNet && ln[1] === "rev") ln = ["Net revenue (after interest paid)"].concat(ln.slice(1));
      if (casDiv && ln[1] === "divp") ln = ["Dividends and interest paid"].concat(ln.slice(1)); /* r39 */
      var key = typeof ln[1] === "string" ? ln[1] : ln[5] || null, kind = ln[2]; /* r20 (SU20-1): the finance costs lines' marks are the interest figure's */
      body += '<tr class="' + (ln[3] || "") + '"><th scope="row">' + esc(ln[0]) + "</th>" + vals.map(function (v, i) { /* r39 (SU39-5): the line as the row's header */
        var r = shown[i], t = !fin(v) ? DASH : kind === "e" ? neg(psNum(v), v) /* r24 (SU24-3) */ : kind === "s" || kind === "n" ? fmtNum(v / 1e6, 1) : fmtMoney(v, unit);
        var mk = key && fin(v); /* r21 (SU21-5): every line's marks beside its figure, not on a "—" (a DPS taken away by secDpsCheck, M20-1) */ /* r20 (SU20-1): an interest figure's marks beside it, not on another line's "—" */ var mark = ""; if (mk && r.der && r.der.indexOf(key) >= 0) mark = '<button type="button" class="d" title="' + (key === "eps" || key === "epsd" ? "Not reported for this quarter on its own: its net income to common shareholders over its weighted average " + (key === "eps" ? "basic" : "diluted") + " shares (quarters' EPS need not add up to the year's when the share count moves)" : key === "shd" && fin(r.d.shb) && r.d.shd === r.d.shb && ((fin(r.d.nic) ? r.d.nic : r.d.ni) < 0) ? "Not reported for this quarter on its own: its basic count (a quarter with a loss counts no potential shares)" : key === "gp" && fin(r.d.rev) && fin(r.d.cogs) && Math.abs(r.d.gp - (r.d.rev - r.d.cogs)) <= 1e-6 * Math.max(1, Math.abs(r.d.rev)) ? "Not reported for this quarter on its own: its revenue less its cost of revenue" : key === "rev" && fin(r.d.nii) && fin(r.d.nonii) && Math.abs(r.d.rev - (r.d.nii + r.d.nonii)) <= 1e-6 * Math.max(1, Math.abs(r.d.rev)) ? "Not reported as one figure: its net interest income plus its non-interest income" : key === "rev" && r.leaseRev ? "Not reported as one figure: its lease income" : key === "rev" && r.leaseAdd && fin(r.d.lease) && r.d.rev > r.d.lease ? "Not reported as one figure: its revenue line plus its lease income (the rents that line leaves out)" /* r32 (R32-2): the function's leaseAdd */ : "Not reported for this quarter on its own: the year (or year to date) less the quarters before") /* r29 (SU29-5): a fourth quarter's gross profit worked out as the year less the nine months (GrossProfit filed, no cost of revenue) is not revenue less cost; a revenue the parser made of a bank's or a landlord's lines (fixRevenue) */ + '">◦</button>'; /* r28 (SU28-4): each derived figure's own way */
        var rs = mk && !r.ttm ? rm[(per === "a" ? "a" : "q") + "|" + key + "|" + r.end] : null, rq = rs ? restOn(rs, r, key) : 1; if (rq == null) rs = null; /* r23 (SU23-2): on the row's basis after a split, or none */ if (mark || rs) marks = true;
        if (rs) { var pd = kind === "e" ? psDec(rs.was * rq, rs.now * rq) : 2, rf = function (x) { x = x * rq; return fmtNum(x, kind === "e" ? pd /* r24 (SU24-3, SU24-5) */ : kind === "s" || kind === "n" ? 0 : Math.abs(x) < 100 ? 2 : 0); }; mark += '<button type="button" class="r" title="Restated. First filed ' + esc(rs.filed0 || "") + ": " + esc(rf(rs.was)) + "; latest " + esc(rs.filed || "") + ": " + esc(rf(rs.now)) + (kind === "s" || kind === "n" ? " (shares" : " (reported currency") + (rq !== 1 ? ", on today's basis after a stock split)" : ")") + '">r</button>'; }
        return '<td class="num">' + t + mark + "</td>"; }).join("") + "</tr>";
    });
    if (!any) return '<p class="muted">No figures on these lines.</p>';
    var head = "<tr><th>" + esc(ccyName + ", " + unitName) + "</th>" + shown.map(function (r) { return '<th class="num">' + esc(colLabel(r, per)) + '<br><small class="muted">' + esc(tw[r.end] ? Number(String(r.end).slice(8, 10)) + " " + mLong(r.end) : mShort(r.end)) /* r27 (SU27-2): twin dates by their day */ + "</small></th>"; }).join("") + "</tr>";
    var lastForm = (function () { var a = (D.sec && D.sec.annual) || []; for (var i = a.length - 1; i >= 0; i--) if (a[i].form) return String(a[i].form); return ""; })();
    var forms = (/^20-F/.test(lastForm) ? "20-F" : /^40-F/.test(lastForm) ? "40-F" : "10-K and 10-Q") + (D.sec && Array.isArray(D.sec.taxes) && D.sec.taxes.indexOf("us-gaap") >= 0 && D.sec.taxes.indexOf("ifrs-full") >= 0 ? (D.sec.tax === "ifrs-full" ? ", IFRS; US GAAP before the company changed to IFRS" : ", US GAAP; IFRS before the company changed to US GAAP") : D.sec && D.sec.tax === "ifrs-full" ? ", IFRS" : ""); /* a foreign filer's 20-F or 40-F, in US GAAP or IFRS */ /* r22 (SU22-2): xbAll's merged record (sec.taxes, both: Toyota, Sony, Honda) holds the older accounts' years too */
    var src = set.src === "sec" ? "From the company's own filings at the SEC (" + forms + "): the latest figure filed for each period." + (set.added ? " The last " + (set.added > 1 ? set.added + " years are" : "year is") + " from EODHD: the SEC's data does not have " + (set.added > 1 ? "them" : "it") + " yet." : "") : "From EODHD's records of the company's reports." + (bankNet && revShown ? " A bank's revenue here is net: the interest and fees it received less the interest it paid (shown as interest expense), as the bank and Koyfin count it." : "");
    var more = per !== "a" && rows.length > 12 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the last 12 only" : "Show all " + rows.length + " periods") + "</button></div>" : "";
    return '<div class="sa-wrap"><table class="pt sa-tbl sa-fin"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>" + more +
      '<p class="sa-note">' + esc(src) + (hqE.length ? " The figures EODHD gives under " + hqE.slice().sort().map(function (e) { return esc(date(e)); }).join(", ") + " cover six months or more (a half year), not a quarter: their income statement and cash flows show — here." : "") /* r27 (SU27-1) */ + (hqE2.length ? " The figures EODHD gives under " + hqE2.slice().sort().map(function (e) { return esc(date(e)); }).join(", ") + " are not each quarter's own (two quarters with the same figures, or one quarter's half the next one's: a half year split up), so their income statement and cash flows show — here." : "") /* r28 (SU28-1) */ + (hqE3.length ? " The figures EODHD gives under " + hqE3.slice().sort().map(function (e) { return esc(date(e)); }).join(", ") + " are on another scale than the years beside them (a figure more than four times their revenue or total assets: another currency's or another unit's), so their income statement and cash flows show — here." : "") /* r28 (SU28-5) */ + cutNote(shown, which, per) /* r36 (M36-3) */ + (noRate ? " In " + esc(set.cur) + ", the currency of the reports: there is no dollar rate for " + esc(set.cur) + " yet." : "") + (S.cur === "usd" && !noRate && set.cur && set.cur !== "USD" ? " Reported in " + esc(set.cur) + "; shown in US dollars at each period's average rate (balance sheet: the rate at its end). A period without a rate shows —." : "") + (offE ? " The balance sheet of " + esc(date(offE)) + " is out of all proportion to the two before it (its assets and equity four times theirs or more, or a quarter or less): another company's, another unit's or another currency's figures, and which ones are right cannot be told, so its figures show —, as in the ratios." : "") + (shellE.length ? " The balance sheet" + (shellE.length > 1 ? "s" : "") + " of " + shellE.map(function (e) { return esc(date(e)); }).join(", ") + " do" + (shellE.length > 1 ? "" : "es") + " not hold together (cash above the total assets, or an equity under a thousandth of the cash: a shell company's figures beside the business's), so " + (shellE.length > 1 ? "their" : "its") + " figures show —, as in the ratios." : "") + (scE.length ? " The balance sheet" + (scE.length > 1 ? "s" : "") + " of " + scE.map(function (e) { return esc(date(e)); }).join(", ") + (scE.length > 1 ? " are" : " is") + " on another scale than the years beside " + (scE.length > 1 ? "them" : "it") + " (total assets a quarter or less, or four times or more, of theirs): another unit's, another currency's or another company's figures, so " + (scE.length > 1 ? "their" : "its") + " figures show —, as in the ratios." : "") + (wildM ? " Where a balance sheet's debt is more than the liabilities that must hold it (a debt line counted twice or holding another line's figure, or one on another scale or in another currency: which line is wrong cannot be told), every debt line of that balance sheet shows —, as does a debt line below zero: the total debt and the ratios leave them out too." : "") + (uShown ? " The company's own filings give its finance costs (IFRS: its interest with its other financial costs, such as exchange and fair-value losses); EODHD's figure for its interest may be those too, so it shows as \"Interest expense or finance costs\", with no interest cover worked out from it." : "") + (shown.some(function (r) { return r.split; }) ? " Per-share figures and share counts before a stock split are on today's basis." : "") + (marks ? ' <b>◦</b> worked out, not reported as such: most from the year or year-to-date figure (EPS: the profit of the quarter over its shares; hover over or tap each). <b>r</b> restated: the company changed the figure in a later filing (hover over or tap it for both).' : "") + "</p>";
  }

  /* ---------- ratios, period by period ---------- */
  function usdOf(v, row, set, kind, per) { if (!fin(v)) return null; if (kind === "s" || kind === "n") return v; var r = fxRate(row.cur || set.cur || "USD", kind === "b" ? null : startOf(row, per), row.end); return r == null ? null : v * r; }
  /* stock splits, from EODHD's own month-end closes: the close as traded over the adjusted close steps by the split's ratio in the month of a split
     (dividends move it a little each month). [first month on the new basis, factor] */
  var SPLIT_STD = [1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 100];
  function splitSteps(D) {
    var m = (D.prices && D.prices.m) || [], out = [];
    for (var i = 1; i < m.length; i++) { var a = m[i - 1], b = m[i]; if (!(a[1] > 0 && a[2] > 0 && b[1] > 0 && b[2] > 0)) continue; var j = (a[1] / a[2]) / (b[1] / b[2]);
      for (var k = 0; k < SPLIT_STD.length; k++) { var f = SPLIT_STD[k]; if (Math.abs(j / f - 1) < 0.03) { out.push([String(b[0]).slice(0, 7), f]); break; } if (Math.abs(j * f - 1) < 0.03) { out.push([String(b[0]).slice(0, 7), 1 / f]); break; } } }
    return out;
  }
  /* a month-end close put on today's share basis (the SEC's statements count their shares and per-share figures on it) */
  function onTodayBasis(px, date, steps) { var ym = String(date).slice(0, 7); steps.forEach(function (s) { if (s[0] > ym) px = px / s[1]; }); return px; }
  function priceAt(D, end) { var m = (D.prices && D.prices.m) || []; var ym = String(end).slice(0, 7), dd = Number(String(end).slice(8, 10)); if (dd <= 7) ym = prevMonth(ym, 1); for (var i = m.length - 1; i >= 0; i--) { if (String(m[i][0]).slice(0, 7) === ym) return { px: m[i][1], date: m[i][0] }; if (String(m[i][0]).slice(0, 7) < ym) break; } return null; }
  function ratioRows(co, per) {
    var D = co.d, st = stmts(D), set = per === "a" ? st.A : st.Q; if (!set) return null;
    var rows = periods(set, per === "a" ? "a" : "t", st.A, per === "a" ? null : halfQ(st, D)); if (!rows.length) return null; /* r28 (SU28-2) */
    var M0 = co.u.metrics || {}, finFlag = evOff(co), wh = !!(M0.f || {}).withheld, partic = particOf(M0); /* r21 (SU21-3) */
    var lc = D.profile && D.profile.ccy, adrMix = co.u.kind === "adr" && /\.US$/.test(co.u.eodhd || ""), steps = splitSteps(D);
    var yearBefore = function (i) { var t = Date.parse(rows[i].end); for (var j = i - 1; j >= 0; j--) { var dd = (t - Date.parse(rows[j].end)) / 864e5; if (dd >= 345 && dd <= 385) return rows[j]; if (dd > 385) break; } return null; };
    /* r4: the balance sheets as the function reads them (finSummary's bsRows, bsAt): the quarters' and the years' of the record (one currency); at a date, the
       one with the equity, then the fuller. A period's own unless another of that day is fuller (a quarter without its balance sheet: the year's of that day),
       and a year before, the balance sheet of that day whatever the periods around it (CMOC: no twelve months to June 2025, its June 2025 balance sheet) */
    /* r5: as the function's bsRows: an equity alone is not a balance sheet (finSummary's hasBS, r137d: Anheuser-Busch InBev's and Mahindra's quarters hold the
       equity with the minorities in it), and a summary of the years alone (no quarters it reads: Fujikura, Novatek, Sasol, Rio Tinto) reads the years' balance sheets */
    /* r6: and the quarters' of the record of the years too, after the years (a year's own balance sheet first where both are as full), as the function now
       does for the debt gap and the year-before balance sheet (r137f FN3: Sasol's June 2025 year without its long-term debt beside EODHD's quarter of that
       day with it) */
    var fr = fnRec(D, st.A), hasBS = function (x) { return x && x.d && (fin(x.d.ta) || (fin(x.d.eq) && (fin(x.d.cash) || fin(x.d.tl)))) && !shellBS(x.d); }; /* r8: nor a shell's */
    var sc = scaleSets(st, fr, M0), qOk = sc.qOk, yOk = sc.yOk; /* r8 (F7-1): quarters out of scale with the years (above) */
    /* r7: a latest balance sheet out of all proportion to the two before it (within 400 days): its total assets and its equity both four times or more, or a
       quarter or less, of theirs (which agree within half) is another company's or another unit's: the function shows none (finSummary's offLine, r137f:
       Brookfield Asset Management's June 2026 is Brookfield Corporation's, 525.5 billion dollars of assets beside 17.9 and 16.5) and leaves it out of the
       other figures; so do the ratios here */
    var offEnd = offEndOf(D, st, fr, hasBS, sc), notOff = function (x) { return x.end !== offEnd; };
    var pool = (st.Q && st.A && st.Q.cur === st.A.cur ? (per === "a" && !fr.q ? st.A.rows.concat(st.Q.src === fr.from ? st.Q.rows : []) : st.Q.rows.concat(st.A.rows)) : set.rows).filter(hasBS).filter(notOff).filter(qOk).filter(function (x) { return per === "a" || yOk(x); }); /* r8: scale */
    var other = (function () { var o = fr.from === "eodhd" ? D.sec : D.fin; return o && o.currency === set.cur ? (o.quarterly || []).concat(o.annual || []) : []; })();
    var yBefore = function (r) { return (st.A && st.A.cur === set.cur ? st.A.rows : []).filter(function (a) { var dd = (Date.parse(r.end) - Date.parse(a.end)) / 864e5; return dd >= -5 && dd <= 400 && a.d && (fin(a.d.rev) || fin(a.d.ni)); }).pop(); };
    var paidOf = function (r) { var x = r.d.intexp; if (fin(x)) return x !== 0; var y = r.ttm ? yBefore(r) : null; return !!(y && fin(y.d.intexp) && y.d.intexp !== 0); }; /* the period's interest, or the latest year's (finSummary's payInt) */
    var filled = function (x) { return ["eq", "ta", "cash", "debtc", "debtl", "debtt"].filter(function (k) { return fin(x.d[k]); }).length; };
    /* r6: the function reads no quarter of a record whose summary is the year's (fnRec: q false): its figures for that year come from the years' balance
       sheets alone. A twelve-month column that ends on a year's day (the "Last 12 months" chip) reads them too, so the year's figure is the same under
       both chips (ASE's debt / equity at December 2025: 0.78x on EODHD's quarter, 0.69x on the year's, the overview's; FRHC, Kaspi, Pinnacle: a figure
       the function leaves out) */
    /* r7: the years' balance sheets first, then the quarters' of the record of the years, as the Years column reads them (r6's pool; r137f FN3: the function
       reads those quarters for the year-before balance sheet and the debt gap): Sasol's return on capital at June 2026, 15.9% on the overview and under
       Years, was 16.0% under "Last 12 months" (its June 2025 year without the long-term debt line, EODHD's quarter of that day with it) */
    var yPool = per !== "a" && !fr.q && st.A && st.Q && st.Q.cur === st.A.cur ? st.A.rows.concat(st.Q.src === fr.from ? st.Q.rows : []).filter(hasBS).filter(notOff).filter(qOk) : null;
    var bsAt = function (t, P) { var best = null; (P || pool).forEach(function (x) { if (Math.abs(Date.parse(x.end) - t) > 10 * 864e5) return; var a = fin(x.d.eq) ? 1 : 0, b = best ? (fin(best.d.eq) ? 1 : 0) : -1; if (a !== b ? a > b : x.end !== best.end ? x.end > best.end : filled(x) > filled(best)) best = x; }); return best; };
    /* r26 (M26-4): a split the month-end closes show (splitSteps) puts the price of an SEC period before it on today's basis only where that period's
       shares are on it: a company that never restated its earlier reports (U-Haul's November 2022 distribution of nine non-voting shares for each share,
       a 10-for-1 in EODHD's adjusted closes: its years to March 2019-2022 keep 19.6 million shares and their EPS and dividends of before) was valued at a
       tenth of its price on those old counts: market values and P/E a tenth, dividend yields ten times theirs. A period whose count times the split's
       factor is the first count after it (within 15%), nearer than its count as it stands, is on the old basis: its price as traded */
    var shOfR = function (x) { var dd = (x && x.d) || {}; return fin(dd.sho) && dd.sho > 0 ? dd.sho : fin(dd.shb) && dd.shb > 0 ? dd.shb : fin(dd.shd) && dd.shd > 0 ? dd.shd : null; };
    /* r28 (M28-5): the splits a count missed are the last ones after its period (a report restated for a split holds every split before it): a period
       never restated for two later splits (100 million shares beside 600 today after a 2-for-1 and a 3-for-1) was judged split by split, its count
       times each factor alone (200, 300) near no count after it, and its price was put on today's basis by both: a market value and P/E of a sixth,
       a dividend yield six times. The run of the last splits whose factors together bring its count to the first count after the last of them
       (within 15%, nearer than its count as it stands; the nearest such run) is left out */
    var stepsOf = function (r) { var s0 = shOfR(r); if (!fin(s0)) return steps; var ym = String(r.end).slice(0, 7), later = steps.filter(function (st) { return st[0] > ym; }); if (!later.length) return steps;
      var n = null, last = later[later.length - 1][0]; for (var j = 0; j < rows.length; j++) if (String(rows[j].end).slice(0, 7) >= last && fin(shOfR(rows[j]))) { n = shOfR(rows[j]); break; }
      if (!fin(n) || !(n > 0)) return steps; var best = -1, bestE = Math.abs(Math.log(s0 / n));
      for (var i = 0; i < later.length; i++) { var F = later.slice(i).reduce(function (t, st) { return t * st[1]; }, 1), e = Math.abs(Math.log(s0 * F / n)); if (Math.abs(s0 * F / n - 1) <= 0.15 && e < bestE) { best = i; bestE = e; } }
      if (best < 0) return steps; var miss = later.slice(best); return steps.filter(function (st) { return miss.indexOf(st) < 0; }); };
    var out = rows.map(function (r, i) {
      var p = yearBefore(i); var d = r.d, q = p ? p.d : {};
      var tE = Date.parse(r.end), P0 = yPool && yPool.some(function (a) { return Math.abs(Date.parse(a.end) - tE) <= 10 * 864e5; }) ? yPool : pool, E = bsAt(tE, P0), e = E ? E.d : {}, B0 = bsAt(tE - 365 * 864e5, P0), e0 = B0 ? B0.d : {}, paid = paidOf(r);
      var avg = function (k) { return fin(e[k]) && fin(e0[k]) ? (e[k] + e0[k]) / 2 : e[k]; };
      var rev = d.rev, ebitda = fin(d.opinc) && fin(d.da) ? d.opinc + d.da : d.ebitda, fcf = fcfOfD(d), cash = fin(e.cash) ? e.cash + (e.sti || 0) : null;
      var dI = debtInfo(E || { end: r.end, d: {} }, P0, paid, other), debt = dI.debt != null ? dI.debt : dI.gap > 0 ? debtNear(dI, e.eq) : dI.none && !dI.unk && E && (M0.f || {}).nodebt && Math.abs(Date.parse(E.end) - Date.parse(M0.f.bs_end)) <= 5 * 864e5 && !finFlag ? 0 : null; /* r5: the balance sheet the function found without debt (nodebt): 0, as its debt / equity (r137d); an older one without a debt line stays "—"; never for a bank or an insurer (a debt line not read) */ /* r4: the function's debt: a line the balance sheet before had and this one lacks leaves it unknown, but within 1% of the equity for debt / equity */
      var t = fin(d.tax) && fin(d.pretax) && d.pretax > 0 ? Math.min(0.5, Math.max(0, d.tax / d.pretax)) : 0.21;
      /* r4: invested capital as the function counts it: the debt to within 1% of it, none for a company without any debt line or interest (Copart); the year before left out when its debt is not known */
      var icD = fin(e.eq) && fin(cash) ? debtNear(dI, e.eq + dI.part - cash) : null, ic = fin(icD) ? e.eq + icD - cash : null, dIP = B0 ? debtInfo(B0, P0, paid, other) : null, cashP = fin(e0.cash) ? e0.cash + (e0.sti || 0) : null;
      var icDP = dIP && fin(e0.eq) && fin(cashP) ? debtNear(dIP, e0.eq + dIP.part - cashP) : null, icP = fin(icDP) ? e0.eq + icDP - cashP : null, icA = fin(ic) && fin(icP) ? (ic + icP) / 2 : ic;
      var g = function (a, b) { return fin(a) && fin(b) && b > 0 ? a / b - 1 : null; };
      /* banks and insurers: no gross / operating / EBITDA margin and no ROIC (their revenue and debt mean other things); a margin above 100% or a gross
         profit above revenue is a mismatch of two lines' definitions: "—" rather than a wrong number */
      var finCo = finFlag || (!M0.f && (fin(d.nii) || fin(d.prov))), /* r3: the profile names another industry: not a bank (Samsung). r6: the function's verdict (evOff) for every period; a period's own lines only without a summary */ mg = function (v) { return fin(v) && rev > 0 && v / rev <= 1 && v / rev >= -10 ? v / rev : null; };
      var x = { end: r.end, fyl: r.fyl, fq: r.fq, ttm: r.ttm,
        gm: finCo || !(fin(d.gp) && d.gp <= rev * 1.0001) ? null : mg(d.gp), om: finCo ? null : mg(d.opinc), em: finCo ? null : mg(ebitda), nm: fin(d.ni) && rev > 0 && d.ni / rev <= 1 ? d.ni / rev : null, fm: finCo ? null : mg(fcf),
        roe: fin(d.ni) && e.eq > 0 && !(fin(e0.eq) && e0.eq <= 0) ? d.ni / avg("eq") : null, roa: fin(d.ni) && avg("ta") > 0 ? d.ni / avg("ta") : null,
        roic: !finCo && fin(d.opinc) && fin(icD) && e.eq > 0 && icA > 0 && ic > 0 && ic >= 0.25 * (e.eq + icD) && !(fin(icP) && !(icP > 0 && e0.eq > 0)) /* r7: the year before's capital passes the same tests, as the function's (r137g) */ && Math.abs(d.opinc * (1 - t) / icA) <= 1 ? d.opinc * (1 - t) / icA : null,
        g_rev: g(rev, q.rev), g_op: g(d.opinc, q.opinc), g_ni: g(d.ni, q.ni), g_eps: g(d.epsd, q.epsd), g_fcf: g(fcf, fcfOfD(q)),
        de: fin(debt) && e.eq > 0 ? debt / e.eq : null, nde: !finCo && fin(debt) && fin(cash) && ebitda > 0 ? (debt - cash) / ebitda : null, cov: !finCo && fin(d.opinc) && d.intexp > 0 && !r.intF && !intU(r, set) ? d.opinc / d.intexp : null, /* r24 (M24-6): neither for a bank, an insurer or another company the function counts as financial (as their EBITDA and operating margins, ROIC and EV multiples): their interest paid is the cost of the deposits, policies and clients' money they lend and invest, inside their operating income, and their EBITDA no measure of what services a debt (Banco do Brasil's 2025 "interest cover" 0.03x, ANZ's 0.19x, Crédit Agricole's net debt 31.2 times EBITDA: 145 and 66 of the 283 such companies) */ /* r20 (SU20-2): nor from EODHD's figure for a company whose filings give finance costs */ /* r19: none from an IFRS filer's finance costs (intF): interest with exchange and fair-value losses (Toyota 2.9 times for 57) */ cr: fin(e.ca) && e.cl > 0 ? e.ca / e.cl : null, la: fin(e.tl) && e.ta > 0 ? e.tl / e.ta : null };
      if (!adrMix && !(wh && (set.src === "eodhd" || r.src === "eodhd"))) { var P = priceAt(D, r.end), /* withheld amounts (EODHD's in another currency or unit): no multiple of them */ sh = /^(pe|px)$/.test(String((M0.v || {}).capby || "")) ? (function (bc) { return bc == null ? null : fin(d.sho) && d.sho / bc >= 0.95 && d.sho / bc <= 1.05 ? d.sho : bc; })(fin(d.shb) ? d.shb : fin(d.shd) && fin(d.ni) && d.ni < 0 ? d.shd : null) : fin(d.sho) ? d.sho : fin(d.shb) ? d.shb : d.shd, shP = fin(d.shd) ? d.shd : d.shb; /* r17 (SU17-1): valueRow's capby "pe" or "px" (EODHD's market value counts units or more shares): the common shares checked against the basic shares behind the EPS (the diluted ones in a loss, where no share dilutes): the shares outstanding within 5% of that count (valueRow's kc, M17-1), else the count, else none (the shares outstanding can count the units' voting shares: Ares's Class C, 109.8 of its 313.2 million at December 2024) */
        if (fin(sh) && fin(shP) && shP > 0 && (sh / shP > 1.5 || sh / shP < 0.67)) sh = null; /* r3: shares outstanding on another basis than the period's own diluted count (a split applied twice, or not at all): no market value, rather than a P/E of 1.4 */
        if (P && fin(P.px) && fin(sh) && sh > 0) { var fxl = fxRate(lc || "USD", null, P.date); if (fxl != null) { /* r25 (SU25-4): the rate of the price's month-end (priceAt takes the month before for a period that ends in a month's first week) */
          /* the SEC's rows count shares (and dividends per share) on today's basis after a split: the price must be on it too */
          var px0 = set.src === "sec" && r.src !== "eodhd" ? onTodayBasis(P.px, P.date, stepsOf(r)) : P.px; /* r26 (M26-4): only the splits its shares are on */
          var cap = px0 * sh * fxl, u = function (v, k) { return usdOf(v, { cur: r.cur, end: P.date }, set, k || "f", per === "a" ? "a" : "q"); }; /* r25 (SU25-4): every figure at the market value's rate (M24-2) */
          /* r4: the function's P/E and price / book: the common shareholders' profit (after preferred dividends, never above the profit) and equity (less the preferred stock) */
          var niC = partic && fin(d.sho) ? d.ni : fin(d.nic) && fin(d.ni) ? Math.min(d.ni, d.nic) : d.ni, eqC = fin(e.eq) && fin(e.pref) && e.pref > 0 && e.pref < e.eq ? e.eq - e.pref : e.eq;
          var nI = nciInfo(E || { end: r.end, d: {} }, P0); /* r13: the minorities as the function reads them (finSummary's nciB, r137n) */
          var xI = xclInfo(E, nI, !!E && E.src !== "eodhd" && ((st.A && st.A.src === "sec" && st.A.rows.indexOf(E) >= 0) || (st.Q && st.Q.src === "sec" && st.Q.rows.indexOf(E) >= 0))); /* r14: and the other claims (finSummary's xcl / xgap, r137o) */
          /* r24 (M24-2): a multiple is the same in any currency: the period's profit, sales, EBITDA, free cash flow and dividend per share at the rate of the
             month-end its market value is taken at (the balance sheet's), not at the period's average rate beside a market value at its end: a company that
             reports and trades in reais read for 2024 (the real from 4.95 to 6.18 to the dollar, an average of 5.39) a P/E of 6.77 for its 7.69 in reais,
             a price / sales of 0.80 for 0.91, a free cash flow yield of 14.8% for 13.0% (scratch24/stocks-math/ui/r25_page_test.js); a Canadian dollar
             company's 2022 dividend yield 4.57% for 4.40%. The overview's "Today" figures (valueRow: one rate) were right */
          var niU = u(niC, "b"), revU = u(rev, "b"), eqU = u(eqC, "b"), ebU = u(ebitda, "b"), fcfU = u(fcf, "b"), cashU = u(cash, "b"), nciU = u(nI.nci, "b"), ncgU = u(nI.gap, "b"), xclU = u(xI.x, "b"), xgU = u(xI.gap, "b"), partU = u(dI.part, "b"), gapU = u(dI.gap, "b");
          /* r4: the function's enterprise value: the debt known, or its part when the gap moves the value by under 1%, or none for a company without debt */
          var ev0 = fin(cashU) && fin(partU) ? cap + partU + (nciU || 0) - cashU : null, debtU = dI.debt != null ? u(dI.debt, "b") : dI.gap > 0 ? (ev0 > 0 && gapU <= 0.01 * ev0 ? partU : null) : dI.none && !dI.unk && !(M0.p || {}).fin ? 0 : null; /* r14: never for a company the profile calls financial (finSummary's noDebt, r137f: its debt lines are not all read; metrics.p.fin): Ameriprise's June 2026, $33.1B under a "Today" of "—" */
          var prefU = fin(e.pref) && e.pref > 0 && fin(e.eq) && e.pref < e.eq ? u(e.pref, "b") : null; /* r4: the preferred stock, as the function's enterprise value */
          var ev = fin(cashU) && fin(debtU) && !finCo && !finFlag && ![ncgU, xgU].some(function (w) { return fin(w) && !(w <= 0.01 * (cap + debtU + (prefU || 0) + (nciU || 0) + (xclU || 0) - cashU)); }) ? cap + debtU + (prefU || 0) + (nciU || 0) + (xclU || 0) - cashU : null; /* r14: the other claims in it, EODHD's gap there within 1% (valueRow, r137o) */ /* r13: nor with minorities a balance sheet of the 400 days before gave and this one cannot show (valueRow's ncigap, r137n) */ /* no cash line, no enterprise value (the function's rule): not the market value plus the debt. r3: nor for a bank or an insurer, nor where interest is paid on a debt the statements do not give (JPMorgan: its market value less its cash) */
          x.cap = cap; x.ev = ev; x.pe = niU > 0 ? cap / niU : null; x.ps = revU > 0 ? cap / revU : null; x.pb = eqU > 0 ? cap / eqU : null; x.eve = ev > 0 && ebU > 0 && !finCo && !finFlag ? ev / ebU : null; x.evs = ev > 0 && revU > 0 && !finCo && !finFlag ? ev / revU : null; x.fy = fin(fcfU) && !finCo && !finFlag ? fcfU / cap : null; /* r5: none for a bank or an insurer, as today's (valueRow, r137d) */
          if (partic && !fin(d.sho)) { x.cap = null; x.ev = null; x.ps = null; x.pb = null; x.eve = null; x.evs = null; x.fy = null; } /* r21 (SU21-3): the basic shares leave out those that take part in the profit, and no count of all of them can be read: the P/E (price over EPS) and the dividend yield need none */
          var dps = u(d.dps, "b"), pxU = px0 * fxl; /* r24 (M24-2): the price's rate */ x.dy = fin(dps) && pxU > 0 ? dps / pxU : null; } } }
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
    var R = ratioRows(co, per); if (!R) { var st0 = stmts(co.d); return '<p class="muted">' + (st0.A || st0.Q ? (per === "a" ? "No yearly figures for this company." : "No twelve-month figures for this company.") : "No statements yet for this company.") + "</p>"; } /* r39 (SU39-3) */
    var shown = per === "a" ? R.rows.slice(-15) : S.all ? R.rows : R.rows.slice(-12);
    var body = "", inG = !groups, anyRow = false, hdr = "";
    RATIO_LINES.forEach(function (ln) {
      if (ln[0] === "hd") { inG = !groups || groups.indexOf(ln[1]) >= 0; hdr = inG && (!groups || groups.length > 1) ? '<tr class="hd"><td>' + esc(ln[1]) + '</td><td colspan="' + shown.length + '"></td></tr>' : ""; return; }
      if (!inG) return;
      var vals = shown.map(function (x) { return x[ln[1]]; }); if (!vals.some(fin)) return;
      body += hdr; hdr = ""; anyRow = true;
      body += "<tr><th scope=\"row\">" + esc(ln[0]) + "</th>" + vals.map(function (v) { var t = ln[2] === "p" ? (ln[1] === "dy" ? pctA(v) /* r24 (SU24-8) */ : pct(v)) : ln[2] === "g" ? pctS(v) : ln[2] === "x" ? (fin(v) ? (Math.abs(v) < 0.05 ? 0 : v).toFixed(v >= 100 ? 0 : 1) + "x" : DASH) : ln[2] === "xx" ? (fin(v) ? (Math.abs(v) < 0.05 ? 0 : v).toFixed(1) + "x" : DASH) : big(v); return '<td class="num ' + (ln[2] === "g" ? cls(v) : "") + '">' + t + "</td>"; }).join("") + "</tr>";
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
    var lk = 0, nl = series.filter(function (s, i) { return n <= 20 || i % Math.ceil(n / 12) === 0; }).length; /* r3: the labels counted from the last, every other one hidden on a phone */
    var g = series.map(function (s, i) { var x = 10 + i * bw; var o = "";
      if (fin(s.a)) o += '<rect class="' + (s.a < 0 ? "neg" : "b2") + '" x="' + (x + bw * 0.12).toFixed(1) + '" y="' + Math.min(y(s.a), y0).toFixed(1) + '" width="' + (bw * 0.76).toFixed(1) + '" height="' + Math.max(1, Math.abs(y(s.a) - y0)).toFixed(1) + '"/>';
      if (fin(s.b)) o += '<rect class="' + (s.b < 0 ? "neg" : "b1") + '" x="' + (x + bw * 0.32).toFixed(1) + '" y="' + Math.min(y(s.b), y0).toFixed(1) + '" width="' + (bw * 0.36).toFixed(1) + '" height="' + Math.max(1, Math.abs(y(s.b) - y0)).toFixed(1) + '"/>';
      if (n <= 20 || i % Math.ceil(n / 12) === 0) o += '<text class="ax' + ((lk++ - nl + 1) % 2 ? " odd" : "") + '" x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + esc(s.l) + "</text>"; return o; }).join("");
    return '<svg class="sa-svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opt.label || "chart") + '"><line class="z" x1="10" x2="' + (w - 10) + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '"/>' + g + "</svg>";
  }
  function epsChart(hist) { /* hist rows: [q, report, when, cur, act, est] */
    var rows = hist.filter(function (h) { return fin(h[4]) || fin(h[5]); }).slice(-12); if (!rows.length) return "";
    var w = 640, h = 180, pad = 22, vals = []; rows.forEach(function (r) { if (fin(r[4])) vals.push(r[4]); if (fin(r[5])) vals.push(r[5]); });
    var mx = Math.max.apply(null, vals.concat([0])), mn = Math.min.apply(null, vals.concat([0])), span = mx - mn || 1, bw = (w - 20) / rows.length, y = function (v) { return pad + ((mx - v) / span) * (h - 2 * pad); };
    return '<svg class="sa-svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="EPS against the estimate"><line class="z" x1="10" x2="' + (w - 10) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>' + rows.map(function (r, i) { var x = 10 + i * bw + bw / 2, o = "";
      if (fin(r[5])) o += '<circle class="est" cx="' + x.toFixed(1) + '" cy="' + y(r[5]).toFixed(1) + '" r="7"/>'; if (fin(r[4])) o += '<circle class="act" cx="' + x.toFixed(1) + '" cy="' + y(r[4]).toFixed(1) + '" r="4.5"/>';
      return o + '<text class="ax' + ((rows.length - 1 - i) % 2 ? " odd" : "") + '" x="' + x.toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + esc(mShort(r[0])) + "</text>"; }).join("") + "</svg>";
  }
  function line(points, opt) { /* points: [[date, v]] */
    var p = points.filter(function (x) { return fin(x[1]); }); if (p.length < 2) return ""; opt = opt || {};
    var w = 640, h = opt.h || 160, pad = 18, t0 = Date.parse(p[0][0]), t1 = Date.parse(p[p.length - 1][0]) || t0 + 1, vs = p.map(function (x) { return x[1]; }), mx = Math.max.apply(null, vs), mn = Math.min.apply(null, vs), span = mx - mn || Math.abs(mx) || 1;
    var X = function (d) { return 10 + (Date.parse(d) - t0) / (t1 - t0 || 1) * (w - 20); }, Y = function (v) { return pad + (mx - v) / span * (h - 2 * pad); };
    return '<svg class="sa-svg" viewBox="0 0 ' + w + " " + h + '"><path class="ln" d="' + p.map(function (x, i) { return (i ? "L" : "M") + X(x[0]).toFixed(1) + " " + Y(x[1]).toFixed(1); }).join("") + '"/><text class="ax lt" x="10" y="2">' + esc(opt.fmt ? opt.fmt(mx) : fmtNum(mx, 2)) + '</text><text class="ax" x="10" y="' + (h - 4) + '">' + esc(opt.fmt ? opt.fmt(mn) : fmtNum(mn, 2)) + '</text><text class="ax" x="' + (w - 10) + '" y="' + (h - 4) + '" text-anchor="end">' + esc(date(p[p.length - 1][0])) /* r17 (SU17-7) */ + "</text></svg>";
  }
  /* exchanges whose prices TradingView does not show in charts embedded on other sites ("This symbol is only available on TradingView"):
     a link to the chart on TradingView instead of an empty box */
  /* r137o: by TradingView's own list of the markets its widgets may show (tradingview.com/widget-docs/markets: North America, Europe, Middle East /
     Africa, Mexico and South America, Asia / Pacific; its FAQ: "This symbol is only available on TradingView" means "we are not allowed to show that
     symbol in any timeframe in the widgets"): neither Hong Kong (HKEX; only the Hang Seng indices), Tokyo (TSE; only TOCOM), the Taiwan Stock Exchange
     (TWSE; only the Taipei Exchange, TPEX), Singapore, Thailand, Ho Chi Minh, the Philippines, New Zealand, London (only Turquoise), Euronext, Oslo,
     Istanbul, Johannesburg nor Mexico's BMV (only BIVA) is there: some 300 companies' Price chart and overview chart showed TradingView's refusal in
     the box. Bombay (BSE), Abu Dhabi (ADX), Kuwait (KSE) and Egypt (EGX) are on it, and are shown */
  var TV_NO_EMBED = /^(KRX|NSE|TADAWUL|DFM|QSE|HKEX|TSE|TWSE|SGX|SET|HOSE|PSE|NZX|LSE|EURONEXT|OSL|BIST|JSE|BMV):/;
  function tvWidget(el, symbol, small) {
    if (!el || !symbol || el.dataset.on === symbol) return; el.dataset.on = symbol;
    if (TV_NO_EMBED.test(symbol)) { el.innerHTML = '<div class="sa-tvno"><p>The price chart of ' + esc(symbol) + " cannot be shown here: TradingView keeps this exchange's prices on its own site.</p><p><a href=\"https://www.tradingview.com/symbols/" + encodeURIComponent(symbol.replace(":", "-")) + '/" target="_blank" rel="noopener">Open the chart on TradingView ↗</a></p></div>'; return; } el.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div><div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div></div>';
    var s = document.createElement("script"); s.async = true;
    if (small) { s.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"; s.textContent = JSON.stringify({ symbols: [[symbol, symbol + "|12M"]], chartOnly: false, width: "100%", height: "100%", locale: "en", colorTheme: "dark", autosize: true, showVolume: false, showMA: false, hideDateRanges: false, hideMarketStatus: false, hideSymbolLogo: true, scalePosition: "right", scaleMode: "Normal", fontSize: "10", noTimeScale: false, valuesTracking: "1", changeMode: "price-and-percent", chartType: "area", lineWidth: 2, lineType: 0, lineColor: "rgba(255, 255, 255, 1)", topColor: "rgba(255, 255, 255, 0.16)", bottomColor: "rgba(255, 255, 255, 0)", backgroundColor: "rgba(10, 10, 11, 1)", gridLineColor: "rgba(255, 255, 255, 0.05)", widgetFontColor: "rgba(219, 219, 219, 1)", dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"] }); }
    else { s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"; s.textContent = JSON.stringify({ autosize: true, symbol: symbol, interval: "D", timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(10, 10, 11, 1)", gridColor: "rgba(255, 255, 255, 0.05)", allow_symbol_change: true, calendar: false, hide_volume: false, support_host: "https://www.tradingview.com" }); }
    el.querySelector(".tradingview-widget-container").appendChild(s);
  }

  /* ---------- the company page ---------- */
  /* the sections, as on Koyfin: snapshots, analysts' estimates, financial analysis, filings and transcripts, graphs. The side menu lists the five
     sections only; a section's pages are a bar of tabs at the top of the page (19 Oct: no scrolling down the menu to reach Highlights or Solvency) */
  var MENU = [
    ["Snapshots", [["overview", "Overview"], ["description", "Description"], ["rank", "Percentile rank"], ["dividends", "Dividends"], ["ownership", "Ownership"], ["earnings", "Earnings history"]]],
    ["Analyst estimates", [["estimates", "Estimates"], ["target", "Price target"]]],
    ["Financial analysis", [["highlights", "Highlights"], ["is", "Income statement"], ["bs", "Balance sheet"], ["cf", "Cash flow"], ["multiples", "Multiples"], ["ev", "Enterprise value"], ["profitability", "Profitability"], ["returns", "Returns (ROE, ROIC)"], ["growth", "Growth"], ["solvency", "Solvency"]]],
    ["Filings", [["filings", "Filings"]]],
    ["Graphs", [["chart", "Price chart"]]]
  ];
  var ALIAS = { summary: "overview", financials: "is", ratios: "profitability", news: "filings", transcripts: "filings" }; /* the old links keep working */
  function pageOf(tab) { tab = ALIAS[tab] || tab; return MENU.some(function (g) { return g[1].some(function (t) { return t[0] === tab; }); }) ? tab : "overview"; }
  function pageName(tab) { var n = "Overview"; MENU.forEach(function (g) { g[1].forEach(function (t) { if (t[0] === tab) n = t[1]; }); }); return n; }
  /* the company's sections live in the site's own side menu, under Stock Analysis (as on Koyfin), not in a second menu beside it.
     On a phone the side menu is a drawer: a list of the sections also sits at the top of the page there */
  function sideSel(on) {
    return '<select id="sa-sidesel" class="sa-sel" aria-label="Section">' + MENU.map(function (g) { return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === on ? " selected" : "") + ">" + esc(t[1]) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select>";
  }
  function groupName(tab) { var n = ""; MENU.forEach(function (g) { g[1].forEach(function (t) { if (t[0] === tab) n = g[0]; }); }); return n; }
  function groupOf(tab) { var gi = -1; MENU.forEach(function (g, i) { g[1].forEach(function (t) { if (t[0] === tab) gi = i; }); }); return gi; }
  /* the last page seen in each section: its link in the side menu goes back there */
  var G_TAB = {};
  /* the section's pages as tabs at the top of the page, the one shown marked (a line under it, its name bold) */
  function pageTabs(id, tab, glow) {
    var gi = groupOf(tab); if (gi < 0) return ""; G_TAB[gi] = tab; var g = MENU[gi];
    if (g[1].length < 2) return "";
    return '<nav class="sa-ptabs" aria-label="' + esc(g[0]) + '">' + g[1].map(function (t) { var me = t[0] === tab;
      return '<a href="#stocks/' + encodeURIComponent(id) + "/" + t[0] + '"' + (me ? ' class="on' + (glow ? " sa-in2" : "") + '" aria-current="page"' : "") + ">" + esc(t[1]) + "</a>"; }).join("") + "</nav>";
  }
  /* the menu is always there, under Stock Analysis: the company's name and its five sections, the one shown marked (a bar, a lighter row, a dot) and
     lit for a moment when it changes. Without a company open, its links go to the last company seen (else the largest) */
  function sideNav(id, on, name) {
    var old = document.getElementById("sa-snav"), anchor = document.getElementById("nav-stocks");
    if (!anchor || anchor.hidden) { if (old) old.remove(); return; }
    css(); /* its styles before it is drawn, on whatever page of the site (17 Oct: drawn unstyled until Stock Analysis was opened) */
    var last = LS.get("mws_sa_last") || null;
    if (id) { if (!last || last.id !== id || last.name !== name) LS.set("mws_sa_last", { id: id, name: name || id }); }
    else if (last && last.id) { id = last.id; name = last.name; }
    else { id = "NVDA"; name = "NVIDIA"; }
    var gOn = groupOf(on);
    var href = function (gi) { return "#stocks/" + encodeURIComponent(id) + "/" + (G_TAB[gi] || MENU[gi][1][0][0]); };
    var box = old; if (!box) { box = document.createElement("div"); box.id = "sa-snav"; box.className = "sa-snav"; box.setAttribute("role", "navigation"); box.setAttribute("aria-label", "Company sections");
      box.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("a"); if (!a) return; var close = document.getElementById("side-close"); if (close && W.matchMedia && W.matchMedia("(max-width:960px)").matches) setTimeout(function () { close.click(); }, 0); }); }
    var page = id + "|" + gOn, moved = box.getAttribute("data-p") !== page;
    var fg = (function () { var a = document.activeElement; return a && a !== box && box.contains(a) && a.getAttribute ? a.getAttribute("data-g") : null; })(); /* r39 (SU39-1) */
    box.innerHTML = '<span class="sa-cn" title="' + esc(name || id) + '">' + esc(name || id) + "</span>" + MENU.map(function (g, gi) { var me = gi === gOn;
      return '<a href="' + href(gi) + '" data-g="' + gi + '"' + (me ? ' class="on' + (moved && old && old.getAttribute("data-p") ? " flash" : "") + '" aria-current="page"' : "") + ">" + esc(g[0]) + "</a>"; }).join("");
    box.setAttribute("data-p", page); if (fg != null && (!document.activeElement || document.activeElement === document.body) && !(W.matchMedia && W.matchMedia("(max-width:960px)").matches)) { var fa = box.querySelector('a[data-g="' + fg + '"]'); if (fa) try { fa.focus({ preventScroll: true }); } catch (e) { fa.focus(); } } /* drawn on every page: the site's own router clears every mark in its menu on each page change */
    if (box.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", box);
    /* the page's section brought into view in the side menu (the menu scrolls, the page does not) */
    var cur = box.querySelector("a.on"), nav = anchor.parentElement; if (moved && cur && nav) { var r = cur.getBoundingClientRect(), nr = nav.getBoundingClientRect(); if (r.bottom > nr.bottom || r.top < nr.top) nav.scrollTop += r.top - nr.top - nr.height / 2; }
  }
  /* what the checks on the data found, said once at the top of every page in plain words */
  function xOf(s) { var m = /x(-?[\d.]+)/.exec(String(s || "")); return m ? "\u00d7" + m[1] : DASH; }
  /* r12: EODHD's balance sheets these pages show (its years after the SEC's among the last 17, its quarters where the Quarters pages read them) whose equity
     is "—" because it held the minorities, by the SEC's balance sheet of the same day: the same total assets (0.1%), and an equity and minorities that
     make those assets less the liabilities and our assets less liabilities (the equity taken) within a tenth of the minorities (the function's finEqCheck
     test, r137k; its guard's eqnci takes such equities too). Counted here, not as fin.eqSec, which counts every balance sheet finEqCheck took in the
     record, EODHD's years among them that the SEC's years stand in for on these pages (Alibaba's March 2023 and March 2024 years and quarters: four, of
     which the Quarters page shows two); an equity the guard's eqnci took that the SEC's balance sheet of the day shows the same way is counted too
     (Rogers' December 2025 quarter: "—" without a word on a company with SEC years) */
  function eqHeldShown(co) {
    var D = co.d || {}, sec = D.sec, f = (co.u.metrics || {}).f || {}, none = { n: 0, ends: {} };
    if (!sec || !D.fin || f.withheld || !sec.currency || sec.currency !== D.fin.currency) return none;
    var S = (sec.annual || []).concat(sec.quarterly || []).filter(function (x) { return x && x.d && x.end && x.d.ta > 0 && fin(x.d.tl) && fin(x.d.eq); }); if (!S.length) return none;
    var st = stmts(D), ends = {}, n = 0;
    var rows = (st.A ? st.A.rows.slice(-17).filter(function (r) { return st.A.src === "eodhd" || r.src === "eodhd"; }) : []).concat(st.Q && st.Q.src === "eodhd" && !f.qbad ? st.Q.rows : []);
    rows.forEach(function (r) { var d = r && r.d; if (!d || !r.end || ends[r.end] || fin(d.eq) || !(d.ta > 0) || !fin(d.tl)) return; var t = Date.parse(r.end), e0 = d.ta - d.tl;
      if (S.some(function (x) { var b = x.d, nc = d.nci > 0 ? d.nci : b.nci > 0 ? b.nci : b.ta - b.tl - b.eq; /* r13: the SEC's own gap for the minorities (finEqCheck, r137m: Masco's December 2024) */ return Math.abs(Date.parse(x.end) - t) <= 10 * 864e5 && Math.abs(b.ta - d.ta) <= 0.001 * d.ta && nc >= 0.005 * d.ta && Math.abs(b.ta - b.tl - b.eq - nc) <= 0.1 * nc && Math.abs(e0 - b.eq - nc) <= 0.1 * nc + 0.003 * d.ta; })) { ends[r.end] = 1; n++; } });
    /* r13: and once the function has found the record to give its equity with the minorities in it (fin.eqSec: an EODHD balance sheet beside the SEC's of
       its day so, at this run or an earlier one; never a balance sheet the guard took, which finEqCheck does not see), every other of its balance sheets without an SEC balance sheet of its day, where the SEC's nearest one (within 400 days)
       gives minorities apart of 0.5% of the assets or more: finEqCheck's proven rule (r137m). Alibaba's June, September and December 2023 and 2024 and
       June 2025 quarters, HCA's, Masco's and Clorox's 2023 to 2025: "—" on the Quarters page that the note left out (Alibaba: 2 of 9). Not an equity the
       guard says it took itself (fin.qg.at: its own note counts it) */
    if (D.fin.eqSec > 0) {
      var gE = {}; ((D.fin.qg && Array.isArray(D.fin.qg.at)) ? D.fin.qg.at : []).forEach(function (p) { var a = String(p).split("|"); if (a[2] === "eq") gE[a[0] + "|" + a[1]] = 1; });
      var qR = st.Q ? st.Q.rows : [], apartOf = function (x) { return x.nci > 0 ? (x.ta - x.tl - x.eq >= 0.5 * x.nci ? x.nci : 0) : x.nci == null ? Math.max(0, x.ta - x.tl - x.eq) : 0; }; /* r14: the SEC's minorities apart as finEqCheck reads them (r137n): its line where the three add up with it, else (no line) its own gap; none where its line says 0 */
      rows.forEach(function (r) { var d = r && r.d; if (!d || !r.end || ends[r.end] || fin(d.eq) || !(d.ta > 0) || !fin(d.tl) || gE[(qR.indexOf(r) >= 0 ? "Q" : "A") + "|" + r.end]) return; var t = Date.parse(r.end);
        if (S.some(function (x) { return Math.abs(Date.parse(x.end) - t) <= 10 * 864e5 && Math.abs(x.d.ta - d.ta) <= 0.001 * d.ta; })) return; /* an SEC balance sheet of its day: the test above decides */
        if (fin(d.nci) && d.nci < 0.005 * d.ta) return; /* r14: nor one whose own minorities line is under 0.5% of its assets (r137n) */
        var s0 = S.filter(function (x) { return Math.abs(Date.parse(x.end) - t) <= 400 * 864e5; }) /* r14: the nearest SEC balance sheet whatever it shows (r137n), not the nearest with minorities */.sort(function (a, b) { return Math.abs(Date.parse(a.end) - t) - Math.abs(Date.parse(b.end) - t); })[0];
        if (s0 && apartOf(s0.d) >= 0.005 * d.ta) { ends[r.end] = 1; n++; } });
    }
    return { n: n, ends: ends };
  }
  /* r13: the SEC's balance sheets these pages show whose equity the function took as holding the minorities (secEqCheck: sec.eqNci; secEqOwnCheck:
     sec.eqOwn). Both count every balance sheet of the SEC record they took: the years before the last 17 (VeriSign's 2008 beside its 2009: "on 2 balance
     sheets" over one "—") and the SEC quarters of a company whose Quarters pages read EODHD's (Brookfield Corporation's and Brookfield Infrastructure's
     records keep 9 each). An equity taken leaves its balance sheet with total assets and liabilities but no equity (secEqOwnCheck: beside minorities
     under half the assets): those the pages show are counted, never above the function's own count */
  function secEqShown(co) {
    var D0 = co.d || {}, sec = D0.sec, f = (co.u.metrics || {}).f || {}, N = sec && sec.eqNci > 0 ? sec.eqNci : 0, O = sec && sec.eqOwn > 0 ? sec.eqOwn : 0; if (!N && !O) return { n: 0, o: 0 };
    var st = stmts(f.withheld ? secOnly(D0) : D0), c = 0, cO = 0;
    var rows = (st.A && st.A.src === "sec" ? st.A.rows.slice(-17).filter(function (r) { return r.src !== "eodhd"; }) : []).concat(st.Q && st.Q.src === "sec" && perOpts(co, true, "bs").some(function (o) { return o[0] === "q"; }) ? st.Q.rows : []);
    var tot = {}; (sec && Array.isArray(sec.eqTotAt) ? sec.eqTotAt : []).forEach(function (p) { tot[String(p).slice(2)] = 1; }); /* r14: not one secEqTotCheck took (secTotShown counts those) */
    rows.forEach(function (r) { var d = r && r.d; if (!d || fin(d.eq) || !(d.ta > 0) || !fin(d.tl) || tot[r.end]) return; c++; if (d.nci > 0 && d.nci < 0.5 * d.ta) cO++; });
    var o = Math.min(O, cO); return { n: Math.min(N, c - o), o: o };
  }
  /* r14: the SEC's equities the function took as a total with the minorities in it beside no minorities line (secEqTotCheck, r137o: a report that tags
     neither the shareholders' equity nor the minorities; sec.eqTotAt, "A|end" or "Q|end"): those these pages show as "—" (Energy Transfer's 10-Q
     quarters, Viper's June 2025) */
  function secTotShown(co) {
    var D0 = co.d || {}, sec = D0.sec, f = (co.u.metrics || {}).f || {}, at = sec && Array.isArray(sec.eqTotAt) ? sec.eqTotAt : []; if (!at.length) return 0;
    var st = stmts(f.withheld ? secOnly(D0) : D0), n = 0, has = {}; at.forEach(function (p) { has[p] = 1; });
    (st.A && st.A.src === "sec" ? st.A.rows.slice(-17).filter(function (r) { return r.src !== "eodhd"; }) : []).forEach(function (r) { if (r && r.d && !fin(r.d.eq) && has["A|" + r.end]) n++; });
    (st.Q && st.Q.src === "sec" && perOpts(co, true, "bs").some(function (o) { return o[0] === "q"; }) ? st.Q.rows : []).forEach(function (r) { if (r && r.d && !fin(r.d.eq) && has["Q|" + r.end]) n++; });
    return n;
  }
  /* r12: the figures the guard took (fin.qg.at: "A|end|key|why" or "Q|end|key|why", one per figure, where the function gives them) that these pages show as
     "—": in the years the statements show (the last 17; for a company with SEC years, EODHD's years after them) and in EODHD's quarters where a statement
     offers them; not one the guard put right (a year's balance sheet from the quarter of its day, bsdate), one of a period it left out whole (misdated,
     partyear, empty), a half-year moved (halfq), nor an equity eqHeldShown counts */
  function qgShown(co, at, eqEnds) {
    var st = stmts(co.d), f = (co.u.metrics || {}).f || {}, n = 0, by = {}, Y = {}, Q = {}, qOn = {}, stOf = {}, lnOn = {};
    (st.A ? st.A.rows.slice(-17) : []).forEach(function (r) { if (st.A.src === "eodhd" || r.src === "eodhd") Y[r.end] = r; });
    if (st.Q && st.Q.src === "eodhd" && !f.qbad) st.Q.rows.forEach(function (r) { Q[r.end] = r; });
    ["is", "bs", "cf"].forEach(function (w) { LINES[w].forEach(function (l) { if (l[0] !== "hd" && typeof l[1] === "string") stOf[l[1]] = w; }); });
    at.forEach(function (p) { var a = String(p).split("|"), k = a[2], why = a[3], w = stOf[k], r = a[0] === "Q" ? Q[a[1]] : a[0] === "A" ? Y[a[1]] : null; /* r12b: "H" a half-year of fin.halves (r137m), shown on no statement row */ if (!w || !r || why === "halfq" || fin(r.d && r.d[k])) return;
      /* r13: nor one in a line the page leaves out whole, none of its periods having a figure there (the Years' last 17, the quarters): PTT Exploration's
         six quarterly "Net income to common" (nicscale), Scentre's five quarterly net profits, Novatek's two quarterly capital expenditures were counted
         as "shown as —" where the Quarters page has no such line */
      var lk = a[0] + "|" + k; if (lnOn[lk] == null) lnOn[lk] = (a[0] === "Q" ? (st.Q ? st.Q.rows : []) : (st.A ? st.A.rows.slice(-17) : [])).some(function (x) { return x && x.d && fin(k === "capex" ? capexOf(x.d) : x.d[k]); }); if (!lnOn[lk]) return;
      if (k === "eq" && eqEnds && eqEnds[r.end]) return;
      if (a[0] === "Q") { if (qOn[w] == null) qOn[w] = perOpts(co, true, w).some(function (o) { return o[0] === "q"; }); if (!qOn[w]) return; }
      n++; by[why] = (by[why] || 0) + 1; });
    return { n: n, by: by };
  }
  function checks(co) {
    var u = co.u, m = u.metrics || {}, f = m.f || {}, v = m.v || {}, st = u.status || {}, out = [];
    var had = !!m.p, gone = (m.r || {}).stale ? ", the dividend yield and the returns" : " and the dividend yield", lastRd = co.d && co.d.profile && co.d.profile.at ? " (" + date(String(co.d.profile.at).slice(0, 10)) + ")" : ""; /* r18 (SU18-1): the day of that last read */ /* r17 (SU17-3): a record read before (its figures kept, valueRow's norecord) */
    if (st.res && st.res.dead) { var rsD = st.res, wkD = !!rsD.plan, soonD = isFinite(Date.parse(String(rsD.again || ""))), whenD = soonD ? (Date.parse(String(rsD.again)) > Date.now() ? "it is asked again within a day, EODHD not having answered the last time" : "it is asked again at its next read") /* r32 (SU32-4): R31-2's again (the SEC gave its name back) is that run's time, not an unanswered re-ask */ : wkD ? "it is asked again every week" : "it is asked again every month"; /* r29 (SU29-2): res.plan is the function's rule (a 403 on the row's own code: a week; else a month); res.again a re-ask that got no answer (r137s, R27-2) */
      out.push(wkD ? (had ? "EODHD's plan no longer includes company data from this exchange (EODHD answers 403; " + whenD + "): its figures from EODHD (profile, estimates, prices) are those of its last read" + lastRd + ", and its market value, the multiples" + gone + " show \u2014 rather than those of its last price." : "EODHD's plan does not include company data from this exchange (EODHD answers 403), so there are no figures for this company yet. " + whenD.charAt(0).toUpperCase() + whenD.slice(1) + "; nothing needs doing.") : had ? "EODHD no longer has a record we can read for this company (" + whenD + "): its figures from EODHD (profile, estimates, prices) are those of its last read" + lastRd + ", and its market value, the multiples" + gone + " show \u2014 rather than those of its last price." : "EODHD has no record we can read for this company yet. " + whenD.charAt(0).toUpperCase() + whenD.slice(1) + "."); }
    if (f.withheld && /market-value/.test(f.check || "")) out.push("Amounts withheld: this company's figures in EODHD are out of all proportion to its market value (" + xOf(f.check) + "), a currency or unit error in EODHD's records. No amount is shown until it is corrected; margins, growth and returns, which do not depend on the currency, are shown.");
    else if (f.withheld && /^eodhd-vs-sec/.test(f.check || "")) out.push("Amounts withheld: EODHD's figures for this company differ from its own 20-F at the SEC (" + xOf(f.check) + "), so they are in another currency or unit, and the SEC's latest year (" + ((/year (\d{4})/.exec(f.check) || [])[1] || "—") + ") is too old to show instead. No amount is shown until a newer 20-F is in; margins, growth and returns are shown.");
    else if (f.withheld) out.push("Amounts withheld: EODHD's statements for this company and EODHD's own twelve-month figures differ by more than double (" + xOf(f.check) + "), so one of them is in another currency or unit. No amount is shown until the two agree; margins, growth and returns, which do not depend on the currency, are shown.");
    else if (/^eodhd-vs-sec/.test(f.check || "")) out.push("EODHD's statements differed from the company's own 20-F at the SEC (" + xOf(f.check) + "): the 20-F's figures are shown.");
    else if (/^sec-revenue-partial/.test(f.check || "")) out.push("The revenue line in the company's SEC filings is only part of its revenue (" + xOf(f.check) + " of the total): " + (f.rev != null ? "EODHD's twelve-month revenue is shown (no sales growth); net income is the filings'." : "no revenue is shown for " + (f.end ? "the year to " + mLong(f.end) : "the latest year") + ", nor the margins and sales growth that need it (EODHD's twelve-month figure covers another period); net income is the filings'."));
    else if (/^bank-gross/.test(f.check || "")) out.push("EODHD gives this bank's gross income (interest received plus fees): its net revenue, EODHD's own twelve-month figure, is shown.");
    if (co.d && revHidden(co.d)) out.push("No revenue is shown for this company: a bank's or insurer's revenue is not one figure across sources (interest received or net of interest paid, premiums written or earned), and EODHD's switches between them from year to year. Its profit, assets, equity and cash flow are shown; a US company's own 10-K revenue line is kept.");
    var eqH = eqHeldShown(co); /* r12: SU12-1, before the guard's note (an equity counted there is not counted twice) */
    var secY = !!(co.d && co.d.sec && co.d.sec.annual && co.d.sec.annual.length), qg0 = co.d && co.d.fin && co.d.fin.qg, qgBy = (qg0 && qg0.by) || {};
    /* r12: the guard's positions only when they are all its figures (every figure it took, less the half-years moved and the periods left out): a record
       whose older passes kept counts alone keeps the counted note until its next full pass */
    var qgAt = qg0 && Array.isArray(qg0.at) && qg0.at.filter(function (p) { return String(p).split("|")[3] !== "halfq"; }).length === qg0.n - (qgBy.halfq || 0) - (qgBy.partyear || 0) - (qgBy.empty || 0) ? qg0.at : null;
    var qg = qg0 && (!secY || qgAt) ? qg0 : null; if (qg && qg.n > 0) { /* a company with its own SEC filings: its pages show those, not EODHD's rows (r12: but for EODHD's quarters where the SEC's are not current and steady, and EODHD's years after the SEC's: counted where the guard says where it took figures, qg.at) */ var QGW = { empty: "rows with nothing but a share count", cfcopy: "cash flows identical, to the unit, to those of the same period a year before or after", /* r37 (PC37-03): M36-1 often takes the earlier of the two (Toyota, Honda, Israel Discount Bank) */ /* r36 (M36-1, SU35-2): the guard reason for copied cash-flow blocks */ yoff: "a year's cost, spending, payout or interest far off its own quarters and five times off the years beside it or beside its run of such years, and a quarter as far off as such a year" /* r37 (M37-2) */ /* r38 (M38-1, M38-2) */, /* r36 (M36-5) */ neg: "costs, assets or liabilities below zero", total: "subtotals smaller than a line inside them", part: "lines larger than their subtotal", bs: "assets that liabilities and equity do not make", spike: "balances far off the periods on both sides", dupq: "two quarters with the same figures", qyear: "quarters equal to their whole year", qsum: "quarters more than 10% off their year", receipt: "share counts of a US receipt's record", parent: "a year with the parent company's balance sheet alone", partyear: "part-years among the years", cumq: "quarters holding the year to date", cumq2: "a second quarter holding the half year", ytdq: "a quarter holding the year to date", gpswap: "gross profit and cost of revenue swapped", parent2: "the parent company's balance sheet in place of the group's", bsdate: "a year's balance sheet dated a quarter early", misdated: "a year dated to the wrong period", flowscale: "a year's figures on another scale than the years on both sides", niscale: "a net profit on another scale than the rest of its year, year after year", nicscale: "a net profit and a profit to common shareholders twenty times apart, one of the two in another currency or unit", eqnci: "an equity with the minority interests inside it, or that cannot be told apart from them", nicsign: "a net profit and a profit to common shareholders of opposite signs", yrev: "a year's revenue under 60% of the year before's while its profits held, beside a half of its own holding most of it" /* r31: the function's M29-4 (r29) */, ptax: "a pre-tax profit and a tax far above the rest of the income statement, the net profit what they leave" /* r31 (M31-1) */, qda: "quarters' depreciation or stock-based compensation that are figures to date, or below zero" /* r31 (M31-2) */, opgp: "a gross profit equal to the operating income (costs reported by nature), or an operating income that is the gross profit or the EBITDA" /* r31 (M31-3) */, gpfill: "a gross profit equal to the revenue (EODHD's filler)" /* r31 (M31-3) */, opscale: "an operating income ten times the revenue and the pre-tax profit" /* r31 (M31-4) */, niusd: "a net profit, and costs, in dollars beside statements in another currency" /* r32 (M32-1) */, gprev: "a gross profit above the revenue, a cost of revenue below zero, the two at odds with the revenue, or a gross loss far below the operating result" /* r35 (L35-1) */ /* r32 (M32-2) */, cytd: "a quarter's cost of revenue that is its year's to date" /* r32 (M32-2) */, optd: "a quarter's operating result that its pre-tax result contradicts by more than half its revenue" /* r32 (M32-2) */, costscale: "costs ten times the revenue that its gross profit, operating income or pre-tax result cannot hold" /* r33 (M33-4) */, cfytd: "quarters' cash flows that are figures to date, or a fourth quarter holding the whole year's" /* r35 (M35-1) */, qbig: "a quarter's costs (selling, research, cost of revenue, depreciation, interest) above its whole year's" /* r36 (M36-6) */ /* r35 (M35-2) */, gpebitda: "a gross profit that is the EBITDA (costs reported by nature)" /* r35 (M35-3) */, qint: "a quarter's interest twenty times the quarters around it and above a whole year's, a loss of the period (its pre-tax result that much below its operating income)" /* r38 (M38-3) */ }; /* r10: the function's r137i reasons (finScaleGuard); r11: its r137j and r137k ones (nicscale, eqnci, nicsign) */
      var by = qg.by || {}, rowsN = (by.empty || 0) + (by.partyear || 0), figN = qg.n - rowsN - (by.halfq || 0), byF = by, hidY = null; if (secY) rowsN = 0;
      /* r12 (SU12-2): the figures these pages show as "—" where the guard says where it took them (qgShown); else its count, said to reach back past the
         years the pages show (the statements show the last 17) */
      if (qgAt) { var qs = qgShown(co, qgAt, eqH.ends); figN = qs.n; byF = qs.by; } else { var stG = stmts(co.d); if (stG.A && stG.A.src === "eodhd" && stG.A.rows.length > 17) hidY = stG.A.rows[stG.A.rows.length - 17]; } /* empty rows and part-years are counted as rows, not figures; half-years are moved, not taken away */
      var why = Object.keys(byF).filter(function (k) { return k !== "empty" && k !== "partyear" && k !== "halfq" && k !== "qmoved" && QGW[k]; }).sort(function (a, b) { return (byF[b] || 0) - (byF[a] || 0); }).map(function (k) { return QGW[k] || k; }).slice(0, 4).join("; ");
      if (figN > 0 && why) out.push(figN + " figure" + (figN === 1 ? "" : "s") + " in EODHD's statements for this company " + (figN === 1 ? "is" : "are") + " shown as \u2014" + (hidY ? " (some of them may be in the years before " + colLabel(hidY, "a") + ", which these pages do not show)" : "") + ": the company's own other figures show they cannot be right (" + why + ").");
      if (by.halfq && !secY) { var poH = perOpts(co, true, "is").map(function (o) { return o[0]; }); out.push(poH.indexOf("q") < 0 && poH.indexOf("t") < 0 ? "This company reports by half-year: its half-year figures are not shown as quarters, so the quarterly and twelve-month views have no income statement; see the years." : "Some of the figures EODHD gives for this company under a quarter's date cover a half year (six months): they are not shown as quarters."); } /* r29 (SU29-4): the views' own chips (a half among quarters: Schindler, Holcim, Symrise) */
      if (rowsN > 0) out.push(rowsN + " period" + (rowsN === 1 ? "" : "s") + " in EODHD's statements for this company " + (rowsN === 1 ? "is" : "are") + " left out: " + [by.partyear ? "part-years among the years" : "", by.empty ? "rows with nothing but a share count" : ""].filter(Boolean).join(" and ") + "."); }
    /* r11: the SEC's equity the function took away as holding the minorities (secEqCheck, r137j: Brookfield Corporation's 40-F, 166.2 billion dollars for
       a shareholders' equity of 47.9) */
    var eqSh = secEqShown(co), eqN = eqSh.n; /* r13: the SEC balance sheets the pages show "—" for (secEqShown), not sec.eqNci */ if (eqN) out.push("The equity in the company's own SEC filings holds its minority interests too (EODHD's balance sheets give the two apart): it shows \u2014 on " + (eqN === 1 ? "one balance sheet" : eqN + " balance sheets") + ", as do the price / book, return on equity and debt / equity made from it.");
    var eqS = eqH.n; /* r12: the balance sheets the pages show "—" for (eqHeldShown), not fin.eqSec */ if (eqS) out.push("The equity in EODHD's balance sheets for this company holds its minority interests too on " + (eqS === 1 ? "one balance sheet" : eqS + " balance sheets") + " (the company's own SEC filings give the two apart): those show \u2014 for the equity, as do the price / book, return on equity and debt / equity made from it."); /* r11: finEqCheck (r137k) */
    var eqO = eqSh.o; /* r13: nor sec.eqOwn */ if (eqO) out.push("The equity in the company's own SEC filings holds its minority interests too on " + (eqO === 1 ? "one balance sheet" : eqO + " balance sheets") + " (it is the assets less the liabilities, with the minorities line beside it): those show \u2014 for the equity, as do the price / book, return on equity and debt / equity made from it."); /* r12: secEqOwnCheck (r137l) */ /* r12: secEqOwnCheck (r137l) */
    var eqT = secTotShown(co); if (eqT) out.push("The equity in the company's own SEC filings holds its minority interests too on " + (eqT === 1 ? "one period" : eqT + " periods") + " these pages show (the filing gives its total equity alone there, while its balance sheets around it, or EODHD's of the same day, give the minorities apart): those show \u2014 for the equity, as do the price / book, return on equity and debt / equity made from it."); /* r14: secEqTotCheck (r137o) */
    if (co.d && co.d.sec && co.d.sec.opOff > 0) out.push("The company's own SEC filings give an operating income equal to its gross profit on some periods: a gross profit worked out from a cost line that holds every operating cost, or an EBITDA tagged as the operating income. Those figures show \u2014, as do the margins, EBITDA and returns made from them."); /* r31 (M31-3): secOpCheck */
    if (co.d && co.d.sec && co.d.sec.dpsOff > 0) out.push("Some dividends per share in the company's own SEC filings are contradicted by the dividends it paid (the dividends paid to its common shareholders over its shares: most often one payment's dividend filed as the whole year's, or a quarter worked out from such figures): those show \u2014, as does the dividend yield made from them."); /* r21 (SU21-4): secDpsCheck (r137u, M20-1) */
    if (f.qbad && !f.withheld) out.push("EODHD's quarterly figures for this company do not add up to its yearly ones (a half-year or a change of definition among the quarters): the latest year is shown instead of the last twelve months, and the quarterly views are left out.");
    if (v.capcheck && /^pe-vs-eodhd/.test(v.capcheck)) out.push("Our P/E for this company and EODHD's own (its price over its twelve months' earnings per share) are more than a third apart (" + xOf(v.capcheck) + "): the market value and the profit are not on one basis (several share classes, minorities in the profit, or a currency label), so the multiples and the amounts in dollars show — until they agree.");
    else if (v.capcheck) out.push("EODHD's market value for this company disagrees with its own enterprise value less the company's net debt (" + xOf(v.capcheck) + "): no market value is shown until the two agree, and the multiples that need it show —.");
    if (v.capunits > 0 && v.capby === "px") out.push("EODHD's market value for this company is " + Number(v.capunits).toFixed(2) + "x " + (function (pp) { return fin(Number(pp.cpx)) && Number(pp.cpx) > 0 && /^\d{4}-\d{2}-\d{2}/.test(String(pp.cpxOf || "")) ? "its share price when that market value was read (" + date(String(pp.cpxOf).slice(0, 10)) + ")" : "its latest share price"; })(m.p || {}) /* r19 (SU19-1): valueRow's kc on the price of the market value's day (metrics.p.cpx, r137s R18-2) */ + " times the common shares its profit per share is of: it counts more than those (most likely a partnership's units, exchangeable for its shares and held by its minority interests, or another class of its shares). Today's P/E, price / book and enterprise value show \u2014 rather than ones that set that market value against the profit and the equity of fewer shares." + (co.d && co.d.prices && co.d.prices.m && co.d.prices.m.length ? " At the end of each period the Multiples page takes the share price times the common shares alone, checked against the basic shares behind the earnings per share (the shares outstanding where they agree with that count within 5%, else the count itself; none where the period's figures give no such count): its P/E, price / book and enterprise value there are on the common shares." : "")); /* r17: valueRow's capby "px" (r137r, M17-2: BXP, American Homes 4 Rent, TPG; Carvana and Simon Property now told by the price) */
    else if (v.capunits > 0 && v.capby === "pe") out.push("Our P/E for this company stood " + Number(v.capunits).toFixed(2) + "x EODHD's own over the same twelve months (its price over its earnings per share), and the company has minority interests of a tenth of its shareholders' equity or more: EODHD's market value most likely counts the units those minorities hold (a partnership's units, exchangeable for its shares) beside the common shares whose profit and equity our multiples use. Today's P/E, price / book and enterprise value show \u2014 rather than ones that may set a market value of more units against the common shareholders' profit and equity." + (co.d && co.d.prices && co.d.prices.m && co.d.prices.m.length ? " At the end of each period the Multiples page takes the share price times the common shares alone, checked against the basic shares behind the earnings per share (the shares outstanding where they agree with that count within 5%, else the count itself; none where the period's figures give no such count): its P/E, price / book and enterprise value there are on the common shares." : "")); /* r16: valueRow's capby "pe" (r137q, M16-1: Ares, Carvana, Simon Property) */
    else if (v.capunits > 0) out.push("EODHD's market value for this company counts its partnership's exchangeable units beside its common shares (our P/E on the common shareholders' profit stood above EODHD's own by about the ratio of " + (fin(v.pe) ? "the whole profit to theirs" : "the diluted shares, which hold the units, to the basic ones") + ", " + Number(v.capunits).toFixed(2) + "x): " + (fin(v.pe) ? "today's P/E is on the whole profit; today's price / book and enterprise value show \u2014, since the units' share of the equity sits in the minority interests and would be counted beside their market value." : "today's P/E (on a profit that is the common shareholders' alone), price / book and enterprise value show \u2014, since the market value is not on their shares alone and the units' share of the equity sits in the minority interests.") + (co.d && co.d.prices && co.d.prices.m && co.d.prices.m.length ? " At the end of each period the Multiples page takes the share price times the common shares alone (without the units, so its market value is below EODHD's by about their part): its P/E, price / book and enterprise value there are on the common shares, with the units' share of the equity among the minority interests." : "")); /* r16 (SU16-1): the history is on the common shares (ratioRows: sho, else the basic count) */ /* r15: valueRow's capunits (r137p) */
    if (v.notrade) out.push("This listing has not traded since " + date(v.notrade) + " (its prices end there: trading suspended, or delisted): its market value, the multiples (the P/E on the next twelve months' estimates too), the dividend yield and the returns show \u2014 rather than those of that day."); /* r16: valueRow's notrade (r137q) */
    if (v.oldyear) out.push("EODHD's statements for this company have no figures after " + date(v.oldyear) + ": that period is shown as the latest, and the multiples that need a year's profit, sales or cash flow (P/E, P/S, EV/EBITDA, FCF yield) show \u2014 rather than ones from a year long past.");
    if (co.d && co.d.fin && co.d.fin.qWait) out.push("EODHD's quarterly figures for this company are left out for now: before they are used they are checked against the company's own SEC filings for figures in another currency under the same label, and that check needs the exchange rate of the " + co.d.fin.qWait + ", which is not available yet. The years are shown; the quarters come back once they are checked."); /* r26 (SU26-1) */
    if (co.d && co.d.fin && co.d.fin.conv) out.push("Some of EODHD's recent figures for this company went through a currency conversion and back (their digits no longer match the company's own reports, and such figures were found 0.1% to 6% off): those periods show —, and the summary uses the latest period still whole.");
    return out.length ? '<div class="sa-check" role="note">' + out.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>" : "";
  }
  /* withheld amounts: the SEC's own years stay, the EODHD years added after them go */
  function secOnly(D) { if (!D.fin) return D; var x = {}; for (var k in D) x[k] = D[k]; x.fin = null; return x; }
  function withheldMsg() { return '<p class="sa-note">The amounts for this company are withheld: none is shown until the reason given in the note above is cleared.</p>'; } /* r11: the reason is the note's (twelve-month figures, the 20-F or the market value) */
  /* no EV multiple for a bank or an insurer: the function's own rule (statements with interest income or provisions, or an industry of banks or
     insurance: metrics.p.bank). A payments network, an exchange or an asset manager keeps its multiples, as in the list and the ranks */
  /* r6: the function's verdict alone (r137f: metrics.f.fin, a business of other people's money by its profile or its statements; metrics.p.bank, by its
     profile): an industry test only where the function has made no summary (and an insurance broker is not an insurer) */
  /* the market value of the summary (made with each EODHD read; none when its check failed), else the list's until a summary exists */
  function pxPlan(co) { var x = ((co.u.status || {}).px) || {}; return !!(x.plan || /\b403\b/.test(String(x.err || ""))); }
  /* r17 (SU17-2): a listing that no longer trades or whose EODHD record is gone (valueRow's notrade, norecord): EODHD's figures made on its last price
     (the P/E on the next twelve months' estimates, the dividend yield) are not today's either */
  function noPx(co) { var v = ((co.u || {}).metrics || {}).v || {}; return !!(v.notrade || v.norecord); }
  function noDy(o) { var x = {}; for (var k in o) if (k !== "dy") x[k] = o[k]; return x; }
  /* r17 (SU17-4): the day of the last price when it is more than 14 days old (the function's STALE_PX_DAYS, retNow), else null */
  function pxOld(co) { var dl = (co.d && co.d.prices && co.d.prices.d) || [], r = ((co.u || {}).metrics || {}).r || {}, at = dl.length ? dl[dl.length - 1][0] : r.at, t = at ? Date.parse(String(at).slice(0, 10)) : NaN; return isFinite(t) && Date.now() - t > 14 * 864e5 ? String(at).slice(0, 10) : null; }
  function capOf(co) { var v = (co.u.metrics || {}).v; return v && v.cap !== undefined ? v.cap : co.u.cap_usd; }
  function evOff(co) { var m = co.u.metrics || {}, f = m.f || {}, p = m.p || {}, ind = String(co.u.industry || ""); return !!(f.fin || p.bank || (!m.f && !m.p && (/\bbanks?\b|\bmortgage\b|financial conglomerates/i.test(ind) || (/\b(re)?insurance\b/i.test(ind) && !/insurance\s+brokers?/i.test(ind))))); }
  /* r3: today's enterprise value, none for a bank or an insurer (its debt and deposits are its business) nor where no debt is known but the latest statements show interest paid (a debt line the filings did not give): the market value less the cash is not one */
  /* r21 (SU21-3): valueRow's partic (M19-3): today's P/E on the whole profit, the profit to common 3% or more below it, no units (capunits): EODHD's
     market value counts shares beside the common ones behind the EPS that take part in the profit (Watsco's restricted shares, the two-class method) */
  function particOf(m) { var v = (m && m.v) || {}, f = (m && m.f) || {}; return !(v.capunits > 0) && !/^(pe|px)$/.test(String(v.capby || "")) && fin(f.ni) && fin(f.nic) && f.nic > 0 && f.ni / f.nic >= 1.03 && fin(v.pe) && v.pe > 0 && fin(v.cap) && v.cap > 0 && Math.abs(v.pe * f.ni / v.cap - 1) <= 1e-6; }
  function evToday(co) { var v = (co.u.metrics || {}).v || {}; if (evOff(co) || !fin(v.ev)) return null; if (v.debt_usd == null) { var st = stmts(co.d || {}), set = st.Q || st.A, r = set && set.rows[set.rows.length - 1]; if (r && r.d && r.d.intexp > 0) return null; } return v.ev; }
  var RANK_LABEL = { cap: "Size", g_rev: "Sales growth", g_eps: "EPS growth", gm: "Gross margin", om: "Operating margin", nm: "Net margin", roe: "Return on equity", roic: "Return on capital", pe: "P/E (cheaper higher)", ps: "P/S (cheaper higher)", pb: "P/B (cheaper higher)", ev_ebitda: "EV/EBITDA (cheaper higher)", fcf_y: "Free cash flow yield", dy: "Dividend yield", de: "Debt/equity (less higher)", r1y: "1-year return", r3m: "3-month return" };
  function header(co) {
    var u = co.u, D = co.d, P = D.profile || {}, m = u.metrics || {}, r = m.r || {}, dl = (D.prices && D.prices.d) || [];
    var last = dl[dl.length - 1], prev = dl[dl.length - 2], lc = P.ccy || u.currency;
    var splitDay = last && prev && last[1] > 0 && prev[1] > 0 && last[2] > 0 && prev[2] > 0 && Math.abs(Math.log((last[2] / last[1]) / (prev[2] / prev[1]))) > 0.2;
    var chg = last && prev ? (!splitDay && last[2] > 0 && prev[2] > 0 ? last[2] / prev[2] - 1 : prev[1] > 0 ? last[1] / prev[1] - 1 : null) : null; /* a dividend is not a move of the price */
    var hist = (D.earnings && D.earnings.hist) || [], today = new Date().toISOString().slice(0, 10);
    var next = hist.filter(function (h) { return h[4] == null && h[1] && h[1] >= today; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1])); })[0];
    var bits = [u.id, P.exchange || null, u.country, [u.sector, u.industry].filter(Boolean).join(" · ") || null].filter(Boolean);
    return '<div class="sa-hd"><div class="id"><h1>' + esc(u.name || P.name || u.id) + '</h1><div class="meta">' + bits.map(esc).join(" · ") + (u.adr && !(u.status && u.status.res && u.status.res.uo) ? " · US line " + esc(String(u.adr).replace(/\.US$/, "")) : "") + "</div></div>" +
      '<div class="quote">' + (last ? "<b>" + esc(px(last[2] != null ? last[2] : last[1], lc)) + '</b><span class="chg ' + cls(chg) + '">' + pctS(chg, 2) + " on " + esc(date(last[0])) + "</span>" : "") +
      '<span class="chg muted">Market value ' + esc(big(capOf(co))) + (u.rank && fin(capOf(co)) ? " · #" + u.rank + " in the world" : "") /* r27 (SU27-4): a rank by market value only beside one */ + "</span>" + (next ? '<span class="chg muted">Next results ' + esc(date(next[1])) + (next[2] ? " · " + esc(whenOf(next[2])) : "") + "</span>" : "") + "</div></div>";
  }
  /* r8: twelve months that ended more than 200 days ago (a later quarter or half not read, or taken away as unreliable: Komatsu's and SoftBank's
     twelve months to September 2025 in October 2026, Glencore's to June 2025, Macquarie's to March 2024) are not "the last 12 months": their end is named */
  function ttOld(f) { return !!(f && f.ttm === true && f.end && Date.now() - Date.parse(f.end) > 200 * 864e5); }
  function peLabel(f) { return f && f.ttm === false && f.end ? "P/E, year to " + mLong(f.end) : ttOld(f) ? "P/E, 12 months to " + mLong(f.end) : "P/E, last 12 months"; }
  /* r5: a twelve-month summary takes a line its twelve months lack from the latest year, within 400 days (finSummary's pickT, both, endOf): gross and operating
     margin, EBITDA, free cash flow and return on capital can be the year's beside a revenue of twelve months (Midea's free cash flow yield, its 2025's beside
     twelve months to June 2026). The label then names the year: { gm, om, ebitda, fcf, roic: that year's end } */
  /* r8: and every figure of old twelve months names their end ("t:" + the end, read by yrLabel) */
  function yearFigs(co) { var f = (co.u.metrics || {}).f || {}, out = yearFigs0(co);
    if (ttOld(f)) ["gm", "om", "ebitda", "fcf", "roic", "po", "yr"].forEach(function (k) { if (!out[k]) out[k] = "t:" + f.end; });
    return out; }
  function yearFigs0(co) {
    var f = (co.u.metrics || {}).f || {}, out = {};
    /* r7: a summary by year (no twelve months: f.ttm false) is that year's in every figure, as its P/E, revenue and net income say: the figures labelled
       here, and the others' labels (yr), name it too (512 of 1,766 companies: Galaxy Entertainment's margins and returns are its 2024's, Hong Kong
       Exchanges' its 2025's) */
    if (f.ttm === false && f.end) return { gm: f.end, om: f.end, ebitda: f.end, fcf: f.end, roic: f.end, po: f.end, yr: f.end };
    if (f.ttm !== true || !f.end) return out;
    var st = stmts(co.d), A = st.A, tEnd = Date.parse(f.end), t = st.Q ? periods(st.Q, "t", A, halfQ(st, co.d)).filter(function (r) { return Math.abs(Date.parse(r.end) - tEnd) <= 5 * 864e5; })[0] : null;
    var hv = !t && st.Q && st.Q.src === "eodhd" && co.d.fin && co.d.fin.halves; /* two halves (fin.halves, read back in place as the function does) */
    if (hv && hv.length) { var H = {}; hv.forEach(function (h) { if (h && h.end) H[h.end] = h.d || {}; });
      var qs = st.Q.rows.map(function (q) { var x = {}, k; for (k in q.d) x[k] = q.d[k]; if (H[q.end]) for (k in H[q.end]) x[k] = H[q.end][k]; return { end: q.end, d: x }; }).filter(function (q) { return fin(q.d.rev) || fin(q.d.ni); });
      var h2 = qs[qs.length - 1], h1 = qs[qs.length - 2], gd = h1 && h2 ? (Date.parse(h2.end) - Date.parse(h1.end)) / 864e5 : 0;
      if (h2 && Math.abs(Date.parse(h2.end) - tEnd) <= 5 * 864e5 && gd >= 165 && gd <= 200) { var hd = {}; Object.keys(h2.d).forEach(function (k) { if (fin(h1.d[k]) && fin(h2.d[k])) hd[k] = h1.d[k] + h2.d[k]; }); t = { end: h2.end, d: hd }; } }
    var ya = A && (!st.Q || A.cur === st.Q.cur) ? A.rows.filter(function (r) { return r.d && (fin(r.d.rev) || fin(r.d.ni)) && Date.parse(r.end) <= tEnd + 5 * 864e5; }).pop() : null;
    if (!ya || Math.abs(tEnd - Date.parse(ya.end)) <= 5 * 864e5 || tEnd - Date.parse(ya.end) > 400 * 864e5) return out;
    /* r6: the figure itself says whose it is: the function's figure that is the year's to the unit, and not the twelve months' the page works out, is the
       year's. The lines alone do not tell: the function also leaves out a line whose quarters or halves do not add up to their year (finSummary's addsUp:
       British American Tobacco's gross profit, operating cash flow and depreciation by halves, Swire's operating profit), and reads halves that are still
       among the quarters (MICC). Return on capital is of the operating income's period: the year's where the twelve months have none (its f.opinc) */
    var near = function (a, b) { return fin(a) && fin(b) && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)); };
    var fig = { gm: function (r) { return fin(r.d.gp) && r.d.rev > 0 ? r.d.gp / r.d.rev : null; }, om: function (r) { return fin(r.d.opinc) && r.d.rev > 0 ? r.d.opinc / r.d.rev : null; },
      ebitda: function (r) { return fin(r.d.opinc) && fin(r.d.da) ? r.d.opinc + r.d.da : null; }, fcf: function (r) { return fcfOfD(r.d); },
      po: function (r) { return fin(r.d.divp) && r.d.divp >= 0 && r.d.ni > 0 ? r.d.divp / r.d.ni : null; } }; /* r6: the payout ratio too (finSummary's po: both("divp", "ni")) */
    Object.keys(fig).forEach(function (k) { if (near(f[k], fig[k](ya)) && !(t && near(f[k], fig[k](t)))) out[k] = ya.end; });
    /* r18: the function names the payout ratio's period itself (finSummary's poA, r137s: the common shareholders' dividends over their profit where
       something comes before them, no longer the year's dividends paid over its net income to recognise): the year's end, or null for the twelve months */
    if (f.poA !== undefined && fin(f.po)) { if (f.poA) out.po = f.poA; else delete out.po; }
    if (fin(f.roic) && (out.om || (f.opinc === null && fin(ya.d.opinc)))) out.roic = ya.end;
    return out;
  }
  function yrLabel(name, end) { return !end ? name : String(end).slice(0, 2) === "t:" ? name + ", 12 months to " + mLong(String(end).slice(2)) : name + ", year to " + mLong(end); }
  /* the last 52 weeks' lowest and highest close as traded; none when a split falls inside them (the adjusted closes are used then) */
  function range52(D) { var all = (D.prices && D.prices.d) || [], y1 = all.length ? Date.parse(all[all.length - 1][0]) - 365 * 864e5 : 0, d = all.filter(function (x) { return Date.parse(x[0]) > y1; }), lo = Infinity, hi = -Infinity, k0 = null; /* r17: the rows of the year to the last price (r137r) */
    for (var i = 0; i < d.length; i++) { var x = d[i]; if (!(x[1] > 0 && x[2] > 0)) continue; var k = x[2] / x[1]; if (k0 != null && Math.abs(Math.log(k / k0)) > 0.2) return null; k0 = k; lo = Math.min(lo, x[2]); hi = Math.max(hi, x[2]); }
    return d.length >= 200 && isFinite(lo) ? [lo, hi] : null; }
  /* EODHD's "AfterMarket" / "BeforeMarket" in words */
  function whenOf(w) { return ({ AfterMarket: "after the close", BeforeMarket: "before the open" })[w] || (w ? String(w) : ""); }
  function grid(items) { return '<div class="sa-grid">' + items.filter(function (x) { return x; }).map(function (x) { return "<div><span>" + esc(x[0]) + "</span><b>" + x[1] + "</b></div>"; }).join("") + "</div>"; }
  function vSummary(co) {
    var u = co.u, D = co.d, P = D.profile || {}, m = u.metrics || {}, v = m.v || {}, f = m.f || {}, p = m.p || {}, r = m.r || {}, finCo = evOff(co);
    var yf = yearFigs(co), evT = evToday(co), g = grid([["Market value", esc(big(capOf(co)))], ["Enterprise value", esc(big(evT))], [peLabel(f), esc(mult(v.pe))], ["P/E, next 12 months", esc(mult(noPx(co) ? null : p.fpe))], [yrLabel("EV / EBITDA", yf.ebitda), esc(mult(evT == null ? null : v.ev_ebitda))], [yrLabel("Price / sales", yf.yr), esc(mult(v.ps))], ["Price / book", esc(mult(v.pb))], [yrLabel("Free cash flow yield", yf.fcf), esc(pct(v.fcf_y))], ["Dividend yield", esc(pctA(noPx(co) ? null : p.dy)) /* r25 (SU25-1): SU24-8's second part */],
      [f.ttm === false && f.end ? "Revenue, year to " + mLong(f.end) : (ttOld(f) ? "Revenue, 12 months to " + mLong(f.end) : "Revenue, 12 months"), esc(big(v.rev_usd))], [f.ttm === false && f.end ? "Net income, year to " + mLong(f.end) : (ttOld(f) ? "Net income, 12 months to " + mLong(f.end) : "Net income, 12 months"), esc(big(v.ni_usd))], [yrLabel("Sales growth", yf.yr), '<span class="' + cls(f.g_rev) + '">' + esc(pctS(f.g_rev)) + "</span>"], [yrLabel("Gross margin", yf.gm), esc(pct(f.gm))], [yrLabel("Operating margin", yf.om), esc(pct(f.om))], [yrLabel("Net margin", yf.yr), esc(pct(f.nm))], [yrLabel("Return on equity", yf.yr), esc(pct(f.roe))], [yrLabel("Return on capital", yf.roic), esc(pct(f.roic))], ["Debt / equity", esc(fin(f.de) && !(f.nodebt && finCo) ? f.de.toFixed(2) + "x" : DASH)],
      ["1 year", '<span class="' + cls(r.r1y) + '">' + esc(pctS(r.r1y)) + "</span>"], ["Since 1 January", '<span class="' + cls(r.ytd) + '">' + esc(pctS(r.ytd)) + "</span>"], ["5 years", '<span class="' + cls(r.r5y) + '">' + esc(pctS(r.r5y, 0)) + "</span>"], [pxOld(co) ? "52 weeks to " + date(pxOld(co)) : "52-week range", (function () { var T = pxOld(co) ? {} : P.tech || {}, rg = range52(D), lo = rg ? rg[0] : fin(r.lo52) ? r.lo52 : fin(T["52WeekLow"]) ? T["52WeekLow"] : null, hi = rg ? rg[1] : fin(r.hi52) ? r.hi52 : fin(T["52WeekHigh"]) ? T["52WeekHigh"] : null; return esc(fin(lo) && fin(hi) ? px(lo, P.ccy) + " – " + px(hi, P.ccy) : DASH); })()], ["Beta", esc(fin(p.beta) ? p.beta.toFixed(2) : DASH)], ["Analysts' target", p.analysts > 0 ? esc(px(p.target, P.ccy)) + " <small>" + p.analysts + " analysts</small>" : DASH]]);
    var pr = noPx(co) ? noDy(m.pr || {}) : m.pr || {}, ps = noPx(co) ? noDy(m.ps || {}) : m.ps || {}; /* r17 (SU17-2) */
    var ranks = Object.keys(RANK_LABEL).filter(function (k) { return fin(pr[k]) && !(finCo && k === "ev_ebitda"); }).map(function (k) { return "<span>" + esc(RANK_LABEL[k]) + '</span><i><b style="width:' + pr[k] + '%"></b>' + (fin(ps[k]) ? '<em style="left:' + ps[k] + '%" title="In its sector: ' + ps[k] + '"></em>' : "") + '</i><span class="n">' + pr[k] + '</span><span class="n">' + (fin(ps[k]) ? ps[k] : DASH) + "</span>"; }).join("");
    var st = stmts(D), Q = st.Q, byYear = (f.qbad && (!Q || Q.src === "eodhd")) || (!Q && !!(D.fin && D.fin.qWait)) /* r26 (SU26-1): the years while EODHD's quarters wait */, set = byYear ? st.A : Q, hqS = !byYear && Q ? halfQ(st, D) : {}, qR = !byYear && Q ? twinCut(Q.rows, "is", hqS).slice(-12) : []; /* r27 (SU27-1, SU27-2): one bar a period, no half year as a quarter */
    var yN = st.A ? st.A.rows.slice(-10).filter(function (r) { return r.d && (fin(r.d.rev) || fin(r.d.ni)); }).length : 0, qHas = function (k) { var n = qR.filter(function (q) { return !hqS[q.end] && fin(q.d[k]); }).length; return n >= 4 || n >= yN; }; /* r28 (SU28-3): four quarters at least to draw (a year's), or more than the years have: not one bar among eleven empty months (BT's, DSM-Firmenich's, Unilever's, AXA's) */
    if (!byYear && st.A && st.A.rows.length && !qHas("rev") && (!qHas("ni") || st.A.rows.some(function (r) { return r.d && fin(r.d.rev); }))) { byYear = true; set = st.A; } /* r27 (SU27-3): quarters with no revenue to draw (halves moved to fin.halves or not quarters, balance sheets only, none) beside years that have it, or with nothing to draw: the years, not no chart or a few net incomes (a bank's quarters, without revenue as its years, stay) */
    var qs = byYear ? (set ? set.rows.slice(-10) : []) : qR;
    /* withheld amounts are not drawn either; quarters that do not add up to the year: the years instead */
    var noRate = !!(set && qs.length && S.cur === "usd" && set.cur && String(set.cur).toUpperCase() !== "USD" && fxRate(set.cur, null, qs[qs.length - 1].end) == null); S.local = noRate; /* no dollar rate: the reported currency, said so */
    try { var revChart = f.withheld && (!set || set.src === "eodhd") ? "" : bars(qs.map(function (q) { return { l: byYear ? "FY" + String(q.fyl || q.end.slice(0, 4)).slice(2) : mShort(q.end), a: !byYear && hqS[q.end] ? null : conv(q.d.rev, q, set, "f", byYear ? "a" : "q"), b: !byYear && hqS[q.end] ? null : conv(q.d.ni, q, set, "f", byYear ? "a" : "q") /* r28 (SU28-3): the quarters' marks, not the years' */ }; }), { label: "Revenue and net income by " + (byYear ? "year" : "quarter") }); } finally { S.local = false; }
    var hist = (D.earnings && D.earnings.hist) || [];
    return g + '<div class="sa-cols"><div>' +
      (revChart ? '<section class="sa-sec"><h3>Revenue and net income</h3><p class="sub">By ' + (byYear ? "year" : "quarter") + ", " + (S.cur === "usd" && !noRate ? "US dollars" : esc(set && set.cur || "")) + " · wide bar revenue, narrow bar net income</p>" + revChart + "</section>" : "") +
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
    var web = webUrl(P.web) || webUrl(F.web);
    return [["Headquarters", P.addr || F.addr], ["Employees", fin(P.employees) ? fmtNum(P.employees) : null], ["Chief executive", A && /chief executive|ceo/i.test(String(A[1])) ? A[0] : null], ["Website", web ? { h: '<a href="' + esc(web) + '" target="_blank" rel="noopener">' + esc(String(web).replace(/^https?:\/\//, "")) + "</a>" } : null], ["Listed since", P.ipo ? date(P.ipo) : null], ["Fiscal year ends", P.fye || fyeSec], ["ISIN", P.isin], ["SEC CIK", u.cik ? { h: '<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + esc(u.cik) + '" target="_blank" rel="noopener">' + esc(String(u.cik).replace(/^0+/, "")) + "</a>" } : null], ["Industry (GICS)", P.gics && [P.gics.sector, P.gics.industry, P.gics.sub].filter(Boolean).join(" \u203a ")], ["Industry (SEC code)", !P.gics && F.sicd ? F.sicd + (F.sic ? " (" + F.sic + ")" : "") : null], ["Incorporated in", F.inc]].filter(function (x) { return x[1]; });
  }
  function kvHtml(kv) { return kv.map(function (x) { return "<span>" + esc(x[0]) + "</span><b>" + (x[1] && x[1].h ? x[1].h : esc(x[1])) + "</b>"; }).join(""); }
  /* a company's website from EODHD or the SEC: http(s) only (a "javascript:" address would run in the member's session), a bare domain made https */
  function webUrl(u) { var s = String(u == null ? "" : u).trim(); if (!s) return null; if (/^https?:\/\//i.test(s)) return s; if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null; return "https://" + s.replace(/^\/+/, ""); }
  function vDescription(co) {
    var P = co.d.profile || {}, kv = facts(co), off = (P.officers || []).filter(function (o) { return o && o[0]; });
    return '<div class="sa-cols"><div><section class="sa-sec"><h3>The business</h3>' + (P.desc ? "<p>" + esc(P.desc) + "</p>" : '<p class="muted">No description yet.</p>') + "</section></div><div>" +
      (kv.length ? '<section class="sa-sec"><h3>The company</h3><div class="sa-kv">' + kvHtml(kv) + "</div></section>" : "") +
      (off.length ? '<section class="sa-sec"><h3>Officers</h3><div class="sa-kv">' + off.map(function (o) { return "<span>" + esc(o[1] || "") + "</span><b>" + esc(o[0]) + (o[2] ? ' <small class="muted">born ' + esc(o[2]) + "</small>" : "") + "</b>"; }).join("") + "</div></section>" : "") + "</div></div>";
  }
  function vRank(co) {
    var m = co.u.metrics || {}, pr = noPx(co) ? noDy(m.pr || {}) : m.pr || {}, ps = noPx(co) ? noDy(m.ps || {}) : m.ps || {}, v = m.v || {}, f = m.f || {}, p = m.p || {}, r = m.r || {}, finCo = evOff(co);
    var val = { cap: big(capOf(co)), g_rev: pctS(f.g_rev), g_eps: pctS(f.g_eps), gm: pct(f.gm), om: pct(f.om), nm: pct(f.nm), roe: pct(f.roe), roic: pct(f.roic), pe: mult(v.pe), ps: mult(v.ps), pb: mult(v.pb), ev_ebitda: mult(v.ev_ebitda), fcf_y: pct(v.fcf_y), dy: pctA(noPx(co) ? null : p.dy) /* r24 (SU24-8) */, de: fin(f.de) && !(f.nodebt && finCo) ? f.de.toFixed(2) + "x" : DASH, r1y: pctS(r.r1y), r3m: pctS(r.r3m) };
    var keys = Object.keys(RANK_LABEL).filter(function (k) { return !(finCo && k === "ev_ebitda"); }); if (!keys.some(function (k) { return fin(pr[k]); })) return '<p class="muted">Ranked once a day; not yet for this company.</p>';
    var yf = yearFigs(co), yk = { gm: yf.gm, om: yf.om, roic: yf.roic, ev_ebitda: yf.ebitda, fcf_y: yf.fcf, g_rev: yf.yr, g_eps: yf.yr, nm: yf.yr, roe: yf.yr, pe: yf.yr, ps: yf.yr };
    var rows = keys.map(function (k) { return "<tr><th scope=\"row\">" + esc(RANK_LABEL[k]) + (yk[k] ? '<br><small class="muted">' + esc(yrLabel("", yk[k]).slice(2)) + "</small>" : "") /* r8: the period on its own line (at 375 px the year labels pushed every value off the screen) */ + '</th><td class="num">' + esc(val[k] || DASH) + '</td><td class="bar">' + (fin(pr[k]) ? '<i><b style="width:' + pr[k] + '%"></b>' + (fin(ps[k]) ? '<em style="left:' + ps[k] + '%"></em>' : "") + "</i>" : "") + '</td><td class="num">' + (fin(pr[k]) ? pr[k] : DASH) + '</td><td class="num">' + (fin(ps[k]) ? ps[k] : DASH) + "</td></tr>"; }).join("");
    return '<div class="sa-wrap"><table class="pt sa-tbl sa-pr"><thead><tr><th>Measure</th><th class="num">This company</th><th>Percentile</th><th class="num">All companies</th><th class="num">' + esc(co.u.sector || "Sector") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="sa-note">Percentile among every company of $10B and more in the list (bar) and in its sector (mark): 100 is the best; for price multiples and debt, the lowest is the best. Ranked once a day' + (m.ranked_at ? ", last on " + esc(date(String(m.ranked_at).slice(0, 10))) : "") + ".</p>";
  }
  function chips(id, opts, on) { return '<div class="chips sm" id="' + id + '">' + opts.map(function (o) { return '<button type="button" data-v="' + esc(o[0]) + '" class="' + (o[0] === on ? "on" : "") + '" aria-pressed="' + (o[0] === on) + '">' + esc(o[1]) + "</button>"; }).join("") + "</div>"; }
  /* the period chips: years always; quarters and twelve months only where EODHD's quarters add up to its years */
  function perOpts(co, withQ, which, groups) { var f = (co.u.metrics || {}).f || {}, st = stmts(co.d), bad = f.qbad && (!st.Q || st.Q.src === "eodhd"), noT = !(st.Q && periods(st.Q, "t", st.A, halfQ(st, co.d)).length); if (!withQ && noT) bad = true; /* r4: no twelve months to show (a company that reports by half-year): the years */
    /* r5: the statements too: no "Last 12 months" chip that opens on "No quarterly figures.", nor "Quarters" on an income or cash flow statement whose quarters hold none of its lines (a half-year reporter's flows are its halves) */
    var noQ = which && which !== "bs" && !(st.Q && st.Q.rows.some(function (r) { return LINES[which].some(function (l) { return typeof l[1] === "string" && l[0] !== "hd" && fin(r.d[l[1]]); }); }));
    /* r6: nor any chip whose own table is empty ("No figures for these lines."): the Growth page's twelve months where none has the twelve months a year
       before it (215 of 1,770 companies; the page opens on that chip once a member has picked quarters or twelve months elsewhere), twelve months of
       quarters whose flows are their halves' (Daifuku, Associated British Foods, Bolloré), a quarter's balance sheet without one of its lines (YPF) */
    var empty = function (per) { try { return which ? !/<table/.test(finTable(f.withheld ? secOnly(co.d) : co.d, which, per, co.u.metrics)) : groups ? !/<table/.test(ratioTable(co, per, groups, {})) : false; } catch (e) { return false; } };
    if (!bad && !noT && empty("t")) noT = true; if (withQ && !bad && !noQ && empty("q")) noQ = true;
    return bad ? [["a", "Years"]] : withQ ? [["a", "Years"]].concat(noQ ? [] : [["q", "Quarters"]], noT ? [] : [["t", "Last 12 months"]]) : noT ? [["a", "Years"]] : [["a", "Years"], ["t", "Last 12 months"]]; }
  function perNow(opts, want) { return opts.some(function (o) { return o[0] === want; }) ? want : "a"; }
  function vStmt(co, which) {
    var f = (co.u.metrics || {}).f || {}, st = stmts(co.d), opts = perOpts(co, true, which), per = perNow(opts, S.per), set = per === "a" ? st.A : st.Q, rc = (set && set.cur) || (st.A && st.A.cur) || (st.Q && st.Q.cur) || ""; /* r23 (SU23-5): the currency of the set shown (Genmab: years in DKK, quarters in USD) */
    var bar = '<div class="sa-bar">' + chips("sa-per", opts, per) + (rc && rc !== "USD" ? chips("sa-cur", [["usd", "US dollars"], ["rep", rc]], S.cur) : "") + "</div>";
    if (f.withheld && set && set.src === "eodhd") return bar + withheldMsg();
    return bar + finTable(f.withheld ? secOnly(co.d) : co.d, which, per, co.u.metrics);
  }
  /* the main figures year by year, as Koyfin's Highlights */
  function vHighlights(co) {
    var f = (co.u.metrics || {}).f || {}, st = stmts(co.d), A = st.A; if (!A || !A.rows.length) return '<p class="muted">' + (st.Q && st.Q.rows.length ? "No yearly figures for this company: its quarters are on the Income statement, Balance sheet and Cash flow pages." : "No statements yet for this company.") + "</p>"; /* r39 (SU39-3) */
    if (f.withheld && A.src === "eodhd") return withheldMsg();
    if (f.withheld) A = stmts(secOnly(co.d)).A || A;
    var rows = A.rows.slice(-10), lastEnd = rows[rows.length - 1].end, noRate = S.cur === "usd" && A.cur && String(A.cur).toUpperCase() !== "USD" && fxRate(A.cur, null, lastEnd) == null;
    var rc = A.cur || ""; S.local = noRate || S.cur !== "usd";
    try {
      var ebitdaOf = function (d) { return fin(d.opinc) && fin(d.da) ? d.opinc + d.da : (fin(d.ebitda) ? d.ebitda : null); }, fcfOf = function (d) { return fcfOfD(d); };
      var raw = function (r, k) { return typeof k === "function" ? k(r.d) : r.d[k]; };
      var L = [["Revenue", "rev", "m", "sum"], ["Growth", "rev", "g"], ["Gross profit", "gp", "m", "sum"], ["Gross margin", "gp", "mg"], ["Operating income", "opinc", "m", "sum"], ["Operating margin", "opinc", "mg"], ["EBITDA", ebitdaOf, "m"], ["Net income", "ni", "m", "sum"], ["Net margin", "ni", "mg"], ["Growth", "ni", "g"], ["EPS, diluted", "epsd", "e"], ["Growth", "epsd", "g"], ["Operating cash flow", "cfo", "m", "sum"], ["Free cash flow", fcfOf, "m", "sum"], ["Free cash flow margin", fcfOf, "mg"], ["Dividend per share", "dps", "e"]];
      var maxAbs = 0; rows.forEach(function (r) { var v = conv(r.d.rev, r, A, "f", "a"); if (fin(v)) maxAbs = Math.max(maxAbs, Math.abs(v)); });
      var unit = maxAbs >= 5e10 ? 1e9 : 1e6, body = "";
      var finCo = evOff(co); /* r8: no gross, operating or free cash flow margin for a company the function counts as financial (an investment company:
         Investor AB's 98% gross margin made of the change in value of its holdings, its interest paid as its cost of revenue), as on the overview and the Margins page */
      L.forEach(function (ln) { if (finCo && ln[2] === "mg" && ln[1] !== "ni") return;
        var vals = rows.map(function (r, i) { var v = raw(r, ln[1]), p = i ? raw(rows[i - 1], ln[1]) : null;
          if (ln[2] === "m") return conv(v, r, A, "f", "a");
          if (ln[2] === "e") return fin(v) ? v : null;
          if (ln[2] === "mg") return fin(v) && r.d.rev > 0 && v / r.d.rev <= 1 && v / r.d.rev >= -10 ? v / r.d.rev : null;
          return fin(v) && fin(p) && p > 0 && i && (Date.parse(r.end) - Date.parse(rows[i - 1].end)) / 864e5 < 380 ? v / p - 1 : null; /* growth: the reported currency, a year apart */ });
        if (!vals.some(fin)) return;
        body += '<tr class="' + (ln[3] || (ln[2] === "g" || ln[2] === "mg" ? "sub" : "")) + '"><th scope="row">' + esc(ln[0]) + "</th>" + vals.map(function (v) { return '<td class="num ' + (ln[2] === "g" ? cls(v) : "") + '">' + (ln[2] === "m" ? (fin(v) ? fmtMoney(v, unit) : DASH) : ln[2] === "e" ? (fin(v) ? neg(psNum(v), v) /* r24 (SU24-3) */ : DASH) : ln[2] === "g" ? pctS(v) : pct(v)) + "</td>"; }).join("") + "</tr>";
      });
      if (!body) return '<p class="muted">No figures on these lines.</p>';
      var ccyName = S.cur === "usd" && !noRate ? "US dollars" : (rc || "reported currency");
      var head = "<tr><th>" + esc(ccyName + ", " + (unit === 1e9 ? "billions" : "millions")) + "</th>" + rows.map(function (r) { return '<th class="num">' + esc(colLabel(r, "a")) + '<br><small class="muted">' + esc(mShort(r.end)) + "</small></th>"; }).join("") + "</tr>";
      return '<div class="sa-bar">' + (rc && rc !== "USD" ? chips("sa-cur", [["usd", "US dollars"], ["rep", rc]], S.cur) : "") + "</div>" + '<div class="sa-wrap"><table class="pt sa-tbl sa-fin"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>" +
        '<p class="sa-note">The last ten fiscal years, from ' + (A.src === "sec" ? "the company's filings at the SEC" + (function (n) { return n ? " (the last " + (n > 1 ? n + " years" : "year") + " from EODHD: the SEC's data does not have " + (n > 1 ? "them" : "it") + " yet)" : ""; })(rows.filter(function (r) { return r.src === "eodhd"; }).length) /* r23 (SU23-3): EODHD's later years (stmts' A.added), as the statements' note */ : "EODHD's records of the company's reports") + ". Growth in the reported currency; margins over revenue" + (finCo ? " (the net margin alone for a bank, an insurer and the other financial and investment companies named on the Enterprise value page)" : "") + ". Per-share figures in " + esc(rc || "the reported currency") + "." + (noRate ? " No dollar rate for " + esc(rc) + " yet: amounts in " + esc(rc) + "." : "") + "</p>";
    } finally { S.local = false; }
  }
  function vRatioPage(co, groups, text) { var opts = perOpts(co, false, null, groups), per = perNow(opts, S.per === "a" ? "a" : "t"); return '<div class="sa-bar">' + chips("sa-per", opts, per) + "</div>" + ratioTable(co, per, groups, { text: text }); }
  function vMultiples(co) {
    var m = co.u.metrics || {}, v = m.v || {}, p = m.p || {}, f = m.f || {}, finCo = evOff(co), opts = perOpts(co, false, null, ["Valuation at the period's end (US dollars)"]), per = perNow(opts, S.per === "a" ? "a" : "t"), hasPx = co.d.prices && co.d.prices.m && co.d.prices.m.length;
    var yf = yearFigs(co), evT = evToday(co), g = grid([["Market value", esc(big(capOf(co)))], ["Enterprise value", esc(big(evT))], [peLabel(f), esc(mult(v.pe))], ["P/E, next 12 months", esc(mult(noPx(co) ? null : p.fpe))], [yrLabel("Price / sales", yf.yr), esc(mult(v.ps))], ["Price / book", esc(mult(v.pb))], [yrLabel("EV / EBITDA", yf.ebitda), esc(mult(evT == null ? null : v.ev_ebitda))], [yrLabel("EV / sales", yf.yr), esc(mult(evT == null ? null : v.ev_sales))], [yrLabel("Free cash flow yield", yf.fcf), esc(pct(v.fcf_y))], ["Dividend yield", esc(pctA(noPx(co) ? null : p.dy)) /* r25 (SU25-1): SU24-8's second part */]]);
    return '<h3 class="sa-h">Today</h3>' + g + '<h3 class="sa-h">At the end of each period</h3>' + (hasPx ? '<div class="sa-bar">' + chips("sa-per", opts, per) + "</div>" + ratioTable(co, per, ["Valuation at the period's end (US dollars)"], { none: f.withheld ? "The amounts for this company are withheld (see the note above), so no multiple of them is shown." : v.capby === "pe" || v.capby === "px" ? "These periods' figures give no count of the common shares alone that can be checked (the basic shares behind the earnings per share, within a third of the diluted ones; where the diluted count holds the units, it is far above them), and the shares outstanding in the filings may count the voting shares that go with the units too (see the note above): no market value or multiple is shown for them." : null, /* r17 (SU17-1) */ text: "The share price at the end of the month each period closed, times the shares then outstanding (both on today's basis after a stock split), against that period's figures." + (v.capunits > 0 ? (v.capby === "pe" || v.capby === "px" ? " For this company those are its common shares alone, checked against the basic shares behind its earnings per share (the shares outstanding in its filings may count the voting shares that go with the units too: they are taken only within 5% of that count, else the count itself, and none where a period's figures give no count that can be checked), while EODHD's market value above most likely counts more than those, a partnership's units or another class of shares (see the note above): the two market values may not be on one basis." : " For this company those are its common shares alone, without the partnership's exchangeable units that EODHD's market value above counts (see the note above): the two market values are not on one basis.") : "") /* r16 (SU16-1) */ + (particOf(m) ? " For this company EODHD's market value above counts shares that take part in its profit and dividends beside the common shares behind its earnings per share (restricted shares: the two-class method). Where a period's filings give no count of all its shares (only of those common shares), its market value and the multiples made from it show \u2014, while its P/E (the price over the earnings per share) and dividend yield need no count of shares." : "") /* r21 (SU21-3) */ + " A multiple on a loss, or one we cannot check, shows —." }) :
      '<p class="muted">The history needs the share price at the end of each period' + (pxPlan(co) ? ", and EODHD\'s plan does not include prices (it answers 403)." : ", and the prices are not read yet.") + ' Today\'s multiples above use EODHD\'s market value, ' + (f.ttm === false && f.end ? "the figures of the year to " + esc(mLong(f.end)) : ttOld(f) ? "the figures of the twelve months to " + esc(mLong(f.end)) : "the latest twelve months\' figures") + ' and today\'s exchange rates.</p>');
  }
  /* r9: the latest balance sheet's debt is one the function reads as on another scale or below zero (finSummary's debtWild on its bsRow, r137h: Novonesis's
     December 2025, a short-term debt of 12,710 beside liabilities of 5,494): that, not a missing line, is why no enterprise value is shown */
  function bsLatest(co) { var D = co.d || {}, f = (co.u.metrics || {}).f || {}; if (!f.bs_end) return null; /* r14: the latest balance sheet as finSummary reads it (bsWild's, r9) */ var st = stmts(D), fr = fnRec(D, st.A);
    var nF = function (x) { return ["eq", "ta", "cash", "debtc", "debtl", "debtt"].filter(function (k) { return fin(x.d[k]); }).length; };
    var r = (fr.q && st.Q && st.Q.src === fr.from ? st.Q.rows : []).concat(st.A && (!fr.q || !st.Q || st.A.cur === st.Q.cur) ? st.A.rows : []).filter(function (x) { return x && x.d && x.end === f.bs_end && (fin(x.d.ta) || (fin(x.d.eq) && (fin(x.d.cash) || fin(x.d.tl)))) && !shellBS(x.d); }).sort(function (a, b) { return nF(b) - nF(a); })[0];
    return r || null; }
  function bsWild(co) { var r = bsLatest(co); return !!(r && debtWild(r.d)); }
  function vEV(co) {
    var m = co.u.metrics || {}, v = m.v || {}, f = m.f || {}, cap = capOf(co);
    var rows = [["Market value", cap, "sum"], ["Plus debt", f.nodebt && evOff(co) ? null : v.debt_usd == null && f.nodebt && (fin(v.ev) || f.ncigap > 0 || f.xgap > 0) ? 0 : v.debt_usd, "sub"], ["Plus minority interests", v.nci_usd, "sub"], ["Less cash and short-term investments", v.cash_usd, "sub"], ["Enterprise value", evToday(co), "sum"]];
    if (fin(v.pref_usd) && v.pref_usd > 0) rows.splice(2, 0, ["Plus preferred stock", v.pref_usd, "sub"]); /* r4: preferred stock is part of the enterprise value (the function adds it) */
    if (fin(v.xcl_usd) && v.xcl_usd > 0) rows.splice(rows.length - 2, 0, ["Plus redeemable stock and other minority claims", v.xcl_usd, "sub"]); /* r14: the claims between the liabilities and the shareholders' equity beside the minorities line (valueRow's xcl, r137o) */
    var fins = evOff(co);
    var tbl = '<div class="sa-wrap" style="max-width:640px"><table class="pt sa-tbl sa-fin"><thead><tr><th>US dollars, today</th><th class="num">Value</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr class="' + r[2] + '"><th scope="row">' + esc(r[0]) + '</th><td class="num">' + esc(big(r[1])) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    return tbl + '<p class="sa-note">EODHD\'s market value, plus the debt, any preferred stock' + (fin(v.xcl_usd) && v.xcl_usd > 0 ? ", the minority interests and the redeemable stock and other claims between the liabilities and the shareholders' equity" : " and the minority interests") + ' on the latest balance sheet' + (f.bs_end ? " (" + esc(date(f.bs_end)) + ")" : "") + ", less its cash and short-term investments, at today\'s exchange rate." + (fins ? (f.inv ? " An investment company: its revenue counts the change in value of its holdings (below zero in a year they lost value), so its gross, operating and EBITDA margins, return on capital and EV multiples say little: none of them is shown or ranked, nor its enterprise value or free cash flow yield (its net margin, made of the same revenue, and return on equity are)." /* r7: the function's investment company (r137g, metrics.f.inv: Investor AB, Industrivärden, Sofina) */ : " For a bank, an insurer, a lender, a broker or another company whose business is other people's money (deposits, policyholders' float, clients' cash and margins), its debt and its cash are part of the business: enterprise value says little, so none is shown, and no EV multiple or free cash flow yield is shown or ranked for it.") : v.ev == null && v.capunits > 0 ? (v.capby === "pe" || v.capby === "px" ? " EODHD's market value most likely counts the units the company's minority interests hold beside its common shares (see the note above), and those units' share of the equity sits in the minority interests: an enterprise value would count it twice, so none is shown." : " EODHD's market value counts the company's exchangeable partnership units beside its common shares, and the units' share of the equity sits in the minority interests: an enterprise value would count it twice, so none is shown.") /* r15: valueRow's capunits (r137p) */ : v.debt_usd == null && fin(v.ev) && evToday(co) == null ? " No debt line was found in the latest statements although they show interest paid: no enterprise value is shown rather than one without the debt." : v.ev == null && v.debt_usd == null && !f.nodebt && fin(v.cash_usd) && fin(cap) && f.bs_end && bsWild(co) ? " The latest balance sheet's debt is more than the liabilities that must hold it (a debt line counted twice or holding another line's figure, or one on another scale or in another currency), or it has a debt line below zero, so no debt is taken from it, and no enterprise value is shown rather than one on a wrong debt." : v.ev == null && v.debt_usd == null && !f.nodebt && fin(v.cash_usd) && fin(cap) && f.bs_end && !(f.dgap > 0) && (m.p || {}).fin && (function (r) { return !!r && !["debtc", "debtl", "debtt"].some(function (k) { return fin(r.d[k]); }); })(bsLatest(co)) ? " The latest balance sheet has no debt line, and a company the profile calls financial is never taken to have no debt (its debt is often tagged in ways not read here): no enterprise value is shown rather than one that may leave its debt out." /* r14: finSummary's noDebt (r137f): Ameriprise, T. Rowe Price, Toast */ : v.ev == null && v.debt_usd == null && !f.nodebt && fin(v.cash_usd) && fin(cap) && f.bs_end ? " The latest balance sheet lacks a debt line an earlier balance sheet had (a line the statements stopped giving, not a debt repaid), shows interest paid without any debt line, or has no debt line where the company's other record of those days (the SEC's or EODHD's) shows debt: no enterprise value is shown rather than one without part of the debt." : v.ev == null && fin(v.cash_usd) && fin(cap) && f.bs_end && (fin(f.ncigap) || fin(f.xgap)) ? " The latest balance sheet's minority interests and other claims before the shareholders are not known to within 1% of the value (a minorities line an earlier balance sheet had and this one lacks, or a gap between its liabilities and its equity that cannot be told apart: minority interests, redeemable stock, or liabilities the statements do not list): no enterprise value is shown rather than one without them." /* r14: valueRow's ncigap (r137n) and xgap (r137o) */ : fin(evToday(co)) && ((f.ncigap > 0 && v.nci_usd == null) || f.xgap > 0) ? " " + (f.ncigap > 0 && v.nci_usd == null ? "The latest balance sheet has no minority interests line although one of the 400 days before had one, nor do its assets less its liabilities and equity show them" : "The latest balance sheet's assets less its liabilities and equity leave a gap that cannot be told apart (minority interests, redeemable stock, or liabilities the statements do not list)") + ": it is left out, which moves the enterprise value by less than 1%." /* r14: SU14-3 (d), Eli Lilly, China Mobile, Shionogi */ : "") + "" + (fins ? "" : co.d.prices && co.d.prices.m && co.d.prices.m.length ? (v.ev == null && v.capunits > 0 ? " Its value at the end of each period, on the common shares alone (the share price times the " + (v.capby === "pe" || v.capby === "px" ? "common shares checked against the basic shares behind the earnings per share, where the period's figures give them;" : "shares outstanding,") + " the units' share of the equity among the minority interests), is on the Multiples page." /* r17 (SU17-1) */ /* r16 (SU16-1) */ : " Its value at the end of each period is on the Multiples page.") : " The history needs share prices at each period\'s end" + (pxPlan(co) ? ", which EODHD\'s plan does not include yet." : ", not read yet.")) + "</p>";
  }
  function vEarnings(co) {
    var hist = ((co.d.earnings && co.d.earnings.hist) || []).slice().reverse(); if (!hist.length) return '<p class="muted">No earnings history yet.</p>';
    var rows = hist.slice(0, S.all ? 400 : 40).map(function (h) { var s = fin(h[4]) && fin(h[5]) && h[5] !== 0 ? (h[4] - h[5]) / Math.abs(h[5]) : null; return "<tr><td>" + esc(mShort(h[0])) + "</td><td>" + esc(h[1] ? date(h[1]) : DASH) + "</td><td>" + esc(whenOf(h[2])) + '</td><td class="num">' + (fin(h[5]) ? fmtNum(h[5], 2) : DASH) + '</td><td class="num">' + (fin(h[4]) ? fmtNum(h[4], 2) : h[1] && h[1] >= new Date().toISOString().slice(0, 10) ? "due" : DASH) + '</td><td class="num ' + cls(s) + '">' + pctS(s) + "</td><td>" + esc(h[3] || "") + "</td></tr>"; }).join("");
    return '<section class="sa-sec"><h3>Earnings per share against the estimate</h3><p class="sub">The last 12 quarters</p>' + epsChart(hist.slice().reverse()) + "</section>" +
      '<div class="sa-wrap" style="margin-top:18px"><table class="pt sa-tbl"><thead><tr><th>Quarter</th><th>Reported</th><th>When</th><th class="num">Estimate</th><th class="num">Result</th><th class="num">Surprise</th><th>Currency</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (hist.length > 40 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the last 40 only" : "Show all " + hist.length + " quarters") + "</button></div>" : "") +
      '<p class="sa-note">EPS on the basis analysts forecast (adjusted where the company adjusts), from EODHD; the statements\' GAAP EPS is on the Income statement page. The estimate is the analysts\' average before the report.</p>';
  }
  /* r16 (R16-3): the estimate log of the record read now: a day names its record (code, from r137q), else its currency (ccy) must be the profile's;
     a refused record's days (another company's targets) and another line's (other currency, other kind of share) stay out of the lines */
  function estLog(co, log) { var P = co.d.profile || {}, code = String(co.u.eodhd || "").toUpperCase();
    return (log || []).filter(function (x) { var d = x.data || {}; return d.code ? !code || String(d.code).toUpperCase() === code : !!co.d.profile && (!d.ccy || !P.ccy || String(d.ccy).toUpperCase() === String(P.ccy).toUpperCase()); }); } /* r29 (SU29-3): a profile dropped (a record refused as another company's: R28-1, R16) leaves the deployed function's days (no code) unknown: another company's targets and estimates */
  function vEstimates(co, log) {
    var lf = !!(log && log.failed); /* r32 (SU32-2) */ log = estLog(co, log);
    var E = co.d.earnings || {}, tr = E.trend || [], P = co.d.profile || {}, ar = P.ar || {};
    var ecur = ((E.hist || []).filter(function (h) { return h && h[3]; }).pop() || [])[3] || co.u.fin_currency || (CCY_FIX[P.ccy] || [])[0] /* r26 (SU26-3): KWF too */ || P.ccy || "";
    var name = { "0q": "This quarter", "+1q": "Next quarter", "0y": "This year", "+1y": "Next year" };
    var periodsT = ["0q", "+1q", "0y", "+1y"].map(function (k) { return tr.filter(function (t) { return t.period === k; })[0]; });
    var cell = function (v, d) { return '<td class="num">' + (fin(v) ? fmtNum(v, d == null ? 2 : d) : DASH) + "</td>"; };
    var head = "<tr><th></th>" + periodsT.map(function (t, i) { var k = ["0q", "+1q", "0y", "+1y"][i]; return '<th class="num">' + name[k] + (t ? '<br><small class="muted">' + esc(mShort(t.date)) + "</small>" : "") + "</th>"; }).join("") + "</tr>";
    var row = function (label, f, d) { return "<tr><th scope=\"row\">" + label + "</th>" + periodsT.map(function (t) { return cell(t ? f(t) : null, d); }).join("") + "</tr>"; };
    var rowP = function (label, f) { return "<tr><th scope=\"row\">" + label + "</th>" + periodsT.map(function (t) { var v = t ? f(t) : null; return '<td class="num ' + cls(v) + '">' + pctS(v) + "</td>"; }).join("") + "</tr>"; };
    var money = function (v) { return fin(v) ? v / 1e6 : null; };
    var tbl = '<div class="sa-wrap"><table class="pt sa-tbl sa-fin"><thead>' + head + '</thead><tbody><tr class="hd"><td>Earnings per share' + (ecur ? " (" + esc(ecur) + ")" : "") + '</td><td colspan="4"></td></tr>' + row("Average", function (t) { return t.eps.avg; }) + row("Low", function (t) { return t.eps.low; }) + row("High", function (t) { return t.eps.high; }) + row("Analysts", function (t) { return t.eps.n; }, 0) + row("A year ago (actual)", function (t) { return t.eps.yago; }) + rowP("Growth", function (t) { return t.eps.growth; }) +
      '<tr class="hd"><td>Revenue, millions' + (ecur ? " (" + esc(ecur) + ")" : "") + "</td><td colspan=\"4\"></td></tr>" + row("Average", function (t) { return money(t.rev.avg); }, 0) + row("Low", function (t) { return money(t.rev.low); }, 0) + row("High", function (t) { return money(t.rev.high); }, 0) + row("Analysts", function (t) { return t.rev.n; }, 0) + rowP("Growth", function (t) { return t.rev.growth; }) +
      '<tr class="hd"><td>How the EPS estimate moved</td><td colspan="4"></td></tr>' + row("Now", function (t) { return t.tr.cur; }) + row("7 days ago", function (t) { return t.tr.d7; }) + row("30 days ago", function (t) { return t.tr.d30; }) + row("60 days ago", function (t) { return t.tr.d60; }) + row("90 days ago", function (t) { return t.tr.d90; }) + row("Raised, last 30 days", function (t) { return t.rv.up30; }, 0) + row("Cut, last 30 days", function (t) { return t.rv.dn30; }, 0) + "</tbody></table></div>";
    var votes = [ar.StrongBuy, ar.Buy, ar.Hold, ar.Sell, ar.StrongSell].map(function (x) { return Number(x) || 0; }), tot = votes.reduce(function (a, b) { return a + b; }, 0);
    var vt = tot ? '<div class="sa-rank" style="grid-template-columns:120px 1fr 44px">' + ["Strong buy", "Buy", "Hold", "Sell", "Strong sell"].map(function (l, i) { return "<span>" + l + '</span><i><b style="width:' + Math.round(votes[i] / tot * 100) + '%"></b></i><span class="n">' + votes[i] + "</span>"; }).join("") + "</div>" : '<p class="muted">No ratings.</p>';
    var fy = null; (log || []).forEach(function (x) { if (x.data && x.data.y0 && x.data.y0.date) fy = x.data.y0.date; });
    var hy = (log || []).filter(function (x) { return x.data && x.data.y0 && (!fy || x.data.y0.date === fy); }).map(function (x) { return [x.day, x.data.y0.eps]; });
    return '<div class="sa-cols"><div>' + tbl + '</div><div><section class="sa-sec"><h3>The EPS estimate over time</h3><p class="sub">' + (lf ? "The estimates kept here for this company could not be read just now; they are read again when this page is opened again." : "The fiscal year to " + (fy ? esc(mLong(fy)) : "come") + ", kept here " + (co.u.rank && co.u.rank <= 600 ? "every day" : "every week or so") + " from " + (hy.length ? esc(date(hy[0][0])) : "today") + "; the line grows with each " + (co.u.rank && co.u.rank <= 600 ? "day" : "record") + ".") + "</p>" + (lf ? "" : line(hy) || '<p class="muted">The line starts after two days of records.</p>') + "</section></div></div>" +
      '<p class="sa-note">Analysts\' consensus from EODHD' + (ecur ? ", in " + esc(ecur) + ", the currency of the company's reported earnings" : "") + ".</p>";
  }
  function vTarget(co, log) {
    var lf = !!(log && log.failed); /* r32 (SU32-2) */ log = estLog(co, log);
    var P = co.d.profile || {}, ar = P.ar || {}, votes = [ar.StrongBuy, ar.Buy, ar.Hold, ar.Sell, ar.StrongSell].map(function (x) { return Number(x) || 0; }), tot = votes.reduce(function (a, b) { return a + b; }, 0);
    var target = tot > 0 ? (ar.TargetPrice != null ? ar.TargetPrice : P.hl && P.hl.WallStreetTargetPrice) : null; /* a target with no analyst behind it (999,999.99) is not a figure */
    var vt = tot ? '<div class="sa-rank" style="grid-template-columns:120px 1fr 44px">' + ["Strong buy", "Buy", "Hold", "Sell", "Strong sell"].map(function (l, i) { return "<span>" + l + '</span><i><b style="width:' + Math.round(votes[i] / tot * 100) + '%"></b></i><span class="n">' + votes[i] + "</span>"; }).join("") + "</div>" : '<p class="muted">No ratings.</p>';
    var hist = (log || []).map(function (x) { var d = x.data || {}, n = (d.votes || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0); return [x.day, n > 0 && fin(d.target) && d.target < 999999 ? d.target : null]; }); /* a day without analysts has no target */
    return grid([["Target price", tot > 0 ? esc(px(target, P.ccy)) + " <small>" + tot + " analysts</small>" : DASH], ["Rating (1 sell, 5 buy)", esc(fin(ar.Rating) ? Number(ar.Rating).toFixed(2) : DASH)]]) +
      '<div class="sa-cols"><div><section class="sa-sec"><h3>The target over time</h3><p class="sub">Analysts\' average' + (P.ccy ? ", " + esc(P.ccy) : "") + (lf ? ": the targets kept here for this company could not be read just now; they are read again when this page is opened again." : ", kept here " + (co.u.rank && co.u.rank <= 600 ? "every day" : "every week or so") + " from " + (log && log.length ? esc(date(log[0].day)) : "today")) + "</p>" + (lf ? "" : line(hist, { fmt: function (v) { return px(v, P.ccy); } }) || '<p class="muted">The line starts after two days of records.</p>') + "</section></div>" +
      '<div><section class="sa-sec"><h3>Ratings</h3><p class="sub">How many analysts say what</p>' + vt + "</section></div></div>" + '<p class="sa-note">From EODHD. The target is the analysts\' average 12-month price target.</p>';
  }
  function vDividends(co) {
    var D = co.d, P = D.profile || {}, dv = P.div || {}, list = ((D.divs && D.divs.list) || []).slice();
    var byYear = {}, nY = {}, cY = {}; list.forEach(function (d) { var y = String(d[0]).slice(0, 4), v = Number(d[1]) || 0; byYear[y] = (byYear[y] || 0) + v; if (v > 0) { nY[y] = (nY[y] || 0) + 1; (cY[y] = cY[y] || {})[String(d[3] || "")] = 1; } });
    var years = Object.keys(byYear).sort(), thisY = new Date().getUTCFullYear(), past = years.filter(function (y) { return Number(y) < thisY; }), full = [];
    if (past.length) for (var yy = Math.max(Number(past[0]), thisY - 15); yy < thisY; yy++) full.push(String(yy)); /* every year, those without a dividend too */
    /* r24 (M24-1): the growth of the dividend a year compares two years that each hold the company's usual payments: as many as the full years within two
       of it most often hold (one count more often than any other), in one currency. A year with one more is a special dividend or a payment that slid in
       from the next year, one with fewer a first, last or slid one, and its sum is not the year's dividend: Costco's 2020 holds its four quarterly
       dividends and the 10 dollars of December 2020 (12.75 beside 5.06 for 2025: "-16.9%" for its five years, its dividend growing 13.0% a year), 2015
       the 5 dollars of February 2015 ("-2.6%" for ten years, 12.5%); a 5% a year payer whose December 2020 payment went ex in January 2021 read 11.2%.
       Such a growth is "—" */
    var usual = function (y) { var c = {}; full.forEach(function (z) { if (Math.abs(Number(z) - Number(y)) <= 2) { var k = nY[z] || 0; c[k] = (c[k] || 0) + 1; } });
      var ks = Object.keys(c).sort(function (p, q) { return c[q] - c[p]; }); return ks.length > 0 && (ks.length === 1 || c[ks[0]] > c[ks[1]]) && Number(ks[0]) === (nY[y] || 0); };
    var cagr = function (n) { if (!full.length) return null; var L = full[full.length - 1], F = String(Number(L) - n), a = byYear[F], b = byYear[L];
      var cc = Object.keys(cY[F] || {}).concat(Object.keys(cY[L] || {})).filter(function (x, i, s) { return s.indexOf(x) === i; });
      if (a > 0 && b > 0 && !(usual(F) && usual(L) && cc.length === 1)) gOff = 1; /* r25 (SU25-3) */
      return a > 0 && b > 0 && usual(F) && usual(L) && cc.length === 1 ? Math.pow(b / a, 1 / n) - 1 : null; }, gOff = 0;
    var payout = ((co.u.metrics || {}).p || {}).payout; /* the dividends paid over the net income, from the company's statements (EODHD's own figure only where it passes the function's check) */
    /* r6: the summary's payout ratio is of its period: a year's (a summary by year, or a year's dividends and profit where the twelve months lack the
       dividends paid: Midea's 74% is 2025's beside twelve months to June 2026), said so as on the overview */
    var fS = (co.u.metrics || {}).f || {}, poEnd = fin(payout) && fin(fS.po) && Math.abs(payout - fS.po) <= 1e-9 ? (fS.ttm === false && fS.end ? fS.end : yearFigs(co).po) : null;
    var g = grid([["Dividend a year (forward)", esc(px(dv.ForwardAnnualDividendRate, P.ccy))], ["Yield", esc(pctA(noPx(co) ? null : dv.ForwardAnnualDividendYield != null ? dv.ForwardAnnualDividendYield : P.hl && P.hl.DividendYield))], [yrLabel("Payout ratio", poEnd), esc(pctA(payout))], [String(dv.ExDividendDate || "").slice(0, 10) > new Date().toISOString().slice(0, 10) ? "Next ex-dividend date" : "Last ex-dividend date", esc(date(dv.ExDividendDate))], [dv.DividendDate && String(dv.DividendDate).slice(0, 10) < new Date().toISOString().slice(0, 10) ? "Last payment" : "Next payment", esc(date(dv.DividendDate))] /* r24 (SU24-7): EODHD's dates are those of the latest dividend declared, either side of today */, ["Growth, 5 years a year", '<span class="' + cls(cagr(5)) + '">' + esc(pctS(cagr(5))) + "</span>"], ["Growth, 10 years a year", '<span class="' + cls(cagr(10)) + '">' + esc(pctS(cagr(10))) + "</span>"], ["Last split", esc(dv.LastSplitFactor ? dv.LastSplitFactor + " on " + date(dv.LastSplitDate) : DASH)]]);
    if (!list.length) return g + '<p class="muted">No dividends on record.</p>';
    /* r26 (SU26-2): one currency: the latest payment's (as the table names it); a year paid in another is not drawn rather than added to it */
    var cOf = function (c) { c = String(c || P.ccy || ""); return c === "GBp" ? "GBX" : c; } /* pence either way */, lastP = list.filter(function (d) { return (Number(d[1]) || 0) > 0; }).pop(), cur0 = cOf(lastP && lastP[3]);
    var offY = full.filter(function (y) { return Object.keys(cY[y] || {}).some(function (c) { return cOf(c) !== cur0; }); }), offC = [];
    offY.forEach(function (y) { Object.keys(cY[y]).forEach(function (c) { c = cOf(c); if (c !== cur0 && offC.indexOf(c) < 0) offC.push(c); }); });
    var offR = offY.reduce(function (o, y) { var l = o[o.length - 1]; if (l && Number(y) === l[1] + 1) l[1] = Number(y); else o.push([Number(y), Number(y)]); return o; }, []).map(function (x) { return x[0] === x[1] ? String(x[0]) : x[0] + "–" + x[1]; }).join(", ");
    var chart = bars(full.map(function (y) { return { l: "’" + y.slice(2), a: offY.indexOf(y) >= 0 ? null : byYear[y] || 0 }; }), { label: "Dividends a year" });
    var rows = list.slice().reverse().slice(0, S.all ? 1000 : 24).map(function (d) { return "<tr><td>" + esc(date(d[0])) + '</td><td class="num">' + fmtNum(d[1], 4) + '</td><td class="num">' + (fin(d[2]) && d[2] !== d[1] ? fmtNum(d[2], 4) : "") + "</td><td>" + esc(d[3] || "") + "</td><td>" + esc(d[4] ? date(d[4]) : DASH) + "</td><td>" + esc(d[6] || "") + "</td></tr>"; }).join("");
    return g + (gOff ? '<p class="sa-note" style="margin:-6px 0 18px">A growth shows — where its first or last year does not hold the company\'s usual number of payments, all in one currency (a special dividend, a payment that slid from one year into the next, a first year, a change in how often or in which currency it pays): that year\'s sum is not its dividend. ' + (offY.length ? "The table below shows every payment." : "The chart and the table below show every payment.") /* r26 (SU26-2) */ + '</p>' : "") /* r25 (SU25-3): why the "—" (M24-1) */ + '<section class="sa-sec"><h3>Dividends paid each year</h3><p class="sub">Per share, adjusted for splits, ' + esc(cur0) + (offY.length ? " (" + esc(offR) + ": paid in " + esc(offC.join(" and ")) + ", not drawn)" : "") /* r26 (SU26-2) */ + "</p>" + chart + "</section>" +
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
  var FILING_GROUPS = [["all", "All"], ["periodic", "Annual and quarterly"], ["results", "Results"], ["current", "Other current reports"], ["proxy", "Proxy"], ["owners", "Large holders"], ["insiders", "Insiders"], ["offer", "Offerings"], ["other", "Other"]];
  function filingGroup(f) { var form = String(f[0] || ""), items = String(f[6] || ""); if (/^(10-K|10-Q|20-F|40-F|10-KT|10-QT)/.test(form)) return "periodic"; if (/^8-K/.test(form) && /2\.02/.test(items)) return "results"; if (/^6-K/.test(form)) return "results"; if (/^8-K/.test(form)) return "current"; if (/^(DEF|DEFA|DEFM|PRE|PRER|DFAN)14|^ARS/.test(form.replace(/ /g, ""))) return "proxy"; if (/13D|13G|13F/.test(form)) return "owners"; if (/^[345](\/A)?$|^144/.test(form)) return "insiders"; if (/^(424B|S-1|S-3|S-4|S-8|F-1|F-3|F-4|F-10|FWP|POS AM|S-11)/.test(form)) return "offer"; return "other"; }
  /* every filing the company ever made at the SEC, read from the SEC itself when the page opens: its latest thousand, then its older pages one after
     the other (19 Oct: all of them, as on Koyfin; nothing stored on our side) */
  var SECF = {};
  function loadSecFilings(cik) {
    var c = String(Number(cik)); if (SECF[c]) return SECF[c]; var pad = ("0000000000" + c).slice(-10);
    var rows = function (R) { var out = [], n = R && R.accessionNumber ? R.accessionNumber.length : 0; for (var i = 0; i < n; i++) out.push([R.form[i] || "", R.filingDate[i] || null, R.reportDate[i] || null, R.accessionNumber[i], R.primaryDocument[i] || null, R.primaryDocDescription[i] || null, R.items ? R.items[i] || null : null]); return out; };
    var get = function (url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error("SEC " + r.status); return r.json(); }); };
    SECF[c] = get("https://data.sec.gov/submissions/CIK" + pad + ".json").then(function (j) {
      var list = rows(j.filings && j.filings.recent), files = (j.filings && j.filings.files) || [], ok = true;
      return files.reduce(function (p, f) { return p.then(function () { return get("https://data.sec.gov/submissions/" + f.name).then(function (x) { list = list.concat(rows(x)); }, function () { ok = false; }); }); }, Promise.resolve()).then(function () {
        var seen = {}; list = list.filter(function (f) { if (!f[3] || seen[f[3]]) return false; seen[f[3]] = 1; return true; }).sort(function (a, b) { return String(b[1]).localeCompare(String(a[1])); });
        return { list: list, complete: ok }; });
    }); SECF[c].catch(function () { delete SECF[c]; });
    return SECF[c];
  }
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
    var F = co.d.filings, cik = co.u.cik, web = webUrl(co.d.profile && co.d.profile.web); if (!cik) return '<p class="muted">This company does not file with the SEC. Its reports are on its own website' + (web ? ': <a href="' + esc(web) + '" target="_blank" rel="noopener">' + esc(String(web).replace(/^https?:\/\//, "")) + "</a>" : "") + ".</p>";
    var A = co.secAll ? co.secAll.list : F && F.list; if (!A) return '<p class="muted">The SEC filings arrive with the next run.</p>';
    var cnt = {}; A.forEach(function (f) { var g = filingGroup(f); cnt[g] = (cnt[g] || 0) + 1; });
    S.fg = S.fg && (S.fg === "all" || cnt[S.fg]) ? S.fg : "all"; /* r3: a filter this company has no filing for (chosen on another company): all of them, not "None." */ var c = String(Number(cik)), list = A.filter(function (f) { return S.fg === "all" || filingGroup(f) === S.fg; });
    var groups = FILING_GROUPS.filter(function (g) { return g[0] === "all" || cnt[g[0]]; }).map(function (g) { return [g[0], g[1] + " " + fmtNum(g[0] === "all" ? A.length : cnt[g[0]])]; });
    var shown = S.fshow || 60, rows = list.slice(0, shown).map(function (f) { var acc = String(f[3]), dir = "https://www.sec.gov/Archives/edgar/data/" + c + "/" + acc.replace(/-/g, "") + "/"; var g = filingGroup(f);
      return "<tr><td>" + esc(date(f[1])) + "</td><td><b>" + esc(f[0]) + "</b></td><td>" + esc(filingWhat(f, g)) + "</td><td>" + esc(f[2] ? date(f[2]) : "") + '</td><td><a href="' + esc(f[4] ? dir + f[4] : dir) + '" target="_blank" rel="noopener">Document</a> · <a href="' + esc(dir + acc + "-index.htm") + '" target="_blank" rel="noopener">All files</a></td></tr>'; }).join("");
    rest = (rest || []).filter(function (x) { return x && x.data && x.data.k !== "rfc"; });
    /* r24 (SU24-2): a period the parser moved to today's share basis after a stock split (its row's r.split): the two figures on that basis, as the statement's
       "r" hover (restOn); where that cannot be told, as filed, marked so */
    var rsQ = function (d) { var pp = String(d.p || "").split(" "), sec = co.d.sec || {}, rows = (pp[0] === "FY" ? sec.annual : sec.quarterly) || [], rr = null; for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].end === pp[1]) { rr = rows[i]; break; }
      var q = rr && rr.split ? restOn(d, rr, d.k) : 1; return q == null ? (/^(eps|epsd|dps|shb|shd|sho)$/.test(String(d.k)) ? { q: 1, as: 1 } : { q: 1 }) : { q: q }; }, rsOn = 0, rsAs = 0;
    rest.slice(0, S.all ? 1000 : 40).forEach(function (x) { var o = rsQ(x.data || {}); if (o.as) rsAs = 1; else if (o.q !== 1) rsOn = 1; }); /* r23 (SU23-4): not the contracts revenue the parser reads only to check its revenue line ("Revenue" holds the same restatement, or the line shown was not restated) */
    var rt = rest && rest.length ? '<section class="sa-sec" style="margin-top:18px"><h3>Restated figures</h3><p class="sub">A later filing changed a figure the company had already published. Both stay here; the statements show the latest. Amounts in ' + esc((co.d.sec && co.d.sec.currency) || "the currency of the filings") + ' as filed, in whole units (not millions); share counts in millions.' + (rsOn ? " Per-share figures and share counts of periods before a stock split are on today's basis, as in the statements." : "") + (rsAs ? " * As filed, before a later stock split: the statements show them on today's basis." : "") + '</p><div class="sa-wrap"><table class="pt sa-tbl"><thead><tr><th>Line</th><th>Period</th><th class="num">First filed</th><th class="num">Latest</th><th class="num">Change</th><th>Changed on</th></tr></thead><tbody>' +
      rest.slice(0, S.all ? 1000 : 40).map(function (x) { var d = x.data || {}, ch = fin(d.was) && d.was !== 0 ? d.now / d.was - 1 : null, lbl = d.k === "intexp" && co.d.sec && co.d.sec.tax === "ifrs-full" ? "Interest expense or finance costs" : LINE_NAME[d.k] || d.k, shr = /^sh[bdo]$/.test(String(d.k)), rq = rsQ(d), pd = /^(eps|epsd|dps)$/.test(String(d.k)) && fin(d.was) && fin(d.now) ? psDec(d.was * rq.q, d.now * rq.q) : null, rv = function (v) { v = v * rq.q; return (shr ? fmtNum(v / 1e6, 1) : pd != null ? fmtNum(v, pd) : fmtNum(v, Math.abs(v) < 100 ? 2 : 0)) + (rq.as ? "*" : ""); }; /* r23 (SU23-4): share counts in millions, as their line names say */ /* r24 (SU24-2): on the statements' basis after a split, else marked as filed */ /* r19: an IFRS filer's line is either (intF) */ return "<tr><td>" + esc(lbl) + "</td><td>" + esc(String(d.p || "").replace(/^FY /, "Year to ").replace(/^Q /, "Quarter to ")) + '</td><td class="num">' + rv(d.was) + '</td><td class="num">' + rv(d.now) + '</td><td class="num ' + cls(ch) + '">' + pctS(ch) + "</td><td>" + esc(date(d.filed)) + "</td></tr>"; }).join("") + "</tbody></table></div>" + (rest.length > 40 ? '<div class="sa-more"><button type="button" id="sa-all">' + (S.all ? "Show the latest 40 only" : "Show all " + fmtNum(Math.min(rest.length, 1000))) + "</button></div>" : "") /* r24 (SU24-6): the rest of the list, not cut at 40 without a word */ + "</section>" : "";
    return '<div class="sa-bar">' + chips("sa-fg", groups, S.fg) + '</div><div class="sa-wrap"><table class="pt sa-tbl"><thead><tr><th>Filed</th><th>Form</th><th>What</th><th>Period</th><th>Links</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">None.</td></tr>') + "</tbody></table></div>" + (list.length > shown ? '<div class="sa-more"><button type="button" id="sa-fmore">Show ' + fmtNum(Math.min(500, list.length - shown)) + " more (" + fmtNum(shown) + " of " + fmtNum(list.length) + " shown)</button></div>" : "") +
      '<p class="sa-note">' + (co.secAll ? "Every filing at the SEC, " + fmtNum(A.length) + (co.secAll.complete ? "" : " (some older pages could not be read now)") + ", read from the SEC just now" : co.secFail ? "The latest " + fmtNum(A.length) + " filings, as last stored here: the SEC's full list could not be read just now" : "The SEC's own records (the full list is being read from the SEC)") + (F && F.sicd ? " · industry code: " + esc(F.sicd) : "") + (F && F.cat ? " · " + esc(F.cat) : "") + ".</p>" + rt;
  }
  var LINE_NAME = {}; ["is", "bs", "cf"].forEach(function (k) { LINES[k].forEach(function (l) { if (typeof l[1] === "string" && l[0] !== "hd") LINE_NAME[l[1]] = l[0]; }); });
  /* r23 (SU23-4): the parser's other keys by name, not by code */
  LINE_NAME.shb = "Basic shares, millions"; LINE_NAME.opex = "Operating expenses"; LINE_NAME.lease = "Lease income"; LINE_NAME.debtt = "Total debt"; LINE_NAME.pref = "Preferred stock";
  /* earnings call transcripts: EODHD has none; every call will be listed here once a transcript source is chosen (19 Oct) */
  function vTranscripts(co) { return '<p class="muted">The transcripts of ' + esc(co.u.name || co.u.id) + "'s earnings calls will be listed here, every call, once a transcript source is connected: EODHD, the source of the figures, does not provide them.</p>"; }
  function vNews(co) { var n = (co.d.news && co.d.news.list) || []; if (!n.length) return '<p class="muted">No headlines yet.</p>'; return '<div class="sa-wrap"><table class="pt sa-tbl"><tbody>' + n.map(function (x) { return "<tr><td>" + esc(date(String(x[0]).slice(0, 10))) + '</td><td style="white-space:normal"><a href="' + esc(webUrl(x[2]) || "#") + '" target="_blank" rel="noopener nofollow">' + esc(x[1]) + '</a> <span class="muted">' + esc(x[3] || "") + "</span></td></tr>"; }).join("") + '</tbody></table></div><p class="sa-note">Headlines and links from EODHD\'s news feed; the articles are on their publishers\' sites.</p>'; }
  function vChart(co) { return co.u.tv ? '<div class="sa-tv" id="sa-tv"></div>' : '<p class="muted">No chart for this listing.</p>'; }

  /* ---------- routing, access, wiring ---------- */
  function sources(co) {
    var st = co.u.status || {}, d = function (x, kept) { var t = function (v) { return date(String(v).slice(0, 10)); }; return x && x.at && !x.err ? t(x.at) : x && x.err ? (kept ? (typeof kept === "string" ? "of " + t(kept) + " " : "") + "(the latest read, on " + t(x.at) + ", did not complete: it is tried again)" : "not read yet (tried " + t(x.at) + ")") : "not yet"; }; /* r23 (SU23-6): a failed read beside what an earlier one kept is not "not read yet" */
    var NAME = { px: "prices", div: "dividends", news: "news" }, is403 = function (x) { return x && (x.plan || /\b403\b/.test(String(x.err || ""))); };
    /* the SEC found nothing (its submissions or its data answered 404: status none) and nothing is kept from an earlier read: said so, not "read" */
    var on = function (x) { return x && x.at ? date(String(x.at).slice(0, 10)) : "—"; }, D0 = co.d || {}, secRows = !!(D0.sec && ((D0.sec.annual || []).length || (D0.sec.quarterly || []).length));
    var bits = []; if (co.u.cik) bits.push((st.subs && st.subs.none && !st.subs.err && !D0.filings ? "no filings found at the SEC (checked " + on(st.subs) + ")" : (st.subs && st.subs.err ? "SEC filings " + d(st.subs, D0.filings ? true : null) : st.subs && st.subs.at ? "SEC filings read " + d(st.subs) : "SEC filings " + d(st.subs)) /* r24 (SU24-4): "SEC filings not yet", not "read not yet" */) + (st.sec && st.sec.none && !st.sec.err && !secRows ? ", no statements in its SEC data (checked " + on(st.sec) + ")" : ", statements " + d(st.sec, secRows ? (D0.sec.at ? String(D0.sec.at) : true) : null))); if (!(st.res && st.res.dead)) bits.push((st.eod && st.eod.at && /^summary:/.test(String(st.eod.err || "")) ? "EODHD profile read " + date(String(st.eod.at).slice(0, 10)) + ", its statements " + d(st.eod, true) : "EODHD profile and statements " + d(st.eod, D0.profile || (D0.fin && ((D0.fin.annual || []).length || (D0.fin.quarterly || []).length)) ? true : null)) + (st.px && !st.px.err ? ", prices " + d(st.px) : "")) /* r23 (R23-2, stocks-pipe): the profile read, the statements not saved (R22-1) */;
    /* EODHD refusing a kind of data (403) is the plan, not a fault: said plainly, never as an error */
    var plan = ["px", "div", "news"].filter(function (k) { return is403(st[k]); }).map(function (k) { return NAME[k]; });
    if (plan.length) bits.push("not in the EODHD plan: " + plan.join(", ") + " (asked again every week)");
    var slow = ["px", "div", "news"].filter(function (k) { return st[k] && st[k].err && !is403(st[k]) && /timed out|aborted|did not answer/i.test(st[k].err); }).map(function (k) { return NAME[k]; });
    if (slow.length) bits.push("EODHD did not answer in time for " + slow.join(", ") + " (tried again later)");
    var errs = ["sec", "subs", "eod", "px", "div", "news"].filter(function (k) { return st[k] && st[k].err && !is403(st[k]) && !/timed out|aborted|did not answer|no EODHD record/i.test(st[k].err); }).map(function (k) { return k + ": " + st[k].err; });
    if (st.res && st.res.dead && !(st.res.plan || /\b403\b/.test(String(st.res.err || "")))) errs.push("EODHD has no record we can read for this company" + (st.res.err ? " (" + st.res.err + ")" : ""));
    var showE = !!(errs.length && (S.ctx.staff && !S.ctx.sim)); if (!bits.length && !showE) return ""; /* r17 (SU17-6) */
    return '<p class="sa-note">' + (bits.length ? esc(bits.join(" · ")) + "." : "") + (showE ? (bits.length ? "<br>" : "") + '<span style="color:var(--warn)">' + esc(errs.join(" · ")) + "</span>" : "") + "</p>";
  }
  /* the refresh button's answer, in words: a refusal by the plan is not an error */
  function noteText(n) { var m = /^(px|div|news|eod)\b[^:]*:\s*(.*)$/.exec(String(n)); if (m && /\b403\b/.test(m[2])) return ({ px: "prices", div: "dividends", news: "news", eod: "company data" })[m[1]] + ": not in the EODHD plan"; return String(n).replace(/\s*Please contact support@eodhistoricaldata\.com\.?/g, ""); }
  function loadLog(id, kind) {
    var key = id + "|" + kind; if (S.log[key]) return S.log[key];
    var c = sb(); if (!c) return Promise.resolve([]);
    /* r31 (SU31-2): newest first, 1,000 rows a page (the API's most): an oldest-first read lost a long log's latest days; the estimates back in date order */
    var page = function (from) { return c.from("stock_log").select("day,data").eq("sid", id).eq("kind", kind).order("day", { ascending: false }).range(from, from + 999).then(function (r) { if (r.error) throw r.error; return r.data || []; }); };
    var bad = false; /* r32 (SU32-2): a failed read (any page) is not kept: asked again the next time the page is drawn, and said (rows.failed) */
    var all = function (rows, from) { return page(from).then(function (x) { rows = rows.concat(x); return kind === "est" && x.length === 1000 && from < 4000 ? all(rows, from + 1000) : rows; }, function () { bad = true; return rows; }); };
    var p = S.log[key] = all([], 0).then(function (rows) { if (bad) { if (S.log[key] === p) delete S.log[key]; var none = []; none.failed = true; return none; } return kind === "est" ? rows.reverse() : rows; }); return p;
  }
  /* a company opens at once: its name and place from the list in this browser, then its summary (a few kilobytes) as soon as it arrives,
     then the statements; a page seen before comes back from memory */
  var MEMO = {}, MEMO_KEYS = [];
  function memo(key, f) { if (MEMO[key] != null) return MEMO[key]; var v = f(); MEMO[key] = v; MEMO_KEYS.push(key); if (MEMO_KEYS.length > 80) delete MEMO[MEMO_KEYS.shift()]; return v; }
  var rowBusy = {};
  function fetchRow(id) { if (rowBusy[id]) return rowBusy[id]; var c = sb(); if (!c) return Promise.reject(new Error("no client")); rowBusy[id] = c.from("stock_universe").select(U_COLS).eq("id", id).maybeSingle().then(function (r) { delete rowBusy[id]; if (r.error) throw r.error; return r.data; }, function (e) { delete rowBusy[id]; throw e; }); return rowBusy[id]; }
  function hashId() { var m = /^#stocks\/([^/]*)/.exec(location.hash); if (!m) return null; try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } } /* r3: the company in the address, decoded as show() decodes it (#stocks/M&M.NSE and #stocks/M%26M.NSE are one page) */
  function shellHeader(r) { return '<div class="sa-hd"><div class="id"><h1>' + esc(r.name || r.id) + '</h1><div class="meta">' + [r.id, r.country, r.sector].filter(Boolean).map(esc).join(" · ") + '</div></div><div class="quote"><span class="chg muted">Market value ' + esc(big(r.cap_usd)) + (r.rank ? " · #" + r.rank + " in the world" : "") + "</span></div></div>"; }
  /* r39 (SU39-1): a control that redraws the page (a chip, a page tab, the section list, "Show all") keeps the keyboard's focus: the redrawn page's
     control of the same value, address or id takes it back, only when focus was lost (fell to <body>) */
  function fKeep(box) { var a = document.activeElement; if (!box || !a || a === document.body || !box.contains(a)) return null;
    var c = a.closest ? a.closest(".chips[id]") : null; if (c && a.hasAttribute("data-v")) return { c: c.id, v: a.getAttribute("data-v") };
    if (a.id) return { id: a.id }; var h = a.tagName === "A" ? a.getAttribute("href") : null; return h ? { h: h } : null; }
  function fBack(box, k) { var a = document.activeElement; if (!k || !box || (a && a !== document.body && a.isConnected)) return;
    var n = k.c ? ($$("#" + k.c + " button", box).filter(function (b) { return b.getAttribute("data-v") === k.v; })[0] || $("#" + k.c + " button.on", box)) : k.id ? document.getElementById(k.id) : $$("a", box).filter(function (x) { return x.getAttribute("href") === k.h; })[0];
    if (n && box.contains(n)) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
  /* r39 (SU39-2): a table box that scrolls sideways with nothing focusable in it takes focus, named, so a keyboard reaches its older columns */
  function keyScroll(w) { if (!w || w.scrollWidth <= w.clientWidth + 1 || w.querySelector("a[href],button,input,select,[tabindex]")) return;
    var sec = w.closest ? w.closest(".sa-sec") : null, h = sec ? $("h3", sec) : null; w.tabIndex = 0; w.setAttribute("role", "region");
    w.setAttribute("aria-label", (h && h.textContent.trim()) || String(document.title).split(" \u00b7 ")[0] || "Table"); }
  function renderCompany(el, id, tab) {
    css(); tab = pageOf(tab); var back = '<p class="back"><a href="#stocks">← Stock analysis</a></p>';
    /* a new page says so: its group and name above it, a short fade as it comes, the top of the page in view, its name in the bar at the top */
    var pageKey = id + "|" + tab, fresh = S.page !== pageKey; S.page = pageKey; var token = S.rt = (S.rt || 0) + 1, mine = function () { return token === S.rt && el.isConnected; };
    var anim = function () { if (!fresh) return ""; fresh = false; return " sa-in"; }, glow = fresh;
    /* the section's name, then its pages as tabs (the one shown marked); a section of one page keeps its name as the title */
    var title = function () { var g = glow; glow = false; var tabs = pageTabs(id, tab, g);
      return '<p class="sa-crumb">' + esc(groupName(tab)) + "</p>" + (tabs || '<h2 class="sa-ttl' + (g ? " sa-in2" : "") + '">' + esc(pageName(tab)) + "</h2>"); };
    var named = function (n) { var crumb = $("#crumb"); if (crumb) crumb.textContent = (n || id) + " \u00b7 " + pageName(tab); document.title = pageName(tab) + " \u00b7 " + (n || id) + " \u00b7 Mr. Wall Street"; };
    if (fresh) { S.all = false; S.fshow = 60; }
    if (fresh && W.scrollY > 0) W.scrollTo(0, 0);
    var shell = function (head, name) { var fk = fKeep(el); el.innerHTML = back + staffBar(id) + head + '<div class="sa-main' + anim() + '">' + sideSel(tab) + title() + '<div class="sa-wait"><span></span><span></span><span></span></div></div>'; sideNav(id, tab, name || id); named(name); var sel = $("#sa-sidesel", el); if (sel) sel.addEventListener("change", function () { location.hash = "#stocks/" + encodeURIComponent(id) + "/" + sel.value; }); fBack(el, fk); }; /* r39 (SU39-1) */
    var full = false;
    if (!S.co[id]) {
      var lr = (S.list || []).filter(function (r) { return r.id === id; })[0];
      shell(lr ? shellHeader(lr) : "<h1>" + esc(id) + "</h1>", lr && lr.name);
      /* the summary row, small, while the statements come: the overview's figures can be shown from it */
      fetchRow(id).then(function (u) { if (full || !u || !mine() || hashId() !== id) return; if (tab === "overview") draw({ u: u, d: {}, partial: true }); else shell(header({ u: u, d: {} }), u.name); }, function () { /* the full read will say */ });
    }
    S.onCo = function (id2) { if (id2 === id && el.isConnected && hashId() === id) renderCompany(el, id, tab); }; /* a fresher copy arrived */
    function draw(co, extra) {
      if (!mine()) return;
      named(co.u.name); if (co.d) co.d._rp = /^sec-revenue-partial/.test(String(((co.u.metrics || {}).f || {}).check || ""));
      var view = { overview: vSummary, description: vDescription, rank: vRank, dividends: vDividends, ownership: vOwnership, earnings: vEarnings, highlights: vHighlights,
        is: function (c) { return vStmt(c, "is"); }, bs: function (c) { return vStmt(c, "bs"); }, cf: function (c) { return vStmt(c, "cf"); }, multiples: vMultiples, ev: vEV,
        profitability: function (c) { return vRatioPage(c, ["Margins"], "Margins over revenue, computed here from the company's statements. Banks, insurers and the other financial and investment companies named on the Enterprise value page have no gross, operating or EBITDA margin: their revenue and costs mean other things."); },
        returns: function (c) { return vRatioPage(c, ["Returns"], "Return on equity and on assets: net income over the average of the opening and closing balance. Return on invested capital: operating income after tax (the company's own rate, 21% when unclear) over equity plus debt less cash; not for banks, insurers and the other financial and investment companies named on the Enterprise value page."); },
        growth: function (c) { return vRatioPage(c, ["Growth, year on year"], "Each period against the same period a year before, in the reported currency."); },
        solvency: function (c) { return vRatioPage(c, ["Balance sheet"], "From the balance sheet at each period's end; interest cover from the period's operating income and interest paid (none from finance costs, which hold other financial costs beside the interest: IFRS, nor from EODHD's figure for a company whose own filings give finance costs, as that figure may be those). Neither interest cover nor net debt / EBITDA for a bank, an insurer or another company whose business is other people's money (its interest paid is the cost of the money it lends and invests), nor for an investment company (its operating income counts the change in value of its holdings): the companies named on the Enterprise value page."); }, /* r24 (M24-6) */ /* r25 (M25-3): the investment companies too (f.inv: evOff's), whose interest is not the cost of money lent */
        news: vNews, transcripts: vTranscripts, chart: vChart }[tab];
      var key = [id, tab, co.partial ? "p" : co.at, S.per, S.cur, S.stmt, S.all, S.fg, S.fshow, extra ? extra.length + (extra.failed ? "f" : "") : "", co.secAll ? co.secAll.list.length : co.secFail ? "f" : ""].join("|");
      var body; try { body = co.partial ? (view || vSummary)(co) : memo(key, function () { return tab === "estimates" ? vEstimates(co, extra) : tab === "target" ? vTarget(co, extra) : tab === "filings" ? vFilings(co, extra) : (view || vSummary)(co); }); } catch (e) { body = '<div class="banner bad"><div><b>This part could not be shown.</b><p>' + esc(e && e.message || e) + "</p></div></div>"; if (W.console) console.error(e); }
      var fk = fKeep(el); /* r39 (SU39-1) */ el.innerHTML = back + staffBar(id) + header(co) + '<div class="sa-main' + anim() + '">' + sideSel(tab) + title() + checks(co) + body + (co.partial ? '<div class="sa-wait"><span></span><span></span><span></span></div>' : sources(co)) + "</div>"; sideNav(id, tab, co.u.name || id); wire(el, co, id, tab); fBack(el, fk);
    }
    loadCompany(id).then(function (co) {
      full = true; if (!mine()) return;
      if (!co && id !== id.toUpperCase()) { location.replace("#stocks/" + encodeURIComponent(id.toUpperCase()) + "/" + tab); return; } /* the list's codes are in capitals */
      if (!co) { el.innerHTML = back + "<h1>" + esc(id) + '</h1><p class="muted">This company is not in the list.</p>'; return; }
      if (!el.isConnected || hashId() !== id) return;
      if (tab === "estimates" || tab === "target") loadLog(id, "est").then(function (x) { draw(co, x); }); else if (tab === "filings") { loadLog(id, "restated").then(function (x) { draw(co, x); /* the stored list first, then every filing straight from the SEC */
        if (co.u.cik && !co.secAll) loadSecFilings(co.u.cik).then(function (all) { co.secAll = all; if (el.isConnected && hashId() === id && /^#stocks\/[^/]*\/filings/.test(location.hash)) draw(co, x); }, function () { co.secFail = true; if (el.isConnected && hashId() === id && /^#stocks\/[^/]*\/filings/.test(location.hash)) draw(co, x); /* the stored list stays, said so */ }); }); } else draw(co);
    }, function (e) { full = true; if (!mine()) return; el.innerHTML = back + '<div class="banner bad"><div><b>Could not load this company.</b><p>' + esc(e && e.message || e) + "</p></div></div>"; });
  }
  function wire(el, co, id, tab) {
    var redraw = function () { renderCompany(el, id, tab); };
    var on = function (sel, f) { var b = $(sel, el); if (b) b.addEventListener("click", function (e) { var t = e.target.closest("button"); if (t) f(t.dataset.v, t); }); };
    on("#sa-st", function (v) { S.stmt = v; redraw(); }); on("#sa-per", function (v) { S.per = v; S.all = false; remember(); redraw(); }); on("#sa-cur", function (v) { S.cur = v; remember(); redraw(); }); on("#sa-fg", function (v) { S.fg = v; S.all = false; S.fshow = 60; redraw(); });
    var all = $("#sa-all", el); if (all) all.addEventListener("click", function () { S.all = !S.all; redraw(); });
    $$(".sa-fin", el).forEach(function (t) { t.addEventListener("click", function (e) { var m = e.target.closest && e.target.closest("button.d,button.r"); if (m && MWS.toast) MWS.toast(m.getAttribute("title")); }); }); /* r39 (SU39-4) */
    var fm = $("#sa-fmore", el); if (fm) fm.addEventListener("click", function () { S.fshow = (S.fshow || 60) + 500; redraw(); });
    /* the statements read like the company's: the latest period at the right, in view; older ones a scroll away */
    $$(".sa-wrap", el).forEach(function (w) { if (w.querySelector(".sa-fin")) w.scrollLeft = w.scrollWidth; keyScroll(w); }); /* r39 (SU39-2) */
    if (!co.partial) setTimeout(function () { if (tab === "chart") tvWidget($("#sa-tv", el), co.u.tv, false); if (tab === "overview") tvWidget($("#sa-tv-s", el), co.u.tv, true); }, 60); /* the chart (an outside widget) after the page is on screen */
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
    return c.rpc("desk_live", { section: "stocks" }).then(function (r) { if (r.error) return null; S.live = r.data === true; return S.live; }, function () { return null; }); /* r30 (SU30-3): null, not known (not "not live") */ /* r29: a failed answer is not kept: asked again next time */
  }
  function nav(ctx) {
    if (ctx) S.ctx = { staff: !!ctx.staff, sim: !!ctx.sim, member: !!ctx.member };
    var a = $("#nav-stocks"), g = $("#nav-res"); if (!a) return; css(); /* the menu's styles from the first page, not only once Stock Analysis is opened */
    var show = function (v) { a.hidden = !v; if (g) g.hidden = !v; };
    var menu = function () { var m = /^#stocks\/([^/]+)(?:\/([^/]+))?/.exec(location.hash); if (!m) sideNav(null, null); }; /* the company menu under Stock Analysis from the start, on every page */
    if (S.ctx.staff || S.ctx.sim) { show(true); menu(); liveCheck(); return; }
    liveCheck().then(function (live) { if (live === null && !(S.ctx.staff || S.ctx.sim)) { menu(); return; } show(S.ctx.staff || S.ctx.sim || (live && S.ctx.member)); menu(); }); /* r30 (SU30-3): an answer that did not come leaves the entry as it is (app.html's saNav does the same) */ /* r29: the context when the answer comes (the app may have said staff meanwhile) */
  }
  function show(ctx) {
    if (ctx) S.ctx = { staff: !!ctx.staff, sim: !!ctx.sim, member: !!ctx.member };
    var el = $("#sa-page"); if (!el) return; css();
    if (ctx && !ctx.ready) { el.innerHTML = '<p class="small muted">Loading…</p>'; el.removeAttribute("data-sa"); return; }
    var arg = ctx && ctx.arg != null ? ctx.arg : (W.__saArg || ""); var parts = String(arg).split("/"), id = parts[0] ? (function (s) { try { return decodeURIComponent(s); } catch (e) { return s; } })(parts[0]) : "", tab = parts[1] || "summary";
    var go = function () { el.setAttribute("data-sa", String(arg)); if (id) renderCompany(el, id, tab); else { S.page = null; S.rt = (S.rt || 0) + 1; sideNav(null, null); renderList(el); } };
    var seq = S.showSeq = (S.showSeq || 0) + 1; /* r31 (SU31-1): only the latest call acts on its answer (a stale failure does not wipe the page a later answer drew) */
    var stf = S.ctx.staff || S.ctx.sim; /* r32 (SU32-1): staff and "view as" too see "Loading…" while the answer is not known, not the page shown before (unless it is the one asked for: a redraw keeps its place), and nothing is drawn once they have left the section */
    if (S.live === null && (!stf || el.getAttribute("data-sa") !== String(arg))) { el.innerHTML = '<p class="small muted">Loading…</p>'; el.removeAttribute("data-sa"); } /* r31 (SU31-1): not a blank page while the answer comes */
    if (stf) { liveCheck().then(function () { if (seq === S.showSeq && /^#stocks\b/.test(location.hash)) go(); }); return; }
    liveCheck().then(function (live) { if (seq !== S.showSeq || !/^#stocks\b/.test(location.hash)) return; /* r30 (SU30-3): the member left meanwhile */
      if (live && S.ctx.member) { go(); var na = $("#nav-stocks"), ng = $("#nav-res"); if (na) na.hidden = false; if (ng) ng.hidden = false; }
      else if (live === null && S.ctx.member) { el.innerHTML = '<p class="small muted" style="padding:16px 0">Stock Analysis could not be checked just now. Check your connection. <button type="button" class="btn sm">Try again</button></p>'; var tb = el.querySelector("button"); if (tb) tb.onclick = function () { el.innerHTML = '<p class="small muted">Loading…</p>'; show({ arg: arg, staff: S.ctx.staff, sim: S.ctx.sim, member: S.ctx.member, ready: true }); }; }
      else { el.innerHTML = ""; location.replace("#telegram"); } }); /* r30 (SU30-3): a failed answer (null) is not "not live": said, with Try again, rather than sending a member with access away */
  }
  W.mwsStocks = { show: show, nav: nav, _: { S: S, stmts: stmts, periods: periods, finTable: finTable, ratioRows: ratioRows, fxRate: fxRate, conv: conv, loadFx: loadFx } };
  /* this file can load after the app has routed: catch up */
  function boot() {
    var d = MWS.debug ? (function () { try { return MWS.debug(); } catch (e) { return null; } })() : null; if (!d) return false;
    var acc = MWS.store && MWS.store.get ? MWS.store.get("mws_access") : null, member = !!(acc && acc.valid && acc.at >= ((W.performance && performance.timeOrigin) || 0)); /* r29: only this page's own read (a previous visit's answer says nothing about staff) */
    S.ctx = { staff: !!d.staff, sim: !!d.sim, member: S.ctx.member || member }; nav();
    if (/^#stocks/.test(location.hash) && (d.staff || d.sim || member)) { var m = /^#stocks(?:\/(.*))?$/.exec(location.hash); show({ arg: m && m[1] ? m[1] : "", staff: !!d.staff, sim: !!d.sim, member: S.ctx.member, ready: true }); }
    return true;
  }
  /* leaving a company (another page of the site, or the list): its sections leave the side menu */
  W.addEventListener("hashchange", function () { if (!/^#stocks\/[^/]+/.test(location.hash)) { S.page = null; S.rt = (S.rt || 0) + 1; sideNav(null, null); } }); /* another page: the menu stays, nothing marked */
  if (!boot()) { var tries = 0, t = setInterval(function () { if (boot() || ++tries > 40) clearInterval(t); }, 250); }
})();
