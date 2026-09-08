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

  reservationStatus.textContent = "Submitting...";

  const { error } = await supabaseClient
    .from("reservations")
    .insert([
      {
        name: name,
        phone: phone,
        party_size: partySize,
        reservation_date: date,
        reservation_time: time,
      },
    ]);

  if (error) {
    reservationStatus.textContent = "Something went wrong. Please try again.";
    console.error("Supabase error:", error);
    return;
  }

  reservationStatus.textContent = `Thanks, ${name}! Your request for ${partySize} on ${date} at ${time} has been sent.`;
  reservationForm.reset();
});

