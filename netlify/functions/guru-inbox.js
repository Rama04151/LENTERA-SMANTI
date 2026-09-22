const { google } = require("googleapis");

function getSheets() {

  const auth =
    new google.auth.GoogleAuth({
      credentials: {

        client_email:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,

        private_key:
          process.env.GOOGLE_PRIVATE_KEY
            .replace(/\\n/g, "\n")
            .replace(/^"|"$/g, "")
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

function success(data = {}) {

  return {
    statusCode: 200,

    headers: {
      "Content-Type":
        "application/json"
    },

    body: JSON.stringify({
      success: true,
      ...data
    })
  };
}

function error(message, statusCode = 400) {

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


// =====================================================
// CARI GURU
// =====================================================

async function getGuru(
  sheets,
  spreadsheetId,
  guruId,
  guruUsername
) {

  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId,

      range:
        "Guru!A:E"

    });

  const rows =
    response.data.values || [];

  for (
    const row of rows.slice(1)
  ) {

    const id =
      String(
        row[0] || ""
      ).trim();

    const username =
      String(
        row[1] || ""
      ).trim();

    const nama =
      String(
        row[3] || ""
      ).trim();

    const status =
      String(
        row[4] || ""
      ).trim();

    if (
      status.toLowerCase() !==
      "aktif"
    ) {
      continue;
    }

    // Utamakan ID
    if (
      guruId &&
      id === String(guruId).trim()
    ) {

      return {
        id,
        username,
        nama
      };
    }

    // Fallback username
    if (
      guruUsername &&
      username.toLowerCase() ===
      String(guruUsername)
        .trim()
        .toLowerCase()
    ) {

      return {
        id,
        username,
        nama
      };
    }
  }

  return null;
}


// =====================================================
// SHEET ID
// =====================================================

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

  return sheet
    ? sheet.properties.sheetId
    : null;
}


// =====================================================
// HANDLER
// =====================================================

exports.handler =
  async function (event) {

    const sheets =
      getSheets();

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    try {

      // =================================================
      // GET — PESAN YANG DIKIRIM GURU
      // =================================================

      if (
        event.httpMethod ===
        "GET"
      ) {

        const params =
          event.queryStringParameters ||
          {};

        const guruId =
          String(
            params.guruId || ""
          ).trim();

        const guruUsername =
          String(
            params.guruUsername || ""
          ).trim();

        const guru =
          await getGuru(
            sheets,
            spreadsheetId,
            guruId,
            guruUsername
          );

        if (!guru) {

          return error(
            "Akun guru tidak ditemukan.",
            404
          );
        }

        const [
          inboxResponse,
          siswaResponse,
          kelasResponse
        ] =
          await Promise.all([

            sheets.spreadsheets.values.get({
              spreadsheetId,
              range:
                "Inbox!A:H"
            }),

            sheets.spreadsheets.values.get({
              spreadsheetId,
              range:
                "Siswa!A:F"
            }),

            sheets.spreadsheets.values.get({
              spreadsheetId,
              range:
                "Kelas!A:E"
            })

          ]);

        const inboxRows =
          inboxResponse.data.values ||
          [];

        const siswaRows =
          siswaResponse.data.values ||
          [];

        const kelasRows =
          kelasResponse.data.values ||
          [];


        // ================================
        // MAP SISWA
        // ================================

        const siswaMap = {};

        siswaRows
          .slice(1)
          .forEach(row => {

            const id =
              String(
                row[0] || ""
              ).trim();

            if (!id) {
              return;
            }

            siswaMap[id] = {

              nama:
                String(
                  row[2] || ""
                ).trim(),

              nisn:
                String(
                  row[1] || ""
                ).trim(),

              kelasId:
                String(
                  row[3] || ""
                ).trim()

            };

          });


        // ================================
        // MAP KELAS
        // ================================

        const kelasMap = {};

        kelasRows
          .slice(1)
          .forEach(row => {

            const id =
              String(
                row[0] || ""
              ).trim();

            const nama =
              String(
                row[1] || ""
              ).trim();

            if (id) {

              kelasMap[id] =
                nama;

            }

          });


        // ================================
        // FILTER PESAN GURU
        // ================================

        const pesanSaya = [];

        inboxRows
          .slice(1)
          .forEach(row => {

            const id =
              String(
                row[0] || ""
              ).trim();

            const siswaId =
              String(
                row[1] || ""
              ).trim();

            const judul =
              String(
                row[2] || ""
              ).trim();

            const pesan =
              String(
                row[3] || ""
              ).trim();

            const dibuat =
              String(
                row[4] || ""
              ).trim();

            const kedaluwarsa =
              String(
                row[5] || ""
              ).trim();

            const dibuatOleh =
              String(
                row[6] || ""
              ).trim();

            const status =
              String(
                row[7] || ""
              ).trim();


            if (
              dibuatOleh.toLowerCase() !==
              guru.username.toLowerCase()
            ) {

              return;
            }


            const siswa =
              siswaMap[siswaId] ||
              {};


            pesanSaya.push({

              id,

              siswaId,

              siswaNama:
                siswa.nama || "-",

              siswaNisn:
                siswa.nisn || "-",

              siswaKelas:
                kelasMap[
                  siswa.kelasId
                ] || "-",

              judul,

              pesan,

              dibuat,

              kedaluwarsa,

              status,

              guruUsername:
                guru.username

            });

          });


        // Terbaru di atas
        pesanSaya.sort(
          (a, b) =>
            new Date(b.dibuat) -
            new Date(a.dibuat)
        );


        return success({

          guru: {

            id:
              guru.id,

            username:
              guru.username,

            nama:
              guru.nama

          },

          pesan:
            pesanSaya

        });

      }


      // =================================================
      // POST — KIRIM PESAN
      // =================================================

      if (
        event.httpMethod ===
        "POST"
      ) {

        const body =
          JSON.parse(
            event.body || "{}"
          );


        const siswaId =
          String(
            body.siswaId || ""
          ).trim();

        const judul =
          String(
            body.judul || ""
          ).trim();

        const pesan =
          String(
            body.pesan || ""
          ).trim();

        const durasi =
          String(
            body.durasi || "1d"
          ).trim();

        const guruId =
          String(
            body.guruId || ""
          ).trim();

        const guruUsername =
          String(
            body.guruUsername || ""
          ).trim();


        if (!siswaId) {

          return error(
            "Siswa belum dipilih."
          );
        }

        if (!judul) {

          return error(
            "Judul pesan wajib diisi."
          );
        }

        if (!pesan) {

          return error(
            "Pesan wajib diisi."
          );
        }


        if (
          judul.length >
          100
        ) {

          return error(
            "Judul maksimal 100 karakter."
          );
        }


        if (
          pesan.length >
          2000
        ) {

          return error(
            "Pesan maksimal 2000 karakter."
          );
        }


        const guru =
          await getGuru(
            sheets,
            spreadsheetId,
            guruId,
            guruUsername
          );


        if (!guru) {

          return error(
            "Akun guru tidak ditemukan.",
            404
          );
        }


        // =================================================
        // CEK SISWA
        // =================================================

        const siswaResponse =
          await sheets.spreadsheets.values.get({

            spreadsheetId,

            range:
              "Siswa!A:F"

          });

        const siswaRows =
          siswaResponse.data.values ||
          [];

        let siswaDitemukan =
          false;

        for (
          const row of siswaRows.slice(1)
        ) {

          const id =
            String(
              row[0] || ""
            ).trim();

          const status =
            String(
              row[5] || ""
            ).trim();

          if (
            id === siswaId &&
            status.toLowerCase() ===
            "aktif"
          ) {

            siswaDitemukan =
              true;

            break;
          }
        }


        if (!siswaDitemukan) {

          return error(
            "Siswa tidak ditemukan atau tidak aktif."
          );
        }


        // =================================================
        // DURASI
        // =================================================

        const durations = {

          "1h":
            1 * 60 * 60 * 1000,

          "3h":
            3 * 60 * 60 * 1000,

          "6h":
            6 * 60 * 60 * 1000,

          "12h":
            12 * 60 * 60 * 1000,

          "1d":
            24 * 60 * 60 * 1000,

          "3d":
            3 * 24 * 60 * 60 * 1000,

          "7d":
            7 * 24 * 60 * 60 * 1000

        };


        if (
          !durations[durasi]
        ) {

          return error(
            "Durasi pesan tidak valid."
          );
        }


        const now =
          new Date();

        const expiredAt =
          new Date(
            now.getTime() +
            durations[durasi]
          );


        const messageId =
          "MSG" +
          Date.now();


        await sheets.spreadsheets.values.append({

          spreadsheetId,

          range:
            "Inbox!A:H",

          valueInputOption:
            "USER_ENTERED",

          insertDataOption:
            "INSERT_ROWS",

          requestBody: {

            values: [[

              messageId,

              siswaId,

              judul,

              pesan,

              now.toISOString(),

              expiredAt.toISOString(),

              guru.username,

              "Aktif"

            ]]

          }

        });


        return success({

          message:
            "Pesan berhasil dikirim."

        });

      }


      // =================================================
      // DELETE — HAPUS PESAN SENDIRI
      // =================================================

      if (
        event.httpMethod ===
        "DELETE"
      ) {

        const body =
          JSON.parse(
            event.body || "{}"
          );


        const messageId =
          String(
            body.id || ""
          ).trim();

        const guruId =
          String(
            body.guruId || ""
          ).trim();

        const guruUsername =
          String(
            body.guruUsername || ""
          ).trim();


        if (!messageId) {

          return error(
            "ID pesan tidak ditemukan."
          );
        }


        const guru =
          await getGuru(
            sheets,
            spreadsheetId,
            guruId,
            guruUsername
          );


        if (!guru) {

          return error(
            "Akun guru tidak ditemukan.",
            404
          );
        }


        const response =
          await sheets.spreadsheets.values.get({

            spreadsheetId,

            range:
              "Inbox!A:H"

          });


        const rows =
          response.data.values ||
          [];


        let rowNumber =
          -1;


        for (
          let i = 1;
          i < rows.length;
          i++
        ) {

          const id =
            String(
              rows[i][0] || ""
            ).trim();

          const dibuatOleh =
            String(
              rows[i][6] || ""
            ).trim();


          if (
            id === messageId &&
            dibuatOleh.toLowerCase() ===
            guru.username.toLowerCase()
          ) {

            rowNumber =
              i + 1;

            break;
          }

        }


        if (
          rowNumber === -1
        ) {

          return error(
            "Pesan tidak ditemukan atau bukan pesan Anda.",
            403
          );
        }


        const sheetId =
          await getSheetId(
            sheets,
            spreadsheetId,
            "Inbox"
          );


        if (
          sheetId === null
        ) {

          return error(
            "Sheet Inbox tidak ditemukan.",
            500
          );
        }


        await sheets.spreadsheets.batchUpdate({

          spreadsheetId,

          requestBody: {

            requests: [{

              deleteDimension: {

                range: {

                  sheetId,

                  dimension:
                    "ROWS",

                  startIndex:
                    rowNumber - 1,

                  endIndex:
                    rowNumber

                }

              }

            }]

          }

        });


        return success({

          message:
            "Pesan berhasil dihapus."

        });

      }


      return error(
        "Method tidak diizinkan.",
        405
      );


    } catch (err) {

      console.error(
        "GURU INBOX ERROR:",
        err
      );

      return error(
        "Terjadi kesalahan pada server.",
        500
      );
    }
  };
