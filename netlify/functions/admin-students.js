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

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Siswa!A:F"
    });

    const rows = result.data.values || [];

    const siswa = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      siswa.push({
        id: String(row[0] || "").trim(),
        nisn: String(row[1] || "").trim(),
        nama: String(row[2] || "").trim(),
        kelasId: String(row[3] || "").trim(),
        status: String(row[5] || "").trim()
      });
    }

    return response(200, {
      success: true,
      siswa
    });

  } catch (error) {
    console.error("ADMIN STUDENTS ERROR:", error);

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
