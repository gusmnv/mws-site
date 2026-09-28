/* Mr. Wall Street — shared app runtime. Loaded by join / signup / login / app (member area) / admin. */
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
    var user = mode ? { id:'u1', email:'member@example.com', created_at:'2026-04-02T00:00:00Z' } : null; var full = mode==='owner' ? 'Gustavo Owner' : 'Alex Member';
    var access = mode==='owner' ? { valid:true, status:'owner', plan_key:'owner', reason:'staff', grace_days:3 } : mode==='active' ? { valid:true, status:'active', plan_key:'yearly', renewal_period_end:'2027-09-27T00:00:00Z', manage_url:'#', grace_days:3 } : mode==='pastdue' ? { valid:true, status:'past_due', plan_key:'monthly', renewal_period_end:'2026-10-27T00:00:00Z', manage_url:'#', grace_days:3 } : { valid:false, reason:'none' };
    var tables = { profiles: mode==='active' ? [{ id:'u1', email:'member@example.com', full_name:full, role:'owner', email_updates:true, created_at:'2026-04-02T00:00:00Z' },{ id:'u2', email:'old@example.com', role:'member', email_updates:true, created_at:'2026-05-10T00:00:00Z' }] : { id:'u1', email:'member@example.com', full_name:full, role: mode==='owner' ? 'owner' : 'member', email_updates:true, created_at:'2026-04-02T00:00:00Z' }, memberships: mode==='active' ? [{id:'mem_1',email:'member@example.com',user_id:'u1',plan_key:'yearly',status:'active',renewal_period_end:'2027-09-27',updated_at:'2026-09-27'},{id:'mem_2',email:'whop.only@example.com',user_id:null,plan_key:'monthly',status:'active',renewal_period_end:'2026-10-27',updated_at:'2026-09-27'},{id:'manual_x1',email:'crypto@example.com',user_id:null,plan_key:'lifetime',status:'completed',renewal_period_end:null,updated_at:'2026-09-27'},{id:'mem_3',email:'old@example.com',user_id:null,plan_key:'monthly',status:'canceled',renewal_period_end:'2026-08-01',updated_at:'2026-08-01'}] : [], audit_log: [{id:9,at:new Date(Date.now()-5*60000).toISOString(),actor:'telegram',action:'join.declined',subject:'u2',detail:{chat_id:1,why:'no active membership',username:'oldmember'}},{id:8,at:new Date(Date.now()-12*60000).toISOString(),actor:'telegram',action:'join.approved',subject:'u1',detail:{chat_id:1,username:'gustavo'}},{id:7,at:new Date(Date.now()-12*60000-9000).toISOString(),actor:'telegram',action:'link.created',subject:'u1',detail:{username:'gustavo',via:'join_request'}},{id:6,at:new Date(Date.now()-3*3600000).toISOString(),actor:'webhook:payment.failed',action:'membership.status',subject:'mem_2',detail:{from:'active',to:'past_due',email:'whop.only@example.com'}},{id:5,at:new Date(Date.now()-26*3600000).toISOString(),actor:'system',action:'reconcile',subject:null,detail:{ms:2100,users:3,checked:257,changed:0,granted:0,revoked:0}},{id:4,at:new Date(Date.now()-27*3600000).toISOString(),actor:'telegram',action:'channel.pending',subject:'-100555',detail:{title:'Some random group',type:'supergroup',by:12345}},{id:3,at:new Date(Date.now()-50*3600000).toISOString(),actor:'admin:member@example.com',action:'admin.grant',subject:'crypto@example.com',detail:{plan_key:'lifetime'}},{id:2,at:new Date(Date.now()-51*3600000).toISOString(),actor:'system',action:'plan.new',subject:'plan_x',detail:{title:'Weekend pass',price:3,grants_access:false}},{id:1,at:new Date(Date.now()-52*3600000).toISOString(),actor:'system',action:'telegram.revoked',subject:'u2',detail:{reason:'membership ended',blocked:false}}], telegram_links: mode==='active' ? { user_id:'u1', telegram_id:1, telegram_username:'gustavo', linked_at:'2026-09-27' } : null, channels: [{chat_id:1,title:'Exclusive ♠️',sort:1,enabled:true},{chat_id:2,title:'Positions List',sort:2,enabled:true},{chat_id:3,title:'Market Desk',sort:3,enabled:true},{chat_id:4,title:'Private Chat 💬',sort:4,enabled:true}], telegram_access: mode==='active' ? [{user_id:'u1',chat_id:1,status:'joined'},{user_id:'u1',chat_id:2,status:'joined'},{user_id:'u1',chat_id:3,status:'invited'},{user_id:'u1',chat_id:4,status:'joined'}] : [], settings: [{key:'grace_days',value:'3'},{key:'invite_ttl_hours',value:'24'}], positions: (mode==='active'||mode==='owner') ? [{id:'p1',symbol:'BTC',name:'Bitcoin',side:'long',asset_class:'crypto',entry:'57.7-64K',entry_price:61000,mark:83000,mark_at:'2026-09-24',target:'130K',size_pct:35,status:'open',opened_at:'2026-08-11',thesis:'Cycle bottom is in at 57.7K. First target open.',updated_at:'2026-09-24T00:00:00Z',sort:1},{id:'p2',symbol:'MSTR',name:'Strategy',side:'long',asset_class:'equity',entry:'$90-100',entry_price:95,mark:162,target:'$950',size_pct:20,status:'open',opened_at:'2026-07-23',thesis:'Not selling one share.',sort:2},{id:'p3',symbol:'BTC',name:'Bitcoin · 2022 cycle',side:'long',asset_class:'crypto',entry:'16-18K',exit:'100-126K',result:'x7',status:'closed',opened_at:'2022-11-20',closed_at:'2025-11-16',thesis:'Bought when the market called for 10-12K.',sort:100}] : [], whop_events: mode==='active' ? [{id:'msg_1',type:'payment.succeeded',received_at:'2026-09-27T12:42:52Z',payload:{data:{id:'pay_1',total:990,currency:'usd',paid_at:'2026-09-27T12:42:50Z',user:{email:'member@example.com'},plan:{id:'plan_0LdJbWcZD6tGE'}}}},{id:'msg_2',type:'payment.succeeded',received_at:'2026-09-20T10:00:00Z',payload:{data:{id:'pay_2',total:99,currency:'usd',paid_at:'2026-09-20T10:00:00Z',user:{email:'whop.only@example.com'},plan:{id:'plan_zKhMuAvHoXfE2'}}}},{id:'msg_3',type:'payment.failed',received_at:'2026-09-25T09:00:00Z',payload:{data:{id:'pay_3',total:99,currency:'usd',user:{email:'old@example.com'},plan:{id:'plan_zKhMuAvHoXfE2'}}}}] : [] };
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
    if (rq && /^pay_[A-Za-z0-9]+$/.test(rq)) { st.receipt = rq; st.paid = true; st.paidAt = st.paidAt || Date.now(); }
    return st;
  };
  window.MWS.saveSignup = function(st){ st.at = st.at || Date.now(); window.MWS.store.set('mws_signup', st); };
  window.MWS.fmtDate = function(iso){ if(!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); };
  window.MWS.validEmail = function(e){ return /^[^\s@"<>()]+@[^\s@]+\.[^\s@]{2,}$/.test(e||''); };
  /* escape anything that came from a user, Whop or Telegram before it goes into innerHTML */
  window.MWS.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  /* only same-origin paths are allowed as a post-login destination */
  window.MWS.safeNext = function(n){ try { var u = new URL(n || '/app', location.origin); if (u.origin !== location.origin || u.pathname === '/login') return '/app'; if (u.pathname === '/account') u.pathname = '/app'; return u.pathname + u.search + (/^#[a-z]+$/.test(u.hash) ? u.hash : ''); } catch (e) { return '/app'; } };

  /* call an edge function with the user's session */
  window.MWS.fn = async function(name, body){
    var s = await window.MWS.sb().auth.getSession();
    var token = s.data.session ? s.data.session.access_token : C.SUPABASE_ANON_KEY;
    if (C.SUPABASE_URL.indexOf('__')===0) { if (name === 'tg-link' && body && body.action === 'links') return { ok:true, linked:false, links:[{chat_id:1,title:'Exclusive ♠️',status:'joined',invite_link:'#'},{chat_id:2,title:'Positions List',status:'invited',invite_link:'https://t.me/+preview'},{chat_id:3,title:'Market Desk',status:'left',invite_link:null},{chat_id:4,title:'Private Chat 💬',status:'invited',invite_link:'https://t.me/+preview2'}] }; return { ok:true, url:'https://t.me/MrWallStreetBot?start=preview', found:0 }; }
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
      var out = $('#hdr-out'); if (out) out.addEventListener('click', async function(){ window.MWS.viewAs.set(''); await window.MWS.sb().auth.signOut(); window.MWS.go('/'); });
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
    return m;
  };
})();
