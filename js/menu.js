// Fetches menu items from Supabase and renders them into #menu-list
// Assumes a "menu_items" table with columns:
// id, name, description, price, is_available

async function loadMenu() {
  const menuList = document.getElementById("menu-list");

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    menuList.innerHTML = "<p>Couldn't load the menu right now.</p>";
    console.error("Supabase error:", error);
    return;
  }

  if (!data || data.length === 0) {
    menuList.innerHTML = "<p>No menu items yet — add some in Supabase.</p>";
    return;
  }

  menuList.innerHTML = data.map(item => `
    <div class="menu-item ${item.is_available ? "" : "unavailable"}">
      <div>
        <strong>${item.name}</strong>
        <p>${item.description || ""}</p>
      </div>
      <div>
        ${item.is_available ? `$${item.price}` : "Sold Out"}
      </div>
    </div>
  `).join("");
}

loadMenu();

