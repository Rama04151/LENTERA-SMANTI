const { google } = require("googleapis");

async function getSheets() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    .replace(/\\n/g, "\n")
    .replace(/^"|"$/g, "");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
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
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // =========================
    // GET — DATA SISWA
    // =========================

    if (event.httpMethod === "GET") {

      const [siswaResult, kelasResult] =
        await Promise.all([
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Siswa!A:F"
          }),

          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Kelas!A:E"
          })
        ]);

      const siswaRows =
        siswaResult.data.values || [];

      const kelasRows =
        kelasResult.data.values || [];

      const kelasMap = {};

      for (let i = 1; i < kelasRows.length; i++) {

        const row = kelasRows[i];

        const id = String(row[0] || "").trim();
        const nama = String(row[1] || "").trim();

        if (id) {
          kelasMap[id] = nama;
        }
      }

      const siswa = [];

      for (let i = 1; i < siswaRows.length; i++) {

        const row = siswaRows[i];

        siswa.push({
          id: String(row[0] || "").trim(),
          nisn: String(row[1] || "").trim(),
          nama: String(row[2] || "").trim(),
          kelasId: String(row[3] || "").trim(),
          kelas: kelasMap[
            String(row[3] || "").trim()
          ] || "-",
          status: String(row[5] || "").trim()
        });
      }

      return response(200, {
        success: true,
        siswa
      });
    }

    // =========================
    // POST — TAMBAH SISWA
    // =========================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(event.body || "{}");

      const {
        nisn,
        nama,
        kelasId,
        password
      } = body;

      if (
        !nisn ||
        !nama ||
        !kelasId ||
        !password
      ) {
        return response(400, {
          success: false,
          message:
            "NISN, nama, kelas, dan password wajib diisi."
        });
      }

      // Cek apakah NISN sudah ada
      const existing =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Siswa!A:F"
        });

      const rows =
        existing.data.values || [];

      for (let i = 1; i < rows.length; i++) {

        if (
          String(rows[i][1] || "").trim() ===
          String(nisn).trim()
        ) {
          return response(409, {
            success: false,
            message: "NISN sudah terdaftar."
          });
        }
      }

      // Buat ID otomatis
      const id =
        "S" +
        String(Date.now()).slice(-6);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Siswa!A:F",
        valueInputOption: "RAW",
        requestBody: {
          values: [[
            id,
            nisn,
            nama,
            kelasId,
            password,
            "Aktif"
          ]]
        }
      });

      return response(201, {
        success: true,
        message: "Siswa berhasil ditambahkan.",
        siswa: {
          id,
          nisn,
          nama,
          kelasId,
          status: "Aktif"
        }
      });
    }

    // =========================
    // PUT — EDIT SISWA
    // =========================

    if (event.httpMethod === "PUT") {

      const body =
        JSON.parse(event.body || "{}");

      const {
        id,
        nisn,
        nama,
        kelasId,
        password,
        status
      } = body;

      if (!id) {
        return response(400, {
          success: false,
          message: "ID siswa wajib diisi."
        });
      }

      const result =
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Siswa!A:F"
        });

      const rows =
        result.data.values || [];

      let rowNumber = null;

      for (let i = 1; i < rows.length; i++) {

        if (
          String(rows[i][0] || "").trim() ===
          String(id).trim()
        ) {
          rowNumber = i + 1;
          break;
        }
      }

      if (!rowNumber) {
        return response(404, {
          success: false,
          message: "Siswa tidak ditemukan."
        });
      }

      const oldRow = rows[rowNumber - 1];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Siswa!A${rowNumber}:F${rowNumber}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[
            id,
            nisn ?? oldRow[1] ?? "",
            nama ?? oldRow[2] ?? "",
            kelasId ?? oldRow[3] ?? "",
            password ?? oldRow[4] ?? "",
            status ?? oldRow[5] ?? "Aktif"
          ]]
        }
      });

      return response(200, {
        success: true,
        message: "Data siswa berhasil diperbarui."
      });
    }

    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });

  } catch (error) {

    console.error(
      "ADMIN STUDENTS ERROR:",
      error
    );

    return response(500, {
      success: false,
      message: "Terjadi kesalahan pada server."
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
