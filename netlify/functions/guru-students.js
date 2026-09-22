const { google } = require("googleapis");

exports.handler = async function (event) {

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        message: "Method tidak diizinkan."
      })
    };
  }

  try {

    const auth = new google.auth.GoogleAuth({
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

    const sheets =
      google.sheets({
        version: "v4",
        auth
      });

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // =========================
    // AMBIL DATA KELAS
    // =========================

    const kelasResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Kelas!A:E"
      });

    const kelasRows =
      kelasResponse.data.values || [];

    const kelasMap = {};

    kelasRows
      .slice(1)
      .forEach(row => {

        const id =
          String(row[0] || "").trim();

        const nama =
          String(row[1] || "").trim();

        const status =
          String(row[4] || "").trim();

        if (
          id &&
          nama &&
          status.toLowerCase() !== "nonaktif"
        ) {
          kelasMap[id] = nama;
        }

      });

    // =========================
    // AMBIL DATA SISWA
    // =========================

    const siswaResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Siswa!A:F"
      });

    const siswaRows =
      siswaResponse.data.values || [];

    // =========================
    // AMBIL DATA POIN
    // =========================

    const poinResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Poin!A:H"
      });

    const poinRows =
      poinResponse.data.values || [];

    // =========================
    // HITUNG POIN
    // =========================

    const poinMap = {};

    poinRows
      .slice(1)
      .forEach(row => {

        const siswaId =
          String(row[1] || "").trim();

        const jenis =
          String(row[2] || "")
            .trim()
            .toLowerCase();

        const nilai =
          Number(row[3] || 0);

        if (!siswaId) {
          return;
        }

        if (!poinMap[siswaId]) {

          poinMap[siswaId] = {
            penghargaan: 0,
            pelanggaran: 0
          };

        }

        if (jenis === "penghargaan") {

          poinMap[siswaId].penghargaan +=
            nilai;

        }

        if (jenis === "pelanggaran") {

          poinMap[siswaId].pelanggaran +=
            nilai;

        }

      });

    // =========================
    // GABUNGKAN DATA
    // =========================

    const siswa = [];

    siswaRows
      .slice(1)
      .forEach(row => {

        const id =
          String(row[0] || "").trim();

        const nisn =
          String(row[1] || "").trim();

        const nama =
          String(row[2] || "").trim();

        const kelasId =
          String(row[3] || "").trim();

        const status =
          String(row[5] || "").trim();

        // Guru hanya melihat siswa aktif
        if (
          !id ||
          !nama ||
          status.toLowerCase() !== "aktif"
        ) {
          return;
        }

        const poin =
          poinMap[id] || {
            penghargaan: 0,
            pelanggaran: 0
          };

        siswa.push({

          id,

          nisn,

          nama,

          kelasId,

          kelas:
            kelasMap[kelasId] || "-",

          penghargaan:
            poin.penghargaan,

          pelanggaran:
            poin.pelanggaran,

          total:
            poin.penghargaan -
            poin.pelanggaran

        });

      });

    // =========================
    // URUTKAN NAMA
    // =========================

    siswa.sort((a, b) =>
      a.nama.localeCompare(
        b.nama,
        "id"
      )
    );

    return {

      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        success: true,

        siswa

      })

    };

  }
  catch (error) {

    console.error(
      "GURU STUDENTS ERROR:",
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
          "Gagal mengambil data siswa."

      })

    };

  }

};
