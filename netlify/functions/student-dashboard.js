const { google } = require("googleapis");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const siswaId = String(body.siswaId || "").trim();

    if (!siswaId) {
      return response(400, {
        success: false,
        message: "Siswa ID wajib diisi"
      });
    }

    // Pastikan ENV tersedia
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      throw new Error("Environment variable Google belum lengkap");
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

    /*
     * Hanya ambil kolom yang diperlukan.
     *
     * A = ID
     * B = Siswa_ID
     * C = Jenis
     * D = Poin
     * E = Keterangan
     * F = Tanggal
     *
     * Kolom G (Admin) tidak diperlukan untuk dashboard siswa.
     */
    const result = await Promise.race([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Poin!A:F",
        majorDimension: "ROWS"
      }),

      new Promise((_, reject) =>
        setTimeout(() => {
          reject(new Error("Google Sheets timeout"));
        }, 8000)
      )
    ]);

    const rows = result.data.values || [];

    let totalPenghargaan = 0;
    let totalPelanggaran = 0;

    const riwayatPoin = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const id = String(row[0] || "");
      const rowSiswaId = String(row[1] || "");
      const jenis = String(row[2] || "").trim().toLowerCase();
      const poin = Number(row[3] || 0);
      const keterangan = String(row[4] || "");
      const tanggal = String(row[5] || "");

      // Hanya proses data milik siswa yang sedang login
      if (rowSiswaId !== siswaId) {
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
        tanggal
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
