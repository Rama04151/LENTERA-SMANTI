const { google } = require("googleapis");

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {

    const body = JSON.parse(event.body || "{}");

    const {
      tahunAjaranBaruId,
      admin
    } = body;

    if (!tahunAjaranBaruId) {
      return response(400, {
        success: false,
        message: "ID tahun ajaran baru wajib diisi."
      });
    }

    // =========================
    // GOOGLE AUTH
    // =========================

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
    // 1. BACA TAHUN AJARAN
    // =========================

    const tahunResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Tahun_Ajaran!A:C"
      });

    const tahunRows =
      tahunResult.data.values || [];

    let tahunAktif = null;
    let tahunBaru = null;

    for (let i = 1; i < tahunRows.length; i++) {

      const id =
        String(tahunRows[i][0] || "").trim();

      const tahun =
        String(tahunRows[i][1] || "").trim();

      const aktif =
        String(tahunRows[i][2] || "")
          .trim()
          .toLowerCase();

      if (aktif === "true") {

        tahunAktif = {
          id,
          tahun
        };

      }

      if (id === String(tahunAjaranBaruId)) {

        tahunBaru = {
          id,
          tahun
        };

      }

    }

    if (!tahunAktif) {

      return response(400, {
        success: false,
        message: "Tidak ada tahun ajaran aktif."
      });

    }

    if (!tahunBaru) {

      return response(404, {
        success: false,
        message: "Tahun ajaran baru tidak ditemukan."
      });

    }

    if (tahunAktif.id === tahunBaru.id) {

      return response(400, {
        success: false,
        message:
          "Tahun ajaran baru tidak boleh sama dengan tahun ajaran aktif."
      });

    }

    // =========================
    // 2. BACA KELAS
    // =========================

    const kelasResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Kelas!A:E"
      });

    const kelasRows =
      kelasResult.data.values || [];

    const kelasAktif = {};
    const kelasBaru = {};

    for (let i = 1; i < kelasRows.length; i++) {

      const id =
        String(kelasRows[i][0] || "").trim();

      const nama =
        String(kelasRows[i][1] || "").trim();

      const tingkat =
        String(kelasRows[i][2] || "").trim();

      const tahunId =
        String(kelasRows[i][3] || "").trim();

      const status =
        String(kelasRows[i][4] || "").trim();

      if (
        tahunId === tahunAktif.id &&
        status.toLowerCase() === "aktif"
      ) {

        kelasAktif[nama] = {
          id,
          nama,
          tingkat
        };

      }

      if (
        tahunId === tahunBaru.id &&
        status.toLowerCase() === "aktif"
      ) {

        kelasBaru[nama] = {
          id,
          nama,
          tingkat
        };

      }

    }

    // =========================
    // 3. VALIDASI 6 KELAS
    // =========================

    const namaKelasWajib = [
      "X A",
      "X B",
      "XI A",
      "XI B",
      "XII A",
      "XII B"
    ];

    for (const nama of namaKelasWajib) {

      if (!kelasAktif[nama]) {

        return response(400, {
          success: false,
          message:
            `Kelas aktif "${nama}" tidak ditemukan.`
        });

      }

      if (!kelasBaru[nama]) {

        return response(400, {
          success: false,
          message:
            `Kelas tahun ajaran baru "${nama}" tidak ditemukan.`
        });

      }

    }

    // =========================
    // 4. BACA SISWA
    // =========================

    const siswaResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Siswa!A:F"
      });

    const siswaRows =
      siswaResult.data.values || [];

    const perpindahan = [];
    const lulus = [];

    // =========================
    // 5. PROSES SISWA
    // =========================

    for (let i = 1; i < siswaRows.length; i++) {

      const row =
        siswaRows[i];

      const siswaId =
        String(row[0] || "").trim();

      const nama =
        String(row[2] || "").trim();

      const kelasId =
        String(row[3] || "").trim();

      const status =
        String(row[5] || "").trim();

      if (!siswaId) {
        continue;
      }

      if (
        status.toLowerCase() !== "aktif"
      ) {
        continue;
      }

      // =========================
      // CARI KELAS SISWA
      // =========================

      let namaKelasLama = null;

      for (const namaKelas of namaKelasWajib) {

        if (
          kelasAktif[namaKelas].id === kelasId
        ) {

          namaKelasLama =
            namaKelas;

          break;

        }

      }

      if (!namaKelasLama) {
        continue;
      }

      // =========================
      // XII → LULUS
      // =========================

      if (
        namaKelasLama === "XII A" ||
        namaKelasLama === "XII B"
      ) {

        // Status menjadi Lulus
        await sheets.spreadsheets.values.update({

          spreadsheetId,

          range:
            `Siswa!F${i + 1}`,

          valueInputOption:
            "RAW",

          requestBody: {
            values: [
              ["Lulus"]
            ]
          }

        });

        lulus.push({
          id: siswaId,
          nama,
          dari: namaKelasLama
        });

        continue;
      }

      // =========================
      // X → XI
      // XI → XII
      // =========================

      let namaKelasBaru = null;

      if (namaKelasLama === "X A") {
        namaKelasBaru = "XI A";
      }

      if (namaKelasLama === "X B") {
        namaKelasBaru = "XI B";
      }

      if (namaKelasLama === "XI A") {
        namaKelasBaru = "XII A";
      }

      if (namaKelasLama === "XI B") {
        namaKelasBaru = "XII B";
      }

      if (!namaKelasBaru) {
        continue;
      }

      const kelasTujuan =
        kelasBaru[namaKelasBaru];

      // =========================
      // UPDATE KELAS SISWA
      // =========================

      await sheets.spreadsheets.values.update({

        spreadsheetId,

        range:
          `Siswa!D${i + 1}`,

        valueInputOption:
          "RAW",

        requestBody: {
          values: [
            [kelasTujuan.id]
          ]
        }

      });

      perpindahan.push({
        id: siswaId,
        nama,
        dari: namaKelasLama,
        ke: namaKelasBaru,
        dariId: kelasId,
        keId: kelasTujuan.id
      });

    }

    // =========================
    // 6. CATAT RIWAYAT KELAS
    // =========================

    const riwayatValues = [];

    for (const item of perpindahan) {

      const riwayatId =
        "RK" +
        Date.now() +
        Math.floor(
          Math.random() * 1000
        );

      riwayatValues.push([
        riwayatId,
        item.id,
        item.dariId,
        item.keId,
        "Kenaikan kelas",
        new Date().toLocaleDateString("id-ID"),
        admin || "Admin"
      ]);

    }

    if (riwayatValues.length > 0) {

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range:
          "Riwayat_Kelas!A:G",

        valueInputOption:
          "RAW",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values:
            riwayatValues
        }

      });

    }

    // =========================
    // 7. AKTIFKAN TAHUN AJARAN BARU
    // =========================

    let tahunAktifRow = -1;
    let tahunBaruRow = -1;

    for (let i = 1; i < tahunRows.length; i++) {

      const id =
        String(tahunRows[i][0] || "").trim();

      if (id === tahunAktif.id) {
        tahunAktifRow = i + 1;
      }

      if (id === tahunBaru.id) {
        tahunBaruRow = i + 1;
      }

    }

    if (
      tahunAktifRow === -1 ||
      tahunBaruRow === -1
    ) {

      return response(500, {
        success: false,
        message:
          "Baris tahun ajaran tidak ditemukan."
      });

    }

    await sheets.spreadsheets.values.update({

      spreadsheetId,

      range:
        `Tahun_Ajaran!C${tahunAktifRow}`,

      valueInputOption:
        "RAW",

      requestBody: {
        values: [
          ["FALSE"]
        ]
      }

    });

    await sheets.spreadsheets.values.update({

      spreadsheetId,

      range:
        `Tahun_Ajaran!C${tahunBaruRow}`,

      valueInputOption:
        "RAW",

      requestBody: {
        values: [
          ["TRUE"]
        ]
      }

    });

    // =========================
    // SELESAI
    // =========================

    return response(200, {

      success: true,

      message:
        "Kenaikan kelas berhasil diproses.",

      tahunLama:
        tahunAktif.tahun,

      tahunBaru:
        tahunBaru.tahun,

      jumlahNaik:
        perpindahan.length,

      jumlahLulus:
        lulus.length,

      perpindahan,

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
        "Gagal memproses kenaikan kelas."

    });

  }

};


// =========================
// RESPONSE
// =========================

function response(
  statusCode,
  body
) {

  return {

    statusCode,

    headers: {
      "Content-Type":
        "application/json",

      "Cache-Control":
        "no-store"
    },

    body:
      JSON.stringify(body)

  };

}
