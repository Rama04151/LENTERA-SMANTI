const { google } = require("googleapis");

/* =========================================================
   GOOGLE SHEETS
========================================================= */

function getSheets() {
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

  return google.sheets({
    version: "v4",
    auth
  });
}

/* =========================================================
   RESPONSE
========================================================= */

function success(data = {}) {
  return {
    statusCode: 200,

    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
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
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },

    body: JSON.stringify({
      success: false,
      message
    })
  };
}

/* =========================================================
   FIND GURU FROM ROWS
   Tidak melakukan request sendiri.
========================================================= */

function findGuru(rows, guruId, guruUsername) {
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

    /* UTAMAKAN ID */

    if (
      guruId &&
      id === String(guruId).trim()
    ) {
      return {
        id,
        username,
        nama
      };
    }

    /* FALLBACK USERNAME */

    if (
      guruUsername &&
      username.toLowerCase() ===
        String(guruUsername)
          .trim()
          .toLowerCase()
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

/* =========================================================
   BATCH GET
   Beberapa sheet diambil dalam SATU request API.
========================================================= */

async function batchGetSheets(
  sheets,
  spreadsheetId,
  ranges
) {
  const response =
    await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges
    });

  const valueRanges =
    response.data.valueRanges || [];

  const result = {};

  for (let i = 0; i < ranges.length; i++) {
    result[ranges[i]] =
      valueRanges[i]?.values || [];
  }

  return result;
}

/* =========================================================
   VALIDASI JENIS POIN
========================================================= */

function validJenis(jenis) {
  return (
    jenis === "penghargaan" ||
    jenis === "pelanggaran"
  );
}

/* =========================================================
   TANGGAL INDONESIA
========================================================= */

function getTanggalIndonesia() {
  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());
}

/* =========================================================
   HANDLER
========================================================= */

exports.handler = async function (event) {
  const sheets = getSheets();

  const spreadsheetId =
    process.env.GOOGLE_SHEET_ID;

  try {
    /* =====================================================
       GET — POIN SAYA
       SEKARANG: 1 REQUEST
    ===================================================== */

    if (event.httpMethod === "GET") {
      const params =
        event.queryStringParameters || {};

      const guruId =
        String(
          params.guruId || ""
        ).trim();

      const guruUsername =
        String(
          params.guruUsername || ""
        ).trim();

      if (
        !guruId &&
        !guruUsername
      ) {
        return error(
          "Identitas guru tidak ditemukan.",
          401
        );
      }

      /*
        Guru + Poin + Siswa + Kelas
        semuanya diambil menggunakan
        SATU batchGet request.
      */

      const data =
        await batchGetSheets(
          sheets,
          spreadsheetId,
          [
            "Guru!A:E",
            "Poin!A:H",
            "Siswa!A:F",
            "Kelas!A:E"
          ]
        );

      const guruRows =
        data["Guru!A:E"] || [];

      const poinRows =
        data["Poin!A:H"] || [];

      const siswaRows =
        data["Siswa!A:F"] || [];

      const kelasRows =
        data["Kelas!A:E"] || [];

      /* =================================================
         CARI GURU
      ================================================= */

      const guru =
        findGuru(
          guruRows,
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      /* =================================================
         MAP SISWA
      ================================================= */

      const siswaMap = {};

      for (
        const row of siswaRows.slice(1)
      ) {
        const id =
          String(
            row[0] || ""
          ).trim();

        if (!id) {
          continue;
        }

        siswaMap[id] = {
          nama:
            String(
              row[2] || ""
            ).trim(),

          nisn:
            String(
              row[1] || ""
            ).trim(),

          kelasId:
            String(
              row[3] || ""
            ).trim()
        };
      }

      /* =================================================
         MAP KELAS
      ================================================= */

      const kelasMap = {};

      for (
        const row of kelasRows.slice(1)
      ) {
        const id =
          String(
            row[0] || ""
          ).trim();

        const nama =
          String(
            row[1] || ""
          ).trim();

        if (id) {
          kelasMap[id] = nama;
        }
      }

      /* =================================================
         FILTER POIN GURU
      ================================================= */

      const usernameGuru =
        guru.username.toLowerCase();

      const poinSaya = [];

      for (
        const row of poinRows.slice(1)
      ) {
        const pointId =
          String(
            row[0] || ""
          ).trim();

        const siswaId =
          String(
            row[1] || ""
          ).trim();

        const jenis =
          String(
            row[2] || ""
          ).trim();

        const poin =
          Number(
            row[3] || 0
          );

        const keterangan =
          String(
            row[4] || ""
          ).trim();

        const tanggal =
          String(
            row[5] || ""
          ).trim();

        const dibuatOleh =
          String(
            row[6] || ""
          ).trim();

        /*
          Hanya tampilkan poin
          yang dibuat oleh guru ini.
        */

        if (
          dibuatOleh.toLowerCase() !==
          usernameGuru
        ) {
          continue;
        }

        const siswa =
          siswaMap[siswaId] || {};

        poinSaya.push({
          id: pointId,

          siswaId,

          siswaNama:
            siswa.nama || "-",

          siswaNisn:
            siswa.nisn || "-",

          siswaKelas:
            kelasMap[
              siswa.kelasId
            ] || "-",

          jenis,

          poin,

          keterangan,

          tanggal,

          guruUsername:
            guru.username
        });
      }

      /* =================================================
         TERBARU DI ATAS
      ================================================= */

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

    /* =====================================================
       POST — TAMBAH POIN
       1 READ + 1 WRITE = 2 REQUEST
    ===================================================== */

    if (event.httpMethod === "POST") {
      const body =
        JSON.parse(
          event.body || "{}"
        );

      const siswaId =
        String(
          body.siswaId || ""
        ).trim();

      const poin =
        Number(body.poin);

      const keterangan =
        String(
          body.keterangan || ""
        ).trim();

      const jenis =
        String(
          body.jenis || ""
        )
          .trim()
          .toLowerCase();

      const guruId =
        String(
          body.guruId || ""
        ).trim();

      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();

      /* VALIDASI */

      if (!siswaId) {
        return error(
          "Siswa belum dipilih."
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

      if (!validJenis(jenis)) {
        return error(
          "Jenis poin tidak valid."
        );
      }

      /*
        Hanya baca Guru.
        1 request.
      */

      const guruData =
        await batchGetSheets(
          sheets,
          spreadsheetId,
          ["Guru!A:E"]
        );

      const guru =
        findGuru(
          guruData["Guru!A:E"] || [],
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      /* ID POIN */

      const pointId =
        "P" + Date.now();

      /* TANGGAL */

      const tanggal =
        getTanggalIndonesia();

      /*
        1 WRITE REQUEST
      */

      await sheets.spreadsheets.values.append({
        spreadsheetId,

        range: "Poin!A:H",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

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
        message:
          "Poin berhasil ditambahkan."
      });
    }

    /* =====================================================
       PUT — EDIT POIN SENDIRI
       SEKARANG: 1 BATCH READ + 1 WRITE = 2 REQUEST
    ===================================================== */

    if (event.httpMethod === "PUT") {
      const body =
        JSON.parse(
          event.body || "{}"
        );

      const pointId =
        String(
          body.id || ""
        ).trim();

      const siswaIdBaru =
        String(
          body.siswaId || ""
        ).trim();

      const jenis =
        String(
          body.jenis || ""
        )
          .trim()
          .toLowerCase();

      const poin =
        Number(body.poin);

      const keterangan =
        String(
          body.keterangan || ""
        ).trim();

      const guruId =
        String(
          body.guruId || ""
        ).trim();

      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();

      /* VALIDASI */

      if (!pointId) {
        return error(
          "ID poin tidak ditemukan."
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

      if (!validJenis(jenis)) {
        return error(
          "Jenis poin tidak valid."
        );
      }

      /*
        Guru + Poin dibaca dalam
        SATU batchGet request.
      */

      const data =
        await batchGetSheets(
          sheets,
          spreadsheetId,
          [
            "Guru!A:E",
            "Poin!A:H"
          ]
        );

      const guru =
        findGuru(
          data["Guru!A:E"] || [],
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      const rows =
        data["Poin!A:H"] || [];

      let rowNumber = -1;
      let siswaIdLama = "";

      for (
        let i = 1;
        i < rows.length;
        i++
      ) {
        const id =
          String(
            rows[i][0] || ""
          ).trim();

        const creator =
          String(
            rows[i][6] || ""
          ).trim();

        if (
          id === pointId &&
          creator.toLowerCase() ===
            guru.username.toLowerCase()
        ) {
          rowNumber = i + 1;

          siswaIdLama =
            String(
              rows[i][1] || ""
            ).trim();

          break;
        }
      }

      if (rowNumber === -1) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      const siswaIdFinal =
        siswaIdBaru ||
        siswaIdLama;

      if (!siswaIdFinal) {
        return error(
          "Siswa_ID tidak ditemukan. Poin tidak dapat diedit."
        );
      }

      /*
        G dan H tidak disentuh.
        Creator tetap aman.
      */

      await sheets.spreadsheets.values.update({
        spreadsheetId,

        range:
          `Poin!B${rowNumber}:E${rowNumber}`,

        valueInputOption:
          "USER_ENTERED",

        requestBody: {
          values: [[
            siswaIdFinal,
            jenis,
            poin,
            keterangan
          ]]
        }
      });

      return success({
        message:
          "Poin berhasil diperbarui."
      });
    }

    /* =====================================================
       DELETE — HAPUS POIN SENDIRI
       SEKARANG: 1 BATCH READ + 1 WRITE = 2 REQUEST

       CATATAN:
       Baris tidak dihapus secara fisik.
       A:H dikosongkan.
       Ini menghilangkan kebutuhan mengambil sheetId.
    ===================================================== */

    if (event.httpMethod === "DELETE") {
      const body =
        JSON.parse(
          event.body || "{}"
        );

      const pointId =
        String(
          body.id || ""
        ).trim();

      const guruId =
        String(
          body.guruId || ""
        ).trim();

      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();

      if (!pointId) {
        return error(
          "ID poin tidak ditemukan."
        );
      }

      /*
        Guru + Poin
        = SATU batchGet request
      */

      const data =
        await batchGetSheets(
          sheets,
          spreadsheetId,
          [
            "Guru!A:E",
            "Poin!A:H"
          ]
        );

      const guru =
        findGuru(
          data["Guru!A:E"] || [],
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      const rows =
        data["Poin!A:H"] || [];

      let rowNumber = -1;

      for (
        let i = 1;
        i < rows.length;
        i++
      ) {
        const id =
          String(
            rows[i][0] || ""
          ).trim();

        const creator =
          String(
            rows[i][6] || ""
          ).trim();

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

      /*
        Kosongkan A:H.
        Tidak membutuhkan sheetId.
        1 WRITE REQUEST.
      */

      await sheets.spreadsheets.values.clear({
        spreadsheetId,

        range:
          `Poin!A${rowNumber}:H${rowNumber}`
      });

      return success({
        message:
          "Poin berhasil dihapus."
      });
    }

    /* =====================================================
       METHOD TIDAK DIIZINKAN
    ===================================================== */

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
