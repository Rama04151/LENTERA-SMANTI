const { google } = require("googleapis");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {
    const { siswaId } = JSON.parse(event.body || "{}");

    if (!siswaId) {
      return response(400, {
        success: false,
        message: "Siswa ID wajib diisi"
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
          .replace(/\\n/g, "\n")
          .replace(/^"|"$/g, "")
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Ambil data Poin
    const poinResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Poin!A:G"
    });

    const poinRows = poinResult.data.values || [];

    let totalPenghargaan = 0;
    let totalPelanggaran = 0;

    const riwayatPoin = [];

    for (let i = 1; i < poinRows.length; i++) {
      const row = poinRows[i];

      const id = row[0] || "";
      const rowSiswaId = row[1] || "";
      const jenis = row[2] || "";
      const poin = Number(row[3] || 0);
      const keterangan = row[4] || "";
      const tanggal = row[5] || "";
      const admin = row[6] || "";

      if (String(rowSiswaId) !== String(siswaId)) {
        continue;
      }

      if (jenis.toLowerCase() === "penghargaan") {
        totalPenghargaan += poin;
      }

      if (jenis.toLowerCase() === "pelanggaran") {
        totalPelanggaran += poin;
      }

      riwayatPoin.push({
        id,
        jenis,
        poin,
        keterangan,
        tanggal,
        admin
      });
    }

    return response(200, {
      success: true,
      poin: {
        penghargaan: totalPenghargaan,
        pelanggaran: totalPelanggaran
      },
      riwayat: riwayatPoin
    });

  } catch (error) {
    console.error("STUDENT DASHBOARD ERROR:", error);

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
