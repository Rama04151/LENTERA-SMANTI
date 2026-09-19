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

    // Ambil data poin
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Poin!A:G"
    });

    const rows = result.data.values || [];

    let totalPenghargaan = 0;
    let totalPelanggaran = 0;
    const riwayatPoin = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const id = String(row[0] || "").trim();
      const rowSiswaId = String(row[1] || "").trim();
      const jenis = String(row[2] || "").trim().toLowerCase();
      const poin = Number(row[3] || 0);
      const keterangan = String(row[4] || "").trim();
      const tanggal = String(row[5] || "").trim();
      const admin = String(row[6] || "").trim();

      // Hanya ambil poin milik siswa yang sedang login
      if (rowSiswaId !== String(siswaId).trim()) {
        continue;
      }

      if (jenis === "penghargaan") {
        totalPenghargaan += poin;
      }

      if (jenis === "pelanggaran") {
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
      message: "Data poin gagal dimuat"
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
