const loginForm = document.getElementById("loginForm");
const nisnInput = document.getElementById("nisn");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");

const NISN_STORAGE_KEY = "lentera_nisn_terakhir";

// =========================
// SIMPAN & MUAT NISN TERAKHIR
// =========================

// Isi otomatis NISN yang pernah digunakan
const savedNISN = localStorage.getItem(NISN_STORAGE_KEY);

if (savedNISN) {
  nisnInput.value = savedNISN;
}

// Simpan NISN terbaru ketika pengguna mengetik
nisnInput.addEventListener("input", () => {
  const nisn = nisnInput.value.trim();

  if (nisn) {
    localStorage.setItem(NISN_STORAGE_KEY, nisn);
  } else {
    localStorage.removeItem(NISN_STORAGE_KEY);
  }
});

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

  const nisn = nisnInput.value.trim();
  const password = passwordInput.value;

  if (!nisn || !password) {
    message.textContent = "NISN dan password wajib diisi.";
    return;
  }

  // Simpan NISN sebelum mengirim permintaan login
  localStorage.setItem(NISN_STORAGE_KEY, nisn);

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