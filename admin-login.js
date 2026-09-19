const form = document.getElementById("adminLoginForm");
const message = document.getElementById("adminMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document
    .getElementById("username")
    .value
    .trim();

  const password = document
    .getElementById("password")
    .value;

  if (!username || !password) {
    message.textContent = "Username dan password wajib diisi.";
    return;
  }

  message.textContent = "Memproses login...";

  try {
    const response = await fetch(
      "/.netlify/functions/admin-login",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          username,
          password
        })
      }
    );

    const result = await response.json();

    if (!result.success) {
      message.textContent =
        result.message || "Login admin gagal.";
      return;
    }

    sessionStorage.setItem(
      "lentera_admin_session",
      JSON.stringify(result.admin)
    );

    window.location.href = "admin.html";

  } catch (error) {

    console.error(error);

    message.textContent =
      "Tidak dapat terhubung ke server.";
  }
});
