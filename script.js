document.addEventListener("DOMContentLoaded", () => {
  // Price + Currency Detection
  const priceEl = document.getElementById("price-display");
  if (priceEl) {
    const usdPrice = parseFloat(priceEl.dataset.priceUsd);
    let currency = "USD";
    if (navigator.language.includes("en-IN")) currency = "INR";
    else if (navigator.language.includes("de")) currency = "EUR";
    else if (navigator.language.includes("ja")) currency = "JPY";

    let converted = usdPrice;
    if (currency === "INR") converted = usdPrice * 83;
    if (currency === "EUR") converted = usdPrice * 0.93;
    if (currency === "JPY") converted = usdPrice * 150;

    priceEl.textContent = `${currency} ${converted.toFixed(2)}`;
  }

  // Wishlist
  const wlBtn = document.getElementById("cta-wl");
  if (wlBtn) {
    wlBtn.addEventListener("click", () => {
      let wl = JSON.parse(localStorage.getItem("wishlist") || "[]");
      wl.push("WorkWise eBook");
      localStorage.setItem("wishlist", JSON.stringify(wl));
      alert("✅ Added to wishlist!");
    });
  }

  // Test Payment
  const testPay = document.getElementById("btn-test-pay");
  if (testPay) {
    testPay.addEventListener("click", () => {
      let orders = JSON.parse(localStorage.getItem("orders") || "[]");
      orders.push({ product:"WorkWise eBook", date:new Date().toLocaleString(), price: priceEl.textContent });
      localStorage.setItem("orders", JSON.stringify(orders));
      alert("✅ Test payment successful!");
    });
  }

  // Profile Save
  const saveProfile = document.getElementById("save-profile");
  if (saveProfile) {
    saveProfile.addEventListener("click", () => {
      const profile = {
        name: document.getElementById("profile-name").value,
        country: document.getElementById("profile-country").value,
        dob: document.getElementById("profile-dob").value
      };
      localStorage.setItem("profile", JSON.stringify(profile));
      document.getElementById("profile-preview").innerText = "✅ Profile saved!";
    });
  }

  // Wishlist Load
  const wlList = document.getElementById("wishlist-list");
  if (wlList) {
    let wl = JSON.parse(localStorage.getItem("wishlist") || "[]");
    wlList.innerHTML = wl.map(item => `<li>${item}</li>`).join("");
  }

  // Orders Load
  const ordersList = document.getElementById("orders-list");
  if (ordersList) {
    let orders = JSON.parse(localStorage.getItem("orders") || "[]");
    ordersList.innerHTML = orders.map(o => `<li>${o.product} — ${o.price} — ${o.date}</li>`).join("");
  }

  // PayPal (sandbox)
  if (document.getElementById("paypal-button-container") && window.paypal) {
    paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{ amount: { value: "19.00" } }]
        });
      },
      onApprove: (data, actions) => {
        return actions.order.capture().then(() => {
          let orders = JSON.parse(localStorage.getItem("orders") || "[]");
          orders.push({ product:"WorkWise eBook (PayPal)", date:new Date().toLocaleString(), price:"USD 19.00" });
          localStorage.setItem("orders", JSON.stringify(orders));
          alert("✅ PayPal payment successful!");
        });
      }
    }).render("#paypal-button-container");
  }
});
