const { google } = require("googleapis");

async function getSheets() {
  const privateKey =
    process.env.GOOGLE_PRIVATE_KEY
      .replace(/\\n/g, "\n")
      .replace(/^"|"$/g, "");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email:
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey
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

exports.handler = async (event) => {

  try {

    const sheets = await getSheets();

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // =========================
    // GET — DATA KELAS
    // =========================

    if (event.httpMethod === "GET") {

      // Ambil data kelas dan siswa bersamaan
      const [kelasResult, siswaResult] =
        await Promise.all([

          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Kelas!A:E"
          }),

          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Siswa!A:F"
          })

        ]);

      const kelasRows =
        kelasResult.data.values || [];

      const siswaRows =
        siswaResult.data.values || [];

      const kelas = [];

      // =========================
      // BACA DATA KELAS
      // =========================

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

        const tingkat =
          String(row[2] || "").trim();

        const tahunAjaranId =
          String(row[3] || "").trim();

        const status =
          String(row[4] || "").trim();

        if (!id) {
          continue;
        }

        // =========================
        // HITUNG JUMLAH SISWA
        // =========================

        // =========================
// DAFTAR SISWA DALAM KELAS
// =========================

let jumlahSiswa = 0;
const siswaDalamKelas = [];

for (
  let j = 1;
  j < siswaRows.length;
  j++
) {

  const siswaId =
    String(siswaRows[j][0] || "").trim();

  const siswaNisn =
    String(siswaRows[j][1] || "").trim();

  const siswaNama =
    String(siswaRows[j][2] || "").trim();

  const siswaKelasId =
    String(siswaRows[j][3] || "").trim();

  const siswaStatus =
    String(siswaRows[j][5] || "")
      .trim()
      .toLowerCase();

  if (
    siswaKelasId === id &&
    siswaStatus === "aktif"
  ) {

    jumlahSiswa++;

    siswaDalamKelas.push({
      id: siswaId,
      nisn: siswaNisn,
      nama: siswaNama,
      status: "Aktif"
    });

  }

}

        kelas.push({

  id,

  nama,

  tingkat,

  tahunAjaranId,

  status,

  jumlahSiswa,

  siswa: siswaDalamKelas

});

      }

      return response(200, {

        success: true,

        kelas

      });

    }

    // =========================
    // METHOD TIDAK DIIZINKAN
    // =========================

    return response(405, {

      success: false,

      message:
        "Method tidak diizinkan."

    });

  } catch (error) {

    console.error(
      "ADMIN CLASSES ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Data kelas gagal dimuat."

    });

  }

};


// =========================
// RESPONSE HELPER
// =========================

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
