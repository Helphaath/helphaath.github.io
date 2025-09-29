/* ================================
   HELPHAATH — WORKWISE SCRIPT.JS
   ================================ */

/* ---- Currency Detection ---- */
const priceDisplay = document.getElementById("price-display");
const currencySelect = document.getElementById("currency-select");
let basePrice = 19; // USD price

function detectCurrency() {
  const userLang = navigator.language || navigator.userLanguage;
  if (userLang.includes("en-IN")) return "INR";
  if (userLang.includes("ja")) return "JPY";
  if (userLang.includes("de")) return "EUR";
  return "USD";
}

function updatePrice(curr) {
  let priceText = "";
  let price = basePrice;

  switch (curr) {
    case "INR":
      price = basePrice * 83;
      priceText = `₹${price.toFixed(0)}`;
      break;
    case "EUR":
      price = basePrice * 0.92;
      priceText = `€${price.toFixed(2)}`;
      break;
    case "JPY":
      price = basePrice * 150;
      priceText = `¥${price.toFixed(0)}`;
      break;
    default:
      priceText = `$${basePrice}`;
  }
  priceDisplay.textContent = priceText;
}

currencySelect?.addEventListener("change", (e) => {
  const val = e.target.value === "AUTO" ? detectCurrency() : e.target.value;
  updatePrice(val);
});

// Init load
const initCurrency = detectCurrency();
updatePrice(initCurrency);

/* ---- Wishlist Tick Animation ---- */
const wishlistBtn = document.getElementById("cta-wl");
wishlistBtn?.addEventListener("click", () => {
  wishlistBtn.innerHTML = `✔ Added to Wishlist`;
  wishlistBtn.disabled = true;
  wishlistBtn.classList.add("btn-primary");
});

/* ---- Free Mini Guide (fake email capture) ---- */
const freeBtn = document.getElementById("cta-free");
freeBtn?.addEventListener("click", () => {
  alert("📧 Please enter your email to receive the Free Mini Guide (demo).");
});

/* ---- Test Payment Button ---- */
const testPayBtn = document.getElementById("btn-test-pay");
testPayBtn?.addEventListener("click", () => {
  alert("✅ Test Payment successful! You’ll receive your eBook shortly (demo).");
});

/* ---- PayPal Integration ---- */
if (document.getElementById("paypal-button-container")) {
  paypal.Buttons({
    style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { value: basePrice.toString() }
        }]
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture().then(function (details) {
        alert("✅ Payment completed by " + details.payer.name.given_name);
        // Here you could trigger email confirmation, file download etc.
      });
    }
  }).render("#paypal-button-container");
}

/* ---- Contact Form ---- */
const contactSend = document.getElementById("contact-send");
contactSend?.addEventListener("click", () => {
  const name = document.getElementById("contact-name").value;
  const email = document.getElementById("contact-email").value;
  const msg = document.getElementById("contact-msg").value;

  if (!name || !email || !msg) {
    alert("⚠ Please fill in all fields.");
    return;
  }

  // EmailJS example (requires setup at emailjs.com)
  // Replace YOUR_SERVICE_ID, TEMPLATE_ID, and USER_ID
  /*
  emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
    from_name: name,
    from_email: email,
    message: msg,
  }, "YOUR_USER_ID").then(() => {
    alert("📨 Message sent successfully!");
  }, (err) => {
    alert("❌ Failed to send: " + JSON.stringify(err));
  });
  */

  // For demo:
  alert("📨 Message sent (demo). We’ll reply soon!");
});
