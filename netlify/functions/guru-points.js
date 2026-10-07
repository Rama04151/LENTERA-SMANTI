const supabase = require("./_supabase");


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


function error(
  message,
  statusCode = 400
) {

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
   VALIDASI JENIS
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
   VALIDASI TANGGAL YYYY-MM-DD
========================================================= */

function validTanggal(tanggal) {

  const raw =
    String(tanggal || "").trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(raw)
  ) {

    return false;
  }

  const [
    year,
    month,
    day
  ] =
    raw.split("-").map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}


/* =========================================================
   CARI GURU
========================================================= */

async function findGuru(
  guruId,
  guruUsername
) {

  let query =
    supabase
      .from("guru")
      .select(`
        id,
        username,
        nama,
        status
      `);

  if (guruId) {

    query =
      query.eq(
        "id",
        guruId
      );

  } else if (guruUsername) {

    query =
      query.eq(
        "username",
        guruUsername
      );

  } else {

    return null;
  }

  const {
    data,
    error: queryError
  } =
    await query.maybeSingle();

  if (queryError) {
    throw queryError;
  }

  if (!data) {
    return null;
  }

  if (
    String(
      data.status || ""
    )
      .trim()
      .toLowerCase() !==
    "aktif"
  ) {

    return null;
  }

  return {
    id: data.id,
    username: data.username,
    nama: data.nama
  };
}


/* =========================================================
   HANDLER
========================================================= */

exports.handler =
async function(event) {

  try {

    /* =====================================================
       GET
    ===================================================== */

    if (
      event.httpMethod === "GET"
    ) {

      const params =
        event.queryStringParameters ||
        {};

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


      const guru =
        await findGuru(
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
         AMBIL POIN GURU
      ================================================= */

      const {
        data: poinRows,
        error: poinError
      } =
        await supabase
          .from("poin")
          .select(`
            id,
            siswa_id,
            jenis,
            poin,
            keterangan,
            tanggal,
            dibuat_oleh,
            peran
          `)
          .eq(
            "peran",
            "Guru"
          )
          .ilike(
            "dibuat_oleh",
            guru.username
          )
          .order(
            "tanggal",
            {
              ascending: false
            }
          );


      if (poinError) {

        console.error(
          "SUPABASE GURU POINTS GET ERROR:",
          poinError
        );

        return error(
          "Gagal mengambil data poin.",
          500
        );
      }


      /* =================================================
         AMBIL SISWA
      ================================================= */

      const {
        data: siswaRows,
        error: siswaError
      } =
        await supabase
          .from("siswa")
          .select(`
            id,
            nama,
            nisn,
            kelas_id
          `);


      if (siswaError) {

        console.error(
          "SUPABASE GURU POINTS SISWA ERROR:",
          siswaError
        );

        return error(
          "Gagal mengambil data siswa.",
          500
        );
      }


      /* =================================================
         AMBIL KELAS
      ================================================= */

      const {
        data: kelasRows,
        error: kelasError
      } =
        await supabase
          .from("kelas")
          .select(`
            id,
            nama_kelas
          `);


      if (kelasError) {

        console.error(
          "SUPABASE GURU POINTS KELAS ERROR:",
          kelasError
        );

        return error(
          "Gagal mengambil data kelas.",
          500
        );
      }


      /* =================================================
         MAP SISWA
      ================================================= */

      const siswaMap = {};


      for (
        const row of siswaRows || []
      ) {

        const id =
          String(
            row.id || ""
          ).trim();


        if (!id) {
          continue;
        }


        siswaMap[id] = {

          nama:
            String(
              row.nama || ""
            ).trim(),

          nisn:
            String(
              row.nisn || ""
            ).trim(),

          kelasId:
            String(
              row.kelas_id || ""
            ).trim()

        };
      }


      /* =================================================
         MAP KELAS
      ================================================= */

      const kelasMap = {};


      for (
        const row of kelasRows || []
      ) {

        const id =
          String(
            row.id || ""
          ).trim();


        const nama =
          String(
            row.nama_kelas || ""
          ).trim();


        if (id) {

          kelasMap[id] =
            nama;

        }
      }


      /* =================================================
         BENTUK DATA POIN
      ================================================= */

      const poinSaya = [];


      for (
        const row of poinRows || []
      ) {

        const siswaId =
          String(
            row.siswa_id || ""
          ).trim();


        const siswa =
          siswaMap[siswaId] || {};


        poinSaya.push({

          id:
            String(
              row.id || ""
            ).trim(),

          siswaId,

          siswaNama:
            siswa.nama || "-",

          siswaNisn:
            siswa.nisn || "-",

          siswaKelas:
            kelasMap[
              siswa.kelasId
            ] || "-",

          jenis:
            String(
              row.jenis || ""
            ).trim(),

          poin:
            Number(
              row.poin || 0
            ),

          keterangan:
            String(
              row.keterangan || ""
            ).trim(),

          /*
           * PENTING:
           * tanggal tetap YYYY-MM-DD
           */
          tanggal:
            row.tanggal || "",

          guruUsername:
            guru.username

        });
      }


      return success({

        guru: {

          id:
            guru.id,

          username:
            guru.username,

          nama:
            guru.nama

        },

        poin:
          poinSaya

      });
    }


    /* =====================================================
       POST — TAMBAH POIN
    ===================================================== */

    if (
      event.httpMethod === "POST"
    ) {

      const body =
        JSON.parse(
          event.body || "{}"
        );


      const siswaId =
        String(
          body.siswaId || ""
        ).trim();


      const poin =
        Number(
          body.poin
        );


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


      const tanggalInput =
        String(
          body.tanggal || ""
        ).trim();


      const guruId =
        String(
          body.guruId || ""
        ).trim();


      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();


      /* =================================================
         VALIDASI SISWA
      ================================================= */

      if (!siswaId) {

        return error(
          "Siswa belum dipilih."
        );
      }


      /* =================================================
         VALIDASI POIN
      ================================================= */

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {

        return error(
          "Poin harus berupa angka 1 sampai 100."
        );
      }


      /* =================================================
         VALIDASI KETERANGAN
      ================================================= */

      if (!keterangan) {

        return error(
          "Keterangan wajib diisi."
        );
      }


      /* =================================================
         VALIDASI JENIS
      ================================================= */

      if (
        !validJenis(jenis)
      ) {

        return error(
          "Jenis poin tidak valid."
        );
      }


      /* =================================================
         VALIDASI TANGGAL
      ================================================= */

      const tanggalHariIni =
        getTanggalIndonesia();


      /*
       * Jika client lama tidak mengirim tanggal,
       * gunakan tanggal hari ini.
       */

      const tanggal =
        tanggalInput ||
        tanggalHariIni;


      if (
        !validTanggal(tanggal)
      ) {

        return error(
          "Tanggal poin tidak valid. Gunakan format YYYY-MM-DD."
        );
      }


      /*
       * Tidak boleh membuat poin
       * untuk tanggal masa depan.
       */

      if (
        tanggal > tanggalHariIni
      ) {

        return error(
          "Tanggal poin tidak boleh melebihi tanggal hari ini."
        );
      }


      /* =================================================
         VALIDASI GURU
      ================================================= */

      const guru =
        await findGuru(
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
         CEK SISWA
      ================================================= */

      const {
        data: siswa,
        error: siswaError
      } =
        await supabase
          .from("siswa")
          .select("id")
          .eq(
            "id",
            siswaId
          )
          .maybeSingle();


      if (siswaError) {

        console.error(
          "SUPABASE CHECK SISWA ERROR:",
          siswaError
        );

        return error(
          "Gagal memeriksa siswa.",
          500
        );
      }


      if (!siswa) {

        return error(
          "Siswa tidak ditemukan.",
          404
        );
      }


      /* =================================================
         ID POIN
      ================================================= */

      const pointId =
        "P" +
        Date.now();


      /* =================================================
         INSERT
      ================================================= */

      const {
        error: insertError
      } =
        await supabase
          .from("poin")
          .insert({

            id:
              pointId,

            siswa_id:
              siswaId,

            jenis,

            poin,

            keterangan,

            /*
             * PENTING:
             * tanggal langsung YYYY-MM-DD
             */
            tanggal,

            dibuat_oleh:
              guru.username,

            peran:
              "Guru"

          });


      if (insertError) {

        console.error(
          "SUPABASE GURU POINTS INSERT ERROR:",
          insertError
        );

        return error(
          "Gagal menambahkan poin.",
          500
        );
      }


      return success({

        message:
          "Poin berhasil ditambahkan.",

        tanggal

      });
    }


    /* =====================================================
       PUT — EDIT POIN SENDIRI
    ===================================================== */

    if (
      event.httpMethod === "PUT"
    ) {

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
        Number(
          body.poin
        );


      const keterangan =
        String(
          body.keterangan || ""
        ).trim();


      const tanggalInput =
        String(
          body.tanggal || ""
        ).trim();


      const guruId =
        String(
          body.guruId || ""
        ).trim();


      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();


      /* =================================================
         VALIDASI ID
      ================================================= */

      if (!pointId) {

        return error(
          "ID poin tidak ditemukan."
        );
      }


      /* =================================================
         VALIDASI POIN
      ================================================= */

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {

        return error(
          "Poin harus berupa angka 1 sampai 100."
        );
      }


      /* =================================================
         VALIDASI KETERANGAN
      ================================================= */

      if (!keterangan) {

        return error(
          "Keterangan wajib diisi."
        );
      }


      /* =================================================
         VALIDASI JENIS
      ================================================= */

      if (
        !validJenis(jenis)
      ) {

        return error(
          "Jenis poin tidak valid."
        );
      }


      /* =================================================
         VALIDASI GURU
      ================================================= */

      const guru =
        await findGuru(
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
         AMBIL POIN
      ================================================= */

      const {
        data: existingPoint,
        error: pointError
      } =
        await supabase
          .from("poin")
          .select(`
            id,
            siswa_id,
            dibuat_oleh,
            peran,
            tanggal
          `)
          .eq(
            "id",
            pointId
          )
          .maybeSingle();


      if (pointError) {

        console.error(
          "SUPABASE GET POINT ERROR:",
          pointError
        );

        return error(
          "Gagal mengambil data poin.",
          500
        );
      }


      if (!existingPoint) {

        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }


      /* =================================================
         CEK PERAN
      ================================================= */

      if (
        String(
          existingPoint.peran || ""
        ).toLowerCase() !==
        "guru"
      ) {

        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }


      /* =================================================
         CEK PEMILIK
      ================================================= */

      if (
        String(
          existingPoint.dibuat_oleh || ""
        ).toLowerCase() !==
        guru.username.toLowerCase()
      ) {

        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }


      /* =================================================
         TANGGAL
      ================================================= */

      const tanggalHariIni =
        getTanggalIndonesia();


      /*
       * Untuk kompatibilitas dengan client lama:
       * jika tanggal tidak dikirim, pertahankan
       * tanggal lama.
       */

      const tanggal =
        tanggalInput ||
        existingPoint.tanggal ||
        tanggalHariIni;


      if (
        !validTanggal(tanggal)
      ) {

        return error(
          "Tanggal poin tidak valid. Gunakan format YYYY-MM-DD."
        );
      }


      if (
        tanggal > tanggalHariIni
      ) {

        return error(
          "Tanggal poin tidak boleh melebihi tanggal hari ini."
        );
      }


      /* =================================================
         TENTUKAN SISWA
      ================================================= */

      const siswaIdFinal =
        siswaIdBaru ||
        existingPoint.siswa_id;


      if (!siswaIdFinal) {

        return error(
          "Siswa_ID tidak ditemukan. Poin tidak dapat diedit."
        );
      }


      /* =================================================
         CEK SISWA
      ================================================= */

      const {
        data: siswa,
        error: siswaError
      } =
        await supabase
          .from("siswa")
          .select("id")
          .eq(
            "id",
            siswaIdFinal
          )
          .maybeSingle();


      if (siswaError) {

        console.error(
          "SUPABASE CHECK SISWA UPDATE ERROR:",
          siswaError
        );

        return error(
          "Gagal memeriksa siswa.",
          500
        );
      }


      if (!siswa) {

        return error(
          "Siswa tidak ditemukan.",
          404
        );
      }


      /* =================================================
         UPDATE
      ================================================= */

      const {
        error: updateError
      } =
        await supabase
          .from("poin")
          .update({

            siswa_id:
              siswaIdFinal,

            jenis,

            poin,

            keterangan,

            /*
             * PENTING:
             * tanggal ikut diperbarui.
             */
            tanggal

          })
          .eq(
            "id",
            pointId
          )
          .eq(
            "dibuat_oleh",
            guru.username
          )
          .eq(
            "peran",
            "Guru"
          );


      if (updateError) {

        console.error(
          "SUPABASE GURU POINTS UPDATE ERROR:",
          updateError
        );

        return error(
          "Gagal memperbarui poin.",
          500
        );
      }


      return success({

        message:
          "Poin berhasil diperbarui.",

        tanggal

      });
    }


    /* =====================================================
       DELETE — HAPUS POIN SENDIRI
    ===================================================== */

    if (
      event.httpMethod === "DELETE"
    ) {

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


      /* =================================================
         VALIDASI GURU
      ================================================= */

      const guru =
        await findGuru(
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
         CEK POIN
      ================================================= */

      const {
        data: existingPoint,
        error: pointError
      } =
        await supabase
          .from("poin")
          .select(`
            id,
            dibuat_oleh,
            peran
          `)
          .eq(
            "id",
            pointId
          )
          .maybeSingle();


      if (pointError) {

        console.error(
          "SUPABASE GET POINT DELETE ERROR:",
          pointError
        );

        return error(
          "Gagal mengambil data poin.",
          500
        );
      }


      if (!existingPoint) {

        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }


      if (
        String(
          existingPoint.peran || ""
        ).toLowerCase() !==
        "guru"
      ) {

        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }


      if (
        String(
          existingPoint.dibuat_oleh || ""
        ).toLowerCase() !==
        guru.username.toLowerCase()
      ) {

        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }


      /* =================================================
         DELETE
      ================================================= */

      const {
        error: deleteError
      } =
        await supabase
          .from("poin")
          .delete()
          .eq(
            "id",
            pointId
          )
          .eq(
            "dibuat_oleh",
            guru.username
          )
          .eq(
            "peran",
            "Guru"
          );


      if (deleteError) {

        console.error(
          "SUPABASE GURU POINTS DELETE ERROR:",
          deleteError
        );

        return error(
          "Gagal menghapus poin.",
          500
        );
      }


      return success({

        message:
          "Poin berhasil dihapus."

      });
    }


    /* =====================================================
       METHOD LAIN
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
