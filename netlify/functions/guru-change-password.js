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

    const body = JSON.parse(event.body || "{}");

    const guruId =
      String(body.guruId || "").trim();

    const currentPassword =
      String(body.currentPassword || "");

    const newPassword =
      String(body.newPassword || "");

    // =========================
    // VALIDASI
    // =========================

    if (!guruId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "ID guru tidak ditemukan."
        })
      };
    }

    if (!currentPassword || !newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Password lama dan password baru wajib diisi."
        })
      };
    }

    if (newPassword.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Password baru minimal 6 karakter."
        })
      };
    }

    if (currentPassword === newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Password baru harus berbeda dari password lama."
        })
      };
    }

    // =========================
    // GOOGLE AUTH
    // =========================

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

    // =========================
    // CARI GURU
    // =========================

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Guru!A:E"
      });

    const rows =
      response.data.values || [];

    let guruRowIndex = -1;
    let guruData = null;

    rows.slice(1).forEach((row, index) => {

      const id =
        String(row[0] || "").trim();

      if (id === guruId) {

        guruRowIndex = index + 2;

        guruData = row;

      }

    });

    if (!guruData) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: "Akun guru tidak ditemukan."
        })
      };
    }

    // =========================
    // CEK STATUS
    // =========================

    const status =
      String(guruData[4] || "")
        .trim()
        .toLowerCase();

    if (status !== "aktif") {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          message: "Akun guru tidak aktif."
        })
      };
    }

    // =========================
    // CEK PASSWORD LAMA
    // =========================

    const storedPassword =
      String(guruData[2] || "");

    if (storedPassword !== currentPassword) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          message: "Password lama salah."
        })
      };
    }

    // =========================
    // UPDATE PASSWORD
    // =========================

    await sheets.spreadsheets.values.update({
      spreadsheetId,

      range: `Guru!C${guruRowIndex}`,

      valueInputOption: "USER_ENTERED",

      requestBody: {
        values: [
          [newPassword]
        ]
      }
    });

    return {
      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        success: true,
        message: "Password berhasil diubah."
      })
    };

  } catch (error) {

    console.error(
      "GURU CHANGE PASSWORD ERROR:",
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
        message: "Gagal mengubah password."
      })
    };
  }
};
