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

