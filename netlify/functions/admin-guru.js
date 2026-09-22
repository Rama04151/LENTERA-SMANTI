const { google } = require("googleapis");

function getSheets() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    .replace(/\\n/g, "\n")
    .replace(/^"|"$/g, "");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

function response(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(data),
  };
}

function normalizeStatus(status) {
  return String(status || "Aktif").trim() === "Nonaktif"
    ? "Nonaktif"
    : "Aktif";
}

exports.handler = async (event) => {
  try {
    const sheets = getSheets();

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return response(500, {
        error: "GOOGLE_SHEET_ID belum dikonfigurasi.",
      });
    }

    const method = event.httpMethod;

    /*
    ============================================================
    GET
    Mengambil seluruh akun Guru
    ============================================================
    */

    if (method === "GET") {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Guru!A:E",
      });

      const rows = result.data.values || [];

      const guru = rows
        .slice(1)
        .filter((row) => row[0])
        .map((row) => ({
          id: String(row[0] || "").trim(),
          username: String(row[1] || "").trim(),
          nama: String(row[3] || "").trim(),
          status: normalizeStatus(row[4]),
        }));

      return response(200, {
        success: true,
        guru,
      });
    }

    /*
    ============================================================
    POST
    Menambahkan akun Guru baru
    ============================================================
    */

    if (method === "POST") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, {
          error: "Format JSON tidak valid.",
        });
      }

      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const nama = String(body.nama || "").trim();
      const status = normalizeStatus(body.status);

      if (!username) {
        return response(400, {
          error: "Username wajib diisi.",
        });
      }

      if (!password) {
        return response(400, {
          error: "Password wajib diisi.",
        });
      }

      if (!nama) {
        return response(400, {
          error: "Nama guru wajib diisi.",
        });
      }

      if (password.length < 4) {
        return response(400, {
          error: "Password minimal 4 karakter.",
        });
      }

      /*
      ------------------------------------------------------------
      Cek username agar tidak duplikat
      ------------------------------------------------------------
      */

      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Guru!A:E",
      });

      const rows = existing.data.values || [];

      const usernameExists = rows
        .slice(1)
        .some(
          (row) =>
            String(row[1] || "")
              .trim()
              .toLowerCase() === username.toLowerCase()
        );

      if (usernameExists) {
        return response(409, {
          error: "Username guru tersebut sudah digunakan.",
        });
      }

      /*
      ------------------------------------------------------------
      Generate ID otomatis
      Format:
      G001
      G002
      G003
      dst.
      ------------------------------------------------------------
      */

      let maxNumber = 0;

      rows.slice(1).forEach((row) => {
        const id = String(row[0] || "").trim();

        const match = id.match(/^G(\d+)$/i);

        if (match) {
          const number = Number(match[1]);

          if (Number.isFinite(number) && number > maxNumber) {
            maxNumber = number;
          }
        }
      });

      const guruId =
        "G" +
        String(maxNumber + 1).padStart(3, "0");

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Guru!A:E",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [
            [
              guruId,
              username,
              password,
              nama,
              status,
            ],
          ],
        },
      });

      return response(201, {
        success: true,
        message: "Akun guru berhasil ditambahkan.",
        guru: {
          id: guruId,
          username,
          nama,
          status,
        },
      });
    }

    /*
    ============================================================
    PUT
    Edit akun Guru
    - Nama
    - Password
    - Status
    ============================================================
    */

    if (method === "PUT") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, {
          error: "Format JSON tidak valid.",
        });
      }

      const id = String(body.id || "").trim();

      if (!id) {
        return response(400, {
          error: "ID guru wajib diisi.",
        });
      }

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Guru!A:E",
      });

      const rows = result.data.values || [];

      const rowIndex = rows.findIndex(
        (row, index) =>
          index > 0 &&
          String(row[0] || "").trim() === id
      );

      if (rowIndex === -1) {
        return response(404, {
          error: "Akun guru tidak ditemukan.",
        });
      }

      const rowNumber = rowIndex + 1;

      const oldRow = rows[rowIndex];

      const oldUsername =
        String(oldRow[1] || "").trim();

      const oldPassword =
        String(oldRow[2] || "");

      const oldNama =
        String(oldRow[3] || "").trim();

      const oldStatus =
        normalizeStatus(oldRow[4]);

      const nama =
        body.nama !== undefined
          ? String(body.nama || "").trim()
          : oldNama;

      const password =
        body.password !== undefined
          ? String(body.password || "")
          : oldPassword;

      const status =
        body.status !== undefined
          ? normalizeStatus(body.status)
          : oldStatus;

      if (!nama) {
        return response(400, {
          error: "Nama guru tidak boleh kosong.",
        });
      }

      if (!password) {
        return response(400, {
          error: "Password tidak boleh kosong.",
        });
      }

      if (body.password !== undefined && password.length < 4) {
        return response(400, {
          error: "Password minimal 4 karakter.",
        });
      }

      /*
      ------------------------------------------------------------
      Username sengaja tidak diubah.
      Username menjadi identitas pembuat poin Guru.
      ------------------------------------------------------------
      */

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Guru!C${rowNumber}:E${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              password,
              nama,
              status,
            ],
          ],
        },
      });

      return response(200, {
        success: true,
        message: "Akun guru berhasil diperbarui.",
        guru: {
          id,
          username: oldUsername,
          nama,
          status,
        },
      });
    }

    /*
    ============================================================
    DELETE
    Menghapus akun Guru
    ============================================================
    */

    if (method === "DELETE") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, {
          error: "Format JSON tidak valid.",
        });
      }

      const id = String(body.id || "").trim();

      if (!id) {
        return response(400, {
          error: "ID guru wajib diisi.",
        });
      }

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Guru!A:E",
      });

      const rows = result.data.values || [];

      const rowIndex = rows.findIndex(
        (row, index) =>
          index > 0 &&
          String(row[0] || "").trim() === id
      );

      if (rowIndex === -1) {
        return response(404, {
          error: "Akun guru tidak ditemukan.",
        });
      }

      const rowNumber = rowIndex + 1;

      const username =
        String(rows[rowIndex][1] || "").trim();

      /*
      ------------------------------------------------------------
      Hapus seluruh baris menggunakan deleteDimension.
      ------------------------------------------------------------
      */

      const spreadsheetInfo =
        await sheets.spreadsheets.get({
          spreadsheetId,
          fields: "sheets.properties",
        });

      const guruSheet =
        (spreadsheetInfo.data.sheets || []).find(
          (sheet) =>
            sheet.properties &&
            sheet.properties.title === "Guru"
        );

      if (!guruSheet) {
        return response(500, {
          error: "Sheet Guru tidak ditemukan.",
        });
      }

      const sheetId =
        guruSheet.properties.sheetId;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber,
                },
              },
            },
          ],
        },
      });

      return response(200, {
        success: true,
        message:
          `Akun @${username} berhasil dihapus.`,
      });
    }

    return response(405, {
      error: "Method tidak diizinkan.",
    });

  } catch (error) {
    console.error("ADMIN GURU ERROR:", error);

    return response(500, {
      error:
        error.message ||
        "Terjadi kesalahan pada server.",
    });
  }
};
