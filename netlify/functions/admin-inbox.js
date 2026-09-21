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
    // DATA PESAN
    // =========================

    if (
      event.httpMethod === "GET"
    ) {

      // Ambil Inbox
      const inboxResponse =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range: "Inbox!A:H"

        });

      const inboxRows =
        inboxResponse.data.values || [];


      // Ambil data siswa
      const siswaResponse =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range: "Siswa!A:F"

        });

      const siswaRows =
        siswaResponse.data.values || [];


      // Ambil data kelas
      const kelasResponse =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range: "Kelas!A:E"

        });

      const kelasRows =
        kelasResponse.data.values || [];


      // =========================
      // MAP KELAS
      // =========================

      const kelasMap = {};

      for (
        let i = 1;
        i < kelasRows.length;
        i++
      ) {

        const row =
          kelasRows[i];

        const id =
          String(row[0] || "").trim();

        const nama =
          String(row[1] || "").trim();

        if (!id) {
          continue;
        }

        kelasMap[id] =
          nama || "-";

      }


      // =========================
      // MAP SISWA
      // =========================

      const siswaMap = {};

      for (
        let i = 1;
        i < siswaRows.length;
        i++
      ) {

        const row =
          siswaRows[i];

        const id =
          String(row[0] || "").trim();

        if (!id) {
          continue;
        }

        siswaMap[id] = {

          nama:
            String(row[2] || "").trim(),

          nisn:
            String(row[1] || "").trim(),

          kelas:
            kelasMap[
              String(row[3] || "").trim()
            ] || "-",

          status:
            String(row[5] || "").trim()

        };

      }


      // =========================
      // DATA INBOX
      // =========================

      const inbox = [];

      for (
        let i = 1;
        i < inboxRows.length;
        i++
      ) {

        const row =
          inboxRows[i];

        const id =
          String(row[0] || "").trim();

        const siswaId =
          String(row[1] || "").trim();

        const siswa =
          siswaMap[siswaId] || {};


        inbox.push({

          id,

          siswaId,

          siswaNama:
            siswa.nama || "-",

          siswaNisn:
            siswa.nisn || "-",

          siswaKelas:
            siswa.kelas || "-",

          judul:
            String(row[2] || "").trim(),

          pesan:
            String(row[3] || "").trim(),

          dibuat:
            String(row[4] || "").trim(),

          kedaluwarsa:
            String(row[5] || "").trim(),

          admin:
            String(row[6] || "").trim(),

          status:
            String(row[7] || "").trim()

        });

      }


      // Pesan terbaru di atas
      inbox.sort(
        (a, b) =>
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

          inbox

        })

      };

    }


    // =========================
    // POST
    // KIRIM PESAN
    // =========================

    if (
      event.httpMethod === "POST"
    ) {

      const data =
        JSON.parse(
          event.body || "{}"
        );

      const {
        siswaId,
        judul,
        pesan,
        durasi,
        admin
      } = data;


      if (
        !siswaId ||
        !judul ||
        !pesan ||
        !durasi
      ) {

        return {

          statusCode: 400,

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            success: false,

            message:
              "Data pesan belum lengkap."

          })

        };

      }


      // =========================
      // DURASI
      // =========================

      const durationMap = {

        "1h": 1,

        "3h": 3,

        "6h": 6,

        "12h": 12,

        "1d": 24,

        "3d": 72,

        "7d": 168

      };


      const hours =
        durationMap[durasi];


      if (!hours) {

        return {

          statusCode: 400,

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            success: false,

            message:
              "Durasi pesan tidak valid."

          })

        };

      }


      const createdAt =
        new Date();

      const expiredAt =
        new Date(
          createdAt.getTime() +
          hours *
          60 *
          60 *
          1000
        );


      const id =
        "MSG" +
        Date.now();


      // =========================
      // SIMPAN PESAN
      // =========================

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range:
          "Inbox!A:H",

        valueInputOption:
          "RAW",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {

          values: [[

            id,

            String(siswaId),

            String(judul),

            String(pesan),

            createdAt.toISOString(),

            expiredAt.toISOString(),

            String(
              admin || "admin"
            ),

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
            "Pesan berhasil dikirim.",

          data: {

            id,

            dibuat:
              createdAt.toISOString(),

            kedaluwarsa:
              expiredAt.toISOString()

          }

        })

      };

    }


    // =========================
    // DELETE
    // HAPUS PESAN
    // =========================

    if (
      event.httpMethod === "DELETE"
    ) {

      const data =
        JSON.parse(
          event.body || "{}"
        );

      const messageId =
        String(
          data.id || ""
        ).trim();


      if (!messageId) {

        return {

          statusCode: 400,

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            success: false,

            message:
              "ID pesan wajib diisi."

          })

        };

      }


      // =========================
      // CARI PESAN
      // =========================

      const response =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range:
            "Inbox!A:H"

        });


      const rows =
        response.data.values || [];


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


        if (
          id === messageId
        ) {

          rowNumber =
            i + 1;

          break;

        }

      }


      if (
        rowNumber === -1
      ) {

        return {

          statusCode: 404,

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            success: false,

            message:
              "Pesan tidak ditemukan."

          })

        };

      }


      // =========================
      // CARI SHEET ID
      // =========================

      const spreadsheet =
        await sheets.spreadsheets.get({

          spreadsheetId,

          fields:
            "sheets(properties(sheetId,title))"

        });


      const inboxSheet =
        spreadsheet.data.sheets.find(
          sheet =>
            sheet.properties.title ===
            "Inbox"
        );


      if (!inboxSheet) {

        throw new Error(
          'Sheet "Inbox" tidak ditemukan.'
        );

      }


      const sheetId =
        inboxSheet.properties.sheetId;


      // =========================
      // HAPUS BARIS
      // =========================

      await sheets.spreadsheets.batchUpdate({

        spreadsheetId,

        requestBody: {

          requests: [

            {

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

            }

          ]

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


    // =========================
    // METHOD TIDAK DIIZINKAN
    // =========================

    return {

      statusCode: 405,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        success: false,

        message:
          "Method tidak diizinkan."

      })

    };

  }
  catch (error) {

    console.error(
      "ADMIN INBOX ERROR:",
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
          "Terjadi kesalahan server.",

        error:
          error.message

      })

    };

  }

};
