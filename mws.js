/* Mr. Wall Street — shared app runtime. Loaded by join / signup / login / account. */
window.MWS = window.MWS || {};
(function () {
  var C = window.MWS.config = {
    SUPABASE_URL: "https://rgvyyxphqhtedhgvwopy.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_OWxxeqr1TnJCeQMcJGB9oA_X1qh-i6a",
    SITE: "https://mrofwallstreet.com",
    PLANS: {
      monthly: { id: "plan_zKhMuAvHoXfE2", title: "Monthly", price: "$99", per: "/ month", tag: "Most popular", sub: "Billed monthly. Cancel anytime." },
      yearly:  { id: "plan_0LdJbWcZD6tGE", title: "Yearly",  price: "$990", per: "/ year", tag: "Best value", sub: "Billed yearly. Two months free." },
      lifetime:{ id: "plan_vuo4wah1I85pO", title: "Lifetime", price: "$3,990", per: "one-time", tag: "Golden entry", sub: "One payment. Forever. Never pays again." },
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
  window.MWS.sb = function(){ if(!sb){ sb = C.SUPABASE_URL.indexOf('__')===0 ? previewClient() : window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); } return sb; };
  /* offline preview stub (only when the config placeholders are not filled) */
  function previewClient(){
    var q = new URLSearchParams(location.search), mode = q.get('preview')||'';
    var user = mode ? { id:'u1', email:'member@example.com', created_at:'2026-04-02T00:00:00Z' } : null;
    var access = mode==='owner' ? { valid:true, status:'owner', plan_key:'owner', reason:'staff', grace_days:3 } : mode==='active' ? { valid:true, status:'active', plan_key:'yearly', renewal_period_end:'2027-09-27T00:00:00Z', manage_url:'#', grace_days:3 } : mode==='pastdue' ? { valid:true, status:'past_due', plan_key:'monthly', renewal_period_end:'2026-10-27T00:00:00Z', manage_url:'#', grace_days:3 } : { valid:false, reason:'none' };
    var tables = { profiles: mode==='active' ? [{ id:'u1', email:'member@example.com', role:'owner', email_updates:true, created_at:'2026-04-02T00:00:00Z' },{ id:'u2', email:'old@example.com', role:'member', email_updates:true, created_at:'2026-05-10T00:00:00Z' }] : { id:'u1', email:'member@example.com', role:'member', email_updates:true, created_at:'2026-04-02T00:00:00Z' }, memberships: mode==='active' ? [{id:'mem_1',email:'member@example.com',user_id:'u1',plan_key:'yearly',status:'active',renewal_period_end:'2027-09-27',updated_at:'2026-09-27'},{id:'mem_2',email:'whop.only@example.com',user_id:null,plan_key:'monthly',status:'active',renewal_period_end:'2026-10-27',updated_at:'2026-09-27'},{id:'manual_x1',email:'crypto@example.com',user_id:null,plan_key:'lifetime',status:'completed',renewal_period_end:null,updated_at:'2026-09-27'},{id:'mem_3',email:'old@example.com',user_id:null,plan_key:'monthly',status:'canceled',renewal_period_end:'2026-08-01',updated_at:'2026-08-01'}] : [], audit_log: [{at:'2026-09-27T12:42:52Z',actor:'webhook:membership.activated',action:'membership.status',subject:'mem_1'},{at:'2026-09-27T12:19:00Z',actor:'admin:owner',action:'admin.grant',subject:'crypto@example.com'}], telegram_links: mode==='active' ? { user_id:'u1', telegram_id:1, telegram_username:'gustavo', linked_at:'2026-09-27' } : null, channels: [{chat_id:1,title:'Exclusive ♠️',sort:1,enabled:true},{chat_id:2,title:'Positions List',sort:2,enabled:true},{chat_id:3,title:'Market Desk',sort:3,enabled:true},{chat_id:4,title:'Private Chat 💬',sort:4,enabled:true}], telegram_access: mode==='active' ? [{user_id:'u1',chat_id:1,status:'joined'},{user_id:'u1',chat_id:2,status:'joined'},{user_id:'u1',chat_id:3,status:'invited'},{user_id:'u1',chat_id:4,status:'joined'}] : [], settings: [{key:'grace_days',value:'3'},{key:'invite_ttl_hours',value:'24'}], whop_events: mode==='active' ? [{id:'msg_1',type:'payment.succeeded',received_at:'2026-09-27T12:42:52Z',payload:{data:{id:'pay_1',total:990,currency:'usd',paid_at:'2026-09-27T12:42:50Z',user:{email:'member@example.com'},plan:{id:'plan_0LdJbWcZD6tGE'}}}},{id:'msg_2',type:'payment.succeeded',received_at:'2026-09-20T10:00:00Z',payload:{data:{id:'pay_2',total:99,currency:'usd',paid_at:'2026-09-20T10:00:00Z',user:{email:'whop.only@example.com'},plan:{id:'plan_zKhMuAvHoXfE2'}}}},{id:'msg_3',type:'payment.failed',received_at:'2026-09-25T09:00:00Z',payload:{data:{id:'pay_3',total:99,currency:'usd',user:{email:'old@example.com'},plan:{id:'plan_zKhMuAvHoXfE2'}}}}] : [] };
    function chain(t){ var c = { select:function(){return c;}, eq:function(){return c;}, like:function(){return c;}, order:function(){return c;}, limit:function(){return c;}, update:function(){return c;}, maybeSingle:function(){ var v = tables[t]; return Promise.resolve({ data: Array.isArray(v)?(v[0]||null):v }); }, then:function(res){ var v = tables[t]; return Promise.resolve({ data: Array.isArray(v)?v:(v?[v]:[]) }).then(res); } }; return c; }
    return { auth:{ getSession:function(){ return Promise.resolve({ data:{ session: user ? { user:user, access_token:'x' } : null } }); }, onAuthStateChange:function(){}, signOut:function(){ return Promise.resolve({}); }, signUp:function(){ return Promise.resolve({ data:{ user:{identities:[1]}, session:null } }); }, verifyOtp:function(){ return Promise.resolve({ data:{} }); }, signInWithPassword:function(){ return Promise.resolve({ error:{ message:'Invalid login credentials' } }); }, resetPasswordForEmail:function(){ return Promise.resolve({}); }, updateUser:function(){ return Promise.resolve({}); }, resend:function(){ return Promise.resolve({}); } }, from:function(t){ return chain(t); }, rpc:function(){ return Promise.resolve({ data: access }); }, channel:function(){ var ch={ on:function(){return ch;}, subscribe:function(){} }; return ch; } };
  }

  /* helpers */
  var $ = window.MWS.$ = function(s, r){ return (r||document).querySelector(s); };
  window.MWS.$$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  window.MWS.msg = function(el, text, kind){ el = typeof el==='string' ? $(el) : el; if(!el) return; el.textContent = text||''; el.className = 'msg' + (text ? ' on' : '') + (kind ? ' '+kind : ''); };
  window.MWS.busy = function(btn, on){ btn = typeof btn==='string' ? $(btn) : btn; if(!btn) return; btn.classList.toggle('busy', !!on); if(on){ btn.dataset.t = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>' + (btn.dataset.busy || 'One moment'); } else if(btn.dataset.t){ btn.innerHTML = btn.dataset.t; } };
  window.MWS.go = function(path){ location.href = path; };
  window.MWS.qs = function(k){ return new URLSearchParams(location.search).get(k); };
  /* store: survives new tabs (the email link opens one) — used for the checkout handoff. sess: this tab only. */
  function storage(s){ return { get: function(k){ try{ return JSON.parse(s.getItem(k)); }catch(e){ return null; } }, set: function(k,v){ try{ s.setItem(k, JSON.stringify(v)); }catch(e){} }, del: function(k){ try{ s.removeItem(k); }catch(e){} } }; }
  window.MWS.store = storage(window.localStorage);
  window.MWS.sess = storage(window.sessionStorage);
  /* the checkout handoff (plan, email, receipt) — expires after 7 days; a receipt id in the URL (Whop return-url) is captured */
  window.MWS.signupState = function(){
    var st = window.MWS.store.get('mws_signup') || window.MWS.sess.get('mws_signup') || {};
    if (st.at && Date.now() - st.at > 7 * 86400000) st = {};
    var rq = window.MWS.qs('receipt_id') || window.MWS.qs('receipt') || window.MWS.qs('payment_id');
    if (rq && /^pay_[A-Za-z0-9]+$/.test(rq)) { st.receipt = rq; st.paid = true; }
    return st;
  };
  window.MWS.saveSignup = function(st){ st.at = st.at || Date.now(); window.MWS.store.set('mws_signup', st); };
  window.MWS.fmtDate = function(iso){ if(!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); };
  window.MWS.validEmail = function(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e||''); };

  /* call an edge function with the user's session */
  window.MWS.fn = async function(name, body){
    var s = await window.MWS.sb().auth.getSession();
    var token = s.data.session ? s.data.session.access_token : C.SUPABASE_ANON_KEY;
    if (C.SUPABASE_URL.indexOf('__')===0) return { ok:true, url:'https://t.me/MrWallStreetBot?start=preview', found:0 };
    var r = await fetch(C.FUNCTIONS + '/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': C.SUPABASE_ANON_KEY }, body: JSON.stringify(body||{}) });
    var j = null; try { j = await r.json(); } catch(e) { j = { error: 'bad response' }; }
    if(!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
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
    var ch = (channels && channels.length) ? channels : [{ chat_id: 1, title: 'Exclusive ♠️' }, { chat_id: 2, title: 'Positions List' }, { chat_id: 3, title: 'Market Desk' }, { chat_id: 4, title: 'Private Chat 💬' }];
    var tg = (k === 'active' || k === 'lifetime' || k === 'pastdue' || k === 'ending');
    return { key: k, access: A[k], link: tg ? { telegram_username: 'member', telegram_name: 'Member' } : null, channels: ch, tgAccess: tg ? ch.map(function(c){ return { chat_id: c.chat_id, status: 'joined' }; }) : [] };
  };
  window.MWS.toast = function(text){ var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = text; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(function(){ t.style.display = 'none'; }, 2600); };
  function viewBar(){
    if ($('#viewbar')) return;
    var va = window.MWS.viewAs.get(), P = window.MWS.PRESETS, onAccount = /^\/account/.test(location.pathname);
    var opts = Object.keys(P).map(function(k){ return '<option value="' + k + '"' + (k === va ? ' selected' : '') + '>' + P[k] + '</option>'; }).join('');
    document.body.insertAdjacentHTML('beforeend', '<div id="viewbar" class="viewbar" role="status"><span class="dot"></span><span class="lbl">Viewing as</span><select id="va-sel" aria-label="Preview as">' + opts + '</select>' + (onAccount ? '' : '<a href="/account">Account page</a>') + '<button type="button" id="va-exit">Back to admin</button></div>');
    $('#va-sel').addEventListener('change', function(){ window.MWS.viewAs.set(this.value); if (onAccount) location.reload(); else window.MWS.go('/account'); });
    $('#va-exit').addEventListener('click', function(){ window.MWS.viewAs.set(''); window.MWS.go('/admin'); });
  }

  /* header account state */
  window.MWS.header = async function(){
    var s = await window.MWS.sb().auth.getSession();
    var user = s.data.session && s.data.session.user;
    var slot = $('#hdr-actions'); if(!slot) return user;
    if(user){
      var onAccount = /^\/account/.test(location.pathname);
      slot.innerHTML = (onAccount ? '' : '<a class="btn sm ghost" href="/account"><span class="t">My account</span></a>') + '<button class="btn sm ' + (onAccount ? 'ghost' : 'acc') + '" id="hdr-out" type="button">Log out</button>';
      try { var pr = await window.MWS.sb().from('profiles').select('role').eq('id', user.id).maybeSingle(); var staff = pr.data && (pr.data.role === 'owner' || pr.data.role === 'admin'); window.MWS.isStaff = !!staff; if (staff && window.MWS.viewAs.get()) viewBar(); else if (staff && !/^\/admin/.test(location.pathname)) slot.insertAdjacentHTML('afterbegin', '<a class="btn sm ghost" href="/admin"><span class="t">Admin</span></a>'); } catch (e) {}
      $('#hdr-out').addEventListener('click', async function(){ window.MWS.viewAs.set(''); await window.MWS.sb().auth.signOut(); window.MWS.go('/'); });
    } else {
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
    return m;
  };
})();
