const { google } = require("googleapis");

/* =========================================================
   GOOGLE SHEETS
========================================================= */

async function getSheets() {
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

  return google.sheets({
    version: "v4",
    auth
  });
}

/* =========================================================
   BATCH GET
   Beberapa range → 1 Google Sheets API request
========================================================= */

async function batchGet(
  sheets,
  spreadsheetId,
  ranges
) {
  const result =
    await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges
    });

  const valueRanges =
    result.data.valueRanges || [];

  const data = {};

  for (
    let i = 0;
    i < ranges.length;
    i++
  ) {
    data[ranges[i]] =
      valueRanges[i]?.values || [];
  }

  return data;
}

/* =========================================================
   RESPONSE
========================================================= */

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

/* =========================================================
   HANDLER
========================================================= */

exports.handler =
  async (event) => {

    try {

      const sheets =
        await getSheets();

      const spreadsheetId =
        process.env.GOOGLE_SHEET_ID;

      /* ===================================================
         GET — DATA SISWA
         
         SEBELUM:
         Siswa GET
         Kelas GET
         = 2 request

         SEKARANG:
         batchGet
         = 1 request
      =================================================== */

      if (
        event.httpMethod ===
        "GET"
      ) {

        const data =
          await batchGet(
            sheets,
            spreadsheetId,
            [
              "Siswa!A:F",
              "Kelas!A:E"
            ]
          );

        const siswaRows =
          data["Siswa!A:F"] || [];

        const kelasRows =
          data["Kelas!A:E"] || [];

        /* ===============================
           MAP KELAS
        =============================== */

        const kelasMap = {};

        for (
          let i = 1;
          i < kelasRows.length;
          i++
        ) {

          const id =
            String(
              kelasRows[i][0] || ""
            ).trim();

          const nama =
            String(
              kelasRows[i][1] || ""
            ).trim();

          if (id) {
            kelasMap[id] =
              nama;
          }
        }

        /* ===============================
           DATA SISWA
        =============================== */

        const siswa = [];

        for (
          let i = 1;
          i < siswaRows.length;
          i++
        ) {

          const row =
            siswaRows[i];

          const kelasId =
            String(
              row[3] || ""
            ).trim();

          siswa.push({

            id:
              String(
                row[0] || ""
              ).trim(),

            nisn:
              String(
                row[1] || ""
              ).trim(),

            nama:
              String(
                row[2] || ""
              ).trim(),

            kelasId,

            kelas:
              kelasMap[
                kelasId
              ] || "-",

            password:
              String(
                row[4] || ""
              ).trim(),

            status:
              String(
                row[5] || ""
              ).trim()

          });
        }

        return response(
          200,
          {
            success: true,
            siswa
          }
        );
      }

      /* ===================================================
         POST
      =================================================== */

      if (
        event.httpMethod ===
        "POST"
      ) {

        const body =
          JSON.parse(
            event.body || "{}"
          );

        const action =
          body.action || "";

        /* =================================================
           IMPORT SISWA MASSAL
           
           SEBELUM:
           Kelas GET
           Siswa GET
           Append
           = 3 request

           SEKARANG:
           batchGet Kelas + Siswa
           Append
           = 2 request
        ================================================= */

        if (
          action ===
          "import_students"
        ) {

          const siswaList =
            Array.isArray(
              body.siswa
            )
              ? body.siswa
              : [];

          if (
            siswaList.length ===
            0
          ) {

            return response(
              400,
              {
                success:
                  false,

                message:
                  "Data siswa untuk import kosong."
              }
            );
          }

          /* ===============================================
             BACA KELAS + SISWA SEKALIGUS
          =============================================== */

          const data =
            await batchGet(
              sheets,
              spreadsheetId,
              [
                "Kelas!A:E",
                "Siswa!A:F"
              ]
            );

          const kelasRows =
            data["Kelas!A:E"] || [];

          const siswaRows =
            data["Siswa!A:F"] || [];

          /* ===============================================
             MAP KELAS
          =============================================== */

          const kelasMap = {};

          for (
            let i = 1;
            i < kelasRows.length;
            i++
          ) {

            const id =
              String(
                kelasRows[i][0] ||
                ""
              ).trim();

            const nama =
              String(
                kelasRows[i][1] ||
                ""
              ).trim();

            if (
              !id ||
              !nama
            ) {
              continue;
            }

            kelasMap[
              nama.toLowerCase()
            ] = id;
          }

          /* ===============================================
             SET NISN LAMA
          =============================================== */

          const nisnLama =
            new Set();

          for (
            let i = 1;
            i < siswaRows.length;
            i++
          ) {

            const nisn =
              String(
                siswaRows[i][1] ||
                ""
              ).trim();

            if (nisn) {
              nisnLama.add(
                nisn
              );
            }
          }

          /* ===============================================
             VALIDASI
          =============================================== */

          const berhasil = [];
          const gagal = [];

          const nisnDalamImport =
            new Set();

          for (
            let i = 0;
            i < siswaList.length;
            i++
          ) {

            const dataSiswa =
              siswaList[i] || {};

            const nisnValue =
              String(
                dataSiswa.nisn ||
                dataSiswa.NISN ||
                ""
              ).trim();

            const namaValue =
              String(
                dataSiswa.nama ||
                dataSiswa.Nama ||
                ""
              ).trim();

            const kelasValue =
              String(
                dataSiswa.kelas ||
                dataSiswa.Kelas ||
                ""
              ).trim();

            const kelasIdValue =
              String(
                dataSiswa.kelasId ||
                dataSiswa.Kelas_ID ||
                ""
              ).trim();

            const passwordValue =
              String(
                dataSiswa.password ||
                dataSiswa.Password ||
                ""
              ).trim();

            /* ===========================================
               DATA WAJIB
            =========================================== */

            if (
              !nisnValue ||
              !namaValue ||
              (
                !kelasValue &&
                !kelasIdValue
              ) ||
              !passwordValue
            ) {

              gagal.push({

                baris:
                  i + 2,

                nisn:
                  nisnValue,

                nama:
                  namaValue,

                alasan:
                  "NISN, nama, kelas, dan password wajib diisi."

              });

              continue;
            }

            /* ===========================================
               CEK NISN LAMA
            =========================================== */

            if (
              nisnLama.has(
                nisnValue
              )
            ) {

              gagal.push({

                baris:
                  i + 2,

                nisn:
                  nisnValue,

                nama:
                  namaValue,

                alasan:
                  "NISN sudah terdaftar."

              });

              continue;
            }

            /* ===========================================
               CEK DUPLIKAT FILE
            =========================================== */

            if (
              nisnDalamImport.has(
                nisnValue
              )
            ) {

              gagal.push({

                baris:
                  i + 2,

                nisn:
                  nisnValue,

                nama:
                  namaValue,

                alasan:
                  "NISN duplikat di file import."

              });

              continue;
            }

            /* ===========================================
               TENTUKAN KELAS
            =========================================== */

            let kelasTujuanId =
              "";

            /*
             * Jika kelasId diberikan,
             * validasi apakah benar ada
             * di Sheet Kelas.
             */

            if (
              kelasIdValue
            ) {

              const kelasIdDitemukan =
                Object.values(
                  kelasMap
                ).includes(
                  kelasIdValue
                );

              if (
                kelasIdDitemukan
              ) {
                kelasTujuanId =
                  kelasIdValue;
              }
            }

            /*
             * Jika belum ditemukan,
             * cari berdasarkan nama.
             */

            if (
              !kelasTujuanId &&
              kelasValue
            ) {

              kelasTujuanId =
                kelasMap[
                  kelasValue
                    .toLowerCase()
                ] || "";
            }

            /* ===========================================
               KELAS TIDAK VALID
            =========================================== */

            if (
              !kelasTujuanId
            ) {

              gagal.push({

                baris:
                  i + 2,

                nisn:
                  nisnValue,

                nama:
                  namaValue,

                alasan:
                  `Kelas "${kelasValue || kelasIdValue}" tidak ditemukan.`

              });

              continue;
            }

            /* ===========================================
               ID SISWA
            =========================================== */

            const id =
              "S" +
              Date.now()
                .toString()
                .slice(-7) +
              String(i)
                .padStart(
                  2,
                  "0"
                );

            /* ===========================================
               SIAPKAN ROW
            =========================================== */

            berhasil.push([

              id,

              nisnValue,

              namaValue,

              kelasTujuanId,

              passwordValue,

              "Aktif"

            ]);

            nisnDalamImport.add(
              nisnValue
            );
          }

          /* ===============================================
             SIMPAN MASSAL
             
             100 siswa = 1 WRITE REQUEST
          =============================================== */

          if (
            berhasil.length >
            0
          ) {

            await sheets.spreadsheets.values.append({

              spreadsheetId,

              range:
                "Siswa!A:F",

              valueInputOption:
                "RAW",

              insertDataOption:
                "INSERT_ROWS",

              requestBody: {
                values:
                  berhasil
              }

            });
          }

          return response(
            200,
            {

              success:
                true,

              message:
                `${berhasil.length} siswa berhasil diimport.`,

              berhasil:
                berhasil.length,

              gagal:
                gagal.length,

              detailGagal:
                gagal

            }
          );
        }

        /* =================================================
           TAMBAH SISWA BIASA
        ================================================= */

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

          return response(
            400,
            {

              success:
                false,

              message:
                "NISN, nama, kelas, dan password wajib diisi."

            }
          );
        }

        /* ===============================================
           CEK NISN
        =============================================== */

        const existing =
          await sheets.spreadsheets.values.get({

            spreadsheetId,

            range:
              "Siswa!A:F"

          });

        const rows =
          existing.data.values ||
          [];

        for (
          let i = 1;
          i < rows.length;
          i++
        ) {

          if (
            String(
              rows[i][1] || ""
            ).trim() ===
            String(
              nisn
            ).trim()
          ) {

            return response(
              409,
              {

                success:
                  false,

                message:
                  "NISN sudah terdaftar."

              }
            );
          }
        }

        /* ===============================================
           BUAT ID
        =============================================== */

        const id =
          "S" +
          Date.now()
            .toString()
            .slice(-7);

        /* ===============================================
           SIMPAN
        =============================================== */

        await sheets.spreadsheets.values.append({

          spreadsheetId,

          range:
            "Siswa!A:F",

          valueInputOption:
            "RAW",

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

        return response(
          201,
          {

            success:
              true,

            message:
              "Siswa berhasil ditambahkan.",

            siswa: {

              id,

              nisn,

              nama,

              kelasId,

              status:
                "Aktif"

            }

          }
        );
      }

      /* ===================================================
         PUT — EDIT SISWA
         
         1 READ + 1 WRITE
         = 2 request
      =================================================== */

      if (
        event.httpMethod ===
        "PUT"
      ) {

        const body =
          JSON.parse(
            event.body || "{}"
          );

        const {
          id,
          nisn,
          nama,
          kelasId,
          password,
          status
        } = body;

        if (!id) {

          return response(
            400,
            {

              success:
                false,

              message:
                "ID siswa wajib diisi."

            }
          );
        }

        const result =
          await sheets.spreadsheets.values.get({

            spreadsheetId,

            range:
              "Siswa!A:F"

          });

        const rows =
          result.data.values ||
          [];

        let rowNumber =
          null;

        for (
          let i = 1;
          i < rows.length;
          i++
        ) {

          if (
            String(
              rows[i][0] || ""
            ).trim() ===
            String(id).trim()
          ) {

            rowNumber =
              i + 1;

            break;
          }
        }

        if (!rowNumber) {

          return response(
            404,
            {

              success:
                false,

              message:
                "Siswa tidak ditemukan."

            }
          );
        }

        const oldRow =
          rows[
            rowNumber - 1
          ];

        await sheets.spreadsheets.values.update({

          spreadsheetId,

          range:
            `Siswa!A${rowNumber}:F${rowNumber}`,

          valueInputOption:
            "RAW",

          requestBody: {

            values: [[

              id,

              nisn ??
                oldRow[1] ??
                "",

              nama ??
                oldRow[2] ??
                "",

              kelasId ??
                oldRow[3] ??
                "",

              password ??
                oldRow[4] ??
                "",

              status ??
                oldRow[5] ??
                "Aktif"

            ]]

          }

        });

        return response(
          200,
          {

            success:
              true,

            message:
              "Data siswa berhasil diperbarui."

          }
        );
      }

      /* ===================================================
         DELETE — HAPUS SISWA + POIN
         
         SEBELUM:
         - baca Siswa
         - baca Poin
         - clear setiap poin satu per satu
         - clear siswa

         Misalnya siswa punya 50 poin:

         1 read
         + 1 read
         + 50 write
         + 1 write
         = 52 request

         SEKARANG:
         - batchGet Siswa + Poin = 1 read
         - batchClear semua poin = 1 write
         - clear siswa = 1 write

         TOTAL = 3 request
      =================================================== */

      if (
        event.httpMethod ===
        "DELETE"
      ) {

        const body =
          JSON.parse(
            event.body || "{}"
          );

        const id =
          String(
            body.id || ""
          ).trim();

        if (!id) {

          return response(
            400,
            {

              success:
                false,

              message:
                "ID siswa wajib diisi."

            }
          );
        }

        /* ===============================================
           BACA SISWA + POIN SEKALIGUS
        =============================================== */

        const data =
          await batchGet(
            sheets,
            spreadsheetId,
            [
              "Siswa!A:F",
              "Poin!A:G"
            ]
          );

        const siswaRows =
          data["Siswa!A:F"] || [];

        const poinRows =
          data["Poin!A:G"] || [];

        /* ===============================================
           CARI SISWA
        =============================================== */

        let siswaRowNumber =
          -1;

        for (
          let i = 1;
          i < siswaRows.length;
          i++
        ) {

          const siswaId =
            String(
              siswaRows[i][0] ||
              ""
            ).trim();

          if (
            siswaId === id
          ) {

            siswaRowNumber =
              i + 1;

            break;
          }
        }

        if (
          siswaRowNumber ===
          -1
        ) {

          return response(
            404,
            {

              success:
                false,

              message:
                "Siswa tidak ditemukan."

            }
          );
        }

        /* ===============================================
           CARI SEMUA BARIS POIN SISWA
        =============================================== */

        const poinRanges = [];

        for (
          let i = 1;
          i < poinRows.length;
          i++
        ) {

          const siswaIdPoin =
            String(
              poinRows[i][1] ||
              ""
            ).trim();

          if (
            siswaIdPoin === id
          ) {

            poinRanges.push(
              `Poin!A${i + 1}:G${i + 1}`
            );
          }
        }

        /* ===============================================
           HAPUS SEMUA POIN SEKALIGUS
           
           batchClear = 1 write request
        =============================================== */

        if (
          poinRanges.length >
          0
        ) {

          await sheets.spreadsheets.values.batchClear({

            spreadsheetId,

            requestBody: {

              ranges:
                poinRanges

            }

          });
        }

        /* ===============================================
           HAPUS DATA SISWA
        =============================================== */

        await sheets.spreadsheets.values.clear({

          spreadsheetId,

          range:
            `Siswa!A${siswaRowNumber}:F${siswaRowNumber}`

        });

        return response(
          200,
          {

            success:
              true,

            message:
              "Siswa dan seluruh poin siswa berhasil dihapus.",

            poinTerhapus:
              poinRanges.length

          }
        );
      }

      /* ===================================================
         PATCH — STATUS / PASSWORD / PINDAH
      =================================================== */

      if (
        event.httpMethod ===
        "PATCH"
      ) {

        const body =
          JSON.parse(
            event.body || "{}"
          );

        const {
          id,
          action,
          password
        } = body;

        if (!id) {

          return response(
            400,
            {

              success:
                false,

              message:
                "ID siswa wajib diisi."

            }
          );
        }

        /* ===============================================
           CARI SISWA
        =============================================== */

        const result =
          await sheets.spreadsheets.values.get({

            spreadsheetId,

            range:
              "Siswa!A:F"

          });

        const rows =
          result.data.values ||
          [];

        let rowNumber =
          null;

        for (
          let i = 1;
          i < rows.length;
          i++
        ) {

          if (
            String(
              rows[i][0] || ""
            ).trim() ===
            String(id).trim()
          ) {

            rowNumber =
              i + 1;

            break;
          }
        }

        if (!rowNumber) {

          return response(
            404,
            {

              success:
                false,

              message:
                "Siswa tidak ditemukan."

            }
          );
        }

        const oldRow =
          rows[
            rowNumber - 1
          ];

        /* ===============================================
           TOGGLE STATUS
        =============================================== */

        if (
          action ===
          "toggle_status"
        ) {

          const oldStatus =
            String(
              oldRow[5] || ""
            )
              .trim()
              .toLowerCase();

          const newStatus =
            oldStatus ===
            "aktif"
              ? "Nonaktif"
              : "Aktif";

          await sheets.spreadsheets.values.update({

            spreadsheetId,

            range:
              `Siswa!F${rowNumber}`,

            valueInputOption:
              "RAW",

            requestBody: {

              values: [[
                newStatus
              ]]

            }

          });

          return response(
            200,
            {

              success:
                true,

              message:
                `Status siswa diubah menjadi ${newStatus}.`,

              status:
                newStatus

            }
          );
        }

        /* ===============================================
           RESET PASSWORD
        =============================================== */

        if (
          action ===
          "reset_password"
        ) {

          if (!password) {

            return response(
              400,
              {

                success:
                  false,

                message:
                  "Password baru wajib diisi."

              }
            );
          }

          await sheets.spreadsheets.values.update({

            spreadsheetId,

            range:
              `Siswa!E${rowNumber}`,

            valueInputOption:
              "RAW",

            requestBody: {

              values: [[
                password
              ]]

            }

          });

          return response(
            200,
            {

              success:
                true,

              message:
                "Password berhasil direset."

            }
          );
        }

        /* ===============================================
           PINDAH SISWA
        =============================================== */

        if (
          action ===
          "move_student"
        ) {

          const {
            kelasId,
            alasan,
            admin
          } = body;

          if (!kelasId) {

            return response(
              400,
              {

                success:
                  false,

                message:
                  "Kelas tujuan wajib dipilih."

              }
            );
          }

          const siswaId =
            String(id).trim();

          const tujuanKelasId =
            String(
              kelasId
            ).trim();

          const kelasSekarangId =
            String(
              oldRow[3] || ""
            ).trim();

          if (
            kelasSekarangId ===
            tujuanKelasId
          ) {

            return response(
              400,
              {

                success:
                  false,

                message:
                  "Siswa sudah berada di kelas tersebut."

              }
            );
          }

          /* ============================================
             BACA KELAS
          ============================================ */

          const kelasResult =
            await sheets.spreadsheets.values.get({

              spreadsheetId,

              range:
                "Kelas!A:E"

            });

          const kelasRows =
            kelasResult.data.values ||
            [];

          let kelasSekarang =
            "-";

          let kelasTujuan =
            "-";

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

          if (
            kelasTujuan ===
            "-"
          ) {

            return response(
              400,
              {

                success:
                  false,

                message:
                  "Kelas tujuan tidak ditemukan."

              }
            );
          }

          /* ============================================
             UBAH KELAS
          ============================================ */

          await sheets.spreadsheets.values.update({

            spreadsheetId,

            range:
              `Siswa!D${rowNumber}`,

            valueInputOption:
              "RAW",

            requestBody: {

              values: [[
                tujuanKelasId
              ]]

            }

          });

          /* ============================================
             RIWAYAT
          ============================================ */

          const historyId =
            "RK" +
            String(
              Date.now()
            ).slice(-8);

          const now =
            new Date();

          const tanggal =
            String(
              now.getDate()
            ).padStart(
              2,
              "0"
            ) +
            "/" +
            String(
              now.getMonth() + 1
            ).padStart(
              2,
              "0"
            ) +
            "/" +
            now.getFullYear();

          await sheets.spreadsheets.values.append({

            spreadsheetId,

            range:
              "Riwayat_Kelas!A:G",

            valueInputOption:
              "RAW",

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

          return response(
            200,
            {

              success:
                true,

              message:
                `Siswa berhasil dipindahkan dari ${kelasSekarang} ke ${kelasTujuan}.`,

              siswa: {

                id:
                  siswaId,

                dariKelasId:
                  kelasSekarangId,

                dariKelas:
                  kelasSekarang,

                keKelasId:
                  tujuanKelasId,

                keKelas:
                  kelasTujuan

              }

            }
          );
        }

        return response(
          400,
          {

            success:
              false,

            message:
              "Action tidak dikenali."

          }
        );
      }

      /* ===================================================
         METHOD TIDAK DIIZINKAN
      =================================================== */

      return response(
        405,
        {

          success:
            false,

          message:
            "Method tidak diizinkan."

        }
      );

    } catch (error) {

      console.error(
        "ADMIN STUDENTS ERROR:",
        error
      );

      return response(
        500,
        {

          success:
            false,

          message:
            error.message ||
            "Terjadi kesalahan pada server."

        }
      );
    }
  };
