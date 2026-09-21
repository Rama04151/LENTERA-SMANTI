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
          hours * 60 * 60 * 1000
        );

      const id =
        "MSG" +
        Date.now();

      // =========================
      // SIMPAN
      // =========================

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range: "Inbox!A:H",

        valueInputOption: "RAW",

        insertDataOption: "INSERT_ROWS",

        requestBody: {

          values: [[

            id,

            String(siswaId),

            String(judul),

            String(pesan),

            createdAt.toISOString(),

            expiredAt.toISOString(),

            String(admin || "admin"),

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
    // GET
    // DATA INBOX ADMIN
    // =========================

    if (
      event.httpMethod === "GET"
    ) {

      const response =
        await sheets.spreadsheets.values.get({

          spreadsheetId,

          range: "Inbox!A:H"

        });

      const rows =
        response.data.values || [];

      const inbox = [];

      for (
        let i = 1;
        i < rows.length;
        i++
      ) {

        const row = rows[i];

        inbox.push({

          id:
            String(row[0] || ""),

          siswaId:
            String(row[1] || ""),

          judul:
            String(row[2] || ""),

          pesan:
            String(row[3] || ""),

          dibuat:
            String(row[4] || ""),

          kedaluwarsa:
            String(row[5] || ""),

          admin:
            String(row[6] || ""),

          status:
            String(row[7] || "")

        });

      }

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

    return {

      statusCode: 405,

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
