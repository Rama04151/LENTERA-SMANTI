const { google } = require("googleapis");

exports.handler = async function (event) {

  try {

    // =========================
    // GOOGLE AUTH
    // =========================

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

    const sheets =
      google.sheets({
        version: "v4",
        auth
      });

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // ========================================
    // POST = TAMBAH POIN
    // ========================================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(event.body || "{}");

      const siswaId =
        String(body.siswaId || "").trim();

      const poin =
        Number(body.poin || 0);

      const keterangan =
        String(body.keterangan || "").trim();

      const jenis =
        String(body.jenis || "")
          .trim()
          .toLowerCase();

      const guruId =
        String(body.guruId || "").trim();

      const guruUsername =
        String(body.guruUsername || "").trim();

      if (!siswaId) {

        return error(
          400,
          "Siswa belum dipilih."
        );

      }

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {

        return error(
          400,
          "Poin harus antara 1 sampai 100."
        );

      }

      if (!keterangan) {

        return error(
          400,
          "Keterangan wajib diisi."
        );

      }

      if (keterangan.length > 500) {

        return error(
          400,
          "Keterangan maksimal 500 karakter."
        );

      }

      if (
        jenis !== "penghargaan" &&
        jenis !== "pelanggaran"
      ) {

        return error(
          400,
          "Jenis poin tidak valid."
        );

      }

      if (!guruId || !guruUsername) {

        return error(
          401,
          "Data akun guru tidak ditemukan."
        );

      }

      // CEK SISWA

      const siswaResponse =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Siswa!A:F"
        });

      const siswaRows =
        siswaResponse.data.values || [];

      const siswa =
        siswaRows
          .slice(1)
          .find(row =>
            String(row[0] || "").trim() === siswaId
          );

      if (!siswa) {

        return error(
          404,
          "Siswa tidak ditemukan."
        );

      }

      const status =
        String(siswa[5] || "")
          .trim()
          .toLowerCase();

      if (status !== "aktif") {

        return error(
          400,
          "Siswa tidak aktif."
        );

      }

      const pointId =
        "P" + Date.now();

      const tanggal =
        new Date().toISOString();

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range: "Poin!A:H",

        valueInputOption: "USER_ENTERED",

        insertDataOption: "INSERT_ROWS",

        requestBody: {

          values: [[

            pointId,
            siswaId,
            jenis,
            poin,
            keterangan,
            tanggal,
            guruUsername,
            "Guru"

          ]]

        }

      });

      return success(
        "Poin berhasil ditambahkan.",
        {
          id: pointId
        }
      );

    }

    // ========================================
    // PUT = EDIT POIN SENDIRI
    // ========================================

    if (event.httpMethod === "PUT") {

      const body =
        JSON.parse(event.body || "{}");

      const pointId =
        String(body.id || "").trim();

      const poin =
        Number(body.poin || 0);

      const keterangan =
        String(body.keterangan || "").trim();

      const jenis =
        String(body.jenis || "")
          .trim()
          .toLowerCase();

      const guruUsername =
        String(body.guruUsername || "").trim();

      if (!pointId || !guruUsername) {

        return error(
          400,
          "Data poin tidak lengkap."
        );

      }

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {

        return error(
          400,
          "Poin harus antara 1 sampai 100."
        );

      }

      if (!keterangan) {

        return error(
          400,
          "Keterangan wajib diisi."
        );

      }

      if (
        jenis !== "penghargaan" &&
        jenis !== "pelanggaran"
      ) {

        return error(
          400,
          "Jenis poin tidak valid."
        );

      }

      const response =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range: "Poin!A:H"

        });

      const rows =
        response.data.values || [];

      const rowIndex =
        rows.findIndex((row, index) => {

          if (index === 0) {
            return false;
          }

          const id =
            String(row[0] || "").trim();

          const pembuat =
            String(row[6] || "").trim();

          return (
            id === pointId &&
            pembuat === guruUsername
          );

        });

      if (rowIndex === -1) {

        return error(
          403,
          "Poin tidak ditemukan atau bukan milik Anda."
        );

      }

      // rowIndex = index array
      // Sheets row = index + 1

      const sheetRow =
        rowIndex + 1;

      await sheets.spreadsheets.values.update({

        spreadsheetId,

        range:
          `Poin!C${sheetRow}:E${sheetRow}`,

        valueInputOption:
          "USER_ENTERED",

        requestBody: {

          values: [[

            jenis,
            poin,
            keterangan

          ]]

        }

      });

      return success(
        "Poin berhasil diperbarui."
      );

    }

    // ========================================
    // DELETE = HAPUS POIN SENDIRI
    // ========================================

    if (event.httpMethod === "DELETE") {

      const body =
        JSON.parse(event.body || "{}");

      const pointId =
        String(body.id || "").trim();

      const guruUsername =
        String(body.guruUsername || "").trim();

      if (!pointId || !guruUsername) {

        return error(
          400,
          "Data poin tidak lengkap."
        );

      }

      const response =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range: "Poin!A:H"

        });

      const rows =
        response.data.values || [];

      const rowIndex =
        rows.findIndex((row, index) => {

          if (index === 0) {
            return false;
          }

          const id =
            String(row[0] || "").trim();

          const pembuat =
            String(row[6] || "").trim();

          return (
            id === pointId &&
            pembuat === guruUsername
          );

        });

      if (rowIndex === -1) {

        return error(
          403,
          "Poin tidak ditemukan atau bukan milik Anda."
        );

      }

      const sheetId =
        await getSheetId(
          sheets,
          spreadsheetId,
          "Poin"
        );

      await sheets.spreadsheets.batchUpdate({

        spreadsheetId,

        requestBody: {

          requests: [{

            deleteDimension: {

              range: {

                sheetId,

                dimension: "ROWS",

                startIndex:
                  rowIndex,

                endIndex:
                  rowIndex + 1

              }

            }

          }]

        }

      });

      return success(
        "Poin berhasil dihapus."
      );

    }

    return error(
      405,
      "Method tidak diizinkan."
    );

  } catch (error) {

    console.error(
      "GURU POINTS ERROR:",
      error
    );

    return error(
      500,
      "Gagal memproses poin."
    );

  }

};


// ========================================
// HELPER RESPONSE
// ========================================

function success(
  message,
  data = {}
) {

  return {

    statusCode: 200,

    headers: {
      "Content-Type":
        "application/json"
    },

    body: JSON.stringify({

      success: true,

      message,

      ...data

    })

  };

}


function error(
  statusCode,
  message
) {

  return {

    statusCode,

    headers: {
      "Content-Type":
        "application/json"
    },

    body: JSON.stringify({

      success: false,

      message

    })

  };

}


// ========================================
// GET SHEET ID
// ========================================

async function getSheetId(
  sheets,
  spreadsheetId,
  sheetName
) {

  const response =
    await sheets.spreadsheets.get({

      spreadsheetId,

      fields:
        "sheets.properties"

    });

  const sheet =
    response.data.sheets.find(
      item =>
        item.properties.title ===
        sheetName
    );

  if (!sheet) {

    throw new Error(
      `Sheet ${sheetName} tidak ditemukan.`
    );

  }

  return sheet.properties.sheetId;

}
