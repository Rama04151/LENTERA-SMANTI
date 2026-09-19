const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");

// =========================
// TOGGLE PASSWORD
// =========================

if (togglePassword) {
  togglePassword.addEventListener("click", () => {

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      togglePassword.textContent = "🙈";
    } else {
      passwordInput.type = "password";
      togglePassword.textContent = "👁️";
    }

  });
}


// =========================
// LOGIN
// =========================

loginForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const nisn = document
    .getElementById("nisn")
    .value
    .trim();

  const password = passwordInput.value;

  if (!nisn || !password) {
    message.textContent = "NISN dan password wajib diisi.";
    return;
  }

  message.textContent = "Memproses login...";

  try {

    const response = await fetch(
      "/.netlify/functions/login",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          nisn,
          password
        })
      }
    );

    const result = await response.json();

    if (!result.success) {
      message.textContent =
        result.message || "Login gagal.";

      return;
    }

    // =========================
    // SIMPAN SESSION
    // =========================

    sessionStorage.setItem(
      "lentera_session",
      JSON.stringify(result.siswa)
    );

    // =========================
    // PINDAH KE DASHBOARD
    // =========================

    window.location.href = "dashboard.html";

  } catch (error) {

    console.error(error);

    message.textContent =
      "Tidak dapat terhubung ke server.";
  }

});
