/* script.js - HelpHaath front-end logic (profiles, wishlist, orders, currency, tracker, payments)
   - All data stored locally in browser localStorage for demo / testing.
   - Replace PayPal client id in index.html to test real sandbox payments.
   - For Stripe: you need a server endpoint (not included here). Use Test Payment to simulate.
*/

/* ---------- Helpers ---------- */
function $(s){ return document.querySelector(s); }
function $all(s){ return Array.from(document.querySelectorAll(s)); }
function getLS(k, fallback){ try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch(e){ return fallback; } }
function setLS(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function nowISO(){ return new Date().toISOString(); }

/* ---------- CONFIG ---------- */
const PRICE_USD = 19;
const BUNDLE_USD = 99;
const RATES = { USD:1, INR:82, EUR:0.92, JPY:150, KRW:1350 };
let forcedCurrency = getLS('hh_currency') || 'AUTO';

/* ---------- CURRENCY DETECTION & RENDERING ---------- */
function detectCurrency(){
  const lang = (navigator.language || navigator.userLanguage || 'en-US').toUpperCase();
  if(lang.includes('IN')) return 'INR';
  if(lang.includes('JP')) return 'JPY';
  if(lang.includes('KO')||lang.includes('KR')) return 'KRW';
  if(lang.includes('DE')||lang.includes('FR')||lang.includes('ES')) return 'EUR';
  if(lang.includes('GB')||lang.includes('EN')) return 'USD';
  return 'USD';
}
function currentCurrency(){ return (forcedCurrency && forcedCurrency !== 'AUTO') ? forcedCurrency : detectCurrency(); }
function formatLocal(usd){
  const cur = currentCurrency();
  const rate = RATES[cur] || 1;
  const val = Math.round((usd * rate + Number.EPSILON) * 100) / 100;
  if(cur === 'JPY' || cur === 'KRW') return `${cur} ${Math.round(val)}`;
  return `${cur} ${val}`;
}
function renderPrices(){
  $all('[data-price-usd]').forEach(el=>{
    const usd = parseFloat(el.getAttribute('data-price-usd')) || PRICE_USD;
    el.textContent = formatLocal(usd);
  });
  const pd = $('#price-display');
  if(pd) pd.textContent = formatLocal(PRICE_USD);
  const cs = $('#currency-select');
  if(cs) cs.value = forcedCurrency || 'AUTO';
}

/* ---------- PROFILE (local) ---------- */
function getProfile(){ return getLS('hh_user', null); }
function saveProfile(profile){ setLS('hh_user', profile); renderProfileUI(); }
function clearProfile(){
  localStorage.removeItem('hh_user');
  renderProfileUI();
}
function renderProfileUI(){
  const u = getProfile();
  if(u){
    $('#profile-name-display') && ($('#profile-name-display').textContent = u.name || 'Guest');
    $('#profile-country-display') && ($('#profile-country-display').textContent = u.country || '');
    $('#profile-name') && ($('#profile-name').value = u.name || '');
    $('#profile-country') && ($('#profile-country').value = u.country || '');
    $('#profile-dob') && ($('#profile-dob').value = u.dob || '');
    $('#profile-avatar') && ($('#profile-avatar').innerHTML = u.photo ? `<img src="${u.photo}" style="width:84px;height:84px;border-radius:10px;object-fit:cover">` : (u.name ? u.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase() : 'GH'));
  } else {
    $('#profile-name-display') && ($('#profile-name-display').textContent = 'Guest');
    $('#profile-country-display') && ($('#profile-country-display').textContent = 'No country');
    $('#profile-name') && ($('#profile-name').value = '');
    $('#profile-country') && ($('#profile-country').value = '');
    $('#profile-dob') && ($('#profile-dob').value = '');
    $('#profile-avatar') && ($('#profile-avatar').innerHTML = 'GH');
  }
}

/* Save profile from form */
function handleSaveProfile(){
  const name = $('#profile-name') ? $('#profile-name').value.trim() : '';
  const country = $('#profile-country') ? $('#profile-country').value.trim() : '';
  const dob = $('#profile-dob') ? $('#profile-dob').value : '';
  const u = getProfile() || {};
  u.name = name || u.name || 'Guest';
  u.country = country || u.country || '';
  u.dob = dob || u.dob || '';
  u.updatedAt = nowISO();
  setLS('hh_user', u);
  alert('Profile saved (demo).');
  renderProfileUI();
}

/* Photo upload */
function handleProfilePhoto(fileInput){
  const f = fileInput.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const u = getProfile() || {};
    u.photo = ev.target.result; // base64 data URL
    setLS('hh_user', u);
    alert('Photo saved (demo).');
    renderProfileUI();
  };
  reader.readAsDataURL(f);
}

/* ---------- WISHLIST ---------- */
function getWishlist(){ return getLS('hh_wishlist', []); }
function addToWishlist(id){
  const list = getWishlist();
  if(!list.includes(id)) list.push(id);
  setLS('hh_wishlist', list);
  renderWishlistUI();
  alert('Added to wishlist (demo).');
}
function removeFromWishlist(id){
  let list = getWishlist(); list = list.filter(x=>x!==id); setLS('hh_wishlist', list); renderWishlistUI();
}
function renderWishlistUI(){
  const area = $('#wishlist-area');
  if(!area) return;
  const items = getWishlist();
  if(items.length === 0){ area.innerHTML = '<div class="small-muted">No items in wishlist</div>'; return; }
  area.innerHTML = items.map(it => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">${it}<div><button data-buy="${it}" class="btn-ghost">Buy</button><button data-remove="${it}" class="btn-ghost">Remove</button></div></div>`).join('');
  area.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click', e=> removeFromWishlist(e.currentTarget.getAttribute('data-remove'))));
  area.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click', e=> {
    const id = e.currentTarget.getAttribute('data-buy');
    simulatePayment(id);
  }));
}

/* ---------- ORDERS ---------- */
function getOrders(){ return getLS('hh_orders', []); }
function saveOrder(order){
  const list = getOrders();
  list.unshift(order);
  setLS('hh_orders', list);
  renderOrdersUI();
}
function renderOrdersUI(){
  const area = $('#orders-area');
  if(!area) return;
  const list = getOrders();
  if(list.length === 0){ area.innerHTML = '<div class="small-muted">No orders yet</div>'; return; }
  area.innerHTML = list.map(o => `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.02)">${o.items.map(i=>i.title).join(', ')} • ${o.amount_display || (o.currency+' '+o.amount_usd)} • ${new Date(o.createdAt).toLocaleString()}</div>`).join('');
}

/* ---------- DAILY TRACKER ---------- */
function getTracker(){ return getLS('hh_tracker', {}); }
function saveTracker(t){ setLS('hh_tracker', t); renderTrackerUI(); }
function addTaskToday(title){
  if(!title) return;
  const date = (new Date()).toISOString().slice(0,10);
  const t = getTracker();
  t[date] = t[date] || {tasks:[], notes:''};
  t[date].tasks.unshift({id:'t'+Date.now(), title, done:false});
  saveTracker(t);
}
function toggleTask(date, taskId){
  const t = getTracker();
  if(!t[date]) return;
  t[date].tasks = t[date].tasks.map(tsk => tsk.id===taskId ? {...tsk, done: !tsk.done} : tsk);
  saveTracker(t);
}
function renderTrackerUI(){
  const area = $('#tracker-list');
  if(!area) return;
  const date = (new Date()).toISOString().slice(0,10);
  const t = getTracker();
  const today = t[date] || {tasks:[], notes:''};
  if(today.tasks.length === 0){ area.innerHTML = '<div class="small-muted">No tasks for today</div>'; return; }
  area.innerHTML = today.tasks.map(tsk => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0"><input type="checkbox" ${tsk.done ? 'checked' : ''} data-toggle="${tsk.id}" /> <div style="flex:1; text-decoration:${tsk.done ? 'line-through' : 'none'}">${tsk.title}</div></div>`).join('');
  area.querySelectorAll('[data-toggle]').forEach(cb => cb.addEventListener('change', e => {
    const id = e.currentTarget.getAttribute('data-toggle');
    toggleTask(date, id);
  }));
}

/* ---------- CONTACT (quick local capture) ---------- */
function handleContact(){
  const name = $('#contact-name') ? $('#contact-name').value.trim() : '';
  const email = $('#contact-email') ? $('#contact-email').value.trim() : '';
  const msg = $('#contact-msg') ? $('#contact-msg').value.trim() : '';
  if(!email || !msg) return alert('Please provide email & message');
  const list = getLS('hh_contacts', []);
  list.unshift({name,email,msg,ts:nowISO()});
  setLS('hh_contacts', list);
  alert('Message saved. We will contact you (demo).');
  $('#contact-name') && ($('#contact-name').value=''); $('#contact-email') && ($('#contact-email').value=''); $('#contact-msg') && ($('#contact-msg').value='');
}

/* ---------- PAYPAL (smart buttons) ---------- */
function renderPayPalButton(){
  if(!window.paypal) { console.warn('PayPal SDK not loaded (replace YOUR_PAYPAL_SANDBOX_CLIENT_ID in index.html)'); return; }
  const priceUsd = PRICE_USD;
  paypal.Buttons({
    style: { shape:'rect', color:'blue', layout:'vertical', label:'paypal' },
    createOrder: function(data, actions){
      return actions.order.create({
        purchase_units: [{
          amount:{ value: priceUsd.toString() },
          description: 'WorkWise eBook (Full)'
        }]
      });
    },
    onApprove: function(data, actions){
      return actions.order.capture().then(function(details){
        // Save order locally
        const order = {
          id: data.orderID || ('order_'+Date.now()),
          items: [{productId:'ebook_workwise', title:'WorkWise eBook', price_usd:PRICE_USD, qty:1}],
          amount_usd: PRICE_USD,
          amount_display: formatLocal(PRICE_USD),
          currency: currentCurrency(),
          paymentProvider: 'paypal',
          paymentStatus: 'completed',
          createdAt: new Date().toISOString()
        };
        saveOrder(order);
        alert('Payment successful. Thank you ' + (details.payer && details.payer.name && details.payer.name.given_name ? details.payer.name.given_name : '') + '. Order saved (demo).');
      });
    },
    onError: function(err){ console.error('PayPal error', err); alert('PayPal error'); }
  }).render('#paypal-button-container');
}

/* ---------- TEST / SIMULATED PAYMENT ---------- */
function simulatePayment(itemId='ebook_workwise'){
  const amount_usd = (itemId === 'bundle' ? BUNDLE_USD : PRICE_USD);
  const cur = currentCurrency();
  const order = {
    id: 'sim_' + Date.now(),
    items: [{productId: itemId, title: itemId === 'bundle' ? 'WorkWise Premium' : 'WorkWise eBook', price_usd: amount_usd, qty:1}],
    amount_usd,
    amount_display: formatLocal(amount_usd),
    currency: cur,
    paymentProvider: 'simulated',
    paymentStatus: 'completed',
    createdAt: new Date().toISOString()
  };
  saveOrder(order);
  alert('Simulated payment complete (demo). Order saved.');
}

/* ---------- INIT UI & EVENTS ---------- */
function init(){
  // Render currency/prices
  renderPrices();

  // Currency selector
  const cs = $('#currency-select');
  if(cs){
    cs.addEventListener('change', (e)=> {
      forcedCurrency = e.target.value;
      setLS('hh_currency', forcedCurrency);
      renderPrices();
    });
  }

  // Wishlist button on index
  $('#cta-wl') && $('#cta-wl').addEventListener('click', ()=> { addToWishlist('ebook_workwise'); });

  // Free mini guide CTA
  $('#cta-free') && $('#cta-free').addEventListener('click', ()=>{
    const email = prompt('Enter your email to receive the free mini guide (demo):');
    if(!email || !email.includes('@')) return alert('Enter valid email');
    const leads = getLS('hh_leads', []);
    leads.unshift({email, ts:nowISO()});
    setLS('hh_leads', leads);
    alert('Free mini guide sent to your email (demo). Check your inbox — (demo).');
  });

  // Test pay
  $('#btn-test-pay') && $('#btn-test-pay').addEventListener('click', ()=> simulatePayment('ebook_workwise'));

  // Stripe button (placeholder)
  $('#btn-stripe') && $('#btn-stripe').addEventListener('click', ()=> {
    alert('Stripe Checkout requires a small server endpoint. See docs / I can provide full server code if you want.');
  });

  // Contact
  $('#contact-send') && $('#contact-send').addEventListener('click', handleContact);

  // Profile page events
  $('#save-profile') && $('#save-profile').addEventListener('click', handleSaveProfile);
  $('#clear-profile') && $('#clear-profile').addEventListener('click', ()=> { if(confirm('Clear profile?')){ clearProfile(); } });
  $('#profile-photo') && $('#profile-photo').addEventListener('change', function(){ handleProfilePhoto(this); });

  // Wishlist and orders UI on profile page
  renderWishlistUI();
  renderOrdersUI();

  // Tracker
  $('#add-task') && $('#add-task').addEventListener('click', ()=> {
    const val = $('#tracker-input').value.trim();
    if(!val) return alert('Add a task');
    addTaskToday(val);
    $('#tracker-input').value = '';
  });
  renderTrackerUI();

  // Contact page saved contacts (no server)
  // Render profile UI
  renderProfileUI();

  // Render PayPal button (if SDK loaded)
  if(window.paypal) renderPayPalButton();
  else console.warn('PayPal SDK not available. Add your client id script tag in index.html');

  // Render wishlist/orders if on profile page
  renderWishlistUI();
  renderOrdersUI();
}

/* Fire init after DOM ready */
document.addEventListener('DOMContentLoaded', init);

/* Expose helpers for console debugging */
window.hh = {
  getProfile, saveProfile, getWishlist, addToWishlist, getOrders, simulatePayment, getTracker
};
