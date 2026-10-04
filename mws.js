/* Mr. Wall Street — shared app runtime. Loaded by join / signup / login / app (member area) / admin. */
window.MWS = window.MWS || {};
(function () {
  var C = window.MWS.config = {
    SUPABASE_URL: "https://rgvyyxphqhtedhgvwopy.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_OWxxeqr1TnJCeQMcJGB9oA_X1qh-i6a",
    SITE: "https://mrofwallstreet.com",
    PLANS: {
      monthly: { id: "plan_zKhMuAvHoXfE2", title: "Monthly Core", name: "Mr. Wall Street Core", price: "$99", per: "/ month", tag: "Most popular", sub: "Mr. Wall Street Core, billed monthly. Cancel anytime." },
      yearly:  { id: "plan_0LdJbWcZD6tGE", title: "Yearly Core", name: "Mr. Wall Street Core", price: "$990", per: "/ year", tag: "Best value", sub: "Mr. Wall Street Core, billed yearly. Save $198 a year." },
      lifetime:{ id: "plan_vuo4wah1I85pO", title: "Lifetime", name: "Mr. Wall Street Lifetime", price: "$3,990", per: "one-time", tag: "Golden entry", sub: "Mr. Wall Street Lifetime. One payment. Forever." },
      test:    { id: "plan_YLIcoMLF4LFih", title: "Test", price: "$1", per: "one-time", tag: "Internal", sub: "Internal test plan. Not for members.", hidden: true }
    },
    WHOP_LOADER: "https://js.whop.com/static/checkout/loader.js"
  };
  C.FUNCTIONS = C.SUPABASE_URL.replace(".supabase.co", ".supabase.co/functions/v1");

  /* grid: whole squares, first row under the header */
  function gridFit(){var d=document.documentElement,w=d.clientWidth,n=Math.max(4,Math.round(w/72)),h=document.querySelector('header.top');d.style.setProperty('--gs',(w/n).toFixed(3)+'px');d.style.setProperty('--gy',(h?h.offsetHeight:56)+'px');}
  gridFit(); window.addEventListener('resize', gridFit); window.addEventListener('load', gridFit);

  /* supabase client */
  var sb = null;
  window.MWS.sb = function(){ if(!sb){ sb = C.SUPABASE_URL.indexOf('__')===0 ? previewClient() : window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); try { sb.auth.onAuthStateChange(function(ev){ if (ev === 'SIGNED_OUT') window.MWS.store.del('mws_access'); }); } catch (e) {} } return sb; };
  function previewClient(){ return null; }

  /* helpers */
  var $ = window.MWS.$ = function(s, r){ return (r||document).querySelector(s); };
  window.MWS.$$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  window.MWS.msg = function(el, text, kind){ el = typeof el==='string' ? $(el) : el; if(!el) return; el.textContent = text||''; el.className = 'msg' + (text ? ' on' : '') + (kind ? ' '+kind : ''); };
  /* busy button: spinner + disabled (a second click or Enter while a request runs does nothing); idempotent either way */
  window.MWS.busy = function(btn, on){
    btn = typeof btn==='string' ? $(btn) : btn; if(!btn) return;
    if(on){ if(btn.classList.contains('busy')) return; btn.classList.add('busy'); btn.dataset.t = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>' + (btn.dataset.busy || 'One moment'); btn.disabled = true; }
    else { btn.classList.remove('busy'); if(btn.dataset.t){ btn.innerHTML = btn.dataset.t; delete btn.dataset.t; } btn.disabled = false; }
  };
  window.MWS.go = function(path){ location.href = path; };
  window.MWS.qs = function(k){ return new URLSearchParams(location.search).get(k); };
  /* store: survives new tabs (the email link opens one) — used for the checkout handoff. sess: this tab only. */
  function storage(s){ return { get: function(k){ try{ return JSON.parse(s.getItem(k)); }catch(e){ return null; } }, set: function(k,v){ try{ s.setItem(k, JSON.stringify(v)); }catch(e){} }, del: function(k){ try{ s.removeItem(k); }catch(e){} } }; }
  window.MWS.store = storage(window.localStorage);
  window.MWS.sess = storage(window.sessionStorage);
  /* the checkout handoff (plan, email, receipt) — expires after 7 days; a receipt id in the URL (Whop return-url) is captured.
     The "paid" flag and the receipt are trusted for 6 hours, the same window the claim function accepts: after that the
     payment either matched long ago or needs support, and re-sending the receipt would only produce rejected claims. */
  window.MWS.PAID_WINDOW = 6 * 3600000;
  window.MWS.signupState = function(){
    var st = window.MWS.store.get('mws_signup') || window.MWS.sess.get('mws_signup') || {};
    if (st.at && Date.now() - st.at > 7 * 86400000) st = {};
    if ((st.receipt || st.paid) && Date.now() - (st.paidAt || st.at || 0) > window.MWS.PAID_WINDOW) { delete st.receipt; delete st.paidAt; st.paid = false; }
    var rq = window.MWS.qs('receipt_id') || window.MWS.qs('receipt') || window.MWS.qs('payment_id');
    if (rq && /^pay_[A-Za-z0-9]+$/.test(rq)) { st.receipt = rq; st.paid = true; st.paidAt = st.paidAt || Date.now(); }
    return st;
  };
  window.MWS.paidRecently = function(st){ return !!(st && st.paid && Date.now() - (st.paidAt || st.at || 0) < window.MWS.PAID_WINDOW); };
  window.MWS.saveSignup = function(st){ st.at = st.at || Date.now(); window.MWS.store.set('mws_signup', st); };
  window.MWS.fmtDate = function(iso){ if(!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); };
  window.MWS.validEmail = function(e){ return /^[^\s@"<>()]+@[^\s@]+\.[^\s@]{2,}$/.test(e||''); };
  /* escape anything that came from a user, Whop or Telegram before it goes into innerHTML */
  window.MWS.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  /* only same-origin paths are allowed as a post-login destination */
  window.MWS.safeNext = function(n){
    try {
      var u = new URL(n || '/app', location.origin);
      if (u.origin !== location.origin || u.pathname === '/login') return '/app';
      var p = u.pathname.replace(/\/{2,}/g, '/'); /* "/app//evil.com" would be read by the browser as a protocol-relative link to evil.com */
      if (p === '/account') p = '/app';
      return p + u.search + (/^#[a-z]+$/.test(u.hash) ? u.hash : '');
    } catch (e) { return '/app'; }
  };

  /* call an edge function with the user's session */
  window.MWS.fn = async function(name, body){
    var s = await window.MWS.sb().auth.getSession();
    var token = s.data.session ? s.data.session.access_token : C.SUPABASE_ANON_KEY;
    
    var r = await fetch(C.FUNCTIONS + '/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': C.SUPABASE_ANON_KEY }, body: JSON.stringify(body||{}) });
    var j = null; try { j = await r.json(); } catch(e) { j = { error: 'bad response' }; }
    if(!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  };

  /* log out of this device (scope 'local'; the Devices page has the "all other devices" button): preview mode off, access cache
     gone, the checkout handoff forgotten — a sign-out is a change of person, and a receipt left behind on a shared browser must
     never be claimed by whoever logs in next. If Supabase cannot be reached the stored session is dropped by hand, so the person
     is never stuck "logged in". */
  window.MWS.signOut = async function(to, scope){
    window.MWS.viewAs.set(''); window.MWS.store.del('mws_access'); window.MWS.store.del('mws_signup'); window.MWS.sess.del('mws_signup');
    try { var r = await window.MWS.sb().auth.signOut({ scope: scope || 'local' }); if (r && r.error) throw r.error; }
    catch (e) { try { var ref = /^https?:\/\/([^.\/]+)\./.exec(C.SUPABASE_URL); if (ref) window.localStorage.removeItem('sb-' + ref[1] + '-auth-token'); } catch (e2) {} }
    window.MWS.go(to || '/');
  };

  /* "view as member" (owners/admins): a preset replaces the account data on /account, the Admin button hides, a bar shows the way back */
  var VA_KEY = 'mws_viewas';
  window.MWS.viewAs = { get: function(){ return window.MWS.sess.get(VA_KEY) || ''; }, set: function(v){ if (v) window.MWS.sess.set(VA_KEY, v); else window.MWS.sess.del(VA_KEY); } };
  window.MWS.PRESETS = { joined: 'New member · just paid, no Telegram yet', active: 'Active member · Telegram connected', lifetime: 'Lifetime member', pastdue: 'Payment failing · in grace period', ending: 'Cancelling at period end', none: 'Logged in · no plan', canceled: 'Cancelled member', real: 'My real account' };
  window.MWS.sim = function(channels){
    var k = window.MWS.viewAs.get(); if (!k || k === 'real' || !window.MWS.PRESETS[k]) return null;
    var y = new Date(Date.now() + 365 * 86400000).toISOString(), m = new Date(Date.now() + 23 * 86400000).toISOString(), g = 3;
    var A = {
      joined:   { valid: true, status: 'active', plan_key: 'yearly', renewal_period_end: y, manage_url: 'https://whop.com/orders', grace_days: g },
      active:   { valid: true, status: 'active', plan_key: 'yearly', renewal_period_end: y, manage_url: 'https://whop.com/orders', grace_days: g },
      lifetime: { valid: true, status: 'completed', plan_key: 'lifetime', renewal_period_end: null, manage_url: null, grace_days: g },
      pastdue:  { valid: true, status: 'past_due', plan_key: 'monthly', renewal_period_end: m, manage_url: 'https://whop.com/orders', grace_days: g, past_due_since: new Date().toISOString() },
      ending:   { valid: true, status: 'active', cancel_at_period_end: true, plan_key: 'monthly', renewal_period_end: m, manage_url: 'https://whop.com/orders', grace_days: g },
      none:     { valid: false, reason: 'none' },
      canceled: { valid: false, reason: 'inactive', status: 'canceled', plan_key: 'monthly' }
    };
    var ch = (channels && channels.length) ? channels : [{ chat_id: 1, title: 'Mr. Wall Street | Exclusive' }, { chat_id: 2, title: 'Mr. Wall Street | Chat' }];
    var tg = (k === 'active' || k === 'lifetime' || k === 'pastdue' || k === 'ending');
    return { key: k, access: A[k], link: tg ? { telegram_username: 'member', telegram_name: 'Member' } : null, channels: ch, tgAccess: tg ? ch.map(function(c){ return { chat_id: c.chat_id, status: 'joined' }; }) : [] };
  };
  window.MWS.toast = function(text){ var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = text; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(function(){ t.style.display = 'none'; }, 2600); };
  function viewBar(){
    if ($('#viewbar')) return;
    var va = window.MWS.viewAs.get(), P = window.MWS.PRESETS, onAccount = /^\/(app|account)/.test(location.pathname);
    var opts = Object.keys(P).map(function(k){ return '<option value="' + k + '"' + (k === va ? ' selected' : '') + '>' + P[k] + '</option>'; }).join('');
    document.body.insertAdjacentHTML('beforeend', '<div id="viewbar" class="viewbar" role="status"><span class="dot"></span><span class="lbl">Viewing as</span><select id="va-sel" aria-label="Preview as">' + opts + '</select>' + (onAccount ? '' : '<a href="/app">Member area</a>') + '<button type="button" id="va-exit">Back to admin</button></div>');
    $('#va-sel').addEventListener('change', function(){ window.MWS.viewAs.set(this.value); if (onAccount) location.reload(); else window.MWS.go('/app'); });
    $('#va-exit').addEventListener('click', function(){ window.MWS.viewAs.set(''); window.MWS.go('/admin'); });
  }

  /* header account state (pages with the marketing header) + the view-as bar (any page) */
  window.MWS.header = async function(){
    var s = await window.MWS.sb().auth.getSession();
    var user = s.data.session && s.data.session.user;
    var slot = $('#hdr-actions'), inApp = /^\/(app|account)/.test(location.pathname);
    if(user){
      if (slot) slot.innerHTML = (inApp ? '' : '<a class="btn sm ghost" href="/app"><span class="t">Member area</span></a>') + '<button class="btn sm ' + (inApp ? 'ghost' : 'acc') + '" id="hdr-out" type="button">Log out</button>';
      try { var pr = await window.MWS.sb().from('profiles').select('role').eq('id', user.id).maybeSingle(); var staff = pr.data && (pr.data.role === 'owner' || pr.data.role === 'admin'); window.MWS.isStaff = !!staff; if (staff && window.MWS.viewAs.get()) viewBar(); else if (staff && slot && !/^\/admin/.test(location.pathname)) slot.insertAdjacentHTML('afterbegin', '<a class="btn sm ghost" href="/admin"><span class="t">Admin</span></a>'); } catch (e) {}
      var out = $('#hdr-out'); if (out) out.addEventListener('click', function(){ window.MWS.signOut('/'); });
    } else if (slot) {
      slot.innerHTML = '<a class="btn sm ghost" href="/login"><span class="t">Log in</span></a><a class="btn sm acc" href="/join">Join now <span class="ar"></span></a>';
    }
    return user;
  };

  /* map errors to human text */
  window.MWS.human = function(e){
    var m = (e && (e.message || e.error_description || e.error)) || String(e);
    if(/already registered|already exists|User already/i.test(m)) return 'This email already has an account. Log in instead.';
    if(/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if(/Email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the code.';
    if(/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if(/Password should be/i.test(m)) return 'Password must be at least 8 characters.';
    if(/Token has expired|invalid.*otp|otp/i.test(m)) return 'That code is wrong or has expired. Request a new one.';
    if(/blocked by the user|bot was blocked/i.test(m)) return 'You blocked @MrWallStreetBot in Telegram. Unblock it and try again.';
    if(/Auth session missing/i.test(m)) return 'This link has expired. Request a new one from the login page.';
    if(/Failed to fetch|NetworkError|Load failed|network request failed/i.test(m)) return 'No connection. Check your internet and try again.';
    return m;
  };
})();
