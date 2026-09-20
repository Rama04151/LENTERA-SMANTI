const { google } = require("googleapis");

// =========================
// GOOGLE SHEETS AUTH
// =========================

async function getSheets() {

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

  return google.sheets({
    version: "v4",
    auth
  });
}

// =========================
// HANDLER
// =========================

exports.handler = async (event) => {

  try {

    const sheets =
      await getSheets();

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // =====================================================
    // GET — TAHUN AJARAN
    // =====================================================

    if (event.httpMethod === "GET") {

      const result =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range:
            "Tahun_Ajaran!A:C"
        });

      const rows =
        result.data.values || [];

      const tahunAjaran = [];

      for (
        let i = 1;
        i < rows.length;
        i++
      ) {

        const id =
          String(
            rows[i][0] || ""
          ).trim();

        const tahun =
          String(
            rows[i][1] || ""
          ).trim();

        const aktif =
          String(
            rows[i][2] || ""
          )
            .trim()
            .toLowerCase();

        if (!id || !tahun) {
          continue;
        }

        tahunAjaran.push({

          id,

          tahun,

          aktif:
            aktif === "true"
        });
      }

      return response(200, {

        success: true,

        tahunAjaran
      });
    }

    // =====================================================
    // POST — PROSES KENAIKAN
    // =====================================================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const tahunAjaranBaruId =
        String(
          body.tahunAjaranBaruId || ""
        ).trim();

      const admin =
        String(
          body.admin || "Admin"
        ).trim();

      if (!tahunAjaranBaruId) {

        return response(400, {

          success: false,

          message:
            "ID tahun ajaran baru wajib diisi."
        });
      }

      // ===================================================
      // 1. BACA TAHUN AJARAN
      // ===================================================

      const tahunResult =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range:
            "Tahun_Ajaran!A:C"
        });

      const tahunRows =
        tahunResult.data.values || [];

      let tahunAktif = null;
      let tahunBaru = null;

      for (
        let i = 1;
        i < tahunRows.length;
        i++
      ) {

        const id =
          String(
            tahunRows[i][0] || ""
          ).trim();

        const tahun =
          String(
            tahunRows[i][1] || ""
          ).trim();

        const aktif =
          String(
            tahunRows[i][2] || ""
          )
            .trim()
            .toLowerCase();

        if (
          aktif === "true" ||
          aktif === "aktif"
        ) {

          tahunAktif = {
            id,
            tahun
          };
        }

        if (
          id === tahunAjaranBaruId
        ) {

          tahunBaru = {
            id,
            tahun
          };
        }
      }

      if (!tahunAktif) {

        return response(400, {

          success: false,

          message:
            "Tidak ada tahun ajaran aktif."
        });
      }

      if (!tahunBaru) {

        return response(404, {

          success: false,

          message:
            "Tahun ajaran baru tidak ditemukan."
        });
      }

      if (
        tahunAktif.id ===
        tahunBaru.id
      ) {

        return response(400, {

          success: false,

          message:
            "Tahun ajaran tersebut sudah aktif."
        });
      }

      // ===================================================
      // 2. BACA KELAS
      // ===================================================

      const kelasResult =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range:
            "Kelas!A:E"
        });

      const kelasRows =
        kelasResult.data.values || [];

      const kelasAktif = {};
      const kelasBaru = {};

      for (
        let i = 1;
        i < kelasRows.length;
        i++
      ) {

        const id =
          String(
            kelasRows[i][0] || ""
          ).trim();

        const nama =
          String(
            kelasRows[i][1] || ""
          ).trim();

        const tingkat =
          String(
            kelasRows[i][2] || ""
          ).trim();

        const tahunId =
          String(
            kelasRows[i][3] || ""
          ).trim();

        const status =
          String(
            kelasRows[i][4] || ""
          )
            .trim()
            .toLowerCase();

        if (
          tahunId === tahunAktif.id &&
          status === "aktif"
        ) {

          kelasAktif[nama] = {
            id,
            nama,
            tingkat
          };
        }

        if (
          tahunId === tahunBaru.id &&
          status === "aktif"
        ) {

          kelasBaru[nama] = {
            id,
            nama,
            tingkat
          };
        }
      }

      // ===================================================
      // 3. VALIDASI KELAS YANG BENAR-BENAR DIPERLUKAN
      // ===================================================

      // Kelas lama yang harus ada
      const kelasLamaWajib = [

        "X A",
        "X B",
        "XI A",
        "XI B",
        "XII A",
        "XII B"

      ];

      for (
        const nama of kelasLamaWajib
      ) {

        if (!kelasAktif[nama]) {

          return response(400, {

            success: false,

            message:
              `Kelas aktif "${nama}" tidak ditemukan.`
          });
        }
      }

      // Hanya kelas tujuan kenaikan yang wajib ada
      const kelasTujuanWajib = [

        "XI A",
        "XI B",
        "XII A",
        "XII B"

      ];

      for (
        const nama of kelasTujuanWajib
      ) {

        if (!kelasBaru[nama]) {

          return response(400, {

            success: false,

            message:
              `Kelas tujuan "${nama}" pada tahun ajaran ${tahunBaru.tahun} tidak ditemukan.`
          });
        }
      }

      // ===================================================
      // 4. BACA SISWA
      // ===================================================

      const siswaResult =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range:
            "Siswa!A:F"
        });

      const siswaRows =
        siswaResult.data.values || [];

      const perpindahan = [];
      const lulus = [];

      // ===================================================
      // 5. PROSES SISWA
      // ===================================================

      for (
        let i = 1;
        i < siswaRows.length;
        i++
      ) {

        const row =
          siswaRows[i];

        const siswaId =
          String(
            row[0] || ""
          ).trim();

        const nama =
          String(
            row[2] || ""
          ).trim();

        const kelasId =
          String(
            row[3] || ""
          ).trim();

        const status =
          String(
            row[5] || ""
          ).trim();

        if (!siswaId) {
          continue;
        }

        if (
          status.toLowerCase() !==
          "aktif"
        ) {

          continue;
        }

        let namaKelasLama =
          null;

        for (
          const namaKelas of
          kelasLamaWajib
        ) {

          if (
            kelasAktif[namaKelas].id ===
            kelasId
          ) {

            namaKelasLama =
              namaKelas;

            break;
          }
        }

        if (!namaKelasLama) {
          continue;
        }

        // =================================================
        // XII → LULUS
        // =================================================

        if (
          namaKelasLama === "XII A" ||
          namaKelasLama === "XII B"
        ) {

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

            id:
              siswaId,

            nama,

            dari:
              namaKelasLama
          });

          continue;
        }

        // =================================================
        // TENTUKAN KELAS TUJUAN
        // =================================================

        let namaKelasBaru =
          null;

        if (
          namaKelasLama === "X A"
        ) {

          namaKelasBaru =
            "XI A";
        }

        else if (
          namaKelasLama === "X B"
        ) {

          namaKelasBaru =
            "XI B";
        }

        else if (
          namaKelasLama === "XI A"
        ) {

          namaKelasBaru =
            "XII A";
        }

        else if (
          namaKelasLama === "XI B"
        ) {

          namaKelasBaru =
            "XII B";
        }

        if (!namaKelasBaru) {
          continue;
        }

        const kelasTujuan =
          kelasBaru[namaKelasBaru];

        if (!kelasTujuan) {

          return response(400, {

            success: false,

            message:
              `Kelas tujuan "${namaKelasBaru}" tidak ditemukan.`
          });
        }

        // =================================================
        // UPDATE KELAS SISWA
        // =================================================

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

          id:
            siswaId,

          nama,

          dari:
            namaKelasLama,

          ke:
            namaKelasBaru,

          dariId:
            kelasId,

          keId:
            kelasTujuan.id
        });
      }

      // ===================================================
      // 6. SIMPAN RIWAYAT
      // ===================================================

      const riwayatValues = [];

      for (
        const item of perpindahan
      ) {

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

          new Date()
            .toLocaleDateString(
              "id-ID"
            ),

          admin
        ]);
      }

      if (
        riwayatValues.length > 0
      ) {

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

      // ===================================================
      // 7. AKTIFKAN TAHUN AJARAN BARU
      // ===================================================

      let tahunAktifRow =
        -1;

      let tahunBaruRow =
        -1;

      for (
        let i = 1;
        i < tahunRows.length;
        i++
      ) {

        const id =
          String(
            tahunRows[i][0] || ""
          ).trim();

        if (
          id === tahunAktif.id
        ) {

          tahunAktifRow =
            i + 1;
        }

        if (
          id === tahunBaru.id
        ) {

          tahunBaruRow =
            i + 1;
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

      // ===================================================
      // 8. SELESAI
      // ===================================================

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
    }

    return response(405, {

      success: false,

      message:
        "Method tidak diizinkan."
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

// =======================================================
// RESPONSE
// =======================================================

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
