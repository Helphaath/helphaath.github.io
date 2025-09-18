/* script.js - HelpHaath frontend logic
   - currency detection & conversion (placeholder rates)
   - preorders (localStorage)
   - demo profile (localStorage)
   - worker directory, search & booking (localStorage)
   - wishlist, orders, profile rendering
   Comments show where to replace with real backend integrations.
*/

(() => {
  // ---------- CONFIG ----------
  const currencyMap = {
    'US': {code:'USD', symbol:'$', rate:1},
    'IN': {code:'INR', symbol:'₹', rate:82},
    'JP': {code:'JPY', symbol:'¥', rate:150},
    'KR': {code:'KRW', symbol:'₩', rate:1350},
    'GB': {code:'GBP', symbol:'£', rate:0.79},
    'EU': {code:'EUR', symbol:'€', rate:0.92},
    'DEFAULT': {code:'USD', symbol:'$', rate:1}
  };
  const BASE_PRICE_USD = 6.5; // example base for eBook

  // ---------- UTILITIES ----------
  function detectCountryCode(){
    const lang = (navigator.language || navigator.userLanguage || 'en-US').toUpperCase();
    if(lang.includes('IN')) return 'IN';
    if(lang.includes('JP')) return 'JP';
    if(lang.includes('KO') || lang.includes('KR')) return 'KR';
    if(lang.includes('GB')) return 'GB';
    if(lang.includes('DE') || lang.includes('FR') || lang.includes('ES')) return 'EU';
    if(lang.includes('US')) return 'US';
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if(tz.includes('Asia/Kolkata')) return 'IN';
      if(tz.includes('Asia/Tokyo')) return 'JP';
      if(tz.includes('Asia/Seoul')) return 'KR';
    } catch(e){}
    return 'DEFAULT';
  }
  const country = detectCountryCode();
  const currency = currencyMap[country] || currencyMap['DEFAULT'];

  function localPrice(usd){
    return Math.round((usd * currency.rate + Number.EPSILON) * 100) / 100;
  }
  function formatPrice(usd){
    const price = localPrice(usd);
    if(currency.code==='JPY' || currency.code==='KRW') return `${currency.symbol}${Math.round(price)}`;
    return `${currency.symbol}${price}`;
  }

  // update all price placeholders
  function renderPrices(){
    document.querySelectorAll('[data-price-usd]').forEach(el=>{
      const usd = parseFloat(el.getAttribute('data-price-usd')) || BASE_PRICE_USD;
      el.textContent = formatPrice(usd);
    });
    const note = document.getElementById('currency-note');
    if(note) note.textContent = `Prices shown in ${currency.code}`;
  }

  // ---------- PRE-ORDER ----------
  function reservePreorder(email, note){
    const list = JSON.parse(localStorage.getItem('hh_preorders')||'[]');
    list.push({email, note, ts: new Date().toISOString(), country});
    localStorage.setItem('hh_preorders', JSON.stringify(list));
    return true;
  }

  // ---------- DEMO PROFILE ----------
  function getDemoUser(){ return JSON.parse(localStorage.getItem('hh_user')||'null'); }
  function setDemoUser(user){ localStorage.setItem('hh_user', JSON.stringify(user)); renderProfilePanel(); }
  function clearDemoUser(){ localStorage.removeItem('hh_user'); renderProfilePanel(); }

  function renderProfilePanel(){
    const user = getDemoUser();
    const nameEl = document.getElementById('profile-name');
    const roleEl = document.getElementById('profile-role');
    const avatarEl = document.getElementById('profile-avatar');
    const bookingsEl = document.getElementById('profile-bookings');
    const completedEl = document.getElementById('profile-completed');
    const earningsEl = document.getElementById('profile-earnings');
    const activitiesEl = document.getElementById('profile-activities');

    if(!nameEl) return; // not on pages where profile exists
    if(!user){
      nameEl.textContent='Guest';
      roleEl.textContent='Not signed in';
      avatarEl.textContent='GH';
      bookingsEl.textContent='Bookings: 0';
      completedEl.textContent='Completed: 0';
      earningsEl.textContent='Earnings: -';
      activitiesEl.innerHTML='<div class="act">No activities. Create demo profile.</div>';
      document.getElementById('btn-signin-demo') && (document.getElementById('btn-signin-demo').style.display='inline-block');
      document.getElementById('btn-signout-demo') && (document.getElementById('btn-signout-demo').style.display='none');
      return;
    }
    nameEl.textContent = user.name || 'John Doe';
    roleEl.textContent = user.role || 'Worker';
    avatarEl.textContent = ((user.name||'User').split(' ').map(s=>s[0]).slice(0,2).join('')).toUpperCase();
    bookingsEl.textContent = 'Bookings: ' + (user.bookings||0);
    completedEl.textContent = 'Completed: ' + (user.completed||0);
    earningsEl.textContent = 'Earnings: ' + (currency.symbol + (user.earnings || 0));
    const acts = (user.activities||[]);
    activitiesEl.innerHTML = acts.length ? acts.map(a=>`<div class="act">${a}</div>`).join('') : '<div class="act">No recent activity</div>';
    document.getElementById('btn-signin-demo') && (document.getElementById('btn-signin-demo').style.display='none');
    document.getElementById('btn-signout-demo') && (document.getElementById('btn-signout-demo').style.display='inline-block');
  }

  // ---------- WORKERS (demo data) ----------
  const workers = [
    {id:1,name:'Amit Kumar',skill:'Plumbing',city:'Delhi',rating:4.7,priceUSD:10},
    {id:2,name:'Sana Park',skill:'Cleaning',city:'Seoul',rating:4.8,priceUSD:8},
    {id:3,name:'Kenji Ito',skill:'Electrical',city:'Tokyo',rating:4.6,priceUSD:12},
    {id:4,name:'Lara Singh',skill:'Carpentry',city:'Mumbai',rating:4.5,priceUSD:9},
    {id:5,name:'Chris Lee',skill:'Cleaning',city:'NYC',rating:4.9,priceUSD:11}
  ];

  function renderWorkerList(list){
    const el = document.getElementById('worker-list');
    if(!el) return;
    el.innerHTML = list.map(w=>`
      <div class="worker card" data-id="${w.id}">
        <h4>${w.name} <small style="color:var(--muted);font-weight:600">· ${w.city}</small></h4>
        <div class="smallmuted">${w.skill} · ⭐ ${w.rating}</div>
        <div style="margin-top:10px;font-weight:700">${formatPrice(w.priceUSD)}</div>
        <div style="margin-top:8px">
          <button class="btn" onclick="hh.bookWorker(${w.id})">Book</button>
          <button class="btn-ghost" onclick="hh.saveWishlist(${w.id})">Save</button>
        </div>
      </div>
    `).join('');
  }

  // booking flow
  function bookWorker(id){
    const w = workers.find(x=>x.id===id);
    if(!w) return alert('Worker not found');
    const name = prompt('Your name for booking');
    if(!name) return;
    const date = prompt('Preferred date (YYYY-MM-DD)', new Date().toISOString().slice(0,10));
    if(!date) return;
    const bookings = JSON.parse(localStorage.getItem('hh_bookings')||'[]');
    const booking = {id:Date.now(), workerId:id, workerName:w.name, customer:name, date, status:'Pending', priceUSD:w.priceUSD, country};
    bookings.push(booking);
    localStorage.setItem('hh_bookings', JSON.stringify(bookings));
    alert('Booking saved! Check your Profile → Orders.');
    const user = getDemoUser();
    if(user){
      user.bookings = (user.bookings||0) + 1;
      user.activities = user.activities || [];
      user.activities.unshift(`Booking: ${w.skill} with ${w.name} on ${date}`);
      setDemoUser(user);
    }
    renderBookingsDashboard();
  }

  function saveWishlist(id){
    const saved = JSON.parse(localStorage.getItem('hh_wishlist')||'[]');
    if(saved.includes(id)) return alert('Already saved');
    saved.push(id);
    localStorage.setItem('hh_wishlist', JSON.stringify(saved));
    alert('Saved to wishlist');
  }

  function filterWorkers(){
    const q = (document.getElementById('search-q')||{value:''}).value.toLowerCase();
    const city = (document.getElementById('filter-city')||{value:''}).value.toLowerCase();
    const skill = (document.getElementById('filter-skill')||{value:''}).value.toLowerCase();
    const filtered = workers.filter(w=>{
      if(q && !(w.name.toLowerCase().includes(q) || w.skill.toLowerCase().includes(q))) return false;
      if(city && !w.city.toLowerCase().includes(city)) return false;
      if(skill && !w.skill.toLowerCase().includes(skill)) return false;
      return true;
    });
    renderWorkerList(filtered);
  }

  // expose some functions
  window.hh = {
    country, currency, formatPrice, localPrice, filterWorkers, renderPrices, renderWorkerList, renderProfilePanel, renderBookingsDashboard: renderBookingsDashboard, bookWorker, saveWishlist
  };

  // bookings rendering
  function renderBookingsDashboard(){
    const list = JSON.parse(localStorage.getItem('hh_bookings')||'[]');
    const el = document.getElementById('orders-list');
    if(!el) return;
    if(list.length===0){ el.innerHTML = '<div class="act">No orders yet.</div>'; return; }
    el.innerHTML = list.map(b=>`<div class="act"><strong>${b.workerName}</strong> — ${b.date} — ${b.status} — ${formatPrice(b.priceUSD)}</div>`).join('');
  }

  // profile extras for user.html
  function renderProfileExtras(){
    const orders = JSON.parse(localStorage.getItem('hh_bookings')||'[]');
    const el = document.getElementById('orders-list');
    el && (el.innerHTML = orders.length ? orders.map(o=>`<div class="act">${o.workerName} • ${o.date} • ${o.status} • ${formatPrice(o.priceUSD)}</div>`).join('') : '<div class="act">No orders yet</div>');

    const wish = JSON.parse(localStorage.getItem('hh_wishlist')||'[]');
    const wEl = document.getElementById('wishlist-list');
    if(wEl){
      if(!wish || wish.length===0) wEl.innerHTML = '<div class="act">No wishlist items</div>';
      else {
        const items = wish.map(id => {
          const wk = workers.find(x=>x.id===id);
          if(!wk) return '';
          return `<div class="act">${wk.name} — ${wk.skill} — ${formatPrice(wk.priceUSD)}</div>`;
        }).join('');
        wEl.innerHTML = items;
      }
    }

    const pre = JSON.parse(localStorage.getItem('hh_preorders')||'[]');
    const pEl = document.getElementById('preorders-list');
    pEl && (pEl.innerHTML = pre.length ? pre.map(p=>`<div class="act">${p.email} • ${new Date(p.ts).toLocaleString()}</div>`).join('') : '<div class="act">No preorders</div>');
  }

  // image upload demo
  function handlePhotoUpload(fileInput){
    const f = fileInput.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const user = getDemoUser() || {name:'Guest', role:'Visitor'};
      user.photo = ev.target.result;
      localStorage.setItem('hh_user', JSON.stringify(user));
      alert('Photo saved in demo profile (browser only)');
      location.reload();
    }
    reader.readAsDataURL(f);
  }

  // ---------- UI init ----------
  function initUI(){
    renderPrices();
    renderWorkerList(workers);
    renderProfilePanel();
    renderBookingsDashboard();
    renderProfileExtras();

    // pre-order form
    const preform = document.getElementById('preorder-form');
    if(preform) preform.addEventListener('submit', e=>{
      e.preventDefault();
      const email = document.getElementById('pre-email').value.trim();
      const note = document.getElementById('pre-note').value.trim();
      if(!email || !email.includes('@')) return alert('Enter a valid email');
      reservePreorder(email,note);
      alert('Reserved — we will notify you via email when checkout is available.');
      preform.reset();
      renderProfileExtras();
    });

    // demo signin/out
    document.getElementById('btn-signin-demo') && document.getElementById('btn-signin-demo').addEventListener('click', ()=>{
      const name = prompt('Enter name for demo profile') || 'Demo User';
      const role = prompt('Role (Worker/Service Taker)', 'Worker') || 'Worker';
      const demo = {name, role, bookings:0, completed:0, earnings:0, activities:[]};
      setDemoUser(demo);
      alert('Demo profile created locally (browser only).');
    });
    document.getElementById('btn-signout-demo') && document.getElementById('btn-signout-demo').addEventListener('click', ()=>{
      clearDemoUser();
      alert('Signed out demo profile.');
    });

    // global event: file upload input
    const up = document.getElementById('upload-photo');
    if(up) up.addEventListener('change', function(){ handlePhotoUpload(this); });

    // smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(a=>{
      a.addEventListener('click', function(e){
        e.preventDefault();
        const id = this.getAttribute('href').slice(1);
        const t = document.getElementById(id);
        if(t) t.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });

    // currency demo: update anytime
    window.addEventListener('currencyRefresh', renderPrices);
  }

  document.addEventListener('DOMContentLoaded', initUI);

  // expose global for debug
  window.hhDebug = {country, currency, formatPrice};
})();
