/* Mr. Wall Street — shared app runtime. Loaded by join / signup / login / account. */
window.MWS = window.MWS || {};
(function () {
  var C = window.MWS.config = {
    SUPABASE_URL: "https://rgvyyxphqhtedhgvwopy.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_OWxxeqr1TnJCeQMcJGB9oA_X1qh-i6a",
    SITE: "https://mrofwallstreet.com",
    PLANS: {
      monthly: { id: "plan_zKhMuAvHoXfE2", title: "Monthly", price: "$99", per: "/ month", tag: "Most popular", sub: "Cancel anytime. The easiest way in." },
      yearly:  { id: "plan_0LdJbWcZD6tGE", title: "Yearly",  price: "$990", per: "/ year", tag: "Best value", sub: "$82.50 a month, billed annually. Two months free." },
      lifetime:{ id: "plan_vuo4wah1I85pO", title: "Lifetime", price: "$3,990", per: "one-time", tag: "Golden entry", sub: "One payment. Everything, forever. Immune to price rises." },
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
    var access = mode==='active' ? { valid:true, status:'active', plan_key:'yearly', renewal_period_end:'2027-09-27T00:00:00Z', manage_url:'#', grace_days:3 } : mode==='pastdue' ? { valid:true, status:'past_due', plan_key:'monthly', renewal_period_end:'2026-10-27T00:00:00Z', manage_url:'#', grace_days:3 } : { valid:false, reason:'none' };
    var tables = { profiles: { id:'u1', email:'member@example.com', email_updates:true, created_at:'2026-04-02T00:00:00Z' }, telegram_links: mode==='active' ? { user_id:'u1', telegram_id:1, telegram_username:'gustavo', linked_at:'2026-09-27' } : null, channels: [{chat_id:1,title:'Exclusive ♠️',sort:1},{chat_id:2,title:'Positions List',sort:2},{chat_id:3,title:'Market Desk',sort:3},{chat_id:4,title:'Private Chat 💬',sort:4}], telegram_access: mode==='active' ? [{chat_id:1,status:'joined'},{chat_id:2,status:'joined'},{chat_id:3,status:'invited'},{chat_id:4,status:'joined'}] : [] };
    function chain(t){ var c = { select:function(){return c;}, eq:function(){return c;}, order:function(){return c;}, update:function(){return c;}, maybeSingle:function(){ return Promise.resolve({ data: Array.isArray(tables[t])?null:tables[t] }); }, then:function(res){ return Promise.resolve({ data: tables[t]||[] }).then(res); } }; return c; }
    return { auth:{ getSession:function(){ return Promise.resolve({ data:{ session: user ? { user:user, access_token:'x' } : null } }); }, onAuthStateChange:function(){}, signOut:function(){ return Promise.resolve({}); }, signUp:function(){ return Promise.resolve({ data:{ user:{identities:[1]}, session:null } }); }, verifyOtp:function(){ return Promise.resolve({ data:{} }); }, signInWithPassword:function(){ return Promise.resolve({ error:{ message:'Invalid login credentials' } }); }, resetPasswordForEmail:function(){ return Promise.resolve({}); }, updateUser:function(){ return Promise.resolve({}); }, resend:function(){ return Promise.resolve({}); } }, from:function(t){ return chain(t); }, rpc:function(){ return Promise.resolve({ data: access }); }, channel:function(){ var ch={ on:function(){return ch;}, subscribe:function(){} }; return ch; } };
  }

  /* helpers */
  var $ = window.MWS.$ = function(s, r){ return (r||document).querySelector(s); };
  window.MWS.$$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  window.MWS.msg = function(el, text, kind){ el = typeof el==='string' ? $(el) : el; if(!el) return; el.textContent = text||''; el.className = 'msg' + (text ? ' on' : '') + (kind ? ' '+kind : ''); };
  window.MWS.busy = function(btn, on){ btn = typeof btn==='string' ? $(btn) : btn; if(!btn) return; btn.classList.toggle('busy', !!on); if(on){ btn.dataset.t = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>' + (btn.dataset.busy || 'One moment'); } else if(btn.dataset.t){ btn.innerHTML = btn.dataset.t; } };
  window.MWS.go = function(path){ location.href = path; };
  window.MWS.qs = function(k){ return new URLSearchParams(location.search).get(k); };
  window.MWS.store = { get: function(k){ try{ return JSON.parse(sessionStorage.getItem(k)); }catch(e){ return null; } }, set: function(k,v){ try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch(e){} }, del: function(k){ try{ sessionStorage.removeItem(k); }catch(e){} } };
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

  /* header account state */
  window.MWS.header = async function(){
    var s = await window.MWS.sb().auth.getSession();
    var user = s.data.session && s.data.session.user;
    var slot = $('#hdr-actions'); if(!slot) return user;
    if(user){
      slot.innerHTML = '<a class="btn sm ghost" href="/account"><span class="t">My account</span></a><button class="btn sm acc" id="hdr-out" type="button">Log out</button>';
      $('#hdr-out').addEventListener('click', async function(){ await window.MWS.sb().auth.signOut(); window.MWS.go('/'); });
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
