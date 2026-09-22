const guruLoginForm =
  document.getElementById(
    "guruLoginForm"
  );

const loginMessage =
  document.getElementById(
    "loginMessage"
  );

const loginButton =
  document.getElementById(
    "loginButton"
  );


guruLoginForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    const username =
      document
        .getElementById("username")
        .value
        .trim();

    const password =
      document
        .getElementById("password")
        .value;

    if (!username || !password) {

      loginMessage.textContent =
        "Username dan password wajib diisi.";

      return;
    }


    loginButton.disabled = true;

    loginButton.textContent =
      "⏳ Memeriksa...";

    loginMessage.textContent =
      "";


    try {

      const response =
        await fetch(
          "/.netlify/functions/guru-login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              username,
              password
            })
          }
        );


      const result =
        await response.json();


      if (
        !response.ok ||
        !result.success
      ) {

        loginMessage.textContent =
          result.message ||
          "Login gagal.";

        loginButton.disabled =
          false;

        loginButton.textContent =
          "👨‍🏫 Masuk sebagai Guru";

        return;
      }


      sessionStorage.setItem(
        "lentera_guru_session",
        JSON.stringify(
          result.guru
        )
      );


      window.location.href =
        "guru.html";

    }
    catch (error) {

      console.error(
        "GURU LOGIN ERROR:",
        error
      );

      loginMessage.textContent =
        "Tidak dapat terhubung ke server.";

      loginButton.disabled =
        false;

      loginButton.textContent =
        "👨‍🏫 Masuk sebagai Guru";

    }

  }
);
