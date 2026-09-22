const { google } = require("googleapis");

// =====================================================
// GOOGLE SHEETS AUTH
// =====================================================

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

// =====================================================
// BATCH GET
//
// Beberapa range dibaca dalam 1 request.
// =====================================================

async function batchGet(
  sheets,
  spreadsheetId,
  ranges
) {
  const result =
    await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges
    });

  const valueRanges =
    result.data.valueRanges || [];

  const data = {};

  for (
    let i = 0;
    i < ranges.length;
    i++
  ) {
    data[ranges[i]] =
      valueRanges[i]?.values || [];
  }

  return data;
}

// =====================================================
// RESPONSE
// =====================================================

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

// =====================================================
// HANDLER
// =====================================================

exports.handler = async (
  event
) => {

  try {

    const sheets =
      await getSheets();

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // ===================================================
    // GET — DATA POIN
    //
    // SEBELUM:
    // Poin GET  = 1
    // Siswa GET = 1
    //
    // SEKARANG:
    // batchGet = 1
    // ===================================================

    if (
      event.httpMethod ===
      "GET"
    ) {

      const data =
        await batchGet(
          sheets,
          spreadsheetId,
          [
            "Poin!A:H",
            "Siswa!A:F"
          ]
        );

      const poinRows =
        data["Poin!A:H"] || [];

      const siswaRows =
        data["Siswa!A:F"] || [];

      // =================================================
      // MAP SISWA
      // =================================================

      const siswaMap = {};

      for (
        let i = 1;
        i < siswaRows.length;
        i++
      ) {

        const id =
          String(
            siswaRows[i][0] ||
            ""
          ).trim();

        if (!id) {
          continue;
        }

        siswaMap[id] = {

          nama:
            String(
              siswaRows[i][2] ||
              ""
            ).trim(),

          nisn:
            String(
              siswaRows[i][1] ||
              ""
            ).trim(),

          kelasId:
            String(
              siswaRows[i][3] ||
              ""
            ).trim()

        };
      }

      // =================================================
      // DATA POIN
      // =================================================

      const poin = [];

      for (
        let i = 1;
        i < poinRows.length;
        i++
      ) {

        const row =
          poinRows[i];

        const siswaId =
          String(
            row[1] || ""
          ).trim();

        /*
         * Lewati baris benar-benar kosong.
         * Ini penting karena DELETE menggunakan clear,
         * sehingga sheet bisa memiliki baris kosong.
         */

        const pointId =
          String(
            row[0] || ""
          ).trim();

        if (!pointId) {
          continue;
        }

        poin.push({

          id:
            pointId,

          siswaId,

          nama:
            siswaMap[siswaId]
              ?.nama || "-",

          nisn:
            siswaMap[siswaId]
              ?.nisn || "-",

          jenis:
            String(
              row[2] || ""
            ).trim(),

          poin:
            Number(
              row[3] || 0
            ),

          keterangan:
            String(
              row[4] || ""
            ).trim(),

          tanggal:
            String(
              row[5] || ""
            ).trim(),

          dibuatOleh:
            String(
              row[6] || ""
            ).trim(),

          peran:
            String(
              row[7] || ""
            ).trim()

        });
      }

      return response(
        200,
        {
          success:
            true,

          poin
        }
      );
    }

    // ===================================================
    // POST — TAMBAH POIN
    //
    // 1 read siswa
    // + 1 append
    // = 2 request
    // ===================================================

    if (
      event.httpMethod ===
      "POST"
    ) {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const {
        siswaId,
        jenis,
        poin,
        keterangan,
        tanggal,
        admin
      } = body;

      // =================================================
      // VALIDASI DATA
      // =================================================

      if (
        !siswaId ||
        !jenis ||
        poin === undefined ||
        poin === null ||
        !keterangan
      ) {

        return response(
          400,
          {
            success:
              false,

            message:
              "Data poin belum lengkap."
          }
        );
      }

      const jenisNormal =
        String(jenis)
          .trim()
          .toLowerCase();

      if (
        jenisNormal !==
          "penghargaan" &&
        jenisNormal !==
          "pelanggaran"
      ) {

        return response(
          400,
          {
            success:
              false,

            message:
              "Jenis poin tidak valid."
          }
        );
      }

      const nilaiPoin =
        Number(poin);

      if (
        !Number.isFinite(
          nilaiPoin
        ) ||
        nilaiPoin <= 0
      ) {

        return response(
          400,
          {
            success:
              false,

            message:
              "Nilai poin harus lebih dari 0."
          }
        );
      }

      // =================================================
      // CEK SISWA
      // =================================================

      const siswaResult =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range:
            "Siswa!A:F"

        });

      const siswaRows =
        siswaResult.data.values ||
        [];

      const siswaIdNormal =
        String(
          siswaId
        ).trim();

      let siswaDitemukan =
        false;

      for (
        let i = 1;
        i < siswaRows.length;
        i++
      ) {

        if (
          String(
            siswaRows[i][0] ||
            ""
          ).trim() ===
          siswaIdNormal
        ) {

          siswaDitemukan =
            true;

          break;
        }
      }

      if (
        !siswaDitemukan
      ) {

        return response(
          404,
          {
            success:
              false,

            message:
              "Siswa tidak ditemukan."
          }
        );
      }

      // =================================================
      // ID POIN
      // =================================================

      const pointId =
        "P" +
        String(
          Date.now()
        ).slice(-8);

      // =================================================
      // TANGGAL
      // =================================================

      let tanggalFinal =
        String(
          tanggal || ""
        ).trim();

      if (
        !tanggalFinal
      ) {

        const now =
          new Date();

        tanggalFinal =
          String(
            now.getDate()
          ).padStart(
            2,
            "0"
          ) +
          "/" +
          String(
            now.getMonth() + 1
          ).padStart(
            2,
            "0"
          ) +
          "/" +
          now.getFullYear();
      }

      const dibuatOleh =
        String(
          admin || ""
        ).trim();

      // =================================================
      // SIMPAN POIN
      //
      // G = Dibuat_Oleh
      // H = Peran
      // =================================================

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range:
          "Poin!A:H",

        valueInputOption:
          "RAW",

        requestBody: {

          values: [[

            pointId,

            siswaIdNormal,

            jenisNormal,

            nilaiPoin,

            String(
              keterangan
            ).trim(),

            tanggalFinal,

            dibuatOleh,

            "Admin"

          ]]

        }

      });

      return response(
        201,
        {

          success:
            true,

          message:
            "Poin berhasil ditambahkan.",

          poin: {

            id:
              pointId,

            siswaId:
              siswaIdNormal,

            jenis:
              jenisNormal,

            poin:
              nilaiPoin,

            keterangan:
              String(
                keterangan
              ).trim(),

            tanggal:
              tanggalFinal,

            dibuatOleh,

            peran:
              "Admin"

          }

        }
      );
    }

    // ===================================================
    // PUT — EDIT POIN
    //
    // SEBELUM:
    // Siswa GET = 1
    // Poin GET  = 1
    // Update    = 1
    // TOTAL     = 3
    //
    // SEKARANG:
    // batchGet Siswa + Poin = 1
    // Update                  = 1
    // TOTAL                   = 2
    // ===================================================

    if (
      event.httpMethod ===
      "PUT"
    ) {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const {
        id,
        siswaId,
        jenis,
        poin,
        keterangan,
        tanggal
      } = body;

      if (
        !id ||
        !siswaId ||
        !jenis ||
        poin === undefined ||
        poin === null ||
        !keterangan
      ) {

        return response(
          400,
          {
            success:
              false,

            message:
              "Semua data wajib diisi."
          }
        );
      }

      const jenisNormal =
        String(jenis)
          .trim()
          .toLowerCase();

      if (
        jenisNormal !==
          "penghargaan" &&
        jenisNormal !==
          "pelanggaran"
      ) {

        return response(
          400,
          {
            success:
              false,

            message:
              "Jenis poin tidak valid."
          }
        );
      }

      const nilaiPoin =
        Number(poin);

      if (
        !Number.isFinite(
          nilaiPoin
        ) ||
        nilaiPoin <= 0
      ) {

        return response(
          400,
          {
            success:
              false,

            message:
              "Jumlah poin harus lebih dari 0."
          }
        );
      }

      // =================================================
      // BACA SISWA + POIN SEKALIGUS
      // =================================================

      const data =
        await batchGet(
          sheets,
          spreadsheetId,
          [
            "Siswa!A:F",
            "Poin!A:H"
          ]
        );

      const siswaRows =
        data["Siswa!A:F"] || [];

      const pointRows =
        data["Poin!A:H"] || [];

      // =================================================
      // CEK SISWA
      // =================================================

      const siswaIdNormal =
        String(
          siswaId
        ).trim();

      const siswaAda =
        siswaRows.some(
          (
            row,
            index
          ) =>
            index > 0 &&
            String(
              row[0] || ""
            ).trim() ===
            siswaIdNormal
        );

      if (!siswaAda) {

        return response(
          404,
          {
            success:
              false,

            message:
              "Siswa tidak ditemukan."
          }
        );
      }

      // =================================================
      // CARI BARIS POIN
      // =================================================

      const pointIdNormal =
        String(
          id
        ).trim();

      let rowNumber =
        -1;

      for (
        let i = 1;
        i < pointRows.length;
        i++
      ) {

        const rowId =
          String(
            pointRows[i][0] ||
            ""
          ).trim();

        if (
          rowId ===
          pointIdNormal
        ) {

          rowNumber =
            i + 1;

          break;
        }
      }

      if (
        rowNumber ===
        -1
      ) {

        return response(
          404,
          {
            success:
              false,

            message:
              "Data poin tidak ditemukan."
          }
        );
      }

      // =================================================
      // TANGGAL
      // =================================================

      let tanggalFinal =
        String(
          tanggal || ""
        ).trim();

      if (
        !tanggalFinal
      ) {

        const sekarang =
          new Date();

        tanggalFinal =
          String(
            sekarang.getDate()
          ).padStart(
            2,
            "0"
          ) +
          "/" +
          String(
            sekarang.getMonth() + 1
          ).padStart(
            2,
            "0"
          ) +
          "/" +
          sekarang.getFullYear();
      }

      // =================================================
      // UPDATE B:F SAJA
      //
      // G = Dibuat_Oleh
      // H = Peran
      //
      // Metadata pembuat TETAP.
      // =================================================

      await sheets.spreadsheets.values.update({

        spreadsheetId,

        range:
          `Poin!B${rowNumber}:F${rowNumber}`,

        valueInputOption:
          "RAW",

        requestBody: {

          values: [[

            siswaIdNormal,

            jenisNormal,

            nilaiPoin,

            String(
              keterangan
            ).trim(),

            tanggalFinal

          ]]

        }

      });

      return response(
        200,
        {

          success:
            true,

          message:
            "Poin berhasil diperbarui."

        }
      );
    }

    // ===================================================
    // DELETE — HAPUS POIN
    //
    // 1 read
    // + 1 clear
    // = 2 request
    // ===================================================

    if (
      event.httpMethod ===
      "DELETE"
    ) {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const id =
        String(
          body.id || ""
        ).trim();

      if (!id) {

        return response(
          400,
          {

            success:
              false,

            message:
              "ID poin wajib diisi."

          }
        );
      }

      // =================================================
      // CARI POIN
      // =================================================

      const result =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range:
            "Poin!A:H"

        });

      const rows =
        result.data.values ||
        [];

      let rowNumber =
        null;

      for (
        let i = 1;
        i < rows.length;
        i++
      ) {

        if (
          String(
            rows[i][0] || ""
          ).trim() ===
          id
        ) {

          rowNumber =
            i + 1;

          break;
        }
      }

      if (!rowNumber) {

        return response(
          404,
          {

            success:
              false,

            message:
              "Poin tidak ditemukan."

          }
        );
      }

      // =================================================
      // CLEAR A:H
      //
      // Tidak membuat Riwayat_Poin.
      // =================================================

      await sheets.spreadsheets.values.clear({

        spreadsheetId,

        range:
          `Poin!A${rowNumber}:H${rowNumber}`

      });

      return response(
        200,
        {

          success:
            true,

          message:
            "Poin berhasil dihapus."

        }
      );
    }

    // ===================================================
    // METHOD TIDAK DIIZINKAN
    // ===================================================

    return response(
      405,
      {

        success:
          false,

        message:
          "Method tidak diizinkan."

      }
    );

  } catch (
    error
  ) {

    console.error(
      "ADMIN POINTS ERROR:",
      error
    );

    return response(
      500,
      {

        success:
          false,

        message:
          error.message ||
          "Terjadi kesalahan pada server."

      }
    );
  }
};
