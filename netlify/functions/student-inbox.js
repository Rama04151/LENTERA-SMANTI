const { google } = require("googleapis");

exports.handler = async function (event) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        message: "Method tidak diizinkan."
      })
    };
  }

  try {

    const {
      siswaId
    } = JSON.parse(event.body || "{}");

    if (!siswaId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          success: false,
          message: "Siswa ID wajib diisi."
        })
      };
    }

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
    // AMBIL INBOX
    // =========================

    const response =
      await sheets.spreadsheets.values.get({

        spreadsheetId,

        range: "Inbox!A:H"

      });

    const rows =
      response.data.values || [];

    const now =
      new Date();

    const inbox = [];

    for (
      let i = 1;
      i < rows.length;
      i++
    ) {

      const row = rows[i];

      const id =
        String(row[0] || "").trim();

      const targetSiswaId =
        String(row[1] || "").trim();

      const judul =
        String(row[2] || "").trim();

      const pesan =
        String(row[3] || "").trim();

      const dibuat =
        String(row[4] || "").trim();

      const kedaluwarsa =
        String(row[5] || "").trim();

      const admin =
        String(row[6] || "").trim();

      const status =
        String(row[7] || "").trim();

      // Bukan pesan untuk siswa ini
      if (
        targetSiswaId !==
        String(siswaId).trim()
      ) {
        continue;
      }

      // Status tidak aktif
      if (
        status.toLowerCase() !==
        "aktif"
      ) {
        continue;
      }

      const expiryDate =
        new Date(kedaluwarsa);

      // Pesan sudah expired
      if (
        Number.isNaN(
          expiryDate.getTime()
        )
      ) {
        continue;
      }

      if (
        expiryDate <= now
      ) {
        continue;
      }

      inbox.push({

        id,

        judul,

        pesan,

        dibuat,

        kedaluwarsa,

        admin

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
  catch (error) {

    console.error(
      "STUDENT INBOX ERROR:",
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
          "Gagal mengambil inbox.",

        error:
          error.message

      })

    };

  }

};
