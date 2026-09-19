const { google } = require("googleapis");

exports.handler = async (event) => {
  // Hanya menerima POST
  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {
    const { nisn, password } = JSON.parse(event.body || "{}");

    if (!nisn || !password) {
      return response(400, {
        success: false,
        message: "NISN dan password wajib diisi"
      });
    }

    // =========================
    // GOOGLE SHEETS AUTH
    // =========================

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // =========================
    // AMBIL DATA SISWA
    // =========================

    const siswaResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Siswa!A:F"
    });

    const siswaRows = siswaResult.data.values || [];

    // =========================
    // CARI SISWA BERDASARKAN NISN
    // =========================

    let siswa = null;
    let siswaRowNumber = null;

    for (let i = 1; i < siswaRows.length; i++) {
      const row = siswaRows[i];

      const id = row[0] || "";
      const rowNisn = row[1] || "";
      const nama = row[2] || "";
      const kelasId = row[3] || "";
      const rowPassword = row[4] || "";
      const status = row[5] || "";

      if (String(rowNisn) === String(nisn)) {
        siswa = {
          id,
          nisn: rowNisn,
          nama,
          kelasId,
          password: rowPassword,
          status
        };

        siswaRowNumber = i + 1;
        break;
      }
    }

    // =========================
    // NISN TIDAK DITEMUKAN
    // =========================

    if (!siswa) {
      return response(401, {
        success: false,
        message: "NISN atau password salah"
      });
    }

    // =========================
    // CEK STATUS SISWA
    // =========================

    if (String(siswa.status).toLowerCase() !== "aktif") {
      return response(403, {
        success: false,
        message: "Akun siswa tidak aktif"
      });
    }

    // =========================
    // AMBIL LOGIN CONTROL
    // =========================

    const loginControlResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Login_Control!A:C"
    });

    const loginRows = loginControlResult.data.values || [];

    let loginRowNumber = null;
    let failedAttempts = 0;
    let lockedUntil = "";

    for (let i = 1; i < loginRows.length; i++) {
      const row = loginRows[i];

      const rowNisn = row[0] || "";

      if (String(rowNisn) === String(nisn)) {
        loginRowNumber = i + 1;
        failedAttempts = parseInt(row[1] || "0", 10);
        lockedUntil = row[2] || "";
        break;
      }
    }

    // =========================
    // CEK LOCK
    // =========================

    if (lockedUntil) {
      const lockedTime = new Date(lockedUntil);
      const now = new Date();

      if (lockedTime > now) {
        const remainingSeconds = Math.ceil(
          (lockedTime - now) / 1000
        );

        const remainingMinutes = Math.ceil(
          remainingSeconds / 60
        );

        return response(429, {
          success: false,
          message: `Terlalu banyak percobaan. Coba lagi dalam ${remainingMinutes} menit.`
        });
      }

      // Masa lock sudah habis
      failedAttempts = 0;
      lockedUntil = "";
    }

    // =========================
    // CEK PASSWORD
    // =========================

    if (String(siswa.password) !== String(password)) {
      failedAttempts++;

      // =========================
      // GAGAL 3 KALI
      // =========================

      if (failedAttempts >= 3) {
        const lockUntilDate = new Date(
          Date.now() + 5 * 60 * 1000
        );

        lockedUntil = lockUntilDate.toISOString();
        failedAttempts = 3;
      }

      // =========================
      // UPDATE LOGIN CONTROL
      // =========================

      if (loginRowNumber) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Login_Control!A${loginRowNumber}:C${loginRowNumber}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [[
              nisn,
              failedAttempts,
              lockedUntil
            ]]
          }
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Login_Control!A:C",
          valueInputOption: "RAW",
          requestBody: {
            values: [[
              nisn,
              failedAttempts,
              lockedUntil
            ]]
          }
        });
      }

      if (failedAttempts >= 3) {
        return response(429, {
          success: false,
          message: "Gagal 3 kali. Login dikunci selama 5 menit."
        });
      }

      return response(401, {
        success: false,
        message: `NISN atau password salah. Percobaan ${failedAttempts}/3.`
      });
    }

    // =========================
    // LOGIN BERHASIL
    // =========================

    if (loginRowNumber) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Login_Control!A${loginRowNumber}:C${loginRowNumber}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[
            nisn,
            0,
            ""
          ]]
        }
      });
    }

    return response(200, {
      success: true,
      message: "Login berhasil",
      siswa: {
        id: siswa.id,
        nisn: siswa.nisn,
        nama: siswa.nama,
        kelasId: siswa.kelasId
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return response(500, {
      success: false,
      message: "Terjadi kesalahan pada server"
    });
  }
};


// =========================
// RESPONSE HELPER
// =========================

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
