/* script.js — HelpHaath full frontend logic
   2025 — Detailed, step-by-step, production-mindset comments included.

   Summary:
     - UI wiring (buttons, selects)
     - Currency detection & price rendering
     - Wishlist (localStorage)
     - Profile (localStorage + Firestore sync)
     - Orders & Preorders (saved to Firestore). Local fallback for demo.
     - PayPal Smart Buttons integration (client-side; Firestore save after success)
     - Email notifications via EmailJS for new orders / messages (client-side)
     - Contact form -> saves message to Firestore + sends notification email
     - Daily task tracker (local + Firestore optional)
     - Helpful debug logs and graceful fallbacks
*/

/* ================== CONFIG (REPLACE THESE) ================== */

/*
  FIREBASE: create a Firebase project and enable Firestore.
  Go to: https://console.firebase.google.com/
  - Create project
  - Create Firestore database (start in test mode for now)
  - Get firebase config values and paste into FIREBASE_CONFIG below
*/
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_APIKEY",
  authDomain: "YOUR_FIREBASE_AUTHDOMAIN",
  projectId: "YOUR_FIREBASE_PROJECTID",
  storageBucket: "YOUR_FIREBASE_STORAGEBUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGINGSENDERID",
  appId: "YOUR_FIREBASE_APPID"
};

/*
  EMAILJS: client-side email notifications (fast to set up)
  - Signup at https://www.emailjs.com
  - Create an email service (e.g., Gmail) and an email template
  - Note your user ID (public key), service ID, template ID
  - Replace placeholders below
*/
const EMAILJS_USER_ID = "YOUR_EMAILJS_USERID";       // e.g., user_xxx
const EMAILJS_SERVICE_ID = "YOUR_EMAILJS_SERVICEID"; // e.g., service_xxx
const EMAILJS_ORDER_TEMPLATE_ID = "YOUR_TEMPLATE_ORDER"; // template for order notification
const EMAILJS_CONTACT_TEMPLATE_ID = "YOUR_TEMPLATE_CONTACT"; // template for contact message

/*
  PAYPAL:
  - Replace the script tag in index.html with your sandbox client id for testing
  - For live, create live keys and replace when ready
  (No secret in client code — PayPal client id is public)
*/

/* ================== LIBS & INIT ================== */

// Initialize EmailJS (client-side)
if (window.emailjs && EMAILJS_USER_ID && EMAILJS_USER_ID !== "YOUR_EMAILJS_USERID") {
  emailjs.init(EMAILJS_USER_ID);
  console.log("EmailJS initialized");
} else {
  console.warn("EmailJS not initialized. Set EMAILJS_USER_ID in script.js to enable email notifications.");
}

// Initialize Firebase (compat for simplicity)
if (window.firebase && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_APIKEY") {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    var db = firebase.firestore();
    console.log("Firebase initialized and Firestore ready.");
  } catch (e) {
    console.error("Firebase init error", e);
  }
} else {
  console.warn("Firebase not initialized. Set FIREBASE_CONFIG in script.js to enable Firestore persistence.");
}

/* ================== UTILITIES ================== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const nowISO = () => new Date().toISOString();
const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2,9);

const LS = {
  get(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch(e) { console.error('LS.get error',e); return fallback; }
  },
  set(k,v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.error('LS.set error', e); } },
  remove(k) { localStorage.removeItem(k); }
};

/* ================== APP CONFIG ================== */
const APP = {
  priceUSD: 19,
  exchangeRates: { USD:1, INR:82, EUR:0.92, JPY:150, KRW:1350 }, // placeholder, update later if you like
  keys: {
    currency: 'hh_currency',
    profile: 'hh_profile',
    wishlist: 'hh_wishlist',
    orders: 'hh_orders', // local fallback mirror
    tracker: 'hh_tracker'
  }
};

/* ================== CURRENCY & PRICE ================== */
function detectCurrency() {
  const lang = (navigator.language || navigator.userLanguage || 'en-US').toUpperCase();
  if (lang.includes('IN')) return 'INR';
  if (lang.includes('JP')) return 'JPY';
  if (lang.includes('KO') || lang.includes('KR')) return 'KRW';
  if (lang.includes('DE') || lang.includes('FR') || lang.includes('ES')) return 'EUR';
  return 'USD';
}
function currentCurrency() {
  const forced = LS.get(APP.keys.currency, 'AUTO');
  return (forced && forced !== 'AUTO') ? forced : detectCurrency();
}
function formatPriceUSD(usd) {
  const cur = currentCurrency();
  const rate = APP.exchangeRates[cur] || 1;
  const raw = Math.round((usd * rate + Number.EPSILON) * 100) / 100;
  if (cur === 'JPY' || cur === 'KRW') return `${cur} ${Math.round(raw)}`;
  return `${cur} ${raw}`;
}
function renderPrices() {
  $$('[data-price-usd]').forEach(el=>{
    const usd = parseFloat(el.getAttribute('data-price-usd')) || APP.priceUSD;
    el.textContent = formatPriceUSD(usd);
  });
  const main = $('#price-display');
  if (main) main.textContent = formatPriceUSD(APP.priceUSD);
  const cs = $('#currency-select');
  if (cs) cs.value = LS.get(APP.keys.currency, 'AUTO');
}

/* ================== PROFILE (local + Firestore sync) ================== */
function getProfileLocal() { return LS.get(APP.keys.profile, null); }
function saveProfileLocal(profile) { LS.set(APP.keys.profile, profile); renderProfileUI(); return profile; }

/* sync profile to Firestore (if configured) */
async function syncProfileToFirestore(profile) {
  if (!window.db) return;
  try {
    const docRef = await db.collection('users').doc(profile.email || profile.id || uid('user')).set({
      name: profile.name || null,
      email: profile.email || null,
      country: profile.country || null,
      dob: profile.dob || null,
      photo: profile.photo || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('Profile saved to Firestore');
  } catch (e) { console.error('Firestore saveProfile error', e); }
}

/* render profile in UI (user.html) */
function renderProfileUI() {
  const p = getProfileLocal();
  if (!p) {
    if($('#profile-name-display')) $('#profile-name-display').textContent = 'Guest';
    if($('#profile-country-display')) $('#profile-country-display').textContent = 'No country';
    if($('#profile-avatar')) $('#profile-avatar').textContent = 'GH';
    return;
  }
  if($('#profile-name-display')) $('#profile-name-display').textContent = p.name || 'Guest';
  if($('#profile-country-display')) $('#profile-country-display').textContent = p.country || '';
  if($('#profile-name')) $('#profile-name').value = p.name || '';
  if($('#profile-email')) $('#profile-email').value = p.email || '';
  if($('#profile-country')) $('#profile-country').value = p.country || '';
  if($('#profile-dob')) $('#profile-dob').value = p.dob || '';
  if($('#profile-avatar')) {
    if (p.photo) {
      $('#profile-avatar').innerHTML = `<img src="${p.photo}" style="width:84px;height:84px;border-radius:10px;object-fit:cover" />`;
    } else {
      $('#profile-avatar').textContent = (p.name ? p.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase() : 'GH');
    }
  }
}

/* handle profile photo input (stores base64 in localStorage for demo) */
function handleProfilePhotoInput(fileInput) {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const p = getProfileLocal() || {};
    p.photo = ev.target.result;
    LS.set(APP.keys.profile, p); renderProfileUI();
    // optionally sync to Firestore
    syncProfileToFirestore(p);
  };
  reader.readAsDataURL(f);
}

/* save profile from inputs on user.html */
function handleProfileSave() {
  const name = $('#profile-name') ? $('#profile-name').value.trim() : '';
  const email = $('#profile-email') ? $('#profile-email').value.trim() : '';
  const country = $('#profile-country') ? $('#profile-country').value.trim() : '';
  const dob = $('#profile-dob') ? $('#profile-dob').value : '';
  const p = { id: uid('user'), name, email, country, dob, updatedAt: nowISO() };
  LS.set(APP.keys.profile, p);
  syncProfileToFirestore(p);
  renderProfileUI();
  $('#profile-feedback') && ($('#profile-feedback').textContent = 'Profile saved (demo).');
}

/* clear profile local (for demo) */
function handleProfileClear() {
  if (!confirm('Clear profile data locally?')) return;
  LS.remove(APP.keys.profile);
  renderProfileUI();
  renderWishlistUI();
  renderOrdersUI();
}

/* ================== WISHLIST (local + Firestore optional) ================== */
function getWishlist() { return LS.get(APP.keys.wishlist, []); }
function setWishlist(wl) { LS.set(APP.keys.wishlist, wl); renderWishlistUI(); }
function addToWishlist(productId) {
  const arr = getWishlist();
  if (!arr.includes(productId)) arr.push(productId);
  setWishlist(arr);
  showTick('#wl-tick');
  // optionally: record wishlist in Firestore under user doc
  const p = getProfileLocal();
  if (window.db && p && p.email) {
    db.collection('users').doc(p.email).set({ wishlist: arr }, { merge: true }).catch(e=>console.warn('wishlist save error', e));
  }
}
function removeFromWishlist(pid) {
  const arr = getWishlist().filter(x=>x !== pid);
  setWishlist(arr);
}
function renderWishlistUI() {
  const area = $('#wishlist-area');
  if (!area) return;
  const arr = getWishlist();
  if (arr.length === 0) { area.innerHTML = '<div class="small-muted">Wishlist is empty</div>'; return; }
  area.innerHTML = arr.map(pid => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0"><div>${pid}</div><div><button data-buy="${pid}" class="btn btn-ghost small">Buy</button> <button data-remove="${pid}" class="btn btn-ghost small">Remove</button></div></div>`).join('');
  area.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', e => removeFromWishlist(e.currentTarget.getAttribute('data-remove'))));
  area.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', e => simulatePayment(e.currentTarget.getAttribute('data-buy'))));
}

/* ================== ORDERS (Firestore + local fallback) ================== */

async function saveOrderToFirestore(orderObj) {
  if (!window.db) return;
  try {
    const docRef = await db.collection('orders').add(orderObj);
    console.log('Order saved to Firestore:', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('saveOrderToFirestore error', e);
    return null;
  }
}

function saveOrderLocal(orderObj) {
  const arr = LS.get(APP.keys.orders, []);
  arr.unshift(orderObj);
  LS.set(APP.keys.orders, arr);
  renderOrdersUI();
}

/*
  Public method: saveOrder(order)
  - Saves order locally
  - Attempts to save to Firestore if configured
  - Sends an email notification using EmailJS if configured
*/
async function saveOrder(order) {
  // ensure structure
  order.createdAt = order.createdAt || nowISO();
  saveOrderLocal(order);

  // Firestore
  if (window.db) {
    const id = await saveOrderToFirestore(order);
    if (id) order.remoteId = id;
  }

  // Send email notification (order)
  if (window.emailjs && EMAILJS_ORDER_TEMPLATE_ID && EMAILJS_SERVICE_ID) {
    const templateParams = {
      order_id: order.id || order.createdAt,
      email: (order.payer && order.payer.email_address) || order.customerEmail || 'unknown',
      name: (order.payer && order.payer.name && order.payer.name.given_name) || order.customerName || 'Customer',
      product: (order.items && order.items.map(i=>i.title).join(', ')) || 'WorkWise eBook',
      amount: order.amount_display || formatPriceUSD(order.amount_usd || APP.priceUSD),
      date: new Date(order.createdAt).toLocaleString()
    };
    try {
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ORDER_TEMPLATE_ID, templateParams)
        .then(() => console.log('Order email notification sent via EmailJS'))
        .catch(err => console.warn('EmailJS order error', err));
    } catch(e) { console.warn('EmailJS exception', e); }
  }
}

/* load orders into UI */
function renderOrdersUI() {
  const area = $('#orders-area');
  if (!area) return;
  const arr = LS.get(APP.keys.orders, []);
  if (!arr || arr.length === 0) { area.innerHTML = '<div class="small-muted">No orders yet</div>'; return; }
  area.innerHTML = arr.map(o => {
    const items = (o.items && o.items.map(i=>i.title).join(', ')) || 'WorkWise eBook';
    const amount = o.amount_display || (o.currency + ' ' + o.amount_usd);
    const status = o.paymentStatus || o.paymentProvider;
    return `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">
      <div style="display:flex;justify-content:space-between"><strong>${items}</strong><div class="small-muted">${amount}</div></div>
      <div class="small-muted">${status} • ${new Date(o.createdAt).toLocaleString()}</div></div>`;
  }).join('');
}

/* ================== CONTACT FORM ================== */
async function handleContactSend() {
  const name = $('#contact-name') ? $('#contact-name').value.trim() : '';
  const email = $('#contact-email') ? $('#contact-email').value.trim() : '';
  const msg = $('#contact-msg') ? $('#contact-msg').value.trim() : '';
  if (!email || !msg) { alert('Please enter email and message'); return; }

  const contactObj = { name, email, message: msg, createdAt: nowISO() };

  // Save to Firestore
  if (window.db) {
    try {
      await db.collection('contacts').add(contactObj);
      console.log('Contact saved to Firestore');
    } catch(e) { console.warn('contact save error', e); }
  }

  // Save locally too for demo
  const contacts = LS.get('hh_contacts', []);
  contacts.unshift(contactObj);
  LS.set('hh_contacts', contacts);

  // send notification email via EmailJS (if configured)
  if (window.emailjs && EMAILJS_CONTACT_TEMPLATE_ID && EMAILJS_SERVICE_ID) {
    const params = { name, email, message: msg };
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CONTACT_TEMPLATE_ID, params).then(()=> {
      console.log('Contact email sent via EmailJS');
    }).catch(err => console.warn('EmailJS contact error', err));
  }

  $('#contact-feedback') && ($('#contact-feedback').textContent = 'Message sent — we will reply soon (demo).');
  // clear inputs
  if($('#contact-name')) $('#contact-name').value='';
  if($('#contact-email')) $('#contact-email').value='';
  if($('#contact-msg')) $('#contact-msg').value='';
}

/* ================== SIMULATED PAYMENT (DEMO) ================== */
function simulatePayment(productId='ebook_workwise') {
  const orderObj = {
    id: 'sim_' + Date.now(),
    items: [{ productId, title: 'WorkWise eBook', price_usd: APP.priceUSD, qty:1 }],
    amount_usd: APP.priceUSD,
    amount_display: formatPriceUSD(APP.priceUSD),
    currency: currentCurrency(),
    paymentProvider: 'simulated',
    paymentStatus: 'completed',
    createdAt: nowISO(),
    customerEmail: (getProfileLocal() && getProfileLocal().email) || 'guest@demo'
  };
  saveOrder(orderObj);
  showTick('#preorder-confirm');
  alert('Simulated payment completed (demo). Order recorded locally.');
}

/* ================== PAYPAL SMART BUTTONS (CLIENT) ==================

  Integration notes:
  - The PayPal SDK script must be included in index.html with your client-id (sandbox or live).
  - The client-only button is suitable to accept payments, but to fully trust orders you must verify via server-side webhooks.
  - This script accepts onApprove and will save the order to Firestore & send notifications (demo).
*/
function renderPayPalButtons() {
  if (!window.paypal) { console.warn('PayPal SDK not found. Replace client id in index.html to render PayPal buttons.'); return; }

  paypal.Buttons({
    style: { layout:'vertical', color:'blue', shape:'rect', label:'paypal' },
    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{ amount: { value: APP.priceUSD.toString() }, description: 'WorkWise eBook' }]
      });
    },
    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        // Build order object
        const order = {
          id: data.orderID || uid('order'),
          items: [{ productId:'ebook_workwise', title:'WorkWise eBook', price_usd: APP.priceUSD, qty:1 }],
          amount_usd: APP.priceUSD,
          amount_display: formatPriceUSD(APP.priceUSD),
          currency: currentCurrency(),
          paymentProvider: 'paypal',
          paymentStatus: 'completed',
          payer: details.payer,
          createdAt: nowISO()
        };

        // Save order (local + Firestore + email)
        saveOrder(order);

        // Show checkout success
        showTick('#preorder-confirm');

        // Optionally: show download link or open modal for immediate download (demo)
        setTimeout(()=> {
          alert('Payment successful — thank you! Check your dashboard for order details.');
          // TODO: For production, you should generate a secured signed download link in server and send via email.
        }, 200);

      }).catch(err => {
        console.error('PayPal capture error', err);
        alert('Payment capture failed. See console.');
      });
    },
    onError: function(err) {
      console.error('PayPal Buttons Error', err);
      alert('PayPal error: ' + (err && err.message ? err.message : 'unknown'));
    }
  }).render('#paypal-button-container');
}

/* ================== TICK / MICRO-ANIMATIONS ================== */
function showTick(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 2500);
}

/* ================== DAILY TRACKER (local + optional Firestore) ================== */
function getTrackerLocal() { return LS.get(APP.keys.tracker, {}); }
function saveTrackerLocal(data) { LS.set(APP.keys.tracker, data); renderTrackerUI(); }
function addTaskToday(title) {
  if (!title) return;
  const date = new Date().toISOString().slice(0,10);
  const t = getTrackerLocal();
  t[date] = t[date] || { tasks: [], notes: '' };
  t[date].tasks.unshift({ id: 'task_'+Date.now(), title, done: false });
  saveTrackerLocal(t);
}
function toggleTask(date, taskId) {
  const t = getTrackerLocal();
  if (!t[date]) return;
  t[date].tasks = t[date].tasks.map(tsk => tsk.id === taskId ? { ...tsk, done: !tsk.done } : tsk);
  saveTrackerLocal(t);
}
function renderTrackerUI() {
  const area = $('#tracker-list');
  if (!area) return;
  const date = new Date().toISOString().slice(0,10);
  const t = getTrackerLocal();
  const today = t[date] || { tasks: [], notes: '' };
  if (today.tasks.length === 0) { area.innerHTML = '<div class="small-muted">No tasks for today</div>'; return; }
  area.innerHTML = today.tasks.map(tsk => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0"><input type="checkbox" ${tsk.done ? 'checked' : ''} data-task="${tsk.id}" /> <div style="flex:1; text-decoration:${tsk.done ? 'line-through' : 'none'}">${tsk.title}</div></div>`).join('');
  area.querySelectorAll('[data-task]').forEach(cb => cb.addEventListener('change', e => {
    const id = e.currentTarget.getAttribute('data-task');
    const date = new Date().toISOString().slice(0,10);
    toggleTask(date, id);
  }));
}

/* ================== INIT: wire UI events on DOMContentLoaded ================== */
document.addEventListener('DOMContentLoaded', function() {
  // Render initial price and price controls
  renderPrices();

  // Currency selector binding
  const cs = $('#currency-select');
  if (cs) {
    cs.value = LS.get(APP.keys.currency, 'AUTO');
    cs.addEventListener('change', (e)=> {
      LS.set(APP.keys.currency, e.target.value);
      renderPrices();
    });
  }

  // Wishlist button
  $('#btn-wishlist') && $('#btn-wishlist').addEventListener('click', ()=> {
    addToWishlist('ebook_workwise');
    // quick feedback
    setTimeout(()=> { $('#wl-tick') &
