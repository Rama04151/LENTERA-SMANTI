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

    // =========================
    // GET
    // =========================

    if (event.httpMethod === "GET") {

      const params =
        event.queryStringParameters || {};

      const guruUsername =
        String(params.guruUsername || "").trim();

      if (!guruUsername) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Username guru tidak ditemukan."
          })
        };

      }

      const response =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Inbox!A:H"
        });

      const rows =
        response.data.values || [];

      const messages =
        rows
          .slice(1)
          .filter(row => {

            const pembuat =
              String(row[6] || "").trim();

            return pembuat === guruUsername;

          })
          .map(row => ({

            id:
              String(row[0] || "").trim(),

            siswaId:
              String(row[1] || "").trim(),

            judul:
              String(row[2] || "").trim(),

            pesan:
              String(row[3] || "").trim(),

            dibuat:
              String(row[4] || "").trim(),

            kedaluwarsa:
              String(row[5] || "").trim(),

            guruUsername:
              String(row[6] || "").trim(),

            status:
              String(row[7] || "").trim()

          }))
          .sort((a, b) =>
            new Date(b.dibuat) -
            new Date(a.dibuat)
          );

      return {

        statusCode: 200,

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          success: true,
          messages
        })

      };

    }

    // =========================
    // POST
    // =========================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(event.body || "{}");

      const siswaId =
        String(body.siswaId || "").trim();

      const judul =
        String(body.judul || "").trim();

      const pesan =
        String(body.pesan || "").trim();

      const durasi =
        String(body.durasi || "1d").trim();

      const guruUsername =
        String(body.guruUsername || "").trim();

      if (!siswaId) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Siswa wajib dipilih."
          })
        };

      }

      if (!judul) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Judul wajib diisi."
          })
        };

      }

      if (judul.length > 100) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Judul maksimal 100 karakter."
          })
        };

      }

      if (!pesan) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Pesan wajib diisi."
          })
        };

      }

      if (pesan.length > 2000) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Pesan maksimal 2000 karakter."
          })
        };

      }

      if (!guruUsername) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Username guru tidak ditemukan."
          })
        };

      }

      // =========================
      // CEK SISWA
      // =========================

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

        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            message: "Siswa tidak ditemukan."
          })
        };

      }

      const status =
        String(siswa[5] || "")
          .trim()
          .toLowerCase();

      if (status !== "aktif") {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Siswa tidak aktif."
          })
        };

      }

      // =========================
      // DURASI
      // =========================

      const durationMap = {

        "1h": 60 * 60 * 1000,

        "3h": 3 * 60 * 60 * 1000,

        "6h": 6 * 60 * 60 * 1000,

        "12h": 12 * 60 * 60 * 1000,

        "1d": 24 * 60 * 60 * 1000,

        "3d": 3 * 24 * 60 * 60 * 1000,

        "7d": 7 * 24 * 60 * 60 * 1000

      };

      const duration =
        durationMap[durasi] ||
        durationMap["1d"];

      const now =
        new Date();

      const expiredAt =
        new Date(
          now.getTime() + duration
        );

      // =========================
      // ID PESAN
      // =========================

      const messageId =
        "MSG" + Date.now();

      // =========================
      // SIMPAN
      // =========================

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range: "Inbox!A:H",

        valueInputOption: "USER_ENTERED",

        insertDataOption: "INSERT_ROWS",

        requestBody: {

          values: [[

            messageId,

            siswaId,

            judul,

            pesan,

            now.toISOString(),

            expiredAt.toISOString(),

            guruUsername,

            "Aktif"

          ]]

        }

      });

      return {

        statusCode: 200,

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          success: true,

          message:
            "Pesan berhasil dikirim."

        })

      };

    }

    // =========================
    // DELETE
    // =========================

    if (event.httpMethod === "DELETE") {

      const body =
        JSON.parse(event.body || "{}");

      const messageId =
        String(body.id || "").trim();

      const guruUsername =
        String(body.guruUsername || "").trim();

      if (!messageId || !guruUsername) {

        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: "Data pesan tidak lengkap."
          })
        };

      }

      const response =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Inbox!A:H"
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
            id === messageId &&
            pembuat === guruUsername
          );

        });

      if (rowIndex === -1) {

        return {
          statusCode: 403,
          body: JSON.stringify({
            success: false,
            message:
              "Pesan tidak ditemukan atau bukan milik Anda."
          })
        };

      }

      await sheets.spreadsheets.batchUpdate({

        spreadsheetId,

        requestBody: {

          requests: [{

            deleteDimension: {

              range: {

                sheetId:
                  await getSheetId(
                    sheets,
                    spreadsheetId,
                    "Inbox"
                  ),

                dimension:
                  "ROWS",

                startIndex:
                  rowIndex,

                endIndex:
                  rowIndex + 1

              }

            }

          }]

        }

      });

      return {

        statusCode: 200,

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          success: true,

          message:
            "Pesan berhasil dihapus."

        })

      };

    }

    return {

      statusCode: 405,

      body: JSON.stringify({

        success: false,

        message:
          "Method tidak diizinkan."

      })

    };

  } catch (error) {

    console.error(
      "GURU INBOX ERROR:",
      error
    );

    return {

      statusCode: 500,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        success: false,

        message:
          "Gagal memproses inbox guru."

      })

    };

  }

};


// ========================================
// MENDAPATKAN SHEET ID
// ========================================

async function getSheetId(
  sheets,
  spreadsheetId,
  sheetName
) {

  const response =
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties"
    });

  const sheet =
    response.data.sheets.find(
      item =>
        item.properties.title === sheetName
    );

  if (!sheet) {
    throw new Error(
      `Sheet ${sheetName} tidak ditemukan.`
    );
  }

  return sheet.properties.sheetId;
}
