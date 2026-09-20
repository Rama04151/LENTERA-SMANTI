const { google } = require("googleapis");

// =========================
// GOOGLE SHEETS AUTH
// =========================

async function getSheets() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    .replace(/\\n/g, "\n")
    .replace(/^"|"$/g, "");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  });

  return google.sheets({
    version: "v4",
    auth
  });
}

// =========================
// RESPONSE
// =========================

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

// =========================
// HANDLER
// =========================

exports.handler = async (event) => {

  try {

    // Hanya POST
    if (event.httpMethod !== "POST") {
      return response(405, {
        success: false,
        message: "Method tidak diizinkan."
      });
    }

    const sheets = await getSheets();

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // =========================
    // DATA REQUEST
    // =========================

    const body = JSON.parse(
      event.body || "{}"
    );

    const admin =
      String(body.admin || "Admin").trim();

    // =========================
    // BACA KELAS
    // =========================

    const kelasResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Kelas!A:E"
      });

    const kelasRows =
      kelasResult.data.values || [];

    if (kelasRows.length <= 1) {
      return response(400, {
        success: false,
        message: "Data kelas tidak ditemukan."
      });
    }

    // =========================
    // MAP KELAS
    // =========================

    const kelasMap = {};

    for (let i = 1; i < kelasRows.length; i++) {

      const row = kelasRows[i];

      const id =
        String(row[0] || "").trim();

      const nama =
        String(row[1] || "").trim();

      if (!id || !nama) {
        continue;
      }

      kelasMap[nama] = id;
    }

    // =========================
    // VALIDASI 6 KELAS
    // =========================

    const kelasWajib = [
      "X A",
      "X B",
      "XI A",
      "XI B",
      "XII A",
      "XII B"
    ];

    for (const namaKelas of kelasWajib) {

      if (!kelasMap[namaKelas]) {

        return response(400, {
          success: false,
          message:
            `Kelas "${namaKelas}" tidak ditemukan di sheet Kelas.`
        });
      }
    }

    // =========================
    // MAPPING KENAIKAN
    // =========================

    const mapping = {
      "X A": "XI A",
      "X B": "XI B",
      "XI A": "XII A",
      "XI B": "XII B",
      "XII A": "LULUS",
      "XII B": "LULUS"
    };

    // =========================
    // BACA SISWA
    // =========================

    const siswaResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Siswa!A:F"
      });

    const siswaRows =
      siswaResult.data.values || [];

    if (siswaRows.length <= 1) {

      return response(200, {
        success: true,
        message: "Tidak ada siswa aktif yang perlu diproses.",
        diproses: 0,
        naik: 0,
        lulus: 0
      });
    }

    // =========================
    // HASIL
    // =========================

    const updates = [];
    const riwayatValues = [];

    let naik = 0;
    let lulus = 0;

    // =========================
    // PROSES SISWA
    // =========================

    for (let i = 1; i < siswaRows.length; i++) {

      const row = siswaRows[i];

      const siswaId =
        String(row[0] || "").trim();

      const nama =
        String(row[2] || "").trim();

      const kelasId =
        String(row[3] || "").trim();

      const password =
        row[4] || "";

      const status =
        String(row[5] || "").trim();

      // Tidak ada ID
      if (!siswaId) {
        continue;
      }

      // Hanya siswa aktif
      if (status.toLowerCase() !== "aktif") {
        continue;
      }

      // =========================
      // CARI KELAS LAMA
      // =========================

      let kelasLama = null;

      for (const namaKelas of kelasWajib) {

        if (
          kelasMap[namaKelas] === kelasId
        ) {

          kelasLama = namaKelas;
          break;
        }
      }

      // Kalau kelas tidak termasuk
      // X/XI/XII, lewati
      if (!kelasLama) {
        continue;
      }

      const kelasBaru =
        mapping[kelasLama];

      // =========================
      // XII → LULUS
      // =========================

      if (kelasBaru === "LULUS") {

        const rowNumber = i + 1;

        // Kelas_ID dikosongkan
        // Status menjadi Lulus
        updates.push({
          range:
            `Siswa!D${rowNumber}:F${rowNumber}`,

          values: [
            [
              "",
              password,
              "Lulus"
            ]
          ]
        });

        // Riwayat
        riwayatValues.push([
          `RK${Date.now()}${i}`,
          siswaId,
          kelasId,
          "Lulus",
          "Lulus",
          new Date().toLocaleDateString("id-ID"),
          admin
        ]);

        lulus++;

        continue;
      }

      // =========================
      // PINDAH KELAS
      // =========================

      const kelasBaruId =
        kelasMap[kelasBaru];

      if (!kelasBaruId) {

        return response(400, {
          success: false,
          message:
            `Kelas tujuan "${kelasBaru}" tidak ditemukan.`
        });
      }

      const rowNumber = i + 1;

      // Update Kelas_ID
      updates.push({
        range:
          `Siswa!D${rowNumber}`,

        values: [
          [kelasBaruId]
        ]
      });

      // Riwayat
      riwayatValues.push([
        `RK${Date.now()}${i}`,
        siswaId,
        kelasId,
        kelasBaruId,
        "Kenaikan Kelas",
        new Date().toLocaleDateString("id-ID"),
        admin
      ]);

      naik++;
    }

    // =========================
    // UPDATE SISWA
    // =========================

    if (updates.length > 0) {

      await sheets.spreadsheets.values.batchUpdate({

        spreadsheetId,

        requestBody: {

          valueInputOption: "RAW",

          data: updates
        }
      });
    }

    // =========================
    // SIMPAN RIWAYAT
    // =========================

    if (riwayatValues.length > 0) {

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range: "Riwayat_Kelas!A:G",

        valueInputOption: "RAW",

        insertDataOption: "INSERT_ROWS",

        requestBody: {

          values: riwayatValues
        }
      });
    }

    // =========================
    // HASIL
    // =========================

    return response(200, {

      success: true,

      message:
        "Kenaikan kelas berhasil diproses.",

      diproses:
        naik + lulus,

      naik,

      lulus
    });

  } catch (error) {

    console.error(
      "PROMOTION ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        error.message ||
        "Gagal memproses kenaikan kelas."
    });
  }
};
