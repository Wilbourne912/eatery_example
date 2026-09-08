// ONLINE ORDERING: cart + checkout logic
//
// Cart lives entirely in browser memory (a plain JS array) while the person
// is browsing. Nothing touches Supabase until they hit "Place Order" — same
// pattern as any real shopping cart. On checkout, we write one row to
// "orders" and one row per line item to "order_items".

let cart = []; // each entry: { menu_item_id, name, price, quantity }

// ---------- LOAD ORDER MENU (separate render target from the read-only menu display) ----------

async function loadOrderMenu() {
  const orderMenuList = document.getElementById("order-menu-list");

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    orderMenuList.innerHTML = "<p>Couldn't load the menu right now.</p>";
    console.error("Supabase error:", error);
    return;
  }

  if (!data || data.length === 0) {
    orderMenuList.innerHTML = "<p>No menu items available to order yet.</p>";
    return;
  }

  orderMenuList.innerHTML = data.map(item => `
    <div class="order-item ${item.is_available ? "" : "unavailable"}">
      <div>
        <strong>${item.name}</strong>
        <p>${item.description || ""}</p>
        <p>${item.is_available ? "$" + item.price : "Sold Out"}</p>
      </div>
      ${item.is_available
        ? `<button onclick="addToCart(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price})">Add</button>`
        : ""
      }
    </div>
  `).join("");
}

// ---------- CART LOGIC ----------

function addToCart(id, name, price) {
  const existing = cart.find(entry => entry.menu_item_id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ menu_item_id: id, name: name, price: price, quantity: 1 });
  }
  renderCart();
}

function changeQuantity(id, delta) {
  const entry = cart.find(e => e.menu_item_id === id);
  if (!entry) return;

  entry.quantity += delta;
  if (entry.quantity <= 0) {
    cart = cart.filter(e => e.menu_item_id !== id);
  }
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
}

function renderCart() {
  const cartList = document.getElementById("cart-list");
  const cartTotalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout-btn");

  if (cart.length === 0) {
    cartList.innerHTML = "<p>Your cart is empty.</p>";
    cartTotalEl.textContent = "";
    checkoutBtn.disabled = true;
    return;
  }

  cartList.innerHTML = cart.map(entry => `
    <div class="cart-row">
      <span>${entry.name}</span>
      <div class="qty-controls">
        <button onclick="changeQuantity(${entry.menu_item_id}, -1)">-</button>
        <span>${entry.quantity}</span>
        <button onclick="changeQuantity(${entry.menu_item_id}, 1)">+</button>
      </div>
      <span>$${(entry.price * entry.quantity).toFixed(2)}</span>
    </div>
  `).join("");

  cartTotalEl.textContent = "Total: $" + cartTotal().toFixed(2);
  checkoutBtn.disabled = false;
}

// ---------- CHECKOUT ----------

const checkoutForm = document.getElementById("checkout-form");
const checkoutStatus = document.getElementById("checkout-status");

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (cart.length === 0) {
    checkoutStatus.textContent = "Your cart is empty.";
    return;
  }

  const name = document.getElementById("order-name").value.trim();
  const phone = document.getElementById("order-phone").value.trim();
  const notes = document.getElementById("order-notes").value.trim();
  const total = cartTotal();

  checkoutStatus.textContent = "Placing order...";

  // 1. Insert the order itself
  const { data: orderData, error: orderError } = await supabaseClient
    .from("orders")
    .insert([
      {
        customer_name: name,
        customer_phone: phone,
        order_type: "pickup",
        total: total,
        notes: notes,
      },
    ])
    .select()
    .single();

  if (orderError) {
    checkoutStatus.textContent = "ERROR: " + orderError.message;
    console.error("Supabase error:", orderError);
    return;
  }

  // 2. Insert one row per cart line item, linked to the new order's id
  const orderItemsPayload = cart.map(entry => ({
    order_id: orderData.id,
    menu_item_id: entry.menu_item_id,
    item_name: entry.name,
    item_price: entry.price,
    quantity: entry.quantity,
  }));

  const { error: itemsError } = await supabaseClient
    .from("order_items")
    .insert(orderItemsPayload);

  if (itemsError) {
    checkoutStatus.textContent = "ERROR saving order items: " + itemsError.message;
    console.error("Supabase error:", itemsError);
    return;
  }

  checkoutStatus.textContent = `Thanks, ${name}! Your order (#${orderData.id}) has been placed for pickup.`;
  cart = [];
  renderCart();
  checkoutForm.reset();
});

// ---------- DELIVERY OPTION DISPLAY ----------

async function loadDeliveryOption() {
  const deliveryBox = document.getElementById("delivery-option");

  const { data, error } = await supabaseClient
    .from("restaurant_settings")
    .select("delivery_mode, delivery_provider_name, delivery_link, delivery_note")
    .limit(1)
    .single();

  if (error || !data) {
    deliveryBox.innerHTML = "";
    return;
  }

  if (data.delivery_mode === "third_party" && data.delivery_link) {
    deliveryBox.innerHTML = `
      <p>Prefer delivery? Order through ${data.delivery_provider_name || "our delivery partner"}:</p>
      <a href="${data.delivery_link}" target="_blank" rel="noopener" class="delivery-link-btn">
        Order Delivery via ${data.delivery_provider_name || "Delivery Partner"}
      </a>
    `;
  } else if (data.delivery_mode === "self" && data.delivery_note) {
    deliveryBox.innerHTML = `<p>${data.delivery_note}</p>`;
  } else {
    deliveryBox.innerHTML = ""; // delivery_mode is "none" — show nothing
  }
}

loadOrderMenu();
renderCart();
loadDeliveryOption();
