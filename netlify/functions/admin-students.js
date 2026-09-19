const { google } = require("googleapis");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
      .replace(/\\n/g, "\n")
      .replace(/^"|"$/g, "");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly"
      ]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Ambil siswa
    const siswaResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Siswa!A:F"
      });

    // Ambil kelas
    const kelasResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Kelas!A:E"
      });

    const siswaRows =
      siswaResult.data.values || [];

    const kelasRows =
      kelasResult.data.values || [];

    // Buat mapping Kelas ID → Nama Kelas
    const kelasMap = {};

    for (let i = 1; i < kelasRows.length; i++) {
      const row = kelasRows[i];

      const id = String(row[0] || "").trim();
      const nama = String(row[1] || "").trim();

      if (id) {
        kelasMap[id] = nama;
      }
    }

    const siswa = [];

    for (let i = 1; i < siswaRows.length; i++) {

      const row = siswaRows[i];

      const id = String(row[0] || "").trim();
      const nisn = String(row[1] || "").trim();
      const nama = String(row[2] || "").trim();
      const kelasId = String(row[3] || "").trim();
      const status = String(row[5] || "").trim();

      siswa.push({
        id,
        nisn,
        nama,
        kelasId,
        kelas: kelasMap[kelasId] || "-",
        status
      });
    }

    return response(200, {
      success: true,
      siswa
    });

  } catch (error) {

    console.error(
      "ADMIN STUDENTS ERROR:",
      error
    );

    return response(500, {
      success: false,
      message: "Data siswa gagal dimuat"
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
