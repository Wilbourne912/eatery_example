// ADMIN PANEL LOGIC
//
// IMPORTANT: This password check happens entirely in the browser. It is a
// UX convenience to keep casual visitors off this page — it is NOT real
// security. Anyone who views the page source can find this password, and
// the actual database writes are protected only by the "Admin can update"
// Supabase policies, which currently allow the anon key to do this from
// anywhere. Do not use this pattern for a real restaurant's live data
// without upgrading to real Supabase Auth.

const ADMIN_PASSWORD = "changeme123"; // <-- change this before sharing the link

const loginGate = document.getElementById("login-gate");
const adminContent = document.getElementById("admin-content");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

loginBtn.addEventListener("click", () => {
  const entered = document.getElementById("admin-password").value;
  if (entered === ADMIN_PASSWORD) {
    loginGate.style.display = "none";
    adminContent.style.display = "block";
    loadReservations();
    loadMenuEditor();
    loadOrders();
    loadSettings();
  } else {
    loginError.textContent = "Incorrect password.";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  adminContent.style.display = "none";
  loginGate.style.display = "flex";
  document.getElementById("admin-password").value = "";
  loginError.textContent = "";
});

// ---------- RESERVATIONS ----------

async function loadReservations() {
  const list = document.getElementById("reservations-list");

  const { data, error } = await supabaseClient
    .from("reservations")
    .select("*")
    .order("reservation_date", { ascending: true });

  if (error) {
    list.innerHTML = "<p>Error loading reservations: " + error.message + "</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>No reservations yet.</p>";
    return;
  }

  list.innerHTML = data.map(res => `
    <div class="res-card" id="res-${res.id}">
      <p><strong>${res.name}</strong> — ${res.party_size} people</p>
      <p>${res.reservation_date} at ${res.reservation_time}</p>
      <p>Phone: ${res.phone}</p>
      <p class="status-${res.status}">Status: ${res.status}</p>
      ${res.slot_was_full ? '<p style="color:#b00020; font-weight:600;">⚠ Slot was at/over capacity when booked</p>' : ''}
      <div class="btn-row">
        <button class="btn-confirm" onclick="updateReservationStatus(${res.id}, 'confirmed')">Confirm</button>
        <button class="btn-decline" onclick="updateReservationStatus(${res.id}, 'declined')">Decline</button>
      </div>
    </div>
  `).join("");
}

async function updateReservationStatus(id, newStatus) {
  const { error } = await supabaseClient
    .from("reservations")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    alert("Error updating reservation: " + error.message);
    return;
  }

  loadReservations(); // refresh the list to show the new status
}

// ---------- MENU EDITOR ----------

async function loadMenuEditor() {
  const list = document.getElementById("menu-editor-list");

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    list.innerHTML = "<p>Error loading menu items: " + error.message + "</p>";
    return;
  }

  list.innerHTML = data.map(item => `
    <div class="item-card" id="item-${item.id}">
      <label>Name</label>
      <input type="text" id="name-${item.id}" value="${item.name}">

      <label>Description</label>
      <textarea id="desc-${item.id}" rows="2">${item.description || ""}</textarea>

      <label>Price</label>
      <input type="number" step="0.01" id="price-${item.id}" value="${item.price}">

      <div class="availability-toggle">
        <input type="checkbox" id="avail-${item.id}" ${item.is_available ? "checked" : ""}>
        <label for="avail-${item.id}" style="margin:0;">Available</label>
      </div>

      <button class="save-btn" onclick="saveMenuItem(${item.id})">Save Changes</button>
    </div>
  `).join("");
}

async function saveMenuItem(id) {
  const name = document.getElementById(`name-${id}`).value.trim();
  const description = document.getElementById(`desc-${id}`).value.trim();
  const price = parseFloat(document.getElementById(`price-${id}`).value);
  const isAvailable = document.getElementById(`avail-${id}`).checked;

  const { error } = await supabaseClient
    .from("menu_items")
    .update({
      name: name,
      description: description,
      price: price,
      is_available: isAvailable,
    })
    .eq("id", id);

  if (error) {
    alert("Error saving item: " + error.message);
    return;
  }

  alert("Saved!");
}

// ---------- ORDERS ----------

async function loadOrders() {
  const list = document.getElementById("orders-list");

  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = "<p>Error loading orders: " + error.message + "</p>";
    return;
  }

  if (!orders || orders.length === 0) {
    list.innerHTML = "<p>No orders yet.</p>";
    return;
  }

  // Fetch all order_items for these orders in one call, then group by order_id
  const orderIds = orders.map(o => o.id);
  const { data: items, error: itemsError } = await supabaseClient
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);

  if (itemsError) {
    list.innerHTML = "<p>Error loading order items: " + itemsError.message + "</p>";
    return;
  }

  list.innerHTML = orders.map(order => {
    const orderLines = items
      .filter(i => i.order_id === order.id)
      .map(i => `<div class="order-line"><span>${i.quantity} x ${i.item_name}</span><span>$${(i.item_price * i.quantity).toFixed(2)}</span></div>`)
      .join("");

    return `
      <div class="order-card" id="order-${order.id}">
        <p><strong>Order #${order.id}</strong> — ${order.customer_name}</p>
        <p>Phone: ${order.customer_phone}</p>
        ${orderLines}
        <p style="margin-top:0.5rem;"><strong>Total: $${order.total.toFixed(2)}</strong></p>
        ${order.notes ? `<p>Notes: ${order.notes}</p>` : ""}
        <p class="status-${order.status}">Status: ${order.status}</p>
        <div class="order-btn-row">
          <button class="btn-confirm" onclick="updateOrderStatus(${order.id}, 'confirmed')">Confirm</button>
          <button class="btn-ready" onclick="updateOrderStatus(${order.id}, 'ready')">Ready</button>
          <button class="btn-complete" onclick="updateOrderStatus(${order.id}, 'completed')">Completed</button>
          <button class="btn-decline" onclick="updateOrderStatus(${order.id}, 'declined')">Decline</button>
        </div>
      </div>
    `;
  }).join("");
}

async function updateOrderStatus(id, newStatus) {
  const { error } = await supabaseClient
    .from("orders")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    alert("Error updating order: " + error.message);
    return;
  }

  loadOrders();
}

// ---------- RESTAURANT SETTINGS ----------

async function loadSettings() {
  const box = document.getElementById("settings-box");

  const { data, error } = await supabaseClient
    .from("restaurant_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    box.innerHTML = "<p>Error loading settings: " + error.message + "</p>";
    return;
  }

  box.innerHTML = `
    <label>Total Seats (used for reservation capacity checks)</label>
    <input type="number" id="setting-total-seats" value="${data.total_seats}">

    <label>Delivery Mode</label>
    <select id="setting-delivery-mode">
      <option value="none" ${data.delivery_mode === "none" ? "selected" : ""}>No delivery offered</option>
      <option value="third_party" ${data.delivery_mode === "third_party" ? "selected" : ""}>Third-party delivery service</option>
      <option value="self" ${data.delivery_mode === "self" ? "selected" : ""}>We handle our own delivery</option>
    </select>

    <label>Delivery Provider Name (if third-party, e.g. "DoorDash")</label>
    <input type="text" id="setting-delivery-provider" value="${data.delivery_provider_name || ""}">

    <label>Delivery Link (if third-party)</label>
    <input type="text" id="setting-delivery-link" value="${data.delivery_link || ""}">

    <label>Delivery Note (if self-delivery, e.g. "Call us to arrange delivery")</label>
    <textarea id="setting-delivery-note" rows="2">${data.delivery_note || ""}</textarea>

    <button class="save-btn" onclick="saveSettings(${data.id})">Save Settings</button>
  `;
}

async function saveSettings(id) {
  const totalSeats = parseInt(document.getElementById("setting-total-seats").value, 10);
  const deliveryMode = document.getElementById("setting-delivery-mode").value;
  const deliveryProvider = document.getElementById("setting-delivery-provider").value.trim();
  const deliveryLink = document.getElementById("setting-delivery-link").value.trim();
  const deliveryNote = document.getElementById("setting-delivery-note").value.trim();

  const { error } = await supabaseClient
    .from("restaurant_settings")
    .update({
      total_seats: totalSeats,
      delivery_mode: deliveryMode,
      delivery_provider_name: deliveryProvider,
      delivery_link: deliveryLink,
      delivery_note: deliveryNote,
    })
    .eq("id", id);

  if (error) {
    alert("Error saving settings: " + error.message);
    return;
  }

  alert("Settings saved!");
}

