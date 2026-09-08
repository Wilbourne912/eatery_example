// Handles the reservation form: submits a new row to the "reservations" table.
// No availability/conflict checking yet — this is the "Simple" version.
// Every submission is saved as status "pending" for the owner to review manually.

const reservationForm = document.getElementById("reservation-form");
const reservationStatus = document.getElementById("reservation-status");

reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("res-name").value.trim();
  const phone = document.getElementById("res-phone").value.trim();
  const partySize = parseInt(document.getElementById("res-party-size").value, 10);
  const date = document.getElementById("res-date").value;
  const time = document.getElementById("res-time").value;

  reservationStatus.textContent = "Checking availability...";

  // 1. Get total restaurant capacity
  const { data: settingsData, error: settingsError } = await supabaseClient
    .from("restaurant_settings")
    .select("total_seats")
    .limit(1)
    .single();

  if (settingsError) {
    reservationStatus.textContent = "ERROR: " + settingsError.message;
    console.error("Supabase error:", settingsError);
    return;
  }

  const totalSeats = settingsData.total_seats;

  // 2. Sum up party sizes already booked for this exact date + time
  //    (excluding declined reservations, since those don't hold a seat)
  const { data: existingReservations, error: fetchError } = await supabaseClient
    .from("reservations")
    .select("party_size")
    .eq("reservation_date", date)
    .eq("reservation_time", time)
    .neq("status", "declined");

  if (fetchError) {
    reservationStatus.textContent = "ERROR: " + fetchError.message;
    console.error("Supabase error:", fetchError);
    return;
  }

  const seatsAlreadyBooked = existingReservations.reduce(
    (sum, r) => sum + r.party_size,
    0
  );

  const slotWasFull = (seatsAlreadyBooked + partySize) > totalSeats;

  reservationStatus.textContent = "Submitting...";

  // 3. Insert the reservation regardless — just flagged if the slot is full
  const { error } = await supabaseClient
    .from("reservations")
    .insert([
      {
        name: name,
        phone: phone,
        party_size: partySize,
        reservation_date: date,
        reservation_time: time,
        slot_was_full: slotWasFull,
      },
    ]);

  if (error) {
    reservationStatus.textContent = "ERROR: " + error.message + " (code: " + (error.code || "none") + ")";
    console.error("Supabase error:", error);
    return;
  }

  if (slotWasFull) {
    reservationStatus.textContent = `Thanks, ${name}! That time is very popular and may be full — we'll confirm as soon as possible.`;
  } else {
    reservationStatus.textContent = `Thanks, ${name}! Your request for ${partySize} on ${date} at ${time} has been sent.`;
  }
  reservationForm.reset();
});

