const { google } = require("googleapis");

exports.handler = async function (event) {

  // =========================
  // HANYA GET
  // =========================
  if (event.httpMethod !== "GET") {
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
    // AMBIL SEMUA DATA SEKALIGUS
    // =========================
    const response =
      await sheets.spreadsheets.values.batchGet({

        spreadsheetId,

        ranges: [
          "Kelas!A:E",
          "Siswa!A:F",
          "Poin!A:G"
        ]

      });


    const valueRanges =
      response.data.valueRanges || [];


    const kelasRows =
      valueRanges[0]?.values || [];

    const siswaRows =
      valueRanges[1]?.values || [];

    const poinRows =
      valueRanges[2]?.values || [];


    // =========================
    // MAP TOTAL POIN SISWA
    // =========================
    const poinMap = {};


    for (let i = 1; i < poinRows.length; i++) {

      const row = poinRows[i];

      const siswaId =
        String(row[1] || "").trim();

      const jenis =
        String(row[2] || "")
          .trim()
          .toLowerCase();

      const nilai =
        Number(row[3] || 0);


      if (!siswaId) {
        continue;
      }


      if (!poinMap[siswaId]) {

        poinMap[siswaId] = {

          penghargaan: 0,

          pelanggaran: 0

        };

      }


      if (jenis === "penghargaan") {

        poinMap[siswaId].penghargaan += nilai;

      }

      else if (jenis === "pelanggaran") {

        poinMap[siswaId].pelanggaran += nilai;

      }

    }


    // =========================
    // MAP NAMA KELAS
    // =========================
    const kelasMap = {};


    for (let i = 1; i < kelasRows.length; i++) {

      const row = kelasRows[i];

      const id =
        String(row[0] || "").trim();

      const nama =
        String(row[1] || "").trim();

      const tingkat =
        String(row[2] || "").trim();

      const status =
        String(row[4] || "").trim();


      if (!id) {
        continue;
      }


      kelasMap[id] = {

        id,

        nama,

        tingkat,

        status

      };

    }


    // =========================
    // BUAT DATA SISWA
    // =========================
    const siswaPerKelas = {};


    for (let i = 1; i < siswaRows.length; i++) {

      const row = siswaRows[i];

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


      // Hanya siswa aktif
      if (status !== "Aktif") {
        continue;
      }


      if (!kelasId) {
        continue;
      }


      if (!siswaPerKelas[kelasId]) {

        siswaPerKelas[kelasId] = [];

      }


      const poin =
        poinMap[id] || {

          penghargaan: 0,

          pelanggaran: 0

        };


      const total =
        poin.penghargaan -
        poin.pelanggaran;


      siswaPerKelas[kelasId].push({

        id,

        nisn,

        nama,

        penghargaan:
          poin.penghargaan,

        pelanggaran:
          poin.pelanggaran,

        total

      });

    }


    // =========================
    // BUAT HASIL KELAS
    // =========================
    const kelas = [];


    Object.values(kelasMap).forEach(k => {

      const siswa =
        siswaPerKelas[k.id] || [];


      kelas.push({

        id: k.id,

        nama: k.nama,

        tingkat: k.tingkat,

        status: k.status,

        jumlahSiswa:
          siswa.length,

        siswa

      });

    });


    // =========================
    // RESPONSE
    // =========================
    return {

      statusCode: 200,

      headers: {

        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store"

      },

      body: JSON.stringify({

        success: true,

        kelas

      })

    };

  }

  catch (error) {

    console.error(
      "ADMIN CLASSES ERROR:",
      error
    );

    return {

      statusCode: 500,

      headers: {

        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store"

      },

      body: JSON.stringify({

        success: false,

        message:
          "Gagal mengambil data kelas.",

        error:
          error.message

      })

    };

  }

};
