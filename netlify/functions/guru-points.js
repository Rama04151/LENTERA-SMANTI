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

    const body = JSON.parse(event.body || "{}");

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

    // =========================
    // VALIDASI
    // =========================

    if (!siswaId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Siswa belum dipilih."
        })
      };
    }

    if (!Number.isFinite(poin) || poin < 1 || poin > 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Poin harus antara 1 sampai 100."
        })
      };
    }

    if (!keterangan) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Keterangan wajib diisi."
        })
      };
    }

    if (keterangan.length > 500) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Keterangan maksimal 500 karakter."
        })
      };
    }

    // Hanya dua jenis yang diperbolehkan
    if (
      jenis !== "penghargaan" &&
      jenis !== "pelanggaran"
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Jenis poin tidak valid."
        })
      };
    }

    if (!guruId || !guruUsername) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          message: "Data akun guru tidak ditemukan."
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
    // ID POIN
    // =========================

    const pointId =
      "P" + Date.now();

    const tanggal =
      new Date().toISOString();

    // =========================
    // SIMPAN KE GOOGLE SHEETS
    // =========================

    await sheets.spreadsheets.values.append({
      spreadsheetId,

      range: "Poin!A:H",

      valueInputOption: "USER_ENTERED",

      insertDataOption: "INSERT_ROWS",

      requestBody: {
        values: [
          [
            pointId,
            siswaId,
            jenis,
            poin,
            keterangan,
            tanggal,
            guruUsername,
            "Guru"
          ]
        ]
      }
    });

    console.log(
      `POIN GURU: ${guruUsername} | ${jenis} | ${poin} | ${siswaId}`
    );

    return {
      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        success: true,

        message:
          jenis === "penghargaan"
            ? "Poin penghargaan berhasil ditambahkan."
            : "Poin pelanggaran berhasil ditambahkan.",

        data: {
          id: pointId,
          siswaId,
          jenis,
          poin,
          keterangan,
          tanggal,
          dibuatOleh: guruUsername,
          peran: "Guru"
        }
      })
    };

  } catch (error) {

    console.error(
      "GURU POINTS ERROR:",
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
          "Gagal menyimpan poin."
      })
    };
  }
};
