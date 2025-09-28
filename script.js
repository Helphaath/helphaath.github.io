/**
 * script.js — HelpHaath frontend logic (all-in-one)
 *
 * Features:
 * - Currency auto-detection + manual override
 * - Price rendering
 * - Wishlist (localStorage)
 * - Profile (localStorage) with photo upload (base64) for demo
 * - Orders saved locally (after PayPal success or simulated Test Payment)
 * - Pre-order flow (animation + local record)
 * - Contact (save locally)
 * - Daily tracker (local)
 * - PayPal Smart Buttons client-side rendering (safe for client-only demos)
 *
 * Notes:
 * - This is a frontend demo using localStorage. For production-grade order tracking
 *   and centralized storage, add a small backend with webhooks (PayPal/Stripe),
 *   or use Gumroad/LemonSqueezy for an instant store with order records.
 * - Replace 'YOUR_PAYPAL_SANDBOX_CLIENT_ID' in index.html with your PayPal client id for sandbox testing.
 */

/* ========= Utilities ========= */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const nowISO = () => new Date().toISOString();
const uid = (prefix='id') => prefix + '_' + Math.random().toString(36).slice(2,9);

// localStorage helpers with safe JSON parsing
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e) { console.error('lsGet parse error', key, e); return fallback; }
}
function lsSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ========= CONFIG ========= */
const CONFIG = {
  basePriceUSD: 19, // base USD price for WorkWise eBook
  rates: { USD:1, INR:82, EUR:0.92, JPY:150, KRW:1350 }, // placeholder exchange rates
  currencyLSKey: 'hh_currency',
  profileKey: 'hh_user',
  wishlistKey: 'hh_wishlist',
  ordersKey: 'hh_orders',
  trackerKey: 'hh_tracker',
  contactsKey: 'hh_contacts'
};

/* ========= Currency detection & price rendering ========= */

// Try several heuristics for country/currency detection
function detectCurrencyCode() {
  // Best-effort using browser locale
  const lang = (navigator.language || navigator.userLanguage || 'en-US').toUpperCase();
  if (lang.includes('IN')) return 'INR';
  if (lang.includes('JP')) return 'JPY';
  if (lang.includes('KO') || lang.includes('KR')) return 'KRW';
  if (lang.includes('DE') || lang.includes('FR') || lang.includes('ES')) return 'EUR';
  if (lang.includes('GB') || lang.includes('EN') || lang.includes('US')) return 'USD';
  return 'USD';
}

// Get selected/forced currency or auto detect
function getCurrentCurrency() {
  const forced = lsGet(CONFIG.currencyLSKey, 'AUTO');
  return (forced && forced !== 'AUTO') ? forced : detectCurrencyCode();
}

// Format price from USD base to local currency string
function formatPriceFromUSD(usdAmount) {
  const cur = getCurrentCurrency();
  const rate = CONFIG.rates[cur] || 1;
  const converted = Math.round((usdAmount * rate + Number.EPSILON) * 100) / 100;
  if (cur === 'JPY' || cur === 'KRW') return `${cur} ${Math.round(converted)}`;
  return `${cur} ${converted}`;
}

// Render prices in DOM where data-price-usd attribute exists
function renderPrices() {
  $$('[data-price-usd]').forEach(el => {
    const usd = parseFloat(el.getAttribute('data-price-usd')) || CONFIG.basePriceUSD;
    el.textContent = formatPriceFromUSD(usd);
  });
  // Also ensure main price display exists
  const pd = $('#price-display');
  if (pd) pd.textContent = formatPriceFromUSD(CONFIG.basePriceUSD);
  // Set currency select value
  const cs = $('#currency-select');
  if (cs) cs.value = lsGet(CONFIG.currencyLSKey, 'AUTO');
}

/* ========= PROFILE (local demo) ========= */
function getProfile() { return lsGet(CONFIG.profileKey, null); }
function saveProfile(profile) { lsSet(CONFIG.profileKey, profile); renderProfileUI(); }

// Renders profile UI on user.html
function renderProfileUI() {
  const u = getProfile();
  if (!u) {
    if ($('#profile-name-display')) $('#profile-name-display').textContent = 'Guest';
    if ($('#profile-country-display')) $('#profile-country-display').textContent = 'No country';
    if ($('#profile-avatar')) $('#profile-avatar').textContent = 'GH';
    return;
  }
  if ($('#profile-name-display')) $('#profile-name-display').textContent = u.name || 'Guest';
  if ($('#profile-country-display')) $('#profile-country-display').textContent = u.country || '';
  if ($('#profile-name')) $('#profile-name').value = u.name || '';
  if ($('#profile-country')) $('#profile-country').value = u.country || '';
  if ($('#profile-dob')) $('#profile-dob').value = u.dob || '';
  if ($('#profile-avatar')) {
    if (u.photo) {
      $('#profile-avatar').innerHTML = `<img src="${u.photo}" style="width:84px;height:84px;border-radius:10px;object-fit:cover" />`;
    } else {
      $('#profile-avatar').textContent = (u.name ? u.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase() : 'GH');
    }
  }
}

// Save profile from UI inputs (user.html)
function handleSaveProfile() {
  const name = $('#profile-name') ? $('#profile-name').value.trim() : '';
  const country = $('#profile-country') ? $('#profile-country').value.trim() : '';
  const dob = $('#profile-dob') ? $('#profile-dob').value : '';
  const u = getProfile() || {};
  u.name = name || u.name || 'Guest';
  u.country = country || u.country || '';
  u.dob = dob || u.dob || '';
  u.updatedAt = nowISO();
  lsSet(CONFIG.profileKey, u);
  alert('Profile saved (demo).');
  renderProfileUI();
}

// Profile photo handler (stores base64 in localStorage for demo)
function handleProfilePhoto(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const u = getProfile() || {};
    u.photo = ev.target.result;
    lsSet(CONFIG.profileKey, u);
    renderProfileUI();
    alert('Photo saved (demo).');
  };
  reader.readAsDataURL(f);
}

/* ========= WISHLIST ========= */
function getWishlist() { return lsGet(CONFIG.wishlistKey, []); }
function setWishlist(list) { lsSet(CONFIG.wishlistKey, list); renderWishlistUI(); }
function addToWishlist(productId) {
  const list = getWishlist();
  if (!list.includes(productId)) list.push(productId);
  setWishlist(list);
  showWLTick();
}
function removeFromWishlist(productId) {
  let list = getWishlist();
  list = list.filter(x => x !== productId);
  setWishlist(list);
}

function renderWishlistUI() {
  const area = $('#wishlist-area');
  if (!area) return;
  const list = getWishlist();
  if (list.length === 0) { area.innerHTML = '<div class="small-muted">No items in wishlist</div>'; return; }
  area.innerHTML = list.map(pid => {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
      <div>${pid}</div>
      <div><button data-buy="${pid}" class="btn-ghost">Buy</button> <button data-remove="${pid}" class="btn-ghost">Remove</button></div>
    </div>`;
  }).join('');
  area.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', e => removeFromWishlist(e.currentTarget.getAttribute('data-remove'))));
  area.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', e => simulatePayment(e.currentTarget.getAttribute('data-buy'))));
}

function showWLTick() {
  const el = $('#wl-tick');
  if (!el) return;
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 2200);
}

/* ========= ORDERS (local demo) ========= */
function getOrders() { return lsGet(CONFIG.ordersKey, []); }
function saveOrder(order) { const arr = getOrders(); arr.unshift(order); lsSet(CONFIG.ordersKey, arr); renderOrdersUI(); }
function renderOrdersUI() {
  const area = $('#orders-area');
  if (!area) return;
  const list = getOrders();
  if (list.length === 0) { area.innerHTML = '<div class="small-muted">No orders yet</div>'; return; }
  area.innerHTML = list.map(o => {
    const items = o.items.map(i => i.title).join(', ');
    return `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">
      <strong>${items}</strong>
      <div class="small-muted">${o.amount_display || (o.currency+' '+o.amount_usd)} • ${new Date(o.createdAt).toLocaleString()}</div>
      </div>`;
  }).join('');
}

// show order confirmed animation
function showOrderConfirm() {
  const el = $('#preorder-confirm');
  if (!el) return;
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 2500);
}

/* ========= DAILY TRACKER ========= */
function getTracker() { return lsGet(CONFIG.trackerKey, {}); }
function saveTracker(t) { lsSet(CONFIG.trackerKey, t); renderTrackerUI(); }
function addTaskForToday(title) {
  if (!title) return;
  const date = new Date().toISOString().slice(0,10);
  const t = getTracker();
  t[date] = t[date] || { tasks: [], notes: '' };
  t[date].tasks.unshift({ id: 't'+Date.now(), title, done: false });
  saveTracker(t);
}
function toggleTaskDone(date, taskId) {
  const t = getTracker();
  if (!t[date]) return;
  t[date].tasks = t[date].tasks.map(tsk => tsk.id === taskId ? { ...tsk, done: !tsk.done } : tsk);
  saveTracker(t);
}
function renderTrackerUI() {
  const area = $('#tracker-list');
  if (!area) return;
  const date = new Date().toISOString().slice(0,10);
  const t = getTracker();
  const today = t[date] || { tasks: [], notes: '' };
  if (today.tasks.length === 0) { area.innerHTML = '<div class="small-muted">No tasks for today</div>'; return; }
  area.innerHTML = today.tasks.map(tsk => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
    <input type="checkbox" ${tsk.done ? 'checked' : ''} data-toggle="${tsk.id}"/>
    <div style="flex:1; text-decoration:${tsk.done ? 'line-through' : 'none'}">${tsk.title}</div>
  </div>`).join('');
  area.querySelectorAll('[data-toggle]').forEach(cb => cb.addEventListener('change', e => {
    const id = e.currentTarget.getAttribute('data-toggle');
    toggleTaskDone(date, id);
  }));
}

/* ========= CONTACTS (demo) ========= */
function handleContactSend() {
  const name = $('#contact-name') ? $('#contact-name').value.trim() : '';
  const email = $('#contact-email') ? $('#contact-email').value.trim() : '';
  const msg = $('#contact-msg') ? $('#contact-msg').value.trim() : '';
  if (!email || !msg) return alert('Please provide email and message');
  const list = lsGet(CONFIG.contactsKey, []);
  list.unshift({ name, email, msg, ts: nowISO() });
  lsSet(CONFIG.contactsKey, list);
  alert('Message saved (demo). We will contact you.');
  if ($('#contact-name')) $('#contact-name').value = '';
  if ($('#contact-email')) $('#contact-email').value = '';
  if ($('#contact-msg')) $('#contact-msg').value = '';
}

/* ========= PAYMENT: PayPal Smart Buttons (client-side) =========
   - WARNING: This is client-side rendering ONLY for demo and checkout UI.
   - For secure server-side verification and to record orders centrally, you must implement PayPal webhooks (server).
   - Steps to test sandbox:
     1. developer.paypal.com -> Log in -> My Apps & Credentials -> Sandbox -> Create App -> copy Client ID
     2. Replace YOUR_PAYPAL_SANDBOX_CLIENT_ID in index.html <script src="...paypal.com/sdk/js?client-id=..."> tag
     3. Open site, PayPal button will render. Use sandbox buyer account to test.
*/
function renderPayPalButtons() {
  if (!window.paypal) {
    console.warn('PayPal SDK not loaded — replace client id in index.html script tag.');
    return;
  }
  const priceUsd = CONFIG.basePriceUSD;
  paypal.Buttons({
    style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },
    createOrder: function(data, actions) {
      // create order on PayPal client-side for demo
      return actions.order.create({
        purchase_units: [{
          amount: { value: priceUsd.toString() },
          description: 'WorkWise eBook - Full'
        }]
      });
    },
    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        // payment succeeded (client-side)
        const order = {
          id: data.orderID || ('order_' + Date.now()),
          items: [{ productId: 'ebook_workwise', title: 'WorkWise eBook', price_usd: priceUsd, qty: 1 }],
          amount_usd: priceUsd,
          amount_display: formatPriceFromUSD(priceUsd),
          currency: getCurrentCurrency(),
          paymentProvider: 'paypal',
          paymentStatus: 'completed',
          payer: details.payer,
          createdAt: new Date().toISOString()
        };
        saveOrder(order);
        showOrderConfirm();
        alert('Payment successful — thank you! (demo). Check your profile for order history.');
        // For production: send order to your server here (POST to your webhook endpoint) to persist centrally and send delivery email.
      });
    },
    onError: function(err) {
      console.error('PayPal Buttons error', err);
      alert('PayPal error: ' + (err && err.message ? err.message : 'unknown'));
    }
  }).render('#paypal-button-container');
}

/* ========= Simulated/Test Payment (demo) ========= */
function simulatePayment(productId='ebook_workwise') {
  const order = {
    id: 'sim_' + Date.now(),
    items: [{ productId, title: (productId === 'bundle' ? 'WorkWise Bundle' : 'WorkWise eBook'), price_usd: CONFIG.basePriceUSD, qty:1 }],
    amount_usd: CONFIG.basePriceUSD,
    amount_display: formatPriceFromUSD(CONFIG.basePriceUSD),
    currency: getCurrentCurrency(),
    paymentProvider: 'simulated',
    paymentStatus: 'completed',
    createdAt: new Date().toISOString()
  };
  saveOrder(order);
  showOrderConfirm();
}

/* ========= UI Bindings & Init ========= */
function bindUI() {
  // currency selector
  const cs = $('#currency-select');
  if (cs) {
    cs.addEventListener('change', (e) => {
      const v = e.target.value;
      lsSet(CONFIG.currencyLSKey, v);
      renderPrices();
    });
  }

  // wishlist button
  $('#btn-wishlist') && $('#btn-wishlist').addEventListener('click', () => {
    addToWishlist('ebook_workwise');
    alert('Added to wishlist (demo).');
  });

  // test payment
  $('#btn-test-pay') && $('#btn-test-pay').addEventListener('click', () => {
    simulatePayment('ebook_workwise');
    alert('Test payment simulated (demo).');
  });

  // pre-order button (demo: stores a pre-order record)
  $('#btn-preorder') && $('#btn-preorder').addEventListener('click', () => {
    // Save a simple pre-order record (for demo)
    const pre = {
      id: 'pre_' + Date.now(),
      productId: 'ebook_workwise',
      createdAt: new Date().toISOString(),
      name: (getProfile() && getProfile().name) || 'Guest',
      email: (getProfile() && getProfile().email) || ''
    };
    // store in orders as 'preorder' flag for demo
    const order = {
      ...pre,
      items: [{ productId: 'ebook_workwise', title: 'WorkWise (preorder)', price_usd: CONFIG.basePriceUSD, qty: 1 }],
      amount_usd: CONFIG.basePriceUSD,
      amount_display: formatPriceFromUSD(CONFIG.basePriceUSD),
      currency: getCurrentCurrency(),
      paymentProvider: 'preorder',
      paymentStatus: 'reserved',
      createdAt: new Date().toISOString()
    };
    saveOrder(order);
    showOrderConfirm();
    alert('Pre-order saved (demo). You will be notified when product is available.');
  });

  // contact send
  $('#contact-send') && $('#contact-send').addEventListener('click', handleContactSend);

  // profile page bindings
  $('#save-profile') && $('#save-profile').addEventListener('click', handleSaveProfile);
  $('#clear-profile') && $('#clear-profile').addEventListener('click', () => {
    if (confirm('Clear profile? This will remove local demo profile data.')) {
      localStorage.removeItem(CONFIG.profileKey);
      renderProfileUI();
      renderWishlistUI();
      renderOrdersUI();
    }
  });
  $('#profile-photo') && $('#profile-photo').addEventListener('change', function(){ handleProfilePhoto(this); });

  // wishlist / orders rendering on profile page
  renderWishlistUI(); renderOrdersUI(); renderTrackerUI();

  // daily tracker add
  $('#add-task') && $('#add-task').addEventListener('click', () => {
    const t = $('#tracker-input').value.trim();
    if (!t) return alert('Add a task');
    addTaskForToday(t);
    $('#tracker-input').value = '';
  });
}

/* ========= Init on DOMContentLoaded ========= */
document.addEventListener('DOMContentLoaded', () => {
  // Render prices, profile, wishlist etc.
  renderPrices();
  renderProfileUI();
  renderWishlistUI();
  renderOrdersUI();
  renderTrackerUI();
  bindUI();

  // Render PayPal buttons if SDK loaded
  if (window.paypal) renderPayPalButtons();
  else console.warn('PayPal SDK not found. Add client id in index.html script tag to render PayPal buttons.');

  // Helpful debug output
  console.log('HelpHaath frontend initialized - demo mode. Data keys in localStorage:', CONFIG);
});

/* ========= Expose helpers for debugging in console ========= */
window.hh = {
  renderPrices, getProfile, saveProfile,
  getWishlist, addToWishlist, getOrders, simulatePayment,
  getTracker, addTaskForToday
};
