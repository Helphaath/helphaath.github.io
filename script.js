/* script.js — HelpHaath front-end logic
   Features:
   - Currency auto-detect + manual override
   - Wishlist (localStorage)
   - Profile (localStorage with photo as base64)
   - Orders (saved after PayPal success or simulated test)
   - PayPal Smart Buttons (client-side; replace client-id in index.html)
   - Confirmation tick animations and UI wiring
   Note: This is a frontend demo. For production use, add server webhooks for secure order verification.
*/

(function(){
  // ------- Helpers -------
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const nowISO = () => new Date().toISOString();
  const getLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)||JSON.stringify(def)); } catch(e){ return def; } };
  const setLS = (k,v) => localStorage.setItem(k, JSON.stringify(v));

  // ------- Config & Rates (placeholders) -------
  const PRICE_USD = 19;
  const RATES = { USD:1, INR:82, EUR:0.92, JPY:150, KRW:1350 };

  // ------- Currency detection & rendering -------
  const detectCurrency = () => {
    const lang = (navigator.language||navigator.userLanguage||'en-US').toUpperCase();
    if(lang.includes('IN')) return 'INR';
    if(lang.includes('JP')) return 'JPY';
    if(lang.includes('KO')||lang.includes('KR')) return 'KRW';
    if(lang.includes('DE')||lang.includes('FR')||lang.includes('ES')) return 'EUR';
    return 'USD';
  };

  let forcedCurrency = getLS('hh_currency','AUTO');
  const currentCurrency = () => (forcedCurrency && forcedCurrency !== 'AUTO') ? forcedCurrency : detectCurrency();

  function formatLocalPrice(usd){
    const cur = currentCurrency();
    const rate = RATES[cur] || 1;
    const val = Math.round((usd * rate + Number.EPSILON) * 100) / 100;
    if(cur === 'JPY' || cur === 'KRW') return `${cur} ${Math.round(val)}`;
    return `${cur} ${val}`;
  }

  function renderPrices(){
    $$('.price[data-price-usd]').forEach(el=>{
      const usd = parseFloat(el.getAttribute('data-price-usd')) || PRICE_USD;
      el.textContent = formatLocalPrice(usd);
    });
    const pd = $('#price-display');
    if(pd) pd.textContent = formatLocalPrice(PRICE_USD);
    const s = $('#currency-select');
    if(s) s.value = forcedCurrency || 'AUTO';
  }

  // handle currency selector
  document.addEventListener('change', e=>{
    if(e.target && e.target.id === 'currency-select'){
      forcedCurrency = e.target.value;
      setLS('hh_currency', forcedCurrency);
      renderPrices();
    }
  });

  // ------- Profile (localStorage) -------
  function getProfile(){ return getLS('hh_user', null); }
  function saveProfile(profile){ setLS('hh_user', profile); renderProfileUI(); }
  function clearProfile(){ localStorage.removeItem('hh_user'); renderProfileUI(); renderWishlistUI(); renderOrdersUI(); alert('Profile cleared (demo).'); }

  function renderProfileUI(){
    const u = getProfile();
    if(u){
      $('#profile-name-display') && ($('#profile-name-display').textContent = u.name || 'Guest');
      $('#profile-country-display') && ($('#profile-country-display').textContent = u.country || '');
      $('#profile-name') && ($('#profile-name').value = u.name || '');
      $('#profile-country') && ($('#profile-country').value = u.country || '');
      $('#profile-dob') && ($('#profile-dob').value = u.dob || '');
      const avatar = $('#profile-avatar');
      if(avatar){
        avatar.innerHTML = u.photo ? `<img src="${u.photo}" style="width:84px;height:84px;border-radius:10px;object-fit:cover">` : (u.name ? u.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() : 'GH');
      }
    } else {
      $('#profile-name-display') && ($('#profile-name-display').textContent = 'Guest');
      $('#profile-country-display') && ($('#profile-country-display').textContent = 'No country');
      $('#profile-name') && ($('#profile-name').value = '');
      $('#profile-country') && ($('#profile-country').value = '');
      $('#profile-dob') && ($('#profile-dob').value = '');
      $('#profile-avatar') && ($('#profile-avatar').innerHTML = 'GH');
    }
  }

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

  function handlePhotoInput(input){
    const f = input.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const u = getProfile() || {};
      u.photo = ev.target.result;
      setLS('hh_user', u);
      alert('Photo saved (demo).');
      renderProfileUI();
    };
    reader.readAsDataURL(f);
  }

  // ------- Wishlist (localStorage) -------
  function getWishlist(){ return getLS('hh_wishlist', []); }
  function setWishlist(arr){ setLS('hh_wishlist', arr); renderWishlistUI(); }
  function addToWishlist(id){
    const list = getWishlist();
    if(!list.includes(id)) list.push(id);
    setWishlist(list);
    showWLtick();
    alert('Added to wishlist (demo).');
  }
  function removeFromWishlist(id){
    const list = getWishlist().filter(x=>x!==id);
    setWishlist(list);
  }

  function renderWishlistUI(){
    const area = $('#wishlist-area');
    if(!area) return;
    const list = getWishlist();
    if(list.length === 0){
      area.innerHTML = '<div class="small-muted">No wishlist items</div>'; return;
    }
    area.innerHTML = list.map(it=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">${it}<div><button data-buy="${it}" class="btn-ghost">Buy</button><button data-remove="${it}" class="btn-ghost">Remove</button></div></div>`).join('');
    area.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click', e=> removeFromWishlist(e.currentTarget.getAttribute('data-remove'))));
    area.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click', e=> simulatePayment(e.currentTarget.getAttribute('data-buy'))));
  }

  function showWLtick(){
    const el = $('#wl-tick'); if(!el) return;
    el.style.display = 'flex';
    setTimeout(()=> el.style.display = 'none', 2500);
  }

  // ------- Orders (localStorage) -------
  function getOrders(){ return getLS('hh_orders', []); }
  function saveOrder(order){
    const list = getOrders(); list.unshift(order); setLS('hh_orders', list); renderOrdersUI();
  }
  function renderOrdersUI(){
    const area = $('#orders-area'); if(!area) return;
    const list = getOrders();
    if(list.length === 0){ area.innerHTML = '<div class="small-muted">No orders yet</div>'; return; }
    area.innerHTML = list.map(o => `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.02)"><strong>${o.items.map(i=>i.title).join(', ')}</strong><div class="small-muted">${o.amount_display || (o.currency+' '+o.amount_usd)} • ${new Date(o.createdAt).toLocaleString()}</div></div>`).join('');
  }

  function showOrderConfirm(){
    const el = $('#preorder-confirm'); if(!el) return;
    el.style.display = 'flex';
    setTimeout(()=> el.style.display = 'none', 3000);
  }

  // ------- Daily Tracker -------
  function getTracker(){ return getLS('hh_tracker', {}); }
  function saveTracker(t){ setLS('hh_tracker', t); renderTrackerUI(); }
  function addTaskToday(title){
    if(!title) return;
    const date = new Date().toISOString().slice(0,10);
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
    const area = $('#tracker-list'); if(!area) return;
    const date = new Date().toISOString().slice(0,10);
    const t = getTracker();
    const today = t[date] || {tasks:[], notes:''};
    if(today.tasks.length === 0){ area.innerHTML = '<div class="small-muted">No tasks for today</div>'; return; }
    area.innerHTML = today.tasks.map(tsk => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0"><input type="checkbox" ${tsk.done ? 'checked' : ''} data-toggle="${tsk.id}" /> <div style="flex:1; text-decoration:${tsk.done ? 'line-through' : 'none'}">${tsk.title}</div></div>`).join('');
    area.querySelectorAll('[data-toggle]').forEach(cb => cb.addEventListener('change', e=>{
      const id = e.currentTarget.getAttribute('data-toggle');
      toggleTask(date, id);
    }));
  }

  // ------- Contact (local demo) -------
  function handleContact(){
    const name = $('#contact-name') ? $('#contact-name').value.trim() : '';
    const email = $('#contact-email') ? $('#contact-email').value.trim() : '';
    const msg = $('#contact-msg') ? $('#contact-msg').value.trim() : '';
    if(!email || !msg) return alert('Please enter email & message');
    const list = getLS('hh_contacts', []);
    list.unshift({name,email,msg,ts:nowISO()});
    setLS('hh_contacts', list);
    alert('Message saved (demo). We will contact you.');
    $('#contact-name') && ($('#contact-name').value=''); $('#contact-email') && ($('#contact-email').value=''); $('#contact-msg') && ($('#contact-msg').value='');
  }

  // ------- PayPal Buttons (client-side) -------
  function renderPayPal(){
    if(!window.paypal){ console.warn('PayPal SDK not loaded (replace client id)'); return; }
    paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },
      createOrder: function(data, actions){
        return actions.order.create({
          purchase_units: [{
            amount: { value: PRICE_USD.toString() },
            description: "WorkWise eBook - Full"
          }]
        });
      },
      onApprove: function(data, actions){
        return actions.order.capture().then(function(details){
          // Build order object and save locally (demo). For production, validate using webhook.
          const order = {
            id: data.orderID || ('order_'+Date.now()),
            items: [{ productId:'ebook_workwise', title:'WorkWise eBook', price_usd: PRICE_USD, qty:1 }],
            amount_usd: PRICE_USD,
            amount_display: formatLocalPrice(PRICE_USD),
            currency: currentCurrency(),
            paymentProvider: 'paypal',
            paymentStatus: 'completed',
            createdAt: new Date().toISOString(),
            payer: details.payer
          };
          saveOrder(order);
          showOrderConfirm();
          alert('Payment successful — thank you! (demo). Check your profile for order history.');
        });
      },
      onError: function(err){ console.error('PayPal error', err); alert('PayPal error: ' + (err && err.message ? err.message : 'unknown')); }
    }).render('#paypal-button-container');
  }

  // ------- Simulate payment (demo) -------
  function simulatePayment(itemId='ebook_workwise'){
    const amount_usd = PRICE_USD;
    const order = {
      id: 'sim_' + Date.now(),
      items: [{ productId: itemId, title: itemId === 'bundle' ? 'WorkWise Premium' : 'WorkWise eBook', price_usd: amount_usd, qty:1 }],
      amount_usd,
      amount_display: formatLocalPrice(amount_usd),
      currency: currentCurrency(),
      paymentProvider: 'simulated',
      paymentStatus: 'completed',
      createdAt: new Date().toISOString()
    };
    saveOrder(order);
    showOrderConfirm();
  }

  // ------- Init (bind UI events) -------
  function init(){
    renderPrices();

    // Currency selector already handled via change listener
    $('#cta-wl') && $('#cta-wl').addEventListener('click', ()=> addToWishlist('ebook_workwise'));
    $('#cta-free') && $('#cta-free').addEventListener('click', ()=>{
      const email = prompt('Enter your email to receive the free mini guide (demo):');
      if(!email || !email.includes('@')) return alert('Please enter a valid email');
      const leads = getLS('hh_leads', []); leads.unshift({email, ts: nowISO()}); setLS('hh_leads', leads);
      alert('Free mini guide sent to your email (demo).');
    });

    $('#btn-test-pay') && $('#btn-test-pay').addEventListener('click', ()=> simulatePayment('ebook_workwise'));
    $('#btn-stripe') && $('#btn-stripe').addEventListener('click', ()=> alert('Stripe requires a small server. I can provide server code if you want.'));

    $('#contact-send') && $('#contact-send').addEventListener('click', handleContact);

    // Profile page bindings
    $('#save-profile') && $('#save-profile').addEventListener('click', handleSaveProfile);
    $('#clear-profile') && $('#clear-profile').addEventListener('click', ()=> { if(confirm('Clear profile?')) clearProfile(); });
    $('#profile-photo') && $('#profile-photo').addEventListener('change', function(){ handlePhotoInput(this); });

    // Wishlist/orders/tracker UI
    renderWishlistUI(); renderOrdersUI(); renderTrackerUI(); renderProfileUI();

    // tracker add
    $('#add-task') && $('#add-task').addEventListener('click', ()=>{
      const val = $('#tracker-input').value.trim(); if(!val) return alert('Enter a task'); addTaskToday(val); $('#tracker-input').value='';
    });

    // PayPal render (if sdk loaded)
    if(window.paypal) renderPayPal();
    else console.warn('PayPal SDK not available. Add your client-id script tag in index.html');
  }

  document.addEventListener('DOMContentLoaded', init);

  // expose for debugging
  window.hh = { getProfile, getWishlist, getOrders, simulatePayment, addToWishlist };
})();
