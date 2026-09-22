const { google } = require("googleapis");

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY
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
      "Content-Type": "application/json"
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      success: false,
      message
    })
  };
}

async function getGuru(sheets, spreadsheetId, guruId, guruUsername) {

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Guru!A:E"
    });

  const rows =
    response.data.values || [];

  for (const row of rows.slice(1)) {

    const id =
      String(row[0] || "").trim();

    const username =
      String(row[1] || "").trim();

    const nama =
      String(row[3] || "").trim();

    const status =
      String(row[4] || "").trim();

    if (
      status.toLowerCase() !== "aktif"
    ) {
      continue;
    }

    if (
      (guruId && id === String(guruId).trim()) ||
      (guruUsername &&
        username.toLowerCase() ===
        String(guruUsername).trim().toLowerCase())
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

  return sheet
    ? sheet.properties.sheetId
    : null;
}

exports.handler = async function (event) {

  const sheets = getSheets();

  const spreadsheetId =
    process.env.GOOGLE_SHEET_ID;

  try {

    // =====================================================
    // GET — POIN YANG DIBUAT GURU
    // =====================================================

    if (event.httpMethod === "GET") {

      const params =
        event.queryStringParameters || {};

      const guruId =
        String(params.guruId || "").trim();

      const guruUsername =
        String(params.guruUsername || "").trim();

      if (!guruId && !guruUsername) {
        return error(
          "Identitas guru tidak ditemukan.",
          401
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

      const poinResponse =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Poin!A:H"
        });

      const siswaResponse =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Siswa!A:F"
        });

      const kelasResponse =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Kelas!A:E"
        });

      const poinRows =
        poinResponse.data.values || [];

      const siswaRows =
        siswaResponse.data.values || [];

      const kelasRows =
        kelasResponse.data.values || [];

      const siswaMap = {};
      const kelasMap = {};

      siswaRows
        .slice(1)
        .forEach(row => {

          const id =
            String(row[0] || "").trim();

          if (!id) return;

          siswaMap[id] = {
            nama:
              String(row[2] || "").trim(),

            nisn:
              String(row[1] || "").trim(),

            kelasId:
              String(row[3] || "").trim()
          };
        });

      kelasRows
        .slice(1)
        .forEach(row => {

          const id =
            String(row[0] || "").trim();

          const nama =
            String(row[1] || "").trim();

          if (id) {
            kelasMap[id] = nama;
          }
        });

      const poinSaya = [];

      poinRows
        .slice(1)
        .forEach(row => {

          const creator =
            String(row[6] || "").trim();

          if (
            creator.toLowerCase() !==
            guru.username.toLowerCase()
          ) {
            return;
          }

          const id =
            String(row[0] || "").trim();

          const siswaId =
            String(row[1] || "").trim();

          const siswa =
            siswaMap[siswaId] || {};

          poinSaya.push({

            id,

            siswaId,

            siswaNama:
              siswa.nama || "-",

            siswaNisn:
              siswa.nisn || "-",

            siswaKelas:
              kelasMap[siswa.kelasId] || "-",

            jenis:
              String(row[2] || "").trim(),

            poin:
              Number(row[3] || 0),

            keterangan:
              String(row[4] || "").trim(),

            tanggal:
              String(row[5] || "").trim(),

            guruUsername:
              guru.username
          });

        });

      poinSaya.sort(
        (a, b) =>
          new Date(b.tanggal) -
          new Date(a.tanggal)
      );

      return success({
        guru: {
          id: guru.id,
          username: guru.username,
          nama: guru.nama
        },
        poin: poinSaya
      });
    }

    // =====================================================
    // POST — TAMBAH POIN
    // =====================================================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(event.body || "{}");

      const siswaId =
        String(body.siswaId || "").trim();

      const poin =
        Number(body.poin);

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
        return error("Siswa belum dipilih.");
      }

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {
        return error(
          "Poin harus berupa angka 1 sampai 100."
        );
      }

      if (!keterangan) {
        return error(
          "Keterangan wajib diisi."
        );
      }

      if (
        jenis !== "penghargaan" &&
        jenis !== "pelanggaran"
      ) {
        return error(
          "Jenis poin tidak valid."
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

      const pointId =
        "P" + Date.now();

      // Simpan tanggal lokal Indonesia
      const tanggal =
        new Intl.DateTimeFormat(
          "sv-SE",
          {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }
        ).format(new Date());

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
            guru.username,
            "Guru"
          ]]
        }
      });

      return success({
        message: "Poin berhasil ditambahkan."
      });
    }

    // =====================================================
    // PUT — EDIT POIN SENDIRI
    // =====================================================

    if (event.httpMethod === "PUT") {

      const body =
        JSON.parse(event.body || "{}");

      const pointId =
        String(body.id || "").trim();

      const siswaId =
        String(body.siswaId || "").trim();

      const jenis =
        String(body.jenis || "")
          .trim()
          .toLowerCase();

      const poin =
        Number(body.poin);

      const keterangan =
        String(body.keterangan || "").trim();

      const guruId =
        String(body.guruId || "").trim();

      const guruUsername =
        String(body.guruUsername || "").trim();

      if (!pointId) {
        return error(
          "ID poin tidak ditemukan."
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

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {
        return error(
          "Poin harus berupa angka 1 sampai 100."
        );
      }

      if (!keterangan) {
        return error(
          "Keterangan wajib diisi."
        );
      }

      if (
        jenis !== "penghargaan" &&
        jenis !== "pelanggaran"
      ) {
        return error(
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

      let rowNumber = -1;

      for (
        let i = 1;
        i < rows.length;
        i++
      ) {

        const id =
          String(rows[i][0] || "").trim();

        const creator =
          String(rows[i][6] || "").trim();

        if (
          id === pointId &&
          creator.toLowerCase() ===
          guru.username.toLowerCase()
        ) {
          rowNumber = i + 1;
          break;
        }
      }

      if (rowNumber === -1) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Poin!B${rowNumber}:E${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[
            siswaId,
            jenis,
            poin,
            keterangan
          ]]
        }
      });

      return success({
        message: "Poin berhasil diperbarui."
      });
    }

    // =====================================================
    // DELETE — HAPUS POIN SENDIRI
    // =====================================================

    if (event.httpMethod === "DELETE") {

      const body =
        JSON.parse(event.body || "{}");

      const pointId =
        String(body.id || "").trim();

      const guruId =
        String(body.guruId || "").trim();

      const guruUsername =
        String(body.guruUsername || "").trim();

      if (!pointId) {
        return error(
          "ID poin tidak ditemukan."
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
          range: "Poin!A:H"
        });

      const rows =
        response.data.values || [];

      let rowNumber = -1;

      for (
        let i = 1;
        i < rows.length;
        i++
      ) {

        const id =
          String(rows[i][0] || "").trim();

        const creator =
          String(rows[i][6] || "").trim();

        if (
          id === pointId &&
          creator.toLowerCase() ===
          guru.username.toLowerCase()
        ) {
          rowNumber = i + 1;
          break;
        }
      }

      if (rowNumber === -1) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      const sheetId =
        await getSheetId(
          sheets,
          spreadsheetId,
          "Poin"
        );

      if (sheetId === null) {
        return error(
          "Sheet Poin tidak ditemukan.",
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
                dimension: "ROWS",
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
        message: "Poin berhasil dihapus."
      });
    }

    return error(
      "Method tidak diizinkan.",
      405
    );

  } catch (err) {

    console.error(
      "GURU POINTS ERROR:",
      err
    );

    return error(
      "Terjadi kesalahan pada server.",
      500
    );
  }
};
