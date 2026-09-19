const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");

togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";

  passwordInput.type = isPassword ? "text" : "password";
  togglePassword.textContent = isPassword ? "🙈" : "👁";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nisn = document.getElementById("nisn").value.trim();
  const password = passwordInput.value;

  message.textContent = "Memeriksa...";

  try {
    const response = await fetch("/.netlify/functions/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nisn,
        password
      })
    });

    const result = await response.json();

    if (result.success) {
      message.textContent = result.message;

      // Nanti diarahkan ke dashboard siswa
      // window.location.href = "/dashboard.html";
    } else {
      message.textContent = result.message;
    }

  } catch (error) {
    console.error(error);
    message.textContent = "Terjadi kesalahan pada server.";
  }
});
