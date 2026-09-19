const { google } = require("googleapis");

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {

    const { username, password } =
      JSON.parse(event.body || "{}");

    if (!username || !password) {
      return response(400, {
        success: false,
        message: "Username dan password wajib diisi"
      });
    }

    const privateKey = process.env.GOOGLE_PRIVATE_KEY
      .replace(/\\n/g, "\n")
      .replace(/^"|"$/g, "");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,

        private_key: privateKey
      },

      scopes: [
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const result =
      await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Admin!A:D"
      });

    const rows = result.data.values || [];

    let admin = null;

    for (let i = 1; i < rows.length; i++) {

      const row = rows[i];

      const id = String(row[0] || "").trim();
      const rowUsername =
        String(row[1] || "").trim();

      const rowPassword =
        String(row[2] || "");

      const status =
        String(row[3] || "").trim();

      if (
        rowUsername === username &&
        rowPassword === password
      ) {

        admin = {
          id,
          username: rowUsername,
          status
        };

        break;
      }
    }

    if (!admin) {
      return response(401, {
        success: false,
        message: "Username atau password salah."
      });
    }

    if (
      admin.status.toLowerCase() !== "aktif"
    ) {
      return response(403, {
        success: false,
        message: "Akun admin tidak aktif."
      });
    }

    return response(200, {
      success: true,
      message: "Login admin berhasil",
      admin
    });

  } catch (error) {

    console.error(
      "ADMIN LOGIN ERROR:",
      error
    );

    return response(500, {
      success: false,
      message: "Terjadi kesalahan pada server"
    });
  }
};

function response(statusCode, body) {

  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },

    body: JSON.stringify(body)
  };
}
