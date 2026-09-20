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

      const action =
  body.action || "";

      // =========================
// IMPORT SISWA MASSAL
// =========================

if (action === "import_students") {

  try {

    const siswaList =
      Array.isArray(body.siswa)
        ? body.siswa
        : [];


    if (siswaList.length === 0) {

      return response(400, {
        success: false,
        message:
          "Data siswa untuk import kosong."
      });

    }


    // =========================
    // BACA SISWA LAMA
    // =========================

    const siswaResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Siswa!A:F"
      });

    const siswaRows =
      siswaResult.data.values || [];


    const nisnLama =
      new Set();

    for (
      let i = 1;
      i < siswaRows.length;
      i++
    ) {

      const nisn =
        String(
          siswaRows[i][1] || ""
        ).trim();

      if (nisn) {
        nisnLama.add(nisn);
      }

    }


    // =========================
    // BACA KELAS
    // =========================

    const kelasResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Kelas!A:E"
      });

    const kelasRows =
      kelasResult.data.values || [];


    const kelasMap =
      new Map();

    for (
      let i = 1;
      i < kelasRows.length;
      i++
    ) {

      const id =
        String(
          kelasRows[i][0] || ""
        ).trim();

      const namaKelas =
        String(
          kelasRows[i][1] || ""
        ).trim();

      const status =
        String(
          kelasRows[i][4] || ""
        ).trim()
          .toLowerCase();


      if (
        id &&
        namaKelas &&
        status === "aktif"
      ) {

        kelasMap.set(
          id,
          namaKelas
        );

      }

    }


    // =========================
    // VALIDASI
    // =========================

    const berhasil = [];

    const gagal = [];

    const nisnDalamImport =
      new Set();


    for (
      let i = 0;
      i < siswaList.length;
      i++
    ) {

      const data =
        siswaList[i] || {};


      const nisn =
        String(
          data.nisn || ""
        ).trim();

      const nama =
        String(
          data.nama || ""
        ).trim();

      const kelasId =
        String(
          data.kelasId || ""
        ).trim();

      const password =
        String(
          data.password || ""
        ).trim();


      // =========================
      // DATA KOSONG
      // =========================

      if (
        !nisn ||
        !nama ||
        !kelasId ||
        !password
      ) {

        gagal.push({

          baris: i + 2,

          nisn,

          nama,

          alasan:
            "NISN, nama, kelas, dan password wajib diisi."

        });

        continue;

      }


      // =========================
      // NISN DUPLIKAT DATABASE
      // =========================

      if (
        nisnLama.has(nisn)
      ) {

        gagal.push({

          baris: i + 2,

          nisn,

          nama,

          alasan:
            "NISN sudah terdaftar."

        });

        continue;

      }


      // =========================
      // NISN DUPLIKAT FILE
      // =========================

      if (
        nisnDalamImport.has(nisn)
      ) {

        gagal.push({

          baris: i + 2,

          nisn,

          nama,

          alasan:
            "NISN duplikat di file import."

        });

        continue;

      }


      // =========================
      // KELAS TIDAK VALID
      // =========================

      if (
        !kelasMap.has(kelasId)
      ) {

        gagal.push({

          baris: i + 2,

          nisn,

          nama,

          alasan:
            "Kelas tidak ditemukan atau tidak aktif."

        });

        continue;

      }


      nisnDalamImport.add(
        nisn
      );


      const id =
        "S" +
        String(
          Date.now()
        ).slice(-6) +
        String(
          i
        ).padStart(2, "0");


      berhasil.push([

        id,

        nisn,

        nama,

        kelasId,

        password,

        "Aktif"

      ]);

    }


    // =========================
    // SIMPAN MASSAL
    // =========================

    if (
      berhasil.length > 0
    ) {

      await sheets.spreadsheets.values.append({

        spreadsheetId,

        range: "Siswa!A:F",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {

          values:
            berhasil

        }

      });

    }


    return response(200, {

      success: true,

      message:
        `${berhasil.length} siswa berhasil diimport.`,

      berhasil:
        berhasil.length,

      gagal:
        gagal.length,

      detailGagal:
        gagal

    });


  } catch (error) {

    console.error(
      "IMPORT STUDENTS ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Import siswa gagal."

    });

  }

}

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

    // =========================
// DELETE — HAPUS SISWA + POIN
// =========================

if (event.httpMethod === "DELETE") {

  try {

    const body =
      JSON.parse(event.body || "{}");

    const id =
      String(body.id || "").trim();

    if (!id) {

      return response(400, {
        success: false,
        message: "ID siswa wajib diisi."
      });

    }

    // =========================
    // 1. BACA DATA SISWA
    // =========================

    const siswaResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Siswa!A:F"
      });

    const siswaRows =
      siswaResult.data.values || [];

    let siswaRowNumber = -1;

    for (
      let i = 1;
      i < siswaRows.length;
      i++
    ) {

      const siswaId =
        String(
          siswaRows[i][0] || ""
        ).trim();

      if (siswaId === id) {

        siswaRowNumber = i + 1;

        break;
      }
    }

    if (siswaRowNumber === -1) {

      return response(404, {
        success: false,
        message: "Siswa tidak ditemukan."
      });

    }

    // =========================
    // 2. BACA DATA POIN
    // =========================

    const poinResult =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Poin!A:G"
      });

    const poinRows =
      poinResult.data.values || [];

    const poinRowsToDelete = [];

    for (
      let i = 1;
      i < poinRows.length;
      i++
    ) {

      const siswaIdPoin =
        String(
          poinRows[i][1] || ""
        ).trim();

      if (siswaIdPoin === id) {

        poinRowsToDelete.push(i + 1);

      }
    }

    // =========================
    // 3. HAPUS DATA POIN
    // =========================

    for (
      let i = poinRowsToDelete.length - 1;
      i >= 0;
      i--
    ) {

      const rowNumber =
        poinRowsToDelete[i];

      await sheets.spreadsheets.values.clear({

        spreadsheetId,

        range:
          `Poin!A${rowNumber}:G${rowNumber}`

      });

    }

    // =========================
    // 4. HAPUS DATA SISWA
    // =========================

    await sheets.spreadsheets.values.clear({

      spreadsheetId,

      range:
        `Siswa!A${siswaRowNumber}:F${siswaRowNumber}`

    });

    return response(200, {

      success: true,

      message:
        "Siswa dan seluruh poin siswa berhasil dihapus.",

      poinTerhapus:
        poinRowsToDelete.length

    });

  } catch (error) {

    console.error(
      "DELETE STUDENT ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Gagal menghapus siswa dan poin."

    });

  }

}

        // =========================
    // PATCH — STATUS / PASSWORD
    // =========================

  
    if (event.httpMethod === "PATCH") {

      const body =
        JSON.parse(event.body || "{}");

      const {
        id,
        action,
        password
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

      const oldRow =
        rows[rowNumber - 1];

      // =========================
      // NONAKTIFKAN
      // =========================

      if (action === "toggle_status") {

        const oldStatus =
          String(oldRow[5] || "")
            .trim()
            .toLowerCase();

        const newStatus =
          oldStatus === "aktif"
            ? "Nonaktif"
            : "Aktif";

        await sheets.spreadsheets.values.update({
          spreadsheetId,

          range:
            `Siswa!F${rowNumber}`,

          valueInputOption: "RAW",

          requestBody: {
            values: [[newStatus]]
          }
        });

        return response(200, {
          success: true,
          message:
            `Status siswa diubah menjadi ${newStatus}.`,
          status: newStatus
        });
      }

      // =========================
      // RESET PASSWORD
      // =========================

      if (action === "reset_password") {

        if (!password) {
          return response(400, {
            success: false,
            message:
              "Password baru wajib diisi."
          });
        }

        await sheets.spreadsheets.values.update({
          spreadsheetId,

          range:
            `Siswa!E${rowNumber}`,

          valueInputOption: "RAW",

          requestBody: {
            values: [[password]]
          }
        });

        return response(200, {
          success: true,
          message:
            "Password berhasil direset."
        });
      }

            // =========================
      // PINDAHKAN SISWA
      // =========================

      if (action === "move_student") {

        const {
          kelasId,
          alasan,
          admin
        } = body;

        if (!kelasId) {
          return response(400, {
            success: false,
            message: "Kelas tujuan wajib dipilih."
          });
        }

        const siswaId =
          String(id).trim();

        const tujuanKelasId =
          String(kelasId).trim();

        const kelasSekarangId =
          String(oldRow[3] || "").trim();

        // Tidak boleh pindah ke kelas yang sama
        if (
          kelasSekarangId === tujuanKelasId
        ) {
          return response(400, {
            success: false,
            message:
              "Siswa sudah berada di kelas tersebut."
          });
        }

        // Ambil data kelas
        const kelasResult =
          await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Kelas!A:E"
          });

        const kelasRows =
          kelasResult.data.values || [];

        let kelasSekarang = "-";
        let kelasTujuan = "-";

        for (
          let i = 1;
          i < kelasRows.length;
          i++
        ) {

          const kelasRow =
            kelasRows[i];

          const kelasIdRow =
            String(
              kelasRow[0] || ""
            ).trim();

          const namaKelas =
            String(
              kelasRow[1] || ""
            ).trim();

          if (
            kelasIdRow ===
            kelasSekarangId
          ) {
            kelasSekarang =
              namaKelas;
          }

          if (
            kelasIdRow ===
            tujuanKelasId
          ) {
            kelasTujuan =
              namaKelas;
          }
        }

        // Pastikan kelas tujuan valid
        if (kelasTujuan === "-") {
          return response(400, {
            success: false,
            message:
              "Kelas tujuan tidak ditemukan."
          });
        }

        // =========================
        // 1. UBAH KELAS SISWA
        // =========================

        await sheets.spreadsheets.values.update({
          spreadsheetId,

          range:
            `Siswa!D${rowNumber}`,

          valueInputOption: "RAW",

          requestBody: {
            values: [[tujuanKelasId]]
          }
        });

        // =========================
        // 2. ID RIWAYAT
        // =========================

        const historyId =
          "RK" +
          String(Date.now()).slice(-8);

        // =========================
        // 3. TANGGAL
        // =========================

        const now =
          new Date();

        const tanggal =
          String(
            now.getDate()
          ).padStart(2, "0") +
          "/" +
          String(
            now.getMonth() + 1
          ).padStart(2, "0") +
          "/" +
          now.getFullYear();

        // =========================
        // 4. SIMPAN RIWAYAT
        // =========================

        await sheets.spreadsheets.values.append({
          spreadsheetId,

          range:
            "Riwayat_Kelas!A:G",

          valueInputOption: "RAW",

          requestBody: {
            values: [[
              historyId,
              siswaId,
              kelasSekarangId,
              tujuanKelasId,
              alasan || "",
              tanggal,
              admin || ""
            ]]
          }
        });

        return response(200, {
          success: true,

          message:
            `Siswa berhasil dipindahkan dari ${kelasSekarang} ke ${kelasTujuan}.`,

          siswa: {
            id: siswaId,

            dariKelasId:
              kelasSekarangId,

            dariKelas:
              kelasSekarang,

            keKelasId:
              tujuanKelasId,

            keKelas:
              kelasTujuan
          }
        });
      }


      return response(400, {
        success: false,
        message: "Action tidak dikenali."
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
