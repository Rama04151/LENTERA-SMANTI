const { google } = require("googleapis");

exports.handler = async function (event) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        message: "Method tidak diizinkan."
      })
    };
  }

  try {

    const {
      username,
      password
    } = JSON.parse(event.body || "{}");

    if (!username || !password) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          success: false,
          message: "Username dan password wajib diisi."
        })
      };
    }

    const privateKey =
      process.env.GOOGLE_PRIVATE_KEY
        .replace(/\\n/g, "\n")
        .replace(/^"|"$/g, "");

    const auth =
      new google.auth.GoogleAuth({
        credentials: {
          client_email:
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,

          private_key:
            privateKey
        },

        scopes: [
          "https://www.googleapis.com/auth/spreadsheets"
        ]
      });

    const sheets =
      google.sheets({
        version: "v4",
        auth
      });

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Guru!A:E"
      });

    const rows =
      response.data.values || [];

    let guru = null;

    for (
      let i = 1;
      i < rows.length;
      i++
    ) {

      const row = rows[i];

      const id =
        String(row[0] || "").trim();

      const rowUsername =
        String(row[1] || "").trim();

      const rowPassword =
        String(row[2] || "");

      const nama =
        String(row[3] || "").trim();

      const status =
        String(row[4] || "").trim();

      if (
        rowUsername === username &&
        rowPassword === password
      ) {

        if (
          status.toLowerCase() !==
          "aktif"
        ) {

          return {
            statusCode: 403,
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              success: false,
              message:
                "Akun Guru sedang tidak aktif."
            })
          };

        }

        guru = {
          id,
          username: rowUsername,
          nama,
          role: "guru"
        };

        break;
      }
    }

    if (!guru) {

      return {
        statusCode: 401,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          success: false,
          message:
            "Username atau password salah."
        })
      };

    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        success: true,
        message:
          "Login Guru berhasil.",
        guru
      })
    };

  }
  catch (error) {

    console.error(
      "GURU LOGIN ERROR:",
      error
    );

    return {
      statusCode: 500,
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        success: false,
        message:
          "Terjadi kesalahan server.",
        error:
          error.message
      })
    };

  }

};
