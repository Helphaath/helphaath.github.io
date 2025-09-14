/* script.js - HelpHaath client logic
   - currency detection & conversion (placeholder rates)
   - prebook (localStorage)
   - demo profile (localStorage)
   - worker search & booking (localStorage)
*/

(() => {
  // ---------- simple country/currency mapping ----------
  const currencyMap = {
    'US': {code:'USD', symbol:'$', rate:1},
    'IN': {code:'INR', symbol:'₹', rate:82},
    'JP': {code:'JPY', symbol:'¥', rate:150},
    'KR': {code:'KRW', symbol:'₩', rate:1350},
    'GB': {code:'GBP', symbol:'£', rate:0.79},
    'DEFAULT': {code:'USD', symbol:'$', rate:1}
  };

  // placeholder product base price in USD
  const BASE_PRICE_USD = 6.5; // example: ₹499 ≈ $6.5

  function detectCountryCode() {
    // Try to detect from navigator.language (best-effort)
    const lang = (navigator.language || navigator.userLanguage || 'en-US').toUpperCase();
    if(lang.includes('IN')) return 'IN';
    if(lang.includes('JP')) return 'JP';
    if(lang.includes('KO') || lang.includes('KR')) return 'KR';
    if(lang.includes('GB')) return 'GB';
    if(lang.includes('US')) return 'US';
    // fallback: try timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if(tz.includes('Asia/Kolkata')) return 'IN';
      if(tz.includes('Asia/Tokyo')) return 'JP';
      if(tz.includes('Asia/Seoul')) return 'KR';
    } catch(e) {}
    return 'DEFAULT';
  }

  const country = detectCountryCode();
  const currency = currencyMap[country] || currencyMap['DEFAULT'];

  // Convert a USD amount to local currency (using placeholder rate)
  function localPrice(usd){
    return Math.round((usd * currency.rate + Number.EPSILON) * 100) / 100;
  }

  // Format price with symbol
  function formatPrice(usd) {
    const price = localPrice(usd);
    // some currencies like JPY/KRW no decimals
    if(currency.code === 'JPY' || currency.code === 'KRW') {
      return `${currency.symbol}${Math.round(price)}`;
    }
    return `${currency.symbol}${price}`;
  }

  // Set all price placeholders on page
  function renderPrices(){
    document.querySelectorAll('[data-price-usd]').forEach(el=>{
      const usd = parseFloat(el.getAttribute('data-price-usd')) || BASE_PRICE_USD;
      el.textContent = formatPrice(usd);
    });
    // Display currency note
    document.getElementById('currency-note') && (document.getElementById('currency-note').textContent = `Prices shown in ${currency.code}`);
  }

  // ---------- Pre-order (local storage) ----------
  function reservePreorder(email, note){
    const list = JSON.parse(localStorage.getItem('hh_preorders')||'[]');
    list.push({email, note, ts: new Date().toISOString(), country});
    localStorage.setItem('hh_preorders', JSON.stringify(list));
    return true;
  }

  // ---------- Demo profile using localStorage ----------
  function getDemoUser(){
    return JSON.parse(localStorage.getItem('hh_user') || 'null');
  }
  function setDemoUser(user){
    localStorage.setItem('hh_user', JSON.stringify(user));
    renderProfilePanel();
  }
  function clearDemoUser(){
    localStorage.removeItem('hh_user');
    renderProfilePanel();
  }

  function renderProfilePanel(){
    const user = getDemoUser();
    const nameEl = document.getElementById('profile-name');
    const roleEl = document.getElementById('profile-role');
    const avatarEl = document.getElementById('profile-avatar');
    const bookingsEl = document.getElementById('profile-bookings');
    const completedEl = document.getElementById('profile-completed');
    const earningsEl = document.getElementById('profile-earnings');
    const activityEl = document.getElementById('profile-activities');

    if(!user){
      nameEl.textContent = 'Guest';
      roleEl.textContent = 'Not signed in';
      avatarEl.textContent = 'GH';
      bookingsEl.textContent = 'Bookings: 0';
      completedEl.textContent = 'Completed: 0';
      earningsEl.textContent = 'Earnings: -';
      activityEl.innerHTML = `<div class="act">No activities. Sign in to simulate profile.</div>`;
      document.getElementById('btn-signin-demo').style.display = 'inline-block';
      document.getElementById('btn-signout-demo').style.display = 'none';
      return;
    }
    nameEl.textContent = user.name || 'John Doe';
    roleEl.textContent = user.role || 'Worker';
    avatarEl.textContent = (user.name||'User').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
    bookingsEl.textContent = 'Bookings: ' + (user.bookings || 0);
    completedEl.textContent = 'Completed: ' + (user.completed || 0);
    earningsEl.textContent = 'Earnings: ' + (currency.symbol + (user.earnings || 0));
    const acts = (user.activities || []).slice(0,10);
    activityEl.innerHTML = acts.length ? acts.map(a=>`<div class="act">${a}</div>`).join('') : `<div class="act">No recent activity</div>`;
    document.getElementById('btn-signin-demo').style.display = 'none';
    document.getElementById('btn-signout-demo').style.display = 'inline-block';
  }

  // ---------- Worker directory & booking ----------
  const workers = [
    {id:1,name:'Amit Kumar', skill:'Plumbing', city:'Delhi', rating:4.7, priceUSD:10},
    {id:2,name:'Sana Park', skill:'Cleaning', city:'Seoul', rating:4.8, priceUSD:8},
    {id:3,name:'Kenji Ito', skill:'Electrical', city:'Tokyo', rating:4.6, priceUSD:12},
    {id:4,name:'Lara Singh', skill:'Carpentry', city:'Mumbai', rating:4.5, priceUSD:9},
    {id:5,name:'Chris Lee', skill:'Cleaning', city:'NYC', rating:4.9, priceUSD:11}
  ];

  function renderWorkerList(list){
    const el = document.getElementById('worker-list');
    if(!el) return;
    el.innerHTML = list.map(w=>{
      return `<div class="worker card" data-id="${w.id}">
        <h4>${w.name} <small style="color:var(--muted);font-weight:600">· ${w.city}</small></h4>
        <div class="smallmuted">${w.skill} · ⭐ ${w.rating}</div>
        <div style="margin-top:10px;font-weight:700">${formatPrice(w.priceUSD)}</div>
        <div style="margin-top:8px"><button class="btn" onclick="window.bookWorker(${w.id})">Book</button> <button class="btn-ghost" onclick="window.saveWishlist(${w.id})">Save</button></div>
      </div>`;
    }).join('');
  }

  // expose bookWorker & saveWishlist globally (for onclick)
  window.bookWorker = function(id){
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
    alert('Booking saved! Check your profile -> Orders.');
    // add to demo user's activities if signed in
    const user = getDemoUser();
    if(user){
      user.bookings = (user.bookings||0) + 1;
      user.activities = user.activities || [];
      user.activities.unshift(`Booking: ${w.skill} with ${w.name} on ${date}`);
      setDemoUser(user);
    }
  };

  window.saveWishlist = function(id){
    const saved = JSON.parse(localStorage.getItem('hh_wishlist')||'[]');
    if(saved.includes(id)) return alert('Already saved');
    saved.push(id);
    localStorage.setItem('hh_wishlist', JSON.stringify(saved));
    alert('Saved to wishlist');
  };

  // search filter
  function filterWorkers(){
    const q = (document.getElementById('search-q').value||'').toLowerCase();
    const city = (document.getElementById('filter-city').value||'').toLowerCase();
    const skill = (document.getElementById('filter-skill').value||'').toLowerCase();
    const filtered = workers.filter(w=>{
      if(q && !(w.name.toLowerCase().includes(q) || w.skill.toLowerCase().includes(q))) return false;
      if(city && !w.city.toLowerCase().includes(city)) return false;
      if(skill && !w.skill.toLowerCase().includes(skill)) return false;
      return true;
    });
    renderWorkerList(filtered);
  }

  // ---------- bookings dashboard render ----------
  function renderBookingsDashboard(){
    const list = JSON.parse(localStorage.getItem('hh_bookings')||'[]');
    const el = document.getElementById('orders-list');
    if(!el) return;
    if(list.length===0){ el.innerHTML = '<div class="act">No orders yet.</div>'; return; }
    el.innerHTML = list.map(b=>{
      return `<div class="act"><strong>${b.workerName}</strong> — ${b.date} — ${b.status} — ${formatPrice(b.priceUSD)}</div>`;
    }).join('');
  }

  // ---------- pre-order product modal ----------
  function initUI(){
    renderPrices();
    renderWorkerList(workers);
    renderProfilePanel();
    renderBookingsDashboard();
    // hook form events
    const preform = document.getElementById('preorder-form');
    preform && preform.addEventListener('submit', e=>{
      e.preventDefault();
      const email = document.getElementById('pre-email').value.trim();
      const note = document.getElementById('pre-note').value.trim();
      if(!email || !email.includes('@')) return alert('Enter a valid email');
      reservePreorder(email,note);
      alert('Reserved — we will notify you by email');
      preform.reset();
    });

    // Demo signin
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
  }

  // expose some functions for console access
  window.hh = {
    country, currency, formatPrice, localPrice, filterWorkers, renderPrices, renderWorkerList, renderProfilePanel, renderBookingsDashboard
  };

  // run after DOM ready
  document.addEventListener('DOMContentLoaded', initUI);
})();
