const { google } = require("googleapis");

exports.handler = async function (event) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        message: "Method tidak diizinkan."
      })
    };
  }

  try {

    const {
      siswaId,
      currentPassword,
      newPassword
    } = JSON.parse(event.body || "{}");

    if (!siswaId || !currentPassword || !newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Semua data wajib diisi."
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

    const privateKey = process.env.GOOGLE_PRIVATE_KEY
      .replace(/\\n/g, "\n")
      .replace(/^"|"$/g, "");

    const auth = new google.auth.GoogleAuth({
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

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // =========================
    // AMBIL DATA SISWA
    // =========================

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Siswa!A:F"
      });

    const rows =
      response.data.values || [];

    let studentRowIndex = -1;
    let studentRow = null;

    for (let i = 1; i < rows.length; i++) {

      const row = rows[i];

      const id =
        String(row[0] || "").trim();

      if (id === String(siswaId).trim()) {
        studentRowIndex = i + 1;
        studentRow = row;
        break;
      }
    }

    if (!studentRow) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: "Data siswa tidak ditemukan."
        })
      };
    }

    const storedPassword =
      String(studentRow[4] || "").trim();

    const status =
      String(studentRow[5] || "").trim();

    if (status !== "Aktif") {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          message: "Akun siswa tidak aktif."
        })
      };
    }

    // =========================
    // CEK PASSWORD SEKARANG
    // =========================

    if (storedPassword !== String(currentPassword)) {

      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          message: "Password sekarang salah."
        })
      };
    }

    // =========================
    // PASSWORD BARU TIDAK BOLEH SAMA
    // =========================

    if (storedPassword === String(newPassword)) {

      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message:
            "Password baru harus berbeda dari password sekarang."
        })
      };
    }

    // =========================
    // UPDATE PASSWORD
    // Kolom E = Password
    // =========================

    await sheets.spreadsheets.values.update({

      spreadsheetId,

      range: `Siswa!E${studentRowIndex}`,

      valueInputOption: "RAW",

      requestBody: {
        values: [
          [String(newPassword)]
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
        message:
          "Password berhasil diubah."
      })
    };

  } catch (error) {

    console.error(
      "CHANGE PASSWORD ERROR:",
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
