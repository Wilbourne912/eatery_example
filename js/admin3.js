// ADMIN PANEL LOGIC
//
// Login uses Supabase Auth (email + password). Uploads and edits only work
// for a logged-in user because the policies in setup.sql are limited to the
// "authenticated" role. Create the admin user in the Supabase dashboard under
// Authentication > Users, and turn off public sign-ups.

const SITE_BUCKET = "site-images";

const SITE_PHOTOS = [
  { file: "hero.jpg", label: "Hero photo (top of homepage)", maxWidth: 1600 },
  { file: "dining-room.jpg", label: "The Space: dining room", maxWidth: 1200 },
  { file: "kitchen-bar.jpg", label: "The Space: kitchen / bar", maxWidth: 1200 },
  { file: "table.jpg", label: "Reservation section photo", maxWidth: 800 },
  { file: "menu-default.jpg", label: "Default dish photo (used when a dish has none)", maxWidth: 600 },
];

const SITE_TEXT_FIELDS = [
  { key: "restaurant_name", label: "Restaurant name", type: "input" },
  { key: "hero_headline", label: "Homepage headline", type: "input" },
  { key: "hero_subtext", label: "Homepage subtext", type: "textarea" },
  { key: "space_text", label: "The Space paragraph", type: "textarea" },
  { key: "reserve_text", label: "Reservation intro text", type: "textarea" },
];

const loginGate = document.getElementById("login-gate");
const adminContent = document.getElementById("admin-content");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

function esc(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function publicUrl(path) {
  return supabaseClient.storage.from(SITE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- LOGIN / LOGOUT ----------

function showAdmin() {
  loginGate.style.display = "none";
  adminContent.style.display = "block";
  loadReservations();
  loadOrders();
  loadMenuEditor();
  loadSitePhotos();
  loadSiteText();
  loadSettings();
}

function showLogin() {
  adminContent.style.display = "none";
  loginGate.style.display = "flex";
  document.getElementById("admin-password").value = "";
  loginError.textContent = "";
}

async function handleLogin() {
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;

  loginError.textContent = "";
  loginBtn.disabled = true;

  const { error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

  loginBtn.disabled = false;

  if (error) {
    loginError.textContent = "Login failed: " + error.message;
    return;
  }

  showAdmin();
}

loginBtn.addEventListener("click", handleLogin);

document.getElementById("admin-password").addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleLogin();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

supabaseClient.auth.getSession().then(({ data }) => {
  if (data && data.session) showAdmin();
});

// ---------- TABS ----------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => { p.style.display = "none"; });
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
  });
});

// ---------- IMAGE RESIZE ----------

function resizeImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not process the image"));
        }
      }, "image/jpeg", quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that file. Pick a JPG or PNG photo."));
    };

    img.src = url;
  });
}

// ---------- RESERVATIONS ----------

async function loadReservations() {
  const list = document.getElementById("reservations-list");

  const { data, error } = await supabaseClient
    .from("reservations")
    .select("*")
    .order("reservation_date", { ascending: true });

  if (error) {
    list.innerHTML = "<p>Error loading reservations: " + esc(error.message) + "</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>No reservations yet.</p>";
    return;
  }

  list.innerHTML = data.map(res => `
    <div class="res-card" id="res-${res.id}">
      <p><strong>${esc(res.name)}</strong> — ${esc(res.party_size)} people</p>
      <p>${esc(res.reservation_date)} at ${esc(res.reservation_time)}</p>
      <p>Phone: ${esc(res.phone)}</p>
      <p class="status-${esc(res.status)}">Status: ${esc(res.status)}</p>
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

  loadReservations();
}

// ---------- ORDERS ----------

async function loadOrders() {
  const list = document.getElementById("orders-list");

  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = "<p>Error loading orders: " + esc(error.message) + "</p>";
    return;
  }

  if (!orders || orders.length === 0) {
    list.innerHTML = "<p>No orders yet.</p>";
    return;
  }

  const orderIds = orders.map(o => o.id);
  const { data: items, error: itemsError } = await supabaseClient
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);

  if (itemsError) {
    list.innerHTML = "<p>Error loading order items: " + esc(itemsError.message) + "</p>";
    return;
  }

  list.innerHTML = orders.map(order => {
    const orderLines = items
      .filter(i => i.order_id === order.id)
      .map(i => `<div class="order-line"><span>${esc(i.quantity)} x ${esc(i.item_name)}</span><span>$${(i.item_price * i.quantity).toFixed(2)}</span></div>`)
      .join("");

    return `
      <div class="order-card" id="order-${order.id}">
        <p><strong>Order #${order.id}</strong> — ${esc(order.customer_name)}</p>
        <p>Phone: ${esc(order.customer_phone)}</p>
        ${orderLines}
        <p style="margin-top:0.5rem;"><strong>Total: $${order.total.toFixed(2)}</strong></p>
        ${order.notes ? `<p>Notes: ${esc(order.notes)}</p>` : ""}
        <p class="status-${esc(order.status)}">Status: ${esc(order.status)}</p>
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

// ---------- MENU EDITOR ----------

async function loadMenuEditor() {
  const list = document.getElementById("menu-editor-list");

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    list.innerHTML = "<p>Error loading menu items: " + esc(error.message) + "</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>No dishes yet. Add one above.</p>";
    return;
  }

  const fallback = publicUrl("menu-default.jpg");

  list.innerHTML = data.map(item => `
    <div class="item-card" id="item-${item.id}">
      <div class="photo-row">
        <img class="photo-preview" id="photo-preview-${item.id}" src="${esc(item.image_url || fallback)}" alt="${esc(item.name)}">
        <div>
          <label for="photo-input-${item.id}" style="margin-top:0;">Dish photo</label>
          <input type="file" accept="image/*" id="photo-input-${item.id}" onchange="uploadMenuPhoto(${item.id}, this)">
          <p class="photo-status" id="photo-status-${item.id}"></p>
        </div>
      </div>

      <label>Name</label>
      <input type="text" id="name-${item.id}" value="${esc(item.name)}">

      <label>Description</label>
      <textarea id="desc-${item.id}" rows="2">${esc(item.description)}</textarea>

      <label>Price</label>
      <input type="number" step="0.01" id="price-${item.id}" value="${esc(item.price)}">

      <div class="availability-toggle">
        <input type="checkbox" id="avail-${item.id}" ${item.is_available ? "checked" : ""}>
        <label for="avail-${item.id}">Available</label>
      </div>

      <button class="save-btn" onclick="saveMenuItem(${item.id})">Save Changes</button>
      <button class="delete-btn" onclick="deleteMenuItem(${item.id})">Delete Dish</button>
    </div>
  `).join("");
}

async function saveMenuItem(id) {
  const name = document.getElementById(`name-${id}`).value.trim();
  const description = document.getElementById(`desc-${id}`).value.trim();
  const price = parseFloat(document.getElementById(`price-${id}`).value);
  const isAvailable = document.getElementById(`avail-${id}`).checked;

  if (!name || isNaN(price)) {
    alert("A dish needs a name and a price.");
    return;
  }

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

async function addMenuItem() {
  const name = document.getElementById("new-name").value.trim();
  const description = document.getElementById("new-desc").value.trim();
  const price = parseFloat(document.getElementById("new-price").value);

  if (!name || isNaN(price)) {
    alert("A dish needs a name and a price.");
    return;
  }

  const { error } = await supabaseClient
    .from("menu_items")
    .insert([{ name: name, description: description, price: price, is_available: true }]);

  if (error) {
    alert("Error adding dish: " + error.message);
    return;
  }

  document.getElementById("new-name").value = "";
  document.getElementById("new-desc").value = "";
  document.getElementById("new-price").value = "";
  loadMenuEditor();
}

document.getElementById("add-dish-btn").addEventListener("click", addMenuItem);

async function deleteMenuItem(id) {
  if (!confirm("Delete this dish for good?")) return;

  const { error } = await supabaseClient
    .from("menu_items")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Could not delete: " + error.message + "\n\nIf this dish appears in past orders, untick Available instead.");
    return;
  }

  loadMenuEditor();
}

async function uploadMenuPhoto(id, input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById(`photo-status-${id}`);
  status.textContent = "Uploading...";

  try {
    const blob = await resizeImage(file, 600, 0.8);
    const path = `menu/${id}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseClient.storage
      .from(SITE_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });

    if (uploadError) throw uploadError;

    const url = publicUrl(path);

    const { error: dbError } = await supabaseClient
      .from("menu_items")
      .update({ image_url: url })
      .eq("id", id);

    if (dbError) throw dbError;

    document.getElementById(`photo-preview-${id}`).src = url;
    status.textContent = "Photo updated.";
  } catch (err) {
    status.textContent = "Error: " + err.message;
  }

  input.value = "";
}

// ---------- SITE PHOTOS ----------

function loadSitePhotos() {
  const list = document.getElementById("site-photos-list");

  list.innerHTML = SITE_PHOTOS.map((photo, index) => `
    <div class="photo-card">
      <div class="photo-row">
        <img class="photo-preview" id="site-photo-preview-${index}" src="${esc(publicUrl(photo.file))}?t=${Date.now()}" alt="${esc(photo.label)}">
        <div>
          <label for="site-photo-input-${index}" style="margin-top:0;">${esc(photo.label)}</label>
          <input type="file" accept="image/*" id="site-photo-input-${index}" onchange="uploadSitePhoto(${index}, this)">
          <p class="photo-status" id="site-photo-status-${index}"></p>
        </div>
      </div>
    </div>
  `).join("");
}

async function uploadSitePhoto(index, input) {
  const file = input.files[0];
  if (!file) return;

  const photo = SITE_PHOTOS[index];
  const status = document.getElementById(`site-photo-status-${index}`);
  status.textContent = "Uploading...";

  try {
    const blob = await resizeImage(file, photo.maxWidth, 0.8);

    const { error } = await supabaseClient.storage
      .from(SITE_BUCKET)
      .upload(photo.file, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "300" });

    if (error) throw error;

    document.getElementById(`site-photo-preview-${index}`).src = publicUrl(photo.file) + "?t=" + Date.now();
    status.textContent = "Photo updated.";
  } catch (err) {
    status.textContent = "Error: " + err.message;
  }

  input.value = "";
}

// ---------- SITE TEXT ----------

async function loadSiteText() {
  const box = document.getElementById("site-text-box");

  const { data, error } = await supabaseClient
    .from("site_content")
    .select("key, value");

  if (error) {
    box.innerHTML = "<p>Error loading site text: " + esc(error.message) + "</p>";
    return;
  }

  const content = {};
  (data || []).forEach(row => { content[row.key] = row.value; });

  box.innerHTML = SITE_TEXT_FIELDS.map(field => `
    <label for="content-${field.key}">${esc(field.label)}</label>
    ${field.type === "textarea"
      ? `<textarea id="content-${field.key}" rows="3">${esc(content[field.key])}</textarea>`
      : `<input type="text" id="content-${field.key}" value="${esc(content[field.key])}">`
    }
  `).join("") + `<button class="save-btn" onclick="saveSiteText()">Save Text</button>`;
}

async function saveSiteText() {
  const rows = SITE_TEXT_FIELDS.map(field => ({
    key: field.key,
    value: document.getElementById(`content-${field.key}`).value.trim(),
  }));

  const { error } = await supabaseClient
    .from("site_content")
    .upsert(rows, { onConflict: "key" });

  if (error) {
    alert("Error saving text: " + error.message);
    return;
  }

  alert("Text saved!");
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
    box.innerHTML = "<p>Error loading settings: " + esc(error.message) + "</p>";
    return;
  }

  box.innerHTML = `
    <label>Total Seats (used for reservation capacity checks)</label>
    <input type="number" id="setting-total-seats" value="${esc(data.total_seats)}">

    <label>Delivery Mode</label>
    <select id="setting-delivery-mode">
      <option value="none" ${data.delivery_mode === "none" ? "selected" : ""}>No delivery offered</option>
      <option value="third_party" ${data.delivery_mode === "third_party" ? "selected" : ""}>Third-party delivery service</option>
      <option value="self" ${data.delivery_mode === "self" ? "selected" : ""}>We handle our own delivery</option>
    </select>

    <label>Delivery Provider Name (if third-party, e.g. "DoorDash")</label>
    <input type="text" id="setting-delivery-provider" value="${esc(data.delivery_provider_name)}">

    <label>Delivery Link (if third-party)</label>
    <input type="text" id="setting-delivery-link" value="${esc(data.delivery_link)}">

    <label>Delivery Note (if self-delivery, e.g. "Call us to arrange delivery")</label>
    <textarea id="setting-delivery-note" rows="2">${esc(data.delivery_note)}</textarea>

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
